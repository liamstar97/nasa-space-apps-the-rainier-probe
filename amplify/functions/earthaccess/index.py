import json
import os

import earthaccess
import xarray as xr

import pandas as pd
from datetime import datetime, date
import numpy as np


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



def handler(event, context):
    earthaccess.login(strategy='environment')
    
    # Testing with Seattle
    seattle_lat = 47.6
    seattle_lon = -122.3
    date_str = '2025-08-01'
    variables = [
        'T2M',      # 2-meter air temperature (K)
        'PS',       # Surface pressure (Pa)
        'QV2M',     # 2-meter specific humidity (kg/kg)
        'U2M',      # 2-meter eastward wind (m/s)
        'V2M'       # 2-meter northward wind (m/s)
    ]

    all_datasets = pull_multi_year_data(date_str, seattle_lat, seattle_lon, keep_variables=variables, years_back=5)
    all_hourly_data = []
    for i, ds in enumerate(all_datasets):
        hourly_data = extract_hourly_averages(ds)
        all_hourly_data.append(hourly_data)

    # Now average across years for each variable
    averaged_hourly_data = {}
    for var in all_hourly_data[0].keys():  # Get variable names from first dataset
        # Stack all years for this variable and average
        arrays = [data[var] for data in all_hourly_data]
        stacked = np.stack(arrays)  # Shape: (5 years, 24 hours)
        averaged_hourly_data[var] = np.mean(stacked, axis=0)  # Average across years


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
