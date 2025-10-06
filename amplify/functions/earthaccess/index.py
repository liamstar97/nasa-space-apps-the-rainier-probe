import json
import os

import earthaccess
import xarray as xr

def pull_data(date, latitude, longitude, keep_variables=[], buffer=0.5, subset=True):
    earthaccess.login(strategy='environment')
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
    
    # subset by latitude/longitude and by variables
    if subset:
        ds = ds.sel(
            lat=slice(latitude - buffer, latitude + buffer),
            lon=slice(longitude - buffer, longitude + buffer)
        )
    if keep_variables:
        ds = ds[keep_variables]
    
    return ds


def handler(event, context):
  print(os.getenv('EARTHDATA_USERNAME'))
  print(os.getenv('EARTHDATA_PASSWORD'))

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
  ds_seattle = pull_data(date_str, seattle_lat, seattle_lon, keep_variables=variables)

  return {
      "statusCode": 200,
      "body": json.dumps({
          "message": len(ds_seattle),
      }),
  }