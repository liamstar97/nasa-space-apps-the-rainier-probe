import json
import os
import uuid
import boto3
from datetime import datetime, date
from decimal import Decimal

import earthaccess
import xarray as xr
import pandas as pd
import numpy as np

# Initialize AWS clients
dynamodb = boto3.resource('dynamodb')
lambda_client = boto3.client('lambda')


def convert_floats_to_decimal(obj):
    """Convert float values to Decimal for DynamoDB compatibility"""
    if isinstance(obj, float):
        return Decimal(str(obj))
    elif isinstance(obj, dict):
        return {k: convert_floats_to_decimal(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [convert_floats_to_decimal(item) for item in obj]
    return obj


def convert_decimals_to_float(obj):
    """Convert Decimal values back to float for JSON serialization"""
    if isinstance(obj, Decimal):
        return float(obj)
    elif isinstance(obj, dict):
        return {k: convert_decimals_to_float(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [convert_decimals_to_float(item) for item in obj]
    return obj


def pull_data(date, latitude, longitude, keep_variables=[], buffer=0.5, subset=True):
    # search for a list of data files matching the criteria
    results = earthaccess.search_data(
        short_name='M2T1NXSLV',
        version='5.12.4',
        temporal=(date, date),
        bounding_box=(longitude - buffer, latitude - buffer, longitude + buffer, latitude + buffer),
        count=1
    )

    # load data
    fn = earthaccess.open(results)  # downloading the data, authentication
    print(fn)
    ds = xr.open_mfdataset(fn)  # opens file(s) and combines into single xarray dataset
    print('completed loading data')
    
    # subset by latitude/longitude and by variables
    if subset:
        ds = ds.sel(
            lat=slice(latitude - buffer, latitude + buffer),
            lon=slice(longitude - buffer, longitude + buffer)
        )
    if keep_variables:
        ds = ds[keep_variables]
    
    return ds

def extract_hourly_averages(ds):
    print(f"Extracting hourly averages...")
    hourly_data = {}
    for var in ds.data_vars:
        # Average across lat and lon dimensions, keeping time dimension
        hourly_data[var] = ds[var].mean(dim=['lat', 'lon']).values
    
    return hourly_data


def generate_date_range(date_str, years_back=10):
    # Parse the input date
    input_date = datetime.strptime(date_str, '%Y-%m-%d').date()
    month = input_date.month
    day = input_date.day
    
    dates = []
    
    # Go back the specified number of years from the input date
    for year in range(input_date.year - years_back, input_date.year):
        try:
            # Create date object to validate month/day combination
            date_obj = date(year, month, day)
            dates.append(date_obj.strftime('%Y-%m-%d'))
        except ValueError:
            # Handle leap year edge cases (e.g., Feb 29)
            # Skip invalid dates
            continue
    
    return dates

def pull_multi_year_data(date_str, latitude, longitude, keep_variables=[], buffer=0.5, years_back=10, subset=True):
    # Generate date range
    dates = generate_date_range(date_str, years_back)
    print(f"Pulling data for {len(dates)} years: {dates[0]} to {dates[-1]}")
    
    all_datasets = []
    for i, date_str in enumerate(dates):
        print(f"Processing year {i+1}/{len(dates)}: {date_str}")
        try:
            ds = pull_data(date_str, latitude, longitude, keep_variables, buffer, subset)
            all_datasets.append(ds)
            print(f"  Successfully loaded data for {date_str}")
        except Exception as e:
            print(f"  Error loading data for {date_str}: {str(e)}")
            continue
    
    if not all_datasets:
        raise ValueError("No data could be loaded for any of the specified dates")
    
    return all_datasets



def process_earth_data(job_id, date_str, lat, lon, timezone, table_name):
    """
    Long-running process - fetches and processes Earth data
    Updates DynamoDB with results when complete
    """
    table = dynamodb.Table(table_name)
    
    try:
        # Update status to processing
        table.update_item(
            Key={'jobId': job_id},
            UpdateExpression='SET #status = :status',
            ExpressionAttributeNames={'#status': 'status'},
            ExpressionAttributeValues={':status': 'processing'}
        )
        
        earthaccess.login(strategy='environment')
        
        variables = [
            'T2M',      # 2-meter air temperature (K)
            'PS',       # Surface pressure (Pa)
            'QV2M',     # 2-meter specific humidity (kg/kg)
            'U2M',      # 2-meter eastward wind (m/s)
            'V2M'       # 2-meter northward wind (m/s)
        ]

        # Process 5 years of data (no timeout constraint in async mode)
        all_datasets = pull_multi_year_data(date_str, lat, lon, keep_variables=variables, years_back=5)
        all_hourly_data = []
        for i, ds in enumerate(all_datasets):
            hourly_data = extract_hourly_averages(ds)
            all_hourly_data.append(hourly_data)

        # Average across years for each variable
        averaged_hourly_data = {}
        for var in all_hourly_data[0].keys():
            arrays = [data[var] for data in all_hourly_data]
            stacked = np.stack(arrays)
            averaged_hourly_data[var] = np.mean(stacked, axis=0)

        # Extract noon data
        noon_hour_index = 12
        noon_data = {}
        for var, values in averaged_hourly_data.items():
            noon_data[var] = Decimal(str(float(values[noon_hour_index])))

        # Update DynamoDB with completed results
        table.update_item(
            Key={'jobId': job_id},
            UpdateExpression='SET #status = :status, #result = :result, completedAt = :completedAt',
            ExpressionAttributeNames={
                '#status': 'status',
                '#result': 'result'
            },
            ExpressionAttributeValues={
                ':status': 'completed',
                ':result': noon_data,
                ':completedAt': datetime.utcnow().isoformat()
            }
        )
        
        print(f"Job {job_id} completed successfully")
        
    except Exception as e:
        # Update DynamoDB with error
        table.update_item(
            Key={'jobId': job_id},
            UpdateExpression='SET #status = :status, #error = :error, completedAt = :completedAt',
            ExpressionAttributeNames={
                '#status': 'status',
                '#error': 'error'
            },
            ExpressionAttributeValues={
                ':status': 'failed',
                ':error': str(e),
                ':completedAt': datetime.utcnow().isoformat()
            }
        )
        print(f"Job {job_id} failed: {str(e)}")
        raise


def handler(event, context):
    """
    Main handler - routes to appropriate function based on query type
    """
    print(f"Event received: {json.dumps(event, default=str)}")
    print(f"Event keys: {list(event.keys())}")
    
    # Get the field name (query type) from the event
    # Try multiple possible locations for field name
    field_name = event.get('info', {}).get('fieldName', '')
    
    # If not in info.fieldName, check other common locations
    if not field_name:
        field_name = event.get('fieldName', '')
    if not field_name:
        field_name = event.get('operation', '')
    
    print(f"Field name detected: '{field_name}'")
    print(f"Info object: {json.dumps(event.get('info', {}), default=str)}")
    
    # Get table name from environment
    table_name = os.environ.get('DYNAMODB_TABLE_NAME')
    print(f"Table name: {table_name}")
    
    if field_name == 'startEarthAccessJob':
        try:
            print("Starting async job...")
            # Quick response - create job and return ID
            job_id = str(uuid.uuid4())
            date_str = event['arguments']['date']
            lat = event['arguments']['lat']
            lon = event['arguments']['long']
            timezone = event['arguments']['timezone']
            
            print(f"Job ID: {job_id}, Date: {date_str}, Lat: {lat}, Lon: {lon}")
            
            # Create job record in DynamoDB
            if not table_name:
                raise ValueError("DYNAMODB_TABLE_NAME environment variable not set")
            
            table = dynamodb.Table(table_name)
            table.put_item(Item={
                'jobId': job_id,
                'status': 'pending',
                'lat': Decimal(str(lat)),
                'long': Decimal(str(lon)),
                'date': date_str,
                'timezone': timezone,
                'createdAt': datetime.utcnow().isoformat()
            })
            print(f"Created DynamoDB record for job {job_id}")
            
            # Invoke Lambda asynchronously to process data
            response = lambda_client.invoke(
                FunctionName=context.function_name,
                InvocationType='Event',  # Async invocation
                Payload=json.dumps({
                    'processJob': True,
                    'jobId': job_id,
                    'date': date_str,
                    'lat': lat,
                    'long': lon,
                    'timezone': timezone,
                    'tableName': table_name
                })
            )
            print(f"Async Lambda invocation response: {response['StatusCode']}")
            
            return job_id
        except Exception as e:
            print(f"Error in startEarthAccessJob: {str(e)}")
            import traceback
            traceback.print_exc()
            raise
    
    elif field_name == 'getEarthAccessJobStatus':
        try:
            print("Getting job status...")
            # Query job status from DynamoDB
            job_id = event['arguments']['jobId']
            
            if not table_name:
                raise ValueError("DYNAMODB_TABLE_NAME environment variable not set")
            
            table = dynamodb.Table(table_name)
            response = table.get_item(Key={'jobId': job_id})
            
            if 'Item' not in response:
                print(f"Job {job_id} not found")
                return {
                    'status': 'not_found',
                    'error': 'Job not found'
                }
            
            item = response['Item']
            print(f"Job {job_id} status: {item.get('status')}")
            
            # Convert Decimal values to float for JSON serialization
            result = convert_decimals_to_float(item.get('result'))
            
            return {
                'status': item.get('status'),
                'result': result,
                'error': item.get('error'),
                'createdAt': item.get('createdAt'),
                'completedAt': item.get('completedAt')
            }
        except Exception as e:
            print(f"Error in getEarthAccessJobStatus: {str(e)}")
            import traceback
            traceback.print_exc()
            raise
    
    elif event.get('processJob'):
        # This is the async worker invocation
        print(f"Processing job asynchronously: {event.get('jobId')}")
        process_earth_data(
            event['jobId'],
            event['date'],
            event['lat'],
            event['long'],
            event['timezone'],
            event['tableName']
        )
        return {'status': 'processed'}
    
    else:
        # Original synchronous handler (for backward compatibility)
        print("Using synchronous handler (earthaccess query)")
        print(f"Arguments: {json.dumps(event.get('arguments', {}), default=str)}")
        
        # Check if this is actually a synchronous earthaccess call
        if 'arguments' not in event or 'date' not in event.get('arguments', {}):
            raise ValueError(f"Unknown query type or missing arguments. Field name: '{field_name}', Event keys: {list(event.keys())}")
        
        earthaccess.login(strategy='environment')
        
        date_str = event['arguments']['date']
        lat = event['arguments']['lat']
        lon = event['arguments']['long']
        timezone = event['arguments']['timezone']
        variables = [
            'T2M',      # 2-meter air temperature (K)
            'PS',       # Surface pressure (Pa)
            'QV2M',     # 2-meter specific humidity (kg/kg)
            'U2M',      # 2-meter eastward wind (m/s)
            'V2M'       # 2-meter northward wind (m/s)
        ]

        # Reduced to 2 years to stay within API Gateway 30-second timeout
        all_datasets = pull_multi_year_data(date_str, lat, lon, keep_variables=variables, years_back=2)
        all_hourly_data = []
        for i, ds in enumerate(all_datasets):
            hourly_data = extract_hourly_averages(ds)
            all_hourly_data.append(hourly_data)

        # Average across years for each variable
        averaged_hourly_data = {}
        for var in all_hourly_data[0].keys():
            arrays = [data[var] for data in all_hourly_data]
            stacked = np.stack(arrays)
            averaged_hourly_data[var] = np.mean(stacked, axis=0)

        noon_hour_index = 12
        noon_data = {}
        for var, values in averaged_hourly_data.items():
            noon_data[var] = str(values[noon_hour_index])

        return {
          "statusCode": 200,
          "body": json.dumps({
              "message": noon_data,
          }),
      }
