'use client'
import dynamic from 'next/dynamic'

const Map = dynamic(() => import('./index'), {
  ssr: false,
  loading: () => <div style={{ height: '400px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Loading map...</div>
})

export default Map
