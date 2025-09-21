import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'

// 创建 QueryClient 实例
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // 数据在5分钟内被认为是新鲜的
      staleTime: 5 * 60 * 1000,
      // 数据在10分钟后从缓存中移除
      gcTime: 10 * 60 * 1000,
      // 失败时重试3次
      retry: 3,
      // 窗口重新获得焦点时重新获取数据
      refetchOnWindowFocus: false,
    },
    mutations: {
      // 失败时重试1次
      retry: 1,
    },
  },
})

interface QueryProviderProps {
  children: React.ReactNode
}

export function QueryProvider({ children }: QueryProviderProps) {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {/* 开发环境下显示 React Query DevTools */}
      {process.env.NODE_ENV === 'development' && (
        <ReactQueryDevtools initialIsOpen={false} />
      )}
    </QueryClientProvider>
  )
}

export { queryClient }
