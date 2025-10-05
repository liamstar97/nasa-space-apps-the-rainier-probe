'use client'
import { useState, useEffect, useRef } from 'react'
import { Box, Input, Button, Text } from '@chakra-ui/react'
import DatePicker from 'react-datepicker'

interface SearchBoxProps {
  onLocationSearch: (location: string) => void
  onCoordinateSearch: (lat: number, lon: number) => void
  latestSearch?: { lat: number; lon: number; name?: string }
  onDateChange?: (date: string) => void
}

interface Suggestion {
  display_name: string
  lat: string
  lon: string
}

export default function SearchBox({ onLocationSearch, onCoordinateSearch, latestSearch, onDateChange }: SearchBoxProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const [latitude, setLatitude] = useState('')
  const [longitude, setLongitude] = useState('')
  const [selectedDate, setSelectedDate] = useState(new Date())
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<NodeJS.Timeout | null>(null)

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
      setSearchTerm('')
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
    handleSearch(suggestion.display_name)
  }

  const handleCoordinateSearch = () => {
    const lat = parseFloat(latitude)
    const lon = parseFloat(longitude)
    
    if (!isNaN(lat) && !isNaN(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) {
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
    <Box position="absolute" top="10px" left="10px" zIndex={1000} bg="white" p={3} borderRadius="md" boxShadow="lg" minW="300px">
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
            onFocus={() => setShowSuggestions(suggestions.length > 0)}
            size="sm"
            color="black"
            _placeholder={{ color: "gray.500" }}
          />
          
          {showSuggestions && suggestions.length > 0 && (
            <Box
              position="absolute"
              top="100%"
              left="0"
              right="0"
              bg="white"
              border="1px solid"
              borderColor="gray.200"
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
                  bg={index === selectedIndex ? "blue.50" : "white"}
                  _hover={{ bg: "gray.50" }}
                  onClick={() => handleSuggestionClick(suggestion)}
                  borderBottom={index < suggestions.length - 1 ? "1px solid" : "none"}
                  borderColor="gray.100"
                >
                  <Text fontSize="sm" color="black" overflow="hidden" textOverflow="ellipsis" whiteSpace="nowrap">
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
        <Text fontSize="xs" color="gray.600" mb={1}>Or enter coordinates:</Text>
        <Box display="flex" gap={2} alignItems="center">
          <Input
            placeholder="Latitude"
            value={latitude}
            onChange={(e) => setLatitude(e.target.value)}
            onKeyPress={handleCoordinateKeyPress}
            size="sm"
            color="black"
            _placeholder={{ color: "gray.500" }}
            type="number"
            step="any"
          />
          <Input
            placeholder="Longitude"
            value={longitude}
            onChange={(e) => setLongitude(e.target.value)}
            onKeyPress={handleCoordinateKeyPress}
            size="sm"
            color="black"
            _placeholder={{ color: "gray.500" }}
            type="number"
            step="any"
          />
          <Button size="sm" colorScheme="green" onClick={handleCoordinateSearch}>
            Go
          </Button>
        </Box>
      </Box>


      {/* Date Picker */}
      <Box mb={3}>
        <Text fontSize="xs" color="gray.600" mb={1}>Select Date:</Text>
        <DatePicker
          selected={selectedDate}
          onChange={handleDateChange}
          dateFormat="yyyy-MM-dd"
          showPopperArrow={false}
          popperPlacement="bottom-start"
          customInput={
            <Input
              size="sm"
              color="black"
              cursor="pointer"
              _hover={{ borderColor: "blue.300" }}
              _focus={{ borderColor: "blue.500", boxShadow: "0 0 0 1px #3182ce" }}
              readOnly
            />
          }
        />
      </Box>

      {/* Latest Search Display */}
      {latestSearch && (
        <Box mt={3} p={2} bg="gray.50" borderRadius="md" border="1px solid" borderColor="gray.200">
          <Text fontSize="xs" color="gray.600" mb={1}>Latest Search:</Text>
          {latestSearch.name && (
            <Text fontSize="sm" fontWeight="bold" color="black" mb={1}>
              {latestSearch.name}
            </Text>
          )}
          <Text fontSize="xs" color="gray.700">
            <strong>Lat:</strong> {latestSearch.lat.toFixed(6)} | <strong>Lon:</strong> {latestSearch.lon.toFixed(6)}
          </Text>
        </Box>
      )}
    </Box>
  )
}