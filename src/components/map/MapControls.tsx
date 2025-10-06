'use client'
import { useMap } from 'react-leaflet'
import { useColorMode } from '@/components/ui/color-mode'
import { Box, IconButton } from '@chakra-ui/react'
import { LuMoon, LuSun } from 'react-icons/lu'

interface MapControlsProps {
  latestSearch?: { lat: number; lon: number; name?: string }
}

export default function MapControls({ latestSearch }: MapControlsProps) {
  const map = useMap()
  const { colorMode, toggleColorMode } = useColorMode()

  const handleRecenter = () => {
    if (latestSearch) {
      map.setView([latestSearch.lat, latestSearch.lon], 13)
    }
  }

  return (
    <>
      <Box
        position="absolute"
        top="10px"
        right="10px"
        zIndex={1000}
        bg="white"
        p={2}
        borderRadius="md"
        border="3px solid"
        borderColor="#3388ff"
        display="flex"
        flexDirection="column"
        gap="8px"
      >
        {/* Color Mode Toggle */}
        <IconButton
          size="sm"
          variant="outline"
          bg="white"
          border="1px solid"
          borderColor="gray.300"
          borderRadius="4px"
          width="30px"
          height="30px"
          onClick={toggleColorMode}
          aria-label="Toggle color mode"
          _hover={{ bg: "gray.50" }}
        >
          {colorMode === 'dark' ? <LuMoon /> : <LuSun />}
        </IconButton>


        {/* Recenter Button */}
        {latestSearch && (
          <IconButton
            size="sm"
            variant="outline"
            bg="white"
            border="1px solid"
            borderColor="gray.300"
            borderRadius="4px"
            width="30px"
            height="30px"
            fontSize="16px"
            onClick={handleRecenter}
            aria-label="Recenter on latest search"
            _hover={{ bg: "gray.50" }}
          >
            📍
          </IconButton>
        )}

        {/* Zoom In Button */}
        <IconButton
          size="sm"
          variant="outline"
          bg="white"
          border="1px solid"
          borderColor="gray.300"
          borderRadius="4px"
          width="30px"
          height="30px"
          fontSize="18px"
          onClick={() => map.zoomIn()}
          aria-label="Zoom in"
          _hover={{ bg: "gray.50" }}
        >
          +
        </IconButton>

        {/* Zoom Out Button */}
        <IconButton
          size="sm"
          variant="outline"
          bg="white"
          border="1px solid"
          borderColor="gray.300"
          borderRadius="4px"
          width="30px"
          height="30px"
          fontSize="18px"
          onClick={() => map.zoomOut()}
          aria-label="Zoom out"
          _hover={{ bg: "gray.50" }}
        >
          −
        </IconButton>
      </Box>

    </>
  )
}
