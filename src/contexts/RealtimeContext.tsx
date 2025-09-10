import React, { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

interface RealtimeContextType {
  isConnected: boolean
  connectionStatus: string
}

const RealtimeContext = createContext<RealtimeContextType>({
  isConnected: false,
  connectionStatus: 'disconnected'
})

export const useRealtime = () => {
  const context = useContext(RealtimeContext)
  if (!context) {
    throw new Error('useRealtime must be used within a RealtimeProvider')
  }
  return context
}

export const RealtimeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isConnected, setIsConnected] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState('disconnected')

  useEffect(() => {
    const channel = supabase.channel('system-status')
    
    channel
      .on('system', { event: 'online' }, () => {
        console.log('Realtime: Connected')
        setIsConnected(true)
        setConnectionStatus('connected')
      })
      .on('system', { event: 'offline' }, () => {
        console.log('Realtime: Disconnected')
        setIsConnected(false)
        setConnectionStatus('disconnected')
      })
      .subscribe()

    return () => {
      channel.unsubscribe()
    }
  }, [])

  return (
    <RealtimeContext.Provider value={{ isConnected, connectionStatus }}>
      {children}
    </RealtimeContext.Provider>
  )
}