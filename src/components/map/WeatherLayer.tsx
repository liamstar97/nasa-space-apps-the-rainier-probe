'use client'
import { useMap } from 'react-leaflet'
import { useEffect, useState } from 'react'
import { Box, Button, VStack, Text } from '@chakra-ui/react'
import { Slider } from '@chakra-ui/react'
import L from 'leaflet'
// import parseGeoraster from 'georaster'
// import GeoRasterLayer from 'georaster-layer-for-leaflet'

interface WeatherLayerProps {
  map: L.Map
  dataType: 'precipitation' | 'temperature' | null
  onClose: () => void
  latestSearch?: { lat: number; lon: number; name?: string }
}

interface WeatherData {
  url: string
  colorScheme: string
  min: number
  max: number
  unit: string
}

const WEATHER_DATA: Record<string, WeatherData> = {
  precipitation: {
    url: 'https://gpm1.gesdisc.eosdis.nasa.gov/data/GPM_L3/GPM_3IMERGDF.06/{z}/{x}/{y}.tif',
    colorScheme: 'precipitation',
    min: 0,
    max: 50,
    unit: 'mm/hr'
  },
  temperature: {
    url: 'https://modis.gsfc.nasa.gov/data/MODIS_Composites/MOLT/MOD11A2.061/{z}/{x}/{y}.tif',
    colorScheme: 'temperature',
    min: -40,
    max: 40,
    unit: '°C'
  }
}

// Color schemes for different data types
const COLOR_SCHEMES = {
  precipitation: {
    colors: ['#000080', '#0000FF', '#00FFFF', '#00FF00', '#FFFF00', '#FF0000', '#800000'],
    positions: [0, 0.1, 0.2, 0.4, 0.6, 0.8, 1.0]
  },
  temperature: {
    colors: ['#000080', '#0000FF', '#00FFFF', '#00FF00', '#FFFF00', '#FF8000', '#FF0000'],
    positions: [0, 0.2, 0.4, 0.5, 0.6, 0.8, 1.0]
  }
}

