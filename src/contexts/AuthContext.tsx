import React, { createContext, useContext, useEffect, useState } from 'react'
import { User, Session } from '@supabase/supabase-js'
import { supabase, getAuthErrorMessage } from '../lib/supabase'

interface AuthContextType {
  user: User | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signUp: (email: string, password: string, name: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    
    // Load initial user with timeout protection
    const loadUser = async () => {
      try {
        // 设置超时保护
        const userPromise = supabase.auth.getUser()
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('用户加载超时')), 8000)
        )
        
        const { data: { user }, error } = await Promise.race([userPromise, timeoutPromise]) as any
        
        if (error) {
          console.error('获取用户失败:', error)
        }
        
        setUser(user)
      } catch (error) {
        console.error('加载用户异常:', error)
        // 即使出错也要设置用户为 null，避免无限 loading
        setUser(null)
      } finally {
        setLoading(false)
      }
    }

    // 设置最大等待时间，防止无限 loading
    const timeoutId = setTimeout(() => {
      console.warn('用户加载超时，强制设置 loading = false')
      setLoading(false)
    }, 10000)

    loadUser()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
         const newUser = session?.user || null;
        setUser(session?.user || null)
        setLoading(false)
        // 清除超时定时器
        if (timeoutId) {
          clearTimeout(timeoutId)
        }
      }
    )

    return () => {
      subscription.unsubscribe()
      if (timeoutId) {
        clearTimeout(timeoutId)
      }
    }
  }, [])

  const signIn = async (email: string, password: string): Promise<{ error: string | null }> => {
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        return { error: getAuthErrorMessage(error.message) }
      }
      return { error: null }
    } catch (error: any) {
      return { error: getAuthErrorMessage(error.message || '登录失败') }
    }
  }

  const signUp = async (email: string, password: string, name: string): Promise<{ error: string | null }> => {
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name: name
          },
          emailRedirectTo: `${window.location.protocol}//${window.location.host}/auth/callback`
        }
      })
      if (error) {
        return { error: getAuthErrorMessage(error.message) }
      }
      return { error: null }
    } catch (error: any) {
      return { error: getAuthErrorMessage(error.message || '注册失败') }
    }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
  }

  const value = {
    user,
    loading,
    signIn,
    signUp,
    signOut
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}
