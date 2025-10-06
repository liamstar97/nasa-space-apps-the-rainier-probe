'use client'
import { useState } from 'react'
import DynamicMap from "@/components/map/DynamicMap"
import SearchBox from "@/components/map/SearchBox"

export default function Home() {
  const [mapCenter, setMapCenter] = useState<[number, number]>([47.6062, -122.3321])
  const [zoom, setZoom] = useState(13)
  const [latestSearch, setLatestSearch] = useState<{ lat: number; lon: number; name?: string }>({
    lat: 47.6062,
    lon: -122.3321,
    name: "Seattle, WA"
  })
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [showWeatherData, setShowWeatherData] = useState(false)

  const handleLocationSearch = async (location: string) => {
    try {
      // Using OpenStreetMap Nominatim API for geocoding
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(location)}&limit=1`
      )
      const data = await response.json()
      
      if (data && data.length > 0) {
        const { lat, lon, display_name } = data[0]
        const newLat = parseFloat(lat)
        const newLon = parseFloat(lon)
        setMapCenter([newLat, newLon])
        setLatestSearch({
          lat: newLat,
          lon: newLon,
          name: display_name
        })
        setZoom(13)
      } else {
        alert('Location not found. Please try a different search term.')
      }
    } catch (error) {
      console.error('Error searching for location:', error)
      alert('Error searching for location. Please try again.')
    }
  }

  const handleCoordinateSearch = (lat: number, lon: number) => {
    setMapCenter([lat, lon])
    setLatestSearch({
      lat: lat,
      lon: lon,
      name: undefined // No name for coordinate searches
    })
    setZoom(15) // Higher zoom for precise coordinates
  }

  const handleDateChange = (date: string) => {
    setSelectedDate(date)
    console.log('Selected date:', date) // You can add your date logic here
  }

  const handleShowWeatherData = () => {
    setShowWeatherData(!showWeatherData)
  }

  return (
    <div style={{ 
      height: "100vh", 
      width: "100vw", 
      maxHeight: "100vh", 
      maxWidth: "100vw",
      overflow: "hidden",
      position: "relative"
    }}>
      <SearchBox 
        onLocationSearch={handleLocationSearch} 
        onCoordinateSearch={handleCoordinateSearch}
        latestSearch={latestSearch}
        onDateChange={handleDateChange}
        onShowWeatherData={handleShowWeatherData}
        showWeatherData={showWeatherData}
      />
      <DynamicMap 
        posix={mapCenter} 
        zoom={zoom} 
        latestSearch={latestSearch} 
        selectedDate={selectedDate}
        showWeatherData={showWeatherData}
      />
    </div>
  );
}