'use client'
import { useMap } from 'react-leaflet'
import { useEffect, useState, useCallback, useRef } from 'react'
import { Box, HStack, Text, VStack } from '@chakra-ui/react'
import L from 'leaflet'
import { generateClient } from "aws-amplify/data"
import type { Schema } from "../../../amplify/data/resource"
import { Amplify } from "aws-amplify"
import outputs from "@/../amplify_outputs.json"

Amplify.configure(outputs)
const client = generateClient<Schema>()

// Function to determine timezone based on coordinates
function getTimezoneFromCoordinates(lat: number, lon: number): string {
  // Simple timezone mapping based on longitude ranges
  // This is a basic approximation - in production you'd want a more sophisticated timezone library
  
  if (lon >= -180 && lon < -165) return "Pacific/Midway" // Hawaii-Aleutian
  if (lon >= -165 && lon < -150) return "Pacific/Honolulu" // Hawaii
  if (lon >= -150 && lon < -135) return "America/Anchorage" // Alaska
  if (lon >= -135 && lon < -120) return "America/Los_Angeles" // Pacific
  if (lon >= -120 && lon < -105) return "America/Denver" // Mountain
  if (lon >= -105 && lon < -90) return "America/Chicago" // Central
  if (lon >= -90 && lon < -75) return "America/New_York" // Eastern
  if (lon >= -75 && lon < -60) return "America/Halifax" // Atlantic
  if (lon >= -60 && lon < -45) return "America/St_Johns" // Newfoundland
  if (lon >= -45 && lon < -30) return "Atlantic/Azores" // Azores
  if (lon >= -30 && lon < -15) return "Atlantic/Cape_Verde" // Cape Verde
  if (lon >= -15 && lon < 0) return "Europe/London" // GMT
  if (lon >= 0 && lon < 15) return "Europe/Paris" // CET
  if (lon >= 15 && lon < 30) return "Europe/Athens" // EET
  if (lon >= 30 && lon < 45) return "Europe/Moscow" // MSK
  if (lon >= 45 && lon < 60) return "Asia/Dubai" // GST
  if (lon >= 60 && lon < 75) return "Asia/Karachi" // PKT
  if (lon >= 75 && lon < 90) return "Asia/Kolkata" // IST
  if (lon >= 90 && lon < 105) return "Asia/Bangkok" // ICT
  if (lon >= 105 && lon < 120) return "Asia/Shanghai" // CST
  if (lon >= 120 && lon < 135) return "Asia/Tokyo" // JST
  if (lon >= 135 && lon < 150) return "Australia/Adelaide" // ACST
  if (lon >= 150 && lon < 165) return "Australia/Sydney" // AEST
  if (lon >= 165 && lon < 180) return "Pacific/Auckland" // NZST
  
  // Default fallback
  return "UTC"
}

interface WeatherDataLayerProps {
  map: L.Map
  latestSearch?: { lat: number; lon: number; name?: string }
  selectedDate?: string
  showWeatherData?: boolean
}

interface WeatherData {
  value: number
  color: string
  condition: string
}

type JobStatus = {
  status: string;
  result?: Record<string, number>;
  error?: string;
  createdAt?: string;
  completedAt?: string;
};

