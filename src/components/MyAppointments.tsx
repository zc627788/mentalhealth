import React, { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { format } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { useUserAppointments } from '../hooks/useQueries'

interface Appointment {
  id: number
  appointment_date: string
  start_time: string
  end_time: string
  topic: string
  description: string
  status: 'confirmed' | 'cancelled' | 'completed'
  urgency: string
  meeting_link?: string
  counselor_name: string
  created_at: string
}

const MyAppointments: React.FC = () => {
  const { user } = useAuth()
  const { data: appointments = [], isLoading: loading } = useUserAppointments(user?.id || '')
  const [filter, setFilter] = useState<'all' | 'upcoming' | 'past'>('all')

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed':
        return 'bg-green-100 text-green-800'
      case 'cancelled':
        return 'bg-red-100 text-red-800'
      case 'completed':
        return 'bg-blue-100 text-blue-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'confirmed':
        return '已确认'
      case 'cancelled':
        return '已取消'
      case 'completed':
        return '已完成'
      default:
        return '未知状态'
    }
  }

  const getUrgencyText = (urgency: string) => {
    switch (urgency) {
      case 'low':
        return '一般'
      case 'medium':
        return '中等'
      case 'high':
        return '紧急'
      case 'urgent':
        return '非常紧急'
      default:
        return urgency || '中等'
    }
  }

  const filteredAppointments = appointments.filter(appointment => {
    const appointmentDate = new Date(appointment.appointment_date)
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    
    switch (filter) {
      case 'upcoming':
        return appointmentDate >= today && appointment.status === 'confirmed'
      case 'past':
        return appointmentDate < today || appointment.status === 'completed' || appointment.status === 'cancelled'
      default:
        return true
    }
  })

  const isUpcoming = (appointment: Appointment) => {
    const appointmentDate = new Date(appointment.appointment_date)
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    return appointmentDate >= today && appointment.status === 'confirmed'
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-2xl shadow-xl p-8">
            <div className="animate-pulse">
              <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-24 bg-gray-200 rounded-lg"></div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-8 py-6">
            <h1 className="text-3xl font-bold text-white">我的预约</h1>
            <p className="text-blue-100 mt-2">查看和管理您的预约历史</p>
          </div>

          {/* Filter Tabs */}
          <div className="border-b border-gray-200">
            <nav className="flex space-x-8 px-8">
              {[
                { key: 'all', label: '全部预约' },
                { key: 'upcoming', label: '即将到来' },
                { key: 'past', label: '历史记录' }
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setFilter(tab.key as any)}
                  className={`py-4 px-1 border-b-2 font-medium text-sm ${
                    filter === tab.key
                      ? 'border-indigo-500 text-indigo-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          {/* Appointments List */}
          <div className="p-8">
            {filteredAppointments.length === 0 ? (
              <div className="text-center py-12">
                <div className="mx-auto h-12 w-12 text-gray-400">
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <h3 className="mt-2 text-sm font-medium text-gray-900">
                  {filter === 'upcoming' && '暂无即将到来的预约'}
                  {filter === 'past' && '暂无历史预约记录'}
                  {filter === 'all' && '暂无预约记录'}
                </h3>
                <p className="mt-1 text-sm text-gray-500">
                  {filter !== 'past' && '去预约页面创建您的第一个预约吧'}
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {filteredAppointments.map((appointment) => (
                  <div key={appointment.id} className="border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-semibold text-gray-900">{appointment.topic}</h3>
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            getStatusColor(appointment.status)
                          }`}>
                            {getStatusText(appointment.status)}
                          </span>
                          {isUpcoming(appointment) && (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                              即将到来
                            </span>
                          )}
                        </div>
                        <p className="text-gray-600 mb-3">{appointment.description}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="font-medium text-gray-700">日期：</span>
                        <p className="text-gray-900">{format(new Date(appointment.appointment_date), 'yyyy年M月d日 EEEE', { locale: zhCN })}</p>
                      </div>
                      <div>
                        <span className="font-medium text-gray-700">时间：</span>
                        <p className="text-gray-900">{appointment.start_time.slice(0, 5)} - {appointment.end_time.slice(0, 5)}</p>
                      </div>
                      <div>
                        <span className="font-medium text-gray-700">咨询师：</span>
                        <p className="text-gray-900">{appointment.counselor_name}</p>
                      </div>
                      <div>
                        <span className="font-medium text-gray-700">紧急程度：</span>
                        <p className="text-gray-900">{getUrgencyText(appointment.urgency)}</p>
                      </div>
                    </div>

                    {appointment.meeting_link ? (
                      <div className="mt-4 p-4 bg-green-50 rounded-lg border border-green-200">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <h4 className="font-medium text-green-800">会议链接已安排</h4>
                            <p className="text-sm text-green-600 mt-1">请按时参加咨询，建议提前5分钟加入</p>
                            <p className="text-xs text-green-500 mt-2 break-all">
                              <span className="font-medium">链接：</span>
                              {appointment.meeting_link}
                            </p>
                          </div>
                          <div className="flex flex-col space-y-2 ml-4">
                            <a
                              href={appointment.meeting_link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-colors"
                            >
                              加入会议
                              <svg className="ml-2 -mr-1 w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
                              </svg>
                            </a>
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(appointment.meeting_link!)
                                  .then(() => {
                                    // 简单的成功提示
                                    const button = document.activeElement as HTMLButtonElement
                                    const originalText = button.textContent
                                    button.textContent = '已复制!'
                                    button.style.backgroundColor = '#10B981'
                                    setTimeout(() => {
                                      button.textContent = originalText
                                      button.style.backgroundColor = ''
                                    }, 2000)
                                  })
                                  .catch(() => {
                                    // 降级处理：手动选中文本
                                    const textArea = document.createElement('textarea')
                                    textArea.value = appointment.meeting_link!
                                    document.body.appendChild(textArea)
                                    textArea.select()
                                    document.execCommand('copy')
                                    document.body.removeChild(textArea)
                                    
                                    const button = document.activeElement as HTMLButtonElement
                                    const originalText = button.textContent
                                    button.textContent = '已复制!'
                                    button.style.backgroundColor = '#10B981'
                                    setTimeout(() => {
                                      button.textContent = originalText
                                      button.style.backgroundColor = ''
                                    }, 2000)
                                  })
                              }}
                              className="inline-flex items-center px-3 py-1 border border-green-300 rounded-md text-xs font-medium text-green-700 bg-green-50 hover:bg-green-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-colors"
                            >
                              <svg className="mr-1 h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                              </svg>
                              复制链接
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : appointment.status === 'confirmed' ? (
                      <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                        <div className="flex items-center">
                          <div className="flex-shrink-0">
                            <svg className="h-5 w-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          </div>
                          <div className="ml-3">
                            <h4 className="font-medium text-blue-800">会议安排中</h4>
                            <p className="text-sm text-blue-600 mt-1">咨询师正在安排会议链接，请耐心等待</p>
                          </div>
                        </div>
                      </div>
                    ) : null}

                    <div className="mt-4 text-xs text-gray-500">
                      创建时间: {format(new Date(appointment.created_at), 'yyyy-MM-dd HH:mm', { locale: zhCN })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Back to Dashboard */}
        <div className="mt-8 text-center">
          <button
            onClick={() => window.history.back()}
            className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-indigo-600 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 shadow-sm"
          >
            <svg className="mr-2 -ml-1 w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
            </svg>
            返回主页
          </button>
        </div>
      </div>
    </div>
  )
}

export default MyAppointments