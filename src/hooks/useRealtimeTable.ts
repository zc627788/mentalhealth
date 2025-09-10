import { useEffect, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { RealtimeChannel } from '@supabase/supabase-js'

interface UseRealtimeTableOptions {
  table: string
  onInsert?: (payload: any) => void
  onUpdate?: (payload: any) => void
  onDelete?: (payload: any) => void
  filter?: string
}

export const useRealtimeTable = ({
  table,
  onInsert,
  onUpdate,
  onDelete,
  filter
}: UseRealtimeTableOptions) => {
  const channelRef = useRef<RealtimeChannel | null>(null)

  const handleInsert = useCallback((payload: any) => {
    console.log(`Realtime INSERT on ${table}:`, payload.new)
    onInsert?.(payload)
  }, [table, onInsert])

  const handleUpdate = useCallback((payload: any) => {
    console.log(`Realtime UPDATE on ${table}:`, payload.new, payload.old)
    onUpdate?.(payload)
  }, [table, onUpdate])

  const handleDelete = useCallback((payload: any) => {
    console.log(`Realtime DELETE on ${table}:`, payload.old)
    onDelete?.(payload)
  }, [table, onDelete])

  useEffect(() => {
    // 创建频道
    const channelName = filter ? `${table}-${filter}` : table
    channelRef.current = supabase.channel(channelName)

    // 设置监听器
    let channel = channelRef.current
      .on('postgres_changes', 
        { 
          event: 'INSERT', 
          schema: 'public', 
          table: table,
          ...(filter && { filter: filter })
        }, 
        handleInsert
      )
      .on('postgres_changes', 
        { 
          event: 'UPDATE', 
          schema: 'public', 
          table: table,
          ...(filter && { filter: filter })
        }, 
        handleUpdate
      )
      .on('postgres_changes', 
        { 
          event: 'DELETE', 
          schema: 'public', 
          table: table,
          ...(filter && { filter: filter })
        }, 
        handleDelete
      )

    // 订阅频道
    channel.subscribe((status) => {
      console.log(`Realtime subscription status for ${table}:`, status)
    })

    return () => {
      if (channelRef.current) {
        channelRef.current.unsubscribe()
        channelRef.current = null
      }
    }
  }, [table, filter, handleInsert, handleUpdate, handleDelete])

  return {
    channel: channelRef.current
  }
}