export default function WeatherDataLayer({ map, latestSearch, selectedDate, showWeatherData }: WeatherDataLayerProps) {
  const [precipitationData, setPrecipitationData] = useState<WeatherData | null>(null)
  const [temperatureData, setTemperatureData] = useState<WeatherData | null>(null)
  const [weatherMarker, setWeatherMarker] = useState<L.Marker | null>(null)
  const [loading, setLoading] = useState(false)
  const [jobStatus, setJobStatus] = useState<string>('')
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // Clean up polling on unmount
  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current)
      }
    }
  }, [])

  // Poll for job status
  const pollJobStatus = useCallback(async (jobId: string) => {
    try {
      const { data, errors } = await client.queries.getEarthAccessJobStatus({
        jobId: jobId,
      })

      if (errors) {
        console.error('Error polling job status:', errors)
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current)
        }
        setLoading(false)
        setJobStatus('error')
        return
      }

      if (data) {
        // Parse the response if it's a string
        let status: JobStatus
        if (typeof data === 'string') {
          status = JSON.parse(data) as JobStatus
        } else {
          status = data as unknown as JobStatus
        }
        
        console.log('Job status:', status.status)
        setJobStatus(status.status)

        if (status.status === 'completed' && status.result) {
          // Stop polling
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current)
          }
          
          console.log('Job completed with results:', status.result)
          
          // Process the results
          processWeatherResults(status.result)
          setLoading(false)
        } else if (status.status === 'failed') {
          console.error('Job failed:', status.error)
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current)
          }
          setLoading(false)
          setJobStatus('failed')
          
          // Fall back to demo data
          generateDemoData()
        }
      }
    } catch (err) {
      console.error('Error polling job status:', err)
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current)
      }
      setLoading(false)
      generateDemoData()
    }
  }, [latestSearch])

  // Process weather results from the backend
  const processWeatherResults = useCallback((result: Record<string, number>) => {
    if (!latestSearch) return

    console.log('Processing weather results:', result)
    
    // Extract weather data from backend
    let tempValue = 15 // Default fallback
    let precipValue = 0 // Default fallback
    
    // T2M is in Kelvin, convert to Celsius
    if (result.T2M !== undefined) {
      tempValue = result.T2M - 273.15
      console.log('Temperature (T2M):', tempValue, '°C')
    }
    
    // QV2M is specific humidity (kg/kg), we can use it as a proxy for precipitation likelihood
    // This is a rough approximation - higher humidity might indicate more precipitation
    if (result.QV2M !== undefined) {
      // Convert specific humidity to a precipitation estimate (very rough approximation)
      // QV2M typically ranges from 0 to 0.02+ kg/kg
      precipValue = result.QV2M * 500 // Scale to mm/day roughly
      console.log('Precipitation estimate from QV2M:', precipValue, 'mm/day')
    }
    
    // Log other available data
    if (result.PS !== undefined) console.log('Surface Pressure (PS):', result.PS, 'Pa')
    if (result.U2M !== undefined) console.log('Eastward Wind (U2M):', result.U2M, 'm/s')
    if (result.V2M !== undefined) console.log('Northward Wind (V2M):', result.V2M, 'm/s')
    
    const precipColor = precipValue < 1 ? '#87CEEB' : 
                       precipValue < 5 ? '#4682B4' : 
                       precipValue < 10 ? '#0066CC' : '#003366'

    const tempColor = tempValue < 0 ? '#4169E1' : 
                     tempValue < 10 ? '#87CEEB' : 
                     tempValue < 20 ? '#90EE90' : 
                     tempValue < 30 ? '#FFD700' : '#FF4500'

    setPrecipitationData({ 
      value: precipValue, 
      color: precipColor, 
      condition: precipValue < 1 ? 'Low humidity' : precipValue < 5 ? 'Moderate humidity' : precipValue < 10 ? 'High humidity' : 'Very high humidity'
    })
    setTemperatureData({ 
      value: tempValue, 
      color: tempColor, 
      condition: tempValue < 0 ? 'Very cold' : tempValue < 10 ? 'Cold' : tempValue < 20 ? 'Mild' : tempValue < 30 ? 'Warm' : 'Hot'
    })
    
    console.log('Weather data processed successfully:', { tempValue, precipValue })
  }, [latestSearch])

  // Generate demo data as fallback
  const generateDemoData = useCallback(() => {
    if (!latestSearch) return

    console.log('Generating demo data for location:', latestSearch)
    const lat = latestSearch.lat
    const lon = latestSearch.lon
    
    const baseTemp = 30 - Math.abs(lat) * 0.5
    const tempVariation = (Math.random() - 0.5) * 15
    const tempValue = Math.max(-20, Math.min(45, baseTemp + tempVariation))
    
    const basePrecip = Math.abs(lon) > 100 ? Math.random() * 15 : Math.random() * 8
    const precipValue = Math.max(0, Math.min(25, basePrecip))
    
    const precipColor = precipValue < 1 ? '#87CEEB' : 
                       precipValue < 5 ? '#4682B4' : 
                       precipValue < 10 ? '#0066CC' : '#003366'

    const tempColor = tempValue < 0 ? '#4169E1' : 
                     tempValue < 10 ? '#87CEEB' : 
                     tempValue < 20 ? '#90EE90' : 
                     tempValue < 30 ? '#FFD700' : '#FF4500'

    setPrecipitationData({ 
      value: precipValue, 
      color: precipColor, 
      condition: precipValue < 1 ? 'Light rain' : precipValue < 5 ? 'Moderate rain' : precipValue < 10 ? 'Heavy rain' : 'Very heavy rain'
    })
    setTemperatureData({ 
      value: tempValue, 
      color: tempColor, 
      condition: tempValue < 0 ? 'Very cold' : tempValue < 10 ? 'Cold' : tempValue < 20 ? 'Mild' : tempValue < 30 ? 'Warm' : 'Hot'
    })
    
    console.log('Demo data generated:', { lat, lon, tempValue, precipValue })
  }, [latestSearch])

  const loadWeatherData = useCallback(async () => {
    if (!latestSearch || !selectedDate || !showWeatherData) return

    setLoading(true)
    setJobStatus('starting')
    console.log('Loading weather data for location:', latestSearch.name || `${latestSearch.lat}, ${latestSearch.lon}`, 'on date:', selectedDate)
    
    try {
      // Clear existing data
      setPrecipitationData(null)
      setTemperatureData(null)
      
      // Clear any existing polling
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current)
      }

      // Determine timezone based on coordinates
      const timezone = getTimezoneFromCoordinates(latestSearch.lat, latestSearch.lon)
      
      console.log('Starting async job for weather data...')
      
      // Check if startEarthAccessJob query is available
      if (!client.queries.startEarthAccessJob) {
        console.warn('startEarthAccessJob query not available. Backend may not be deployed yet. Using demo data.')
        throw new Error('DEMO_DATA_FALLBACK')
      }
      
      // Start the async job
      const { data, errors } = await client.queries.startEarthAccessJob({
        long: latestSearch.lon,
        lat: latestSearch.lat,
        date: selectedDate,
        timezone: timezone
      })

      if (errors) {
        console.error('Error starting async job:', errors)
        throw new Error(errors.map((e: { message: string }) => e.message).join(", "))
      } else if (data) {
        const jobId = data as string
        console.log('Async job started with ID:', jobId)
        setJobStatus('pending')
        
        // Start polling for job completion (every 3 seconds)
        pollingIntervalRef.current = setInterval(() => {
          pollJobStatus(jobId)
        }, 3000)
        
        // Also poll immediately
        pollJobStatus(jobId)
      }
    } catch (err) {
      console.error('Error loading weather data:', err)
      console.log('Falling back to demo data')
      setLoading(false)
      generateDemoData()
    }
  }, [latestSearch, selectedDate, showWeatherData, pollJobStatus, generateDemoData])

  // Handle location changes and load weather data
  useEffect(() => {
    if (latestSearch && map && showWeatherData) {
      console.log('Loading weather data for new location:', latestSearch.name || `${latestSearch.lat}, ${latestSearch.lon}`)
      loadWeatherData()
    } else {
      // Clear weather data when no search or when weather data is hidden
      console.log('Clearing weather data - no search location or weather data hidden')
      setPrecipitationData(null)
      setTemperatureData(null)
    }
  }, [latestSearch, map, selectedDate, showWeatherData, loadWeatherData])

  // Manage weather marker lifecycle - separate from data loading
  useEffect(() => {
    // Remove existing marker first
    if (weatherMarker) {
      map.removeLayer(weatherMarker)
      setWeatherMarker(null)
    }

    // Create new marker if we have data OR if we're loading
    if (latestSearch && (precipitationData && temperatureData || loading)) {
      console.log('Creating weather marker for location:', latestSearch.name || `${latestSearch.lat}, ${latestSearch.lon}`)
      const newWeatherMarker = createWeatherMarker()
      if (newWeatherMarker) {
        newWeatherMarker.addTo(map)
        setWeatherMarker(newWeatherMarker)
      }
    }
  }, [precipitationData, temperatureData, latestSearch, map, loading, jobStatus])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (weatherMarker) {
        map.removeLayer(weatherMarker)
      }
    }
  }, [weatherMarker, map])

  const createWeatherMarker = useCallback(() => {
    if (!latestSearch) return null

    // Show loading state if data isn't ready yet
    if (loading || !precipitationData || !temperatureData) {
      const loadingIcon = L.divIcon({
        className: 'weather-marker-loading',
        html: `
          <div style="
            background: white;
            border: 3px solid #3388ff;
            border-radius: 12px;
            padding: 16px;
            text-align: center;
            font-family: Arial, sans-serif;
            min-width: 220px;
          ">
            <div style="font-size: 32px; margin-bottom: 8px;">⏳</div>
            <div style="font-size: 14px; font-weight: bold; color: #3388ff; margin-bottom: 4px;">
              Loading Weather Data
            </div>
            <div style="font-size: 12px; color: #666;">
              Status: ${jobStatus || 'initializing'}
            </div>
            <div style="font-size: 10px; color: #999; margin-top: 4px;">
              This may take 30-60 seconds
            </div>
          </div>
        `,
        iconSize: [240, 120],
        iconAnchor: [120, 120]
      })

      return L.marker([latestSearch.lat, latestSearch.lon], {
        icon: loadingIcon,
        interactive: false
      })
    }

    // Create custom icon with weather data
    const weatherIcon = L.divIcon({
      className: 'weather-marker',
      html: `
        <div style="
          background: white;
          border: 3px solid #3388ff;
          border-radius: 12px;
          padding: 12px;
          text-align: center;
          font-family: Arial, sans-serif;
          min-width: 220px;
        ">
             <div style="display: flex; gap: 16px; align-items: center;">
               <!-- Precipitation -->
               <div style="flex: 1; text-align: center;">
                 <div style="font-size: 24px; margin-bottom: 4px;">🌧️</div>
                 <div style="font-size: 12px; color: #666; margin-bottom: 4px; font-weight: bold;">HUMIDITY</div>
                 <div style="font-size: 16px; font-weight: bold; color: ${precipitationData.color}; margin-bottom: 4px;">
                   ${precipitationData.value.toFixed(1)} mm/day
                 </div>
                 <div style="font-size: 10px; color: #666; background: #f0f0f0; padding: 2px 6px; border-radius: 8px; display: inline-block;">
                   ${precipitationData.condition}
                 </div>
               </div>

               <!-- Temperature -->
               <div style="flex: 1; text-align: center;">
                 <div style="font-size: 24px; margin-bottom: 4px;">🌡️</div>
                 <div style="font-size: 12px; color: #666; margin-bottom: 4px; font-weight: bold;">TEMPERATURE</div>
                 <div style="font-size: 16px; font-weight: bold; color: ${temperatureData.color}; margin-bottom: 4px;">
                   ${temperatureData.value.toFixed(1)}°C
                 </div>
                 <div style="font-size: 10px; color: #666; background: #f0f0f0; padding: 2px 6px; border-radius: 8px; display: inline-block;">
                   ${temperatureData.condition}
                 </div>
               </div>
             </div>
             
        </div>
      `,
      iconSize: [240, 100],
      iconAnchor: [120, 100]
    })

    // Create marker at the searched location
    const weatherMarker = L.marker([latestSearch.lat, latestSearch.lon], {
      icon: weatherIcon,
      interactive: false // Make it non-interactive so it doesn't interfere with map
    })

    return weatherMarker
  }, [latestSearch, precipitationData, temperatureData, loading, jobStatus])

  return null // This component doesn't render anything visible in React
}
