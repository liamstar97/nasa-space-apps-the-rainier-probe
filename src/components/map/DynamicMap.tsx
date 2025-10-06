'use client'
import dynamic from 'next/dynamic'

const Map = dynamic(() => import('./index'), {
  ssr: false,
  loading: () => <div style={{ height: '400px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Loading map...</div>
})

interface DynamicMapProps {
  posix: [number, number]
  zoom?: number
  latestSearch?: { lat: number; lon: number; name?: string }
  selectedDate?: string
  showWeatherData?: boolean
}

export default function DynamicMap(props: DynamicMapProps) {
  return <Map {...props} />
}
