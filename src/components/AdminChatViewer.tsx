import React, { useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useAdminChatSessionsQuery, useAdminChatMessagesQuery } from '@/hooks/useAdminQueries'
import VirtualList from './VirtualList'

function useQueryParams() {
	const { search } = useLocation()
	return useMemo(() => new URLSearchParams(search), [search])
}

function Empty({ text = '暂无数据' }: { text?: string }) {
	return (
		<div className="h-full w-full flex items-center justify-center text-gray-500 text-sm">
			{text}
		</div>
	)
}

function Spinner({ text = '加载中…' }: { text?: string }) {
	return (
		<div className="h-full w-full flex items-center justify-center gap-3 text-gray-500 text-sm">
			<div className="h-5 w-5 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin"/>
			<span>{text}</span>
		</div>
	)
}

export default function AdminChatViewer() {
	const qs = useQueryParams()
	const userId = qs.get('userId') || ''
	const initAppointmentId = qs.get('appointmentId') ? Number(qs.get('appointmentId')) : undefined
	const initAiModel = (qs.get('aiModel') as 'doubao'|'peppy'|null) || undefined

	const [page, setPage] = useState(1)
	const [pageSize, setPageSize] = useState(20)
	const { data: sessionsData, isLoading: sessionsLoading } = useAdminChatSessionsQuery({ userId, aiModel: initAiModel, appointmentId: initAppointmentId, page, pageSize })
	const sessions = (sessionsData as any)?.sessions || (sessionsData as any)?.items || []

	const [activeSessionId, setActiveSessionId] = useState<string>('')
	useEffect(() => {
		if (!activeSessionId && sessions.length > 0) {
			setActiveSessionId(sessions[0].id)
		}
	}, [sessions, activeSessionId])

	const { data: messagesData, isLoading: messagesLoading } = useAdminChatMessagesQuery({ sessionId: activeSessionId, page: 1, pageSize: 200 })
	const messages = (messagesData as any)?.messages || (messagesData as any)?.items || []

	return (
		<div className="h-full flex bg-gradient-to-br from-slate-50 to-white">
			<div className="w-80 border-r flex flex-col bg-white/70 backdrop-blur">
				<div className="p-3 font-semibold border-b flex items-center justify-between">
					<span>会话列表</span>
					<span className="text-xs text-gray-500">{sessions.length} 条</span>
				</div>
				<div className="flex-1">
					{sessionsLoading ? (
						<Spinner />
					) : sessions.length === 0 ? (
						<Empty text="暂无会话" />
					) : (
						<VirtualList
							height={Math.min(600, Math.max(300, sessions.length * 64))}
							itemHeight={64}
							items={sessions}
							renderItem={(s: any) => (
								<button
									key={s.id}
									className={`w-full text-left px-3 py-2 border-t hover:bg-slate-50 transition ${activeSessionId === s.id ? 'bg-blue-50' : ''}`}
									onClick={() => setActiveSessionId(s.id)}
								>
									<div className="flex items-center gap-2">
										<span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] ${s.ai_model ? 'bg-blue-100 text-blue-700' : (s.is_appointment ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-700')}`}>
											{s.ai_model ? `AI-${s.ai_model}` : (s.is_appointment ? '人类预约' : '非预约')}
										</span>
										<span className="text-xs text-gray-500">{s.message_count ?? 0} 条消息</span>
									</div>
									<div className="text-xs text-gray-500">{s.last_message_at ? new Date(s.last_message_at).toLocaleString() : ''}</div>
								</button>
							)}
						/>
					)}
				</div>
				<div className="p-2 border-t flex items-center justify-between text-xs text-gray-600">
					<div>共 {sessions.length} 条</div>
					<div className="flex items-center gap-2">
						<button className="px-2 py-1 border rounded" disabled={page <= 1} onClick={() => setPage((p)=>Math.max(1,p-1))}>上一页</button>
						<span>{page}</span>
						<button className="px-2 py-1 border rounded" onClick={() => setPage((p)=>p+1)}>下一页</button>
						<select className="px-2 py-1 border rounded" value={pageSize} onChange={(e)=>{ setPageSize(Number(e.target.value)); setPage(1); }}>
							<option value={20}>20</option>
							<option value={50}>50</option>
							<option value={100}>100</option>
						</select>
					</div>
				</div>
			</div>
			<div className="flex-1 flex flex-col bg-white/60">
				<div className="p-3 border-b font-semibold flex items-center justify-between">
					<span>消息</span>
					<span className="text-xs text-gray-500">{messages.length} 条</span>
				</div>
				<div className="flex-1 p-3">
					{!activeSessionId ? (
						<Empty text="请选择左侧会话" />
					) : messagesLoading ? (
						<Spinner />
					) : messages.length === 0 ? (
						<Empty text="暂无消息" />
					) : (
						<VirtualList
							height={Math.min(700, Math.max(300, messages.length * 96))}
							itemHeight={96}
							items={messages}
							renderItem={(m: any) => (
								<div key={m.id} className={`py-2 flex ${m.sender === 'ai' ? 'justify-start' : 'justify-end'}`}>
									<div className={`flex items-start gap-2 max-w-[85%] ${m.sender === 'ai' ? '' : 'flex-row-reverse'}`}>
										<div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-semibold ${m.sender === 'ai' ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'}`}>
											{m.sender === 'ai' ? 'AI' : 'U'}
										</div>
										<div className={`px-3 py-2 rounded-2xl text-sm whitespace-pre-wrap break-words shadow-sm border ${m.sender === 'ai' ? 'bg-white border-blue-100' : 'bg-blue-600 text-white border-blue-600'}`}>
											<div className={`text-[11px] mb-1 ${m.sender === 'ai' ? 'text-blue-500' : 'text-blue-100/90'}`}>{new Date(m.created_at).toLocaleString()}</div>
											<div>{m.content}</div>
										</div>
									</div>
								</div>
							)}
						/>
					)}
				</div>
			</div>
		</div>
	)
}
