import { createClient } from '@supabase/supabase-js'

// Supabase configuration

export const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://hpmgekbfyqvwyiigmmam.supabase.co'
export const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhwbWdla2JmeXF2d3lpaWdtbWFtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUwODcxMzksImV4cCI6MjA3MDY2MzEzOX0.rgJ-26Gzmia4XeBjRmwORCLmqj6OWLwG4AP14yMThDk'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Auth error messages in Chinese
export const authErrorMessages = {
  'email_address_invalid': '邮箱格式无效，请检查您输入的邮箱地址',
  'email_not_confirmed': '请检查您的邮箱并点击确认链接以激活账户',
  'invalid_credentials': '用户名或密码错误，请重新输入',
  'signup_disabled': '注册功能暂时停用，请联系管理员',
  'email_address_not_authorized': '此邮箱未被授权注册，请联系管理员',
  'password_too_short': '密码长度至少需要6个字符',
  'weak_password': '密码强度太弱，请使用包含字母、数字的更强密码',
  'user_already_registered': '此邮箱已被注册，请直接登录或找回密码',
  'Invalid API key': 'API密钥错误，请联系技术支持',
  'Unauthorized': '访问未被授权，请稍后重试',
  'Invalid login credentials': '登录凭据无效，请检查邮箱和密码'
} as const

export type AuthError = keyof typeof authErrorMessages

export function getAuthErrorMessage(error: string): string {
  // Check if error contains any key from authErrorMessages
  for (const [key, message] of Object.entries(authErrorMessages)) {
    if (error.toLowerCase().includes(key.toLowerCase())) {
      return message
    }
  }
  
  // Fallback for common error patterns
  if (error.toLowerCase().includes('invalid') && error.toLowerCase().includes('key')) {
    return 'API密钥错误，请联系技术支持'
  }
  if (error.toLowerCase().includes('unauthorized')) {
    return '访问未被授权，请稍后重试'
  }
  if (error.toLowerCase().includes('email')) {
    return '邮箱相关错误，请检查邮箱地址'
  }
  
  return error || '操作失败，请稍后重试'
}
