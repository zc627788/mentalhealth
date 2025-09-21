import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

/**
 * 监听会影响人员管理展示的数据变更，并自动触发 React Query 列表刷新。
 * 覆盖：appointments、user_access_policies、meeting_links
 */
export function useAdminRealtimeSync() {
  const qc = useQueryClient()

  useEffect(() => {
    const channel = supabase
      .channel('admin-people-sync')
      // 新用户注册/资料更新（由触发器同步到 public.user_profiles）
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_profiles' }, () => {
        qc.invalidateQueries({ queryKey: ['admin-users'] })
      })
      // 管理员表变更（可能影响权限/展示）
      .on('postgres_changes', { event: '*', schema: 'public', table: 'admin_users' }, () => {
        qc.invalidateQueries({ queryKey: ['admin-users'] })
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments' }, () => {
        // 人员列表的 预约次数/最近预约时间 可能变化
        qc.invalidateQueries({ queryKey: ['admin-users'] })
        // 打开的任意用户预约弹窗需要刷新
        qc.invalidateQueries({ predicate: (q) => String(q.queryKey?.[0]) === 'admin-user-appointments' })
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_access_policies' }, () => {
        // 服务分类变化
        qc.invalidateQueries({ queryKey: ['admin-users'] })
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'meeting_links' }, () => {
        // 会议链接更新后，预约弹窗的数据需要刷新
        qc.invalidateQueries({ predicate: (q) => String(q.queryKey?.[0]) === 'admin-user-appointments' })
      })
      // 非预约会话添加/删除/更新：刷新“非预约会话存在性”与 ChatViewer 列表
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_sessions' }, () => {
        qc.invalidateQueries({ predicate: (q) => String(q.queryKey?.[0]) === 'non-appt-presence' })
        qc.invalidateQueries({ queryKey: ['admin-chat-sessions'] })
        // 触发表格整体重渲染（部分表格库对列 formatter 的依赖变更不敏感）
        qc.invalidateQueries({ queryKey: ['admin-users'] })
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [qc])
}


