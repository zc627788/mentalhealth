import React, { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'

interface PhoneVerificationProps {
  phoneNumber: string
  type: 'register' | 'login'
  onSuccess: () => void
  onBack: () => void
  userName?: string // 注册时需要
}

interface VerificationFormData {
  verificationCode: string
}

interface VerificationFormErrors {
  verificationCode?: string
  general?: string
}

export default function PhoneVerification({ 
  phoneNumber, 
  type, 
  onSuccess, 
  onBack,
  userName 
}: PhoneVerificationProps) {
  const [formData, setFormData] = useState<VerificationFormData>({
    verificationCode: ''
  })
  const [errors, setErrors] = useState<VerificationFormErrors>({})
  const [isLoading, setIsLoading] = useState(false)
  const [countdown, setCountdown] = useState(0)
  const [canResend, setCanResend] = useState(false)
  
  const { sendSMSVerification, signUpWithPhone, signInWithPhone } = useAuth()

  // 倒计时效果
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000)
      return () => clearTimeout(timer)
    } else {
      setCanResend(true)
    }
  }, [countdown])

  const validateForm = (): boolean => {
    const newErrors: VerificationFormErrors = {}

    if (!formData.verificationCode.trim()) {
      newErrors.verificationCode = '请输入验证码'
    } else if (!/^\d{6}$/.test(formData.verificationCode)) {
      newErrors.verificationCode = '验证码必须是6位数字'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    setErrors({})
    
    if (!validateForm()) {
      return
    }

    if (isLoading) {
      return
    }

    setIsLoading(true)

    try {
      let result
      if (type === 'register') {
        if (!userName) {
          setErrors({ general: '注册时姓名不能为空' })
          return
        }
        result = await signUpWithPhone(phoneNumber, formData.verificationCode, userName)
      } else {
        result = await signInWithPhone(phoneNumber, formData.verificationCode)
      }
      
      if (result.error) {
        setErrors({ general: result.error })
      } else {
        onSuccess()
      }
    } catch (error: any) {
      setErrors({ general: '操作失败，请稍后重试' })
    } finally {
      setIsLoading(false)
    }
  }

  const handleResendCode = async () => {
    if (!canResend) return

    setIsLoading(true)
    setCanResend(false)
    setCountdown(60)

    try {
      const { error } = await sendSMSVerification(phoneNumber, type)
      if (error) {
        setErrors({ general: error })
        setCanResend(true)
        setCountdown(0)
      }
    } catch (error: any) {
      setErrors({ general: '发送失败，请稍后重试' })
      setCanResend(true)
      setCountdown(0)
    } finally {
      setIsLoading(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
    
    if (errors[name as keyof VerificationFormErrors]) {
      setErrors(prev => ({ ...prev, [name]: undefined }))
    }
  }

  // 格式化手机号显示
  const formatPhoneNumber = (phone: string) => {
    return phone.replace(/(\d{3})(\d{4})(\d{4})/, '$1****$3')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-100 to-indigo-200 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl p-8 w-full max-w-md">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            {type === 'register' ? '验证手机号' : '登录验证'}
          </h1>
          <p className="text-gray-600">
            我们已向 {formatPhoneNumber(phoneNumber)} 发送验证码
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* General Error Message */}
          {errors.general && (
            <div className="bg-red-50 border border-red-200 rounded-md p-3">
              <p className="text-red-800 text-sm">{errors.general}</p>
            </div>
          )}

          {/* Verification Code Field */}
          <div>
            <label htmlFor="verificationCode" className="block text-sm font-medium text-gray-700 mb-1">
              验证码
            </label>
            <input
              type="text"
              id="verificationCode"
              name="verificationCode"
              value={formData.verificationCode}
              onChange={handleChange}
              className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors text-center text-lg tracking-widest ${
                errors.verificationCode ? 'border-red-300 bg-red-50' : 'border-gray-300'
              }`}
              placeholder="请输入6位验证码"
              maxLength={6}
              required
              disabled={isLoading}
            />
            {errors.verificationCode && (
              <p className="text-red-600 text-xs mt-1">{errors.verificationCode}</p>
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
                {type === 'register' ? '注册中...' : '登录中...'}
              </span>
            ) : (
              type === 'register' ? '完成注册' : '登录'
            )}
          </button>
        </form>

        {/* Resend Code */}
        <div className="mt-6 text-center">
          <p className="text-gray-600 text-sm mb-2">
            没有收到验证码？
          </p>
          <button
            onClick={handleResendCode}
            disabled={!canResend || isLoading}
            className={`text-sm font-medium transition-colors ${
              canResend && !isLoading
                ? 'text-blue-600 hover:text-blue-800'
                : 'text-gray-400 cursor-not-allowed'
            }`}
          >
            {countdown > 0 ? `${countdown}秒后可重新发送` : '重新发送验证码'}
          </button>
        </div>

        {/* Back Button */}
        <div className="mt-4 text-center">
          <button
            onClick={onBack}
            disabled={isLoading}
            className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
          >
            返回上一步
          </button>
        </div>
      </div>
    </div>
  )
}
