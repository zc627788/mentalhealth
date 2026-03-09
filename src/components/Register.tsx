import React, { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useSendSMSCode, useVerifySMSCode } from '@/hooks/useSms'
import { supabase } from '@/lib/supabase'

interface RegisterFormData {
  name: string
  phoneNumber: string
  password: string
  confirmPassword: string
  randomId: string
}

interface RegisterFormErrors {
  name?: string
  phoneNumber?: string
  password?: string
  confirmPassword?: string
  randomId?: string
  general?: string
}

export default function Register() {
  const [formData, setFormData] = useState<RegisterFormData>({
    name: '',
    phoneNumber: '',
    password: '',
    confirmPassword: '',
    randomId: ''
  })
  const [errors, setErrors] = useState<RegisterFormErrors>({})
  const [isLoading, setIsLoading] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  
  // 验证码相关
  const [verificationCode, setVerificationCode] = useState('')
  const [codeSent, setCodeSent] = useState(false)
  const [countdown, setCountdown] = useState(0)
  const [canResend, setCanResend] = useState(true)
  const [smsTip, setSmsTip] = useState('')
  
  // 随机 ID 验证
  const [randomIdValidated, setRandomIdValidated] = useState(false)
  const [randomIdValidating, setRandomIdValidating] = useState(false)

  const { signUpWithPhone } = useAuth()
  const sendSms = useSendSMSCode()
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
      newErrors.name = '姓名至少需要 2 个字符'
    } else if (formData.name.length > 50) {
      newErrors.name = '姓名过长（最多 50 个字符）'
    }

    // Phone validation
    if (!formData.phoneNumber.trim()) {
      newErrors.phoneNumber = '请输入手机号'
    } else if (!/^1[3-9]\d{9}$/.test(formData.phoneNumber)) {
      newErrors.phoneNumber = '手机号格式不正确'
    }

    // Random ID validation
    if (!formData.randomId.trim()) {
      newErrors.randomId = '请输入随机 ID'
    } else if (!/^[A-Za-z0-9]{5}$/.test(formData.randomId)) {
      newErrors.randomId = '随机 ID 格式不正确（5 位字母或数字）'
    } else if (!randomIdValidated) {
      newErrors.randomId = '请先验证随机 ID'
    }

    // Password validation
    if (!formData.password.trim()) {
      newErrors.password = '请输入密码'
    } else if (formData.password.length < 6) {
      newErrors.password = '密码至少需要 6 个字符'
    } else if (formData.password.length > 72) {
      newErrors.password = '密码过长（最多 72 个字符）'
    }

    // Confirm password validation
    if (!formData.confirmPassword.trim()) {
      newErrors.confirmPassword = '请确认密码'
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = '两次输入的密码不一致'
    }

    // SMS verification code
    if (!verificationCode.trim()) {
      newErrors.general = '请输入短信验证码'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  // 验证随机 ID
  const handleValidateRandomId = async () => {
    if (!formData.randomId.trim()) {
      setErrors({ randomId: '请输入随机 ID' })
      return
    }

    if (!/^[A-Za-z0-9]{5}$/.test(formData.randomId)) {
      setErrors({ randomId: '随机 ID 格式不正确（5 位字母或数字）' })
      return
    }

    setRandomIdValidating(true)
    setErrors({ randomId: undefined })

    try {
      const { data, error } = await supabase.functions.invoke('verify-random-id', {
        body: { code: formData.randomId.trim().toUpperCase() }
      })

      if (error) {
        setErrors({ randomId: '验证失败，请稍后重试' })
        setRandomIdValidated(false)
        return
      }

      if (data?.success) {
        setRandomIdValidated(true)
        setSmsTip('随机 ID 验证通过')
      } else {
        setErrors({ randomId: data?.message || '随机 ID 无效' })
        setRandomIdValidated(false)
      }
    } catch (e: any) {
      setErrors({ randomId: '验证失败，请稍后重试' })
      setRandomIdValidated(false)
    } finally {
      setRandomIdValidating(false)
    }
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
      // 使用手机号 + 密码 + 验证码注册
      const result = await signUpWithPhone(
        formData.phoneNumber,
        formData.password,
        verificationCode,
        formData.name,
        formData.randomId // 传递随机 ID，由服务端在创建用户成功后标记为已使用
      )

      if (result.error) {
        setErrors({ general: result.error })
        return
      }

      // 注册成功，跳转到登录页
      navigate('/login', {
        state: {
          message: '注册成功！请使用手机号和密码登录'
        }
      })
    } catch (e: any) {
      setErrors({ general: e?.message || '注册失败，请稍后重试' })
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

    // 重置随机 ID 验证状态
    if (name === 'randomId') {
      setRandomIdValidated(false)
      setSmsTip('')
    }
  }

  const handleSendCode = async () => {
    setErrors({})
    
    // 先验证随机 ID
    if (!randomIdValidated) {
      setErrors({ randomId: '请先验证随机 ID' })
      return
    }
    
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
      const res = await sendSms.mutateAsync({
        phoneNumber: formData.phoneNumber,
        type: 'register', // 注册场景
        cooldownSeconds: 60,
      })
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-100 to-indigo-200 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl p-8 w-full max-w-md">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">创建新账户</h1>
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

          {/* Random ID Field */}
          <div>
            <label htmlFor="randomId" className="block text-sm font-medium text-gray-700 mb-1">
              随机 ID
              <span className="text-gray-500 text-xs ml-2">(必填，5 位字母或数字)</span>
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                id="randomId"
                name="randomId"
                value={formData.randomId}
                onChange={handleChange}
                className={`flex-1 px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors uppercase tracking-widest ${
                  errors.randomId ? 'border-red-300 bg-red-50' : 'border-gray-300'
                } ${randomIdValidated ? 'border-green-500 bg-green-50' : ''}`}
                placeholder="请输入随机 ID"
                maxLength={5}
                disabled={isLoading || randomIdValidated}
                autoComplete="off"
              />
              <button
                type="button"
                onClick={handleValidateRandomId}
                disabled={isLoading || randomIdValidating || randomIdValidated || !formData.randomId.trim()}
                className={`px-4 py-2 rounded-md text-sm whitespace-nowrap ${
                  isLoading || randomIdValidating || randomIdValidated || !formData.randomId.trim()
                    ? 'bg-gray-200 text-gray-500'
                    : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                }`}
              >
                {randomIdValidated ? '✓ 已验证' : randomIdValidating ? '验证中...' : '验证 ID'}
              </button>
            </div>
            {errors.randomId && (
              <p className="text-red-600 text-xs mt-1">{errors.randomId}</p>
            )}
            {randomIdValidated && (
              <p className="text-green-600 text-xs mt-1">✓ 随机 ID 验证通过</p>
            )}
          </div>

          {/* Phone Field */}
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

          {/* SMS Verification Code Field */}
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
                className={`flex-1 px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors tracking-widest ${
                  errors.general ? 'border-red-300 bg-red-50' : 'border-gray-300'
                }`}
                placeholder="请输入 6 位验证码"
                maxLength={6}
                disabled={isLoading}
              />
              <button
                type="button"
                onClick={handleSendCode}
                disabled={isLoading || !canResend || !randomIdValidated}
                className={`px-3 py-2 rounded-md text-sm whitespace-nowrap ${
                  isLoading || !canResend || !randomIdValidated
                    ? 'bg-gray-200 text-gray-500'
                    : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                }`}
              >
                {codeSent ? (countdown > 0 ? `${countdown}s` : '重新发送') : '获取验证码'}
              </button>
            </div>
            {smsTip && (
              <p className="text-xs text-blue-600 mt-1">{smsTip}</p>
            )}
          </div>

          {/* Password Field */}
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
              密码
              <span className="text-gray-500 text-xs font-normal ml-1">(用于日后密码登录)</span>
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
              placeholder="至少需要 6 个字符"
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

          {/* Help Text */}
          <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
            <p className="text-blue-800 text-xs">
              <strong>说明：</strong>注册时需要验证手机号，注册后可使用 <strong>手机号 + 密码</strong> 或 <strong>手机号 + 验证码</strong> 登录
            </p>
          </div>
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
