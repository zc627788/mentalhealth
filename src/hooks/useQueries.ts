import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

// Query Keys - 用于缓存管理
export const queryKeys = {
  appointments: ['appointments'] as const,
  userAppointments: (userId: string) => ['appointments', userId] as const,
  myAccess: (userId?: string|null) => ['my-access', userId ?? 'me'] as const,
  counselors: ['counselors'] as const,
  availabilities: ['availabilities'] as const,
  systemSettings: ['systemSettings'] as const,
  chatSessions: (userId: string) => ['chatSessions', userId] as const,
  chatHistory: (sessionId: number) => ['chatHistory', sessionId] as const,
}

// 获取当前用户 access_type（默认 human_only）
export function useMyAccessType() {
  return useQuery({
    queryKey: queryKeys.myAccess(null),
    queryFn: async () => {
      const { data: auth } = await supabase.auth.getUser()
      const uid = auth.user?.id
      if (!uid) return 'human_only'
      const { data } = await supabase
        .from('user_access_policies')
        .select('access_type')
        .eq('user_id', uid)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      return (data?.access_type as string) || 'human_only'
    },
    staleTime: 5 * 60_000,
  })
}

// 获取用户预约列表
export function useUserAppointments(userId: string) {
  return useQuery({
    queryKey: queryKeys.userAppointments(userId),
    queryFn: async () => {
      // 读取用户 access_type
      let access: 'doubao_only'|'peppy_only'|'human_only' = 'human_only'
      if (userId) {
        const { data: policy } = await supabase
          .from('user_access_policies')
          .select('access_type')
          .eq('user_id', userId)
          .maybeSingle()
        access = (policy?.access_type as any) || 'human_only'
      }

      const { data, error } = await supabase
        .from('appointments')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
      
      if (error) throw error
      // 基于 access_type 进行可见性过滤
      const filtered = (data || []).filter((a: any) => {
        if (a.appointment_type === 'human') {
          return access === 'human_only'
        }
        if (a.appointment_type === 'ai') {
          if (access === 'doubao_only') return a.ai_model === 'doubao'
          if (access === 'peppy_only') return a.ai_model === 'peppy'
          return false
        }
        return false
      })
      return filtered
    },
    enabled: !!userId,
  })
}

// 获取所有咨询师
export function useCounselors() {
  return useQuery({
    queryKey: queryKeys.counselors,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('counselors')
        .select('*')
        .eq('available', true)
        .order('created_at', { ascending: false })
      
      if (error) throw error
      return data
    },
  })
}

// 获取可用时间段
export function useAvailabilities() {
  return useQuery({
    queryKey: queryKeys.availabilities,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('counselor_availability')
        .select('*, counselor:counselors(*)')
        .gte('availability_date', new Date().toISOString().split('T')[0])
        .order('availability_date', { ascending: true })
        .order('start_time', { ascending: true })
      
      if (error) throw error
      return data
    },
  })
}

// 获取系统设置
export function useSystemSettings() {
  return useQuery({
    queryKey: queryKeys.systemSettings,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('system_settings')
        .select('*')
      
      if (error) throw error
      
      // 转换为键值对格式
      const settings: Record<string, string> = {}
      data?.forEach((setting) => {
        settings[setting.setting_key] = setting.setting_value
      })
      
      return settings
    },
  })
}

// 创建预约
export function useCreateAppointment() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (appointmentData: {
      availability_id: string
      topic: string
      description: string
      urgency: string
    }) => {
      const { data, error } = await supabase
        .from('appointments')
        .insert([appointmentData])
        .select()
        .single()
      
      if (error) throw error
      return data
    },
    onSuccess: (data) => {
      // 刷新相关查询
      queryClient.invalidateQueries({ queryKey: queryKeys.appointments })
      queryClient.invalidateQueries({ queryKey: queryKeys.userAppointments(data.user_id) })
    },
  })
}

// 取消预约
export function useCancelAppointment() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async ({ appointmentId, userId }: { appointmentId: number, userId: string }) => {
      const { error } = await supabase
        .from('appointments')
        .update({ status: 'cancelled' })
        .eq('id', appointmentId)
      
      if (error) throw error
    },
    onSuccess: (_, { userId }) => {
      // 刷新用户预约列表
      queryClient.invalidateQueries({ queryKey: queryKeys.userAppointments(userId) })
    },
  })
}

// 发送短信验证码
export function useSendSMS() {
  return useMutation({
    mutationFn: async ({ phoneNumber, type }: { phoneNumber: string, type: 'register' | 'login' }) => {
      const { data, error } = await supabase.functions.invoke('send-sms-tencent-manual', {
        body: { phoneNumber, type }
      })
      
      if (error) throw error
      if (data.error) throw new Error(data.error)
      
      return data
    },
  })
}

// 验证短信验证码
export function useVerifySMS() {
  return useMutation({
    mutationFn: async ({ 
      phoneNumber, 
      verificationCode, 
      type, 
      name 
    }: { 
      phoneNumber: string
      verificationCode: string
      type: 'register' | 'login'
      name?: string
    }) => {
      const { data, error } = await supabase.functions.invoke('verify-sms', {
        body: { phoneNumber, verificationCode, type, name }
      })
      
      if (error) throw error
      if (data.error) throw new Error(data.error)
      
      return data
    },
  })
}

// 获取聊天会话
export function useChatSessions(userId: string) {
  return useQuery({
    queryKey: queryKeys.chatSessions(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('chat_sessions')
        .select('*')
        .eq('user_id', userId)
        .order('last_message_at', { ascending: false })
      
      if (error) throw error
      return data
    },
    enabled: !!userId,
  })
}

// 获取聊天历史
export function useChatHistory(sessionId: number) {
  return useQuery({
    queryKey: queryKeys.chatHistory(sessionId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true })
      
      if (error) throw error
      return data
    },
    enabled: !!sessionId,
  })
}
