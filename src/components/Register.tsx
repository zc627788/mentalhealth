import React, { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useSendSMSCode, useVerifySMSCode } from '@/hooks/useSms'
import { supabase } from '@/lib/supabase'



interface RegisterFormData {
  name: string
  email: string
  password: string
  confirmPassword: string
  phoneNumber: string
}

interface RegisterFormErrors {
  name?: string
  email?: string
  password?: string
  confirmPassword?: string
  phoneNumber?: string
  general?: string
}

type RegisterMode = 'email' | 'phone'

export default function Register() {
  const [formData, setFormData] = useState<RegisterFormData>({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    phoneNumber: ''
  })
  const [errors, setErrors] = useState<RegisterFormErrors>({})
  const [isLoading, setIsLoading] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [registerMode, setRegisterMode] = useState<RegisterMode>('email')
  // 验证码内联
  const [verificationCode, setVerificationCode] = useState('')
  const [codeSent, setCodeSent] = useState(false)
  const [countdown, setCountdown] = useState(0)
  const [canResend, setCanResend] = useState(true)
  const [smsTip, setSmsTip] = useState('')
  const { signUp } = useAuth()
  const sendSms = useSendSMSCode()
  const verifySms = useVerifySMSCode()
  const navigate = useNavigate()

  useEffect(() => {
    if (countdown > 0) {
      setCanResend(false)
      const t = setTimeout(() => setCountdown((s) => s - 1), 1000)
      return () => clearTimeout(t)
    } else {
      setCanResend(true)
    }
  }, [countdown])

  const validateForm = (): boolean => {
    const newErrors: RegisterFormErrors = {}

    // Name validation
    if (!formData.name.trim()) {
      newErrors.name = '请输入姓名'
    } else if (formData.name.length < 2) {
      newErrors.name = '姓名至少需要2个字符'
    } else if (formData.name.length > 50) {
      newErrors.name = '姓名过长（最多50个字符）'
    }

    if (registerMode === 'email') {
      // Email validation
      if (!formData.email.trim()) {
        newErrors.email = '请输入邮箱地址'
      } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
        newErrors.email = '邮箱格式不正确'
      } else if (formData.email.length > 254) {
        newErrors.email = '邮箱地址过长（最多254个字符）'
      }

      // Password validation
      if (!formData.password.trim()) {
        newErrors.password = '请输入密码'
      } else if (formData.password.length < 6) {
        newErrors.password = '密码至少需要6个字符'
      } else if (formData.password.length > 72) {
        newErrors.password = '密码过长（最多72个字符）'
      }

      // Confirm password validation
      if (!formData.confirmPassword.trim()) {
        newErrors.confirmPassword = '请确认密码'
      } else if (formData.password !== formData.confirmPassword) {
        newErrors.confirmPassword = '两次输入的密码不一致'
      }
    } else {
      // Phone validation
      if (!formData.phoneNumber.trim()) {
        newErrors.phoneNumber = '请输入手机号'
      } else if (!/^1[3-9]\d{9}$/.test(formData.phoneNumber)) {
        newErrors.phoneNumber = '手机号格式不正确'
      }
      if (!verificationCode.trim()) {
        newErrors.general = '请输入短信验证码'
      }
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Clear previous errors
    setErrors({})
    
    // Validate form
    if (!validateForm()) {
      return
    }

    // Prevent multiple submissions
    if (isLoading) {
      return
    }

    setIsLoading(true)

    try {
      if (registerMode === 'email') {
        const { error } = await signUp(formData.email, formData.password, formData.name)
        
        if (error) {
          setErrors({ general: error })
        } else {
          setIsSuccess(true)
        }
      } else {
        // 验证并注册（hook）
        try {
          const result = await verifySms.mutateAsync({
            phoneNumber: formData.phoneNumber,
            code: verificationCode,
            type: 'register',
            name: formData.name,
          })
          // 如果后端返回 loginUrl，直接跳转，完成会话建立
          if ((result as any)?.loginUrl) {
            window.location.href = (result as any).loginUrl
            return
          }
          // 兜底：没有返回链接则跳转登录页
          navigate('/login')
        } catch (e: any) {
          setErrors({ general: e?.message || '验证码验证失败' })
        }
      }
    } catch (error: any) {
      setErrors({ general: '操作失败，请稍后重试' })
    } finally {
      setIsLoading(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
    
    // Clear field error when user starts typing
    if (errors[name as keyof RegisterFormErrors]) {
      setErrors(prev => ({ ...prev, [name]: undefined }))
    }
  }

  const handleSendCode = async () => {
    setErrors({})
    if (!formData.phoneNumber || !/^1[3-9]\d{9}$/.test(formData.phoneNumber)) {
      setErrors({ phoneNumber: '请输入正确的手机号' })
      return
    }
    if (!formData.name.trim()) {
      setErrors({ name: '请输入姓名' })
      return
    }
    if (!canResend) return
    setIsLoading(true)
    try {
      const res = await sendSms.mutateAsync({ phoneNumber: formData.phoneNumber, cooldownSeconds: 60 })
      setCodeSent(true)
      setSmsTip((res as any)?.message || '验证码已发送')
      setCountdown(60)
    } catch (e: any) {
      setErrors({ general: e?.message || '发送失败，请稍后重试' })
      setSmsTip('')
    } finally {
      setIsLoading(false)
    }
  }

  // 移除独立验证页，内联验证码

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-100 to-indigo-200 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl p-8 w-full max-w-md">
          <div className="text-center">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4">
              <svg className="h-6 w-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
              </svg>
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">注册成功！</h2>
            <p className="text-gray-600 mb-4">
              请检查您的邮箱并点击确认链接以激活账户。
            </p>
            <p className="text-gray-500 text-sm mb-6">
              激活后您就可以登录使用所有功能了。
            </p>
            <button
              onClick={() => navigate('/login')}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors"
            >
              返回登录
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-100 to-indigo-200 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl p-8 w-full max-w-md">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">创建新账户</h1>
          <p className="text-gray-600">开始您的心理健康之旅</p>
        </div>

        {/* Register Mode Toggle */}
        <div className="flex bg-gray-100 rounded-lg p-1 mb-6">
          <button
            type="button"
            onClick={() => setRegisterMode('email')}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
              registerMode === 'email'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            邮箱注册
          </button>
          <button
            type="button"
            onClick={() => setRegisterMode('phone')}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
              registerMode === 'phone'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            手机注册
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* General Error Message */}
          {errors.general && (
            <div className="bg-red-50 border border-red-200 rounded-md p-3">
              <p className="text-red-800 text-sm">{errors.general}</p>
            </div>
          )}

          {/* Name Field */}
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
              姓名
            </label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${
                errors.name ? 'border-red-300 bg-red-50' : 'border-gray-300'
              }`}
              placeholder="请输入您的姓名"
              maxLength={50}
              required
              disabled={isLoading}
            />
            {errors.name && (
              <p className="text-red-600 text-xs mt-1">{errors.name}</p>
            )}
          </div>

          {/* Email Registration Fields */}
          {registerMode === 'email' && (
            <>
              {/* Email Field */}
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                  邮箱地址
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${
                    errors.email ? 'border-red-300 bg-red-50' : 'border-gray-300'
                  }`}
                  placeholder="请输入邮箱地址"
                  maxLength={254}
                  required
                  disabled={isLoading}
                />
                {errors.email && (
                  <p className="text-red-600 text-xs mt-1">{errors.email}</p>
                )}
              </div>
              {smsTip && (
                <div className="text-xs text-blue-600 mt-1">{smsTip}</div>
              )}

              {/* Password Field */}
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                  密码
                </label>
                <input
                  type="password"
                  id="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${
                    errors.password ? 'border-red-300 bg-red-50' : 'border-gray-300'
                  }`}
                  placeholder="至少需要6个字符"
                  minLength={6}
                  maxLength={72}
                  required
                  disabled={isLoading}
                />
                {errors.password && (
                  <p className="text-red-600 text-xs mt-1">{errors.password}</p>
                )}
              </div>

              {/* Confirm Password Field */}
              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
                  确认密码
                </label>
                <input
                  type="password"
                  id="confirmPassword"
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${
                    errors.confirmPassword ? 'border-red-300 bg-red-50' : 'border-gray-300'
                  }`}
                  placeholder="请再次输入密码"
                  minLength={6}
                  maxLength={72}
                  required
                  disabled={isLoading}
                />
                {errors.confirmPassword && (
                  <p className="text-red-600 text-xs mt-1">{errors.confirmPassword}</p>
                )}
              </div>
            </>
          )}

          {/* Phone Registration Field */}
          {registerMode === 'phone' && (
            <>
              <div>
                <label htmlFor="phoneNumber" className="block text-sm font-medium text-gray-700 mb-1">
                  手机号
                </label>
                <input
                  type="tel"
                  id="phoneNumber"
                  name="phoneNumber"
                  value={formData.phoneNumber}
                  onChange={handleChange}
                  className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${
                    errors.phoneNumber ? 'border-red-300 bg-red-50' : 'border-gray-300'
                  }`}
                  placeholder="请输入手机号"
                  maxLength={11}
                  required
                  disabled={isLoading}
                />
                {errors.phoneNumber && (
                  <p className="text-red-600 text-xs mt-1">{errors.phoneNumber}</p>
                )}
              </div>

              <div>
                <label htmlFor="verificationCode" className="block text-sm font-medium text-gray-700 mb-1">
                  短信验证码
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    id="verificationCode"
                    name="verificationCode"
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    className={`flex-1 px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors  tracking-widest ${
                      errors.general ? 'border-red-300 bg-red-50' : 'border-gray-300'
                    }`}
                    placeholder="请输入6位验证码"
                    maxLength={6}
                    disabled={isLoading}
                  />
                  <button
                    type="button"
                    onClick={handleSendCode}
                    disabled={isLoading || !canResend}
                    className={`px-3 py-2 rounded-md text-sm whitespace-nowrap ${
                      isLoading || !canResend ? 'bg-gray-200 text-gray-500' : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                    }`}
                  >
                    {codeSent ? (countdown > 0 ? `${countdown}s 后重发` : '重新发送') : '获取验证码'}
                  </button>
                </div>
              </div>
            </>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading}
            className={`w-full py-2 px-4 rounded-md font-medium text-white transition-colors duration-200 ${
              isLoading
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2'
            }`}
          >
            {isLoading ? (
              <span className="flex items-center justify-center">
                <svg className="animate-spin -ml-1 mr-3 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                注册中...
              </span>
            ) : (
              '注册'
            )}
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-gray-600 text-sm">
            已有账户？{' '}
            <Link to="/login" className="text-blue-600 hover:text-blue-800 font-medium">
              立即登录
            </Link>
          </p>
        </div>

        <div className="mt-4 text-center">
          <p className="text-xs text-gray-500">Created by MiniMax Agent</p>
        </div>
      </div>
    </div>
  )
}
