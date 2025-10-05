"use client"

import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import { useEffect } from 'react';
import { LatLngExpression, LatLngTuple } from 'leaflet';
import L from 'leaflet';

import "leaflet/dist/leaflet.css";

// Create a simple custom marker icon
const createCustomIcon = () => {
  return L.divIcon({
    className: 'custom-marker',
    html: '<div style="background-color: #3388ff; width: 20px; height: 20px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>',
    iconSize: [20, 20],
    iconAnchor: [10, 10]
  });
};

interface MapProps {
    posix: LatLngExpression | LatLngTuple,
    zoom?: number,
}

const defaults = {
    zoom: 13,
}

// Component to update map center when posix changes
function MapUpdater({ posix, zoom }: { posix: LatLngExpression | LatLngTuple, zoom: number }) {
    const map = useMap()
    
    useEffect(() => {
        map.setView(posix, zoom)
    }, [posix, zoom, map])
    
    return null
}

// Component to add custom zoom control on the right side
function CustomZoomControl() {
    const map = useMap()
    
    useEffect(() => {
        const zoomControl = L.control.zoom({
            position: 'topright'
        })
        map.addControl(zoomControl)
        
        return () => {
            map.removeControl(zoomControl)
        }
    }, [map])
    
    return null
}

const Map = ({ posix, zoom = defaults.zoom }: MapProps) => {
    return (
        <MapContainer
            center={posix}
            zoom={zoom}
            scrollWheelZoom={true}
            style={{ height: "100%", width: "100%" }}
            zoomControl={false}
        >
            <MapUpdater posix={posix} zoom={zoom} />
            <CustomZoomControl />
            <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <Marker position={posix} draggable={false} icon={createCustomIcon()}>
                <Popup>Current Location</Popup>
            </Marker>
        </MapContainer>
    )
}

export default Map