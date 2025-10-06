'use client'
import { useState, useEffect, useRef } from 'react'
import { Box, Input, Button, Text } from '@chakra-ui/react'
import { useColorMode } from '@/components/ui/color-mode'
import DatePicker from 'react-datepicker'

interface SearchBoxProps {
  onLocationSearch: (location: string) => void
  onCoordinateSearch: (lat: number, lon: number) => void
  latestSearch?: { lat: number; lon: number; name?: string }
  onDateChange?: (date: string) => void
  onShowWeatherData?: () => void
  showWeatherData?: boolean
}

interface Suggestion {
  display_name: string
  lat: string
  lon: string
}

export default function SearchBox({ onLocationSearch, onCoordinateSearch, latestSearch, onDateChange, onShowWeatherData, showWeatherData }: SearchBoxProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const [latitude, setLatitude] = useState('')
  const [longitude, setLongitude] = useState('')
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [hasBeenSearched, setHasBeenSearched] = useState(false)
  const [lastSearchedTerm, setLastSearchedTerm] = useState('')
  const [isClient, setIsClient] = useState(false)
  const { colorMode } = useColorMode()
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<NodeJS.Timeout | null>(null)

  // Set client-side flag after hydration
  useEffect(() => {
    setIsClient(true)
  }, [])

  // Apply dark class to body for CSS selectors
  useEffect(() => {
    if (colorMode === 'dark') {
      document.body.classList.add('dark')
    } else {
      document.body.classList.remove('dark')
    }
  }, [colorMode])

  // Debounced search for suggestions
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }

    if (searchTerm.length > 2) {
      debounceRef.current = setTimeout(async () => {
        try {
          const response = await fetch(
            `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchTerm)}&limit=5&addressdetails=1`
          )
          const data = await response.json()
          setSuggestions(data)
          setShowSuggestions(true)
          setSelectedIndex(-1)
        } catch (error) {
          console.error('Error fetching suggestions:', error)
        }
      }, 300)
    } else {
      setSuggestions([])
      setShowSuggestions(false)
    }

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    }
  }, [searchTerm])

  const handleSearch = (location?: string) => {
    const searchLocation = location || searchTerm.trim()
    if (searchLocation) {
      onLocationSearch(searchLocation)
      setShowSuggestions(false)
      // Keep the search term in the input to show what was searched
      setSearchTerm(searchLocation)
      setLastSearchedTerm(searchLocation)
      setHasBeenSearched(true)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (selectedIndex >= 0 && suggestions[selectedIndex]) {
        handleSearch(suggestions[selectedIndex].display_name)
      } else {
        handleSearch()
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex(prev => 
        prev < suggestions.length - 1 ? prev + 1 : prev
      )
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex(prev => prev > 0 ? prev - 1 : -1)
    } else if (e.key === 'Escape') {
      setShowSuggestions(false)
      setSelectedIndex(-1)
    }
  }

  const handleSuggestionClick = (suggestion: Suggestion) => {
    // Auto-populate coordinates when location is selected
    setLatitude(suggestion.lat)
    setLongitude(suggestion.lon)
    handleSearch(suggestion.display_name)
  }

  const handleCoordinateSearch = async () => {
    const lat = parseFloat(latitude)
    const lon = parseFloat(longitude)
    
    if (!isNaN(lat) && !isNaN(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) {
      try {
        // Reverse geocoding to get location name
        const response = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&addressdetails=1`
        )
        const data = await response.json()
        
        // Auto-populate location search field with the found name
        if (data && data.display_name) {
          setSearchTerm(data.display_name)
        }
      } catch (error) {
        console.error('Error reverse geocoding:', error)
        // Still proceed with coordinate search even if reverse geocoding fails
      }
      
      onCoordinateSearch(lat, lon)
      setLatitude('')
      setLongitude('')
    } else {
      alert('Please enter valid coordinates:\nLatitude: -90 to 90\nLongitude: -180 to 180')
    }
  }

  const handleCoordinateKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleCoordinateSearch()
    }
  }

  const handleDateChange = (date: Date | null) => {
    if (date) {
      setSelectedDate(date)
      if (onDateChange) {
        onDateChange(date.toISOString().split('T')[0])
      }
    }
  }

  return (
    <Box position="absolute" top="10px" left="10px" zIndex={1000} bg="bg" p={3} borderRadius="md" minW="300px" border="3px solid" borderColor="#3388ff">
      {/* Location Search */}
      <Box display="flex" gap={2} mb={3}>
        <Box position="relative" flex="1">
                <Input
                  ref={inputRef}
                  placeholder="Search for a location..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyPress={handleKeyPress}
                  onKeyDown={handleKeyPress}
                  onFocus={() => {
                    // Clear the search bar if it has been searched before
                    if (hasBeenSearched) {
                      setSearchTerm('')
                      setHasBeenSearched(false)
                    }
                    setShowSuggestions(suggestions.length > 0)
                  }}
                  onBlur={() => {
                    // Delay to allow click events on suggestions to fire first
                    setTimeout(() => {
                      // If user focused but didn't search, restore the last searched term
                      if (!hasBeenSearched && lastSearchedTerm && !searchTerm.trim()) {
                        setSearchTerm(lastSearchedTerm)
                      }
                      setShowSuggestions(false)
                    }, 150)
                  }}
                  size="sm"
                  color="fg"
                  _placeholder={{ color: "fg.muted" }}
                />
          
          {showSuggestions && suggestions.length > 0 && (
            <Box
              position="absolute"
              top="100%"
              left="0"
              right="0"
              bg="bg"
              border="1px solid"
              borderColor="border"
              borderRadius="md"
              boxShadow="lg"
              maxH="200px"
              overflowY="auto"
              zIndex={1001}
            >
              {suggestions.map((suggestion, index) => (
                <Box
                  key={index}
                  p={2}
                  cursor="pointer"
                  bg={index === selectedIndex ? "accent" : "bg"}
                  _hover={{ bg: "bg.muted" }}
                  onClick={() => handleSuggestionClick(suggestion)}
                  borderBottom={index < suggestions.length - 1 ? "1px solid" : "none"}
                  borderColor="border"
                >
                  <Text fontSize="sm" color="fg" overflow="hidden" textOverflow="ellipsis" whiteSpace="nowrap">
                    {suggestion.display_name}
                  </Text>
                </Box>
              ))}
            </Box>
          )}
        </Box>
        
        <Button size="sm" colorScheme="blue" onClick={() => handleSearch()}>
          Search
        </Button>
      </Box>

      {/* Coordinate Search */}
      <Box>
        <Box display="flex" gap={2} alignItems="center">
          <Input
            placeholder="Latitude"
            value={latitude}
            onChange={(e) => setLatitude(e.target.value)}
            onKeyPress={handleCoordinateKeyPress}
            size="sm"
            color="fg"
            _placeholder={{ color: "fg.muted" }}
            type="number"
            step="any"
          />
          <Input
            placeholder="Longitude"
            value={longitude}
            onChange={(e) => setLongitude(e.target.value)}
            onKeyPress={handleCoordinateKeyPress}
            size="sm"
            color="fg"
            _placeholder={{ color: "fg.muted" }}
            type="number"
            step="any"
          />
          <Button size="sm" colorScheme="green" onClick={handleCoordinateSearch}>
            Go
          </Button>
        </Box>
      </Box>


      {/* Date Picker */}
      <Box mb={3} display="flex" gap={2} alignItems="center">
        <DatePicker
          selected={selectedDate}
          onChange={handleDateChange}
          dateFormat="yyyy-MM-dd"
          showPopperArrow={false}
          popperPlacement="bottom-start"
          wrapperClassName={"date-picker-wrapper " + (isClient && colorMode === 'dark' ? 'dark' : '')}
          customInput={
            <Input
              size="sm"
                    color="fg"
                    cursor="pointer"
                    _hover={{ borderColor: "accent" }}
                    _focus={{ borderColor: "accent", boxShadow: "0 0 0 1px var(--chakra-colors-accent)" }}
              readOnly
            />
          }
        />
        <Button size="sm" colorScheme="purple" onClick={onShowWeatherData} minW="140px">
          {showWeatherData ? "Hide Weather Data" : "Get Weather Data"}
        </Button>
      </Box>

    </Box>
  )
}