export default function WeatherLayer({ map, dataType, onClose, latestSearch }: WeatherLayerProps) {
  const [opacity, setOpacity] = useState(0.7)
  const [layer, setLayer] = useState<L.Layer | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    console.log('WeatherLayer useEffect - dataType:', dataType)
    if (dataType && map) {
      loadWeatherData(dataType)
    }

    return () => {
      if (layer) {
        map.removeLayer(layer)
      }
    }
  }, [dataType, map])

  const loadWeatherData = async (type: 'precipitation' | 'temperature') => {
    console.log('Loading weather data for type:', type)
    setLoading(true)
    setError(null)

    try {
      // Remove existing layer
      if (layer) {
        console.log('Removing existing layer')
        map.removeLayer(layer)
        setLayer(null)
      }

      const weatherConfig = WEATHER_DATA[type]

      // Check if we have a searched location
      if (!latestSearch) {
        setError('Please search for a location first to view weather data.')
        setLoading(false)
        return
      }

      // Create a layer group to hold weather elements
      const weatherLayerGroup = L.layerGroup()

      // Generate weather data for the searched location only
      let value, color, size
      if (type === 'precipitation') {
        // Precipitation: 0-25 mm/hr with varying intensity
        value = Math.random() * 25
        if (value < 1) color = '#87CEEB' // Light blue - light rain
        else if (value < 5) color = '#4682B4' // Steel blue - moderate rain
        else if (value < 10) color = '#0066CC' // Blue - heavy rain
        else color = '#003366' // Dark blue - very heavy rain
        size = 15 + (value / 25) * 20 // Size based on intensity
      } else {
        // Temperature: -10°C to 35°C
        value = -10 + Math.random() * 45
        if (value < 0) color = '#4169E1' // Royal blue - very cold
        else if (value < 10) color = '#87CEEB' // Sky blue - cold
        else if (value < 20) color = '#90EE90' // Light green - mild
        else if (value < 30) color = '#FFD700' // Gold - warm
        else color = '#FF4500' // Orange red - hot
        size = 12 + Math.abs(value - 15) / 5 // Size based on temperature deviation
      }

      // Create circle marker for the searched location
      const marker = L.circleMarker([latestSearch.lat, latestSearch.lon], {
        radius: size,
        fillColor: color,
        color: color,
        weight: 3,
        opacity: opacity,
        fillOpacity: opacity * 0.7
      })

      // Add popup with weather data for the specific location
      marker.bindPopup(`
        <div style="text-align: center; min-width: 150px;">
          <h4 style="margin: 0 0 8px 0; color: ${color};">${type === 'precipitation' ? '🌧️' : '🌡️'}</h4>
          <p style="margin: 0; font-size: 12px; color: #666; font-weight: bold;">
            ${latestSearch.name || `Location (${latestSearch.lat.toFixed(4)}, ${latestSearch.lon.toFixed(4)})`}
          </p>
          <p style="margin: 4px 0; font-size: 14px; font-weight: bold;">
            ${type === 'precipitation' ? 'Precipitation' : 'Temperature'}
          </p>
          <p style="margin: 4px 0; font-size: 18px; font-weight: bold; color: ${color};">
            ${value.toFixed(1)} ${weatherConfig.unit}
          </p>
          <p style="margin: 0; font-size: 12px; color: #666;">
            ${type === 'precipitation' 
              ? value < 1 ? 'Light rain' : value < 5 ? 'Moderate rain' : value < 10 ? 'Heavy rain' : 'Very heavy rain'
              : value < 0 ? 'Very cold' : value < 10 ? 'Cold' : value < 20 ? 'Mild' : value < 30 ? 'Warm' : 'Hot'
            }
          </p>
        </div>
      `)

      weatherLayerGroup.addLayer(marker)

      weatherLayerGroup.addTo(map)
      setLayer(weatherLayerGroup)
      console.log('Weather layer added to map for location:', latestSearch.name || `${latestSearch.lat}, ${latestSearch.lon}`)
      setLoading(false)

    } catch (err) {
      console.error('Error loading weather data:', err)
      setError('Failed to load weather data. Please try again.')
      setLoading(false)
    }
  }

  const updateOpacity = (newOpacity: number) => {
    setOpacity(newOpacity)
    if (layer && layer instanceof L.LayerGroup) {
      layer.eachLayer((marker) => {
        if (marker instanceof L.CircleMarker) {
          marker.setStyle({ 
            opacity: newOpacity,
            fillOpacity: newOpacity * 0.7 
          })
        }
      })
    }
  }

  console.log('WeatherLayer render - dataType:', dataType, 'layer:', layer)

  if (!dataType) {
    console.log('WeatherLayer: No dataType, not rendering')
    return null
  }

  const weatherConfig = WEATHER_DATA[dataType]

  return (
    <Box
      position="absolute"
      top="10px"
      left="320px"
      zIndex={1000}
      bg="bg"
      p={3}
      borderRadius="md"
      boxShadow="lg"
      border="1px solid"
      borderColor="border"
      minW="250px"
    >
      <VStack gap={3} align="stretch">
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Text fontSize="sm" fontWeight="bold" color="fg">
            {dataType === 'precipitation' ? 'Precipitation' : 'Temperature'} - {layer ? 'Active' : 'Loading...'}
          </Text>
          <Button size="xs" onClick={onClose}>
            ×
          </Button>
        </Box>

        {latestSearch && (
          <Box>
            <Text fontSize="xs" color="fg.muted">
              Location: {latestSearch.name || `${latestSearch.lat.toFixed(4)}, ${latestSearch.lon.toFixed(4)}`}
            </Text>
          </Box>
        )}

        {loading && (
          <Text fontSize="sm" color="fg.muted">
            Loading weather data...
          </Text>
        )}

        {error && (
          <Text fontSize="sm" color="red.500">
            {error}
          </Text>
        )}

        <Box>
          <Text fontSize="sm" color="fg" mb={2}>
            Opacity: {Math.round(opacity * 100)}%
          </Text>
          <Slider.Root
            value={[opacity]}
            onValueChange={(details) => updateOpacity(details.value[0])}
            min={0}
            max={1}
            step={0.1}
            size="sm"
          >
            <Slider.Control>
              <Slider.Track>
                <Slider.Range />
              </Slider.Track>
              <Slider.Thumb index={0} />
            </Slider.Control>
          </Slider.Root>
        </Box>

        <Box>
          <Text fontSize="xs" color="fg.muted">
            Range: {weatherConfig.min} - {weatherConfig.max} {weatherConfig.unit}
          </Text>
        </Box>

        <Button
          size="sm"
          colorScheme="blue"
          onClick={() => loadWeatherData(dataType)}
          loading={loading}
        >
          Refresh Data
        </Button>
      </VStack>
    </Box>
  )
}
