"use client"

import React from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import { useEffect, useRef } from 'react';
import { LatLngExpression, LatLngTuple } from 'leaflet';
import L from 'leaflet';
import { useColorMode } from '@/components/ui/color-mode';
import MapControls from './MapControls';
import WeatherDataLayer from './WeatherDataLayer';

import "leaflet/dist/leaflet.css";

// Create a simple custom marker icon
const createCustomIcon = () => {
  return L.divIcon({
    className: 'custom-marker',
    html: '<div style="background-color: #3388ff; width: 20px; height: 20px; border-radius: 50%; border: 3px solid white;"></div>',
    iconSize: [20, 20],
    iconAnchor: [10, 10]
  });
};

interface MapProps {
    posix: LatLngExpression | LatLngTuple,
    zoom?: number,
    latestSearch?: { lat: number; lon: number; name?: string },
    selectedDate?: string
}

const defaults = {
    zoom: 13,
}

// Component to update map center when posix changes
function MapUpdater({ posix, zoom }: { posix: LatLngExpression | LatLngTuple, zoom: number }) {
    const map = useMap()
    const prevPosixRef = useRef<LatLngExpression | LatLngTuple | null>(null)
    const prevZoomRef = useRef<number | null>(null)
    
    // Helper function to normalize LatLngExpression or LatLngTuple to an object with lat/lng
    const getNormalizedCoords = (location: LatLngExpression | LatLngTuple | null) => {
        if (!location) {
            return { lat: NaN, lng: NaN };
        }
        if (Array.isArray(location)) {
            return { lat: location[0], lng: location[1] };
        }
        return location as { lat: number; lng: number };
    };

    useEffect(() => {
        // On initial render, prevPosixRef.current will be null.
        // We set the initial view and store the current posix/zoom.
        if (prevPosixRef.current === null) {
            map.setView(posix, zoom);
            prevPosixRef.current = posix;
            prevZoomRef.current = zoom;
            console.log('MapUpdater: Initializing view', { posix, zoom });
            return;
        }

        // Compare current position with the previous one
        const currentCoords = getNormalizedCoords(posix);
        const prevCoords = getNormalizedCoords(prevPosixRef.current);

        const isNewPosition = currentCoords.lat !== prevCoords.lat || currentCoords.lng !== prevCoords.lng;

        // Compare current zoom with the previous one
        const isNewZoom = Math.abs(prevZoomRef.current! - zoom) > 0.1;

        if (isNewPosition || isNewZoom) {
            console.log('MapUpdater: Setting new view', { posix, zoom, isNewPosition, isNewZoom });
            map.setView(posix, zoom);
            prevPosixRef.current = posix;
            prevZoomRef.current = zoom;
        } else {
            console.log('MapUpdater: Skipping view update - no change detected');
        }
    }, [posix, zoom, map])
    
    return null
}



// Component to handle dynamic tile layer switching
function DynamicTileLayer() {
    const map = useMap()
    const { colorMode } = useColorMode()
    const filterAppliedRef = useRef<string | null>(null)
    
    useEffect(() => {
        // Only apply CSS filter if it's different from what's already applied
        const mapContainer = map.getContainer()
        const newFilter = colorMode === 'dark' ? 'invert(1) hue-rotate(180deg) brightness(0.8)' : 'none'
        
        if (filterAppliedRef.current !== newFilter) {
            console.log('DynamicTileLayer: Applying filter', { colorMode, newFilter })
            mapContainer.style.filter = newFilter
            filterAppliedRef.current = newFilter
        } else {
            console.log('DynamicTileLayer: Filter already applied, skipping')
        }
    }, [map, colorMode])
    
    // Initial tile layer setup - only run once
    useEffect(() => {
        // Check if tile layer already exists
        let hasTileLayer = false
        map.eachLayer((layer) => {
            if (layer instanceof L.TileLayer) {
                hasTileLayer = true
            }
        })
        
        if (!hasTileLayer) {
            console.log('DynamicTileLayer: Adding initial tile layer')
            // Add initial tile layer
            const tileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
                maxZoom: 19,
            })
            
            tileLayer.addTo(map)
        } else {
            console.log('DynamicTileLayer: Tile layer already exists, skipping')
        }
    }, [map])
    
    return null
}

// Wrapper component to provide map context to WeatherDataLayer
function WeatherDataLayerWrapper({ latestSearch, selectedDate }: { latestSearch?: { lat: number; lon: number; name?: string }, selectedDate?: string }) {
    const map = useMap()
    return <WeatherDataLayer map={map} latestSearch={latestSearch} selectedDate={selectedDate} />
}

const Map = ({ posix, zoom = defaults.zoom, latestSearch, selectedDate }: MapProps) => {
    return (
        <MapContainer
            center={posix}
            zoom={zoom}
            scrollWheelZoom={true}
            style={{ height: "100%", width: "100%" }}
            zoomControl={false}
        >
            <MapUpdater posix={posix} zoom={zoom} />
            <MapControls latestSearch={latestSearch} />
            <DynamicTileLayer />
            <WeatherDataLayerWrapper latestSearch={latestSearch} selectedDate={selectedDate} />
            <Marker position={posix} draggable={false} icon={createCustomIcon()}>
                <Popup>Current Location</Popup>
            </Marker>
        </MapContainer>
    )
}

export default Map