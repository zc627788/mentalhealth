import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQueries } from "@tanstack/react-query";
import {
  useAdminUsersQuery,
  useUpdateUserAccessMutation,
} from "@/hooks/useAdminQueries";
import UserAppointmentsModal from "@/components/UserAppointmentsModal";
import DataTable from "./DataTable";
import { useAdminRealtimeSync } from "@/hooks/useAdminRealtimeSync";
import { listAdminChatSessions } from "@/lib/adminApi";

type AccessType = "all" | "doubao_only" | "peppy_only" | "human_only";

export default function AdminPeople() {
  useAdminRealtimeSync()
  const [accessType, setAccessType] = useState<AccessType>("all");

  // 拉全量（上限9999）
  const page = 1;
  const pageSize = 9999;
  const { data, isLoading, refetch } = useAdminUsersQuery({
    page,
    pageSize,
    accessType,
    sortBy: "last_appointment_at",
    order: "desc",
  });
  const users = (data as any)?.users || (data as any)?.items || [];

  const [modalUserId, setModalUserId] = useState<string | null>(null);
  const [modalUserName, setModalUserName] = useState<string>("");

  // 基于 React Query 的非预约会话存在性探测
  const userIds = useMemo(() => (users || []).map((u: any) => u.user_id).filter(Boolean), [users])
  const presenceQueries = useQueries({
    queries: userIds.map((uid) => ({
      queryKey: ["non-appt-presence", uid],
      queryFn: async () => {
        const res = await listAdminChatSessions({ userId: uid, isAppointment: false, page: 1, pageSize: 1 } as any)
        const sessions = (res as any)?.sessions || (res as any)?.items || []
        return sessions.length > 0
      },
      enabled: !!uid,
      staleTime: 5 * 60_000,
      gcTime: 30 * 60_000,
      retry: false,
    }))
  })
  const hasNonApptMap = useMemo(() => {
    const map: Record<string, boolean> = {}
    presenceQueries.forEach((q, i) => { map[userIds[i]] = (q.data as boolean) ?? false })
    return map
  }, [presenceQueries, userIds])
  const loadingSet = useMemo(() => {
    const s = new Set<string>()
    presenceQueries.forEach((q, i) => { if (q.isLoading || q.isFetching) s.add(userIds[i]) })
    return s
  }, [presenceQueries, userIds])

  // 使用 ref 保存映射，避免 columns 依赖频繁变化导致表格重建
  const hasNonApptMapRef = useRef<Record<string, boolean>>({})
  const loadingSetRef = useRef<Set<string>>(new Set())
  useEffect(() => {
    hasNonApptMapRef.current = hasNonApptMap
  }, [hasNonApptMap])
  useEffect(() => {
    loadingSetRef.current = loadingSet
  }, [loadingSet])

  // 进页面自动由 React Query 并行探测，无需本地 useEffect 手写

  const { mutateAsync: updateAccess, isPending: accessPending } =
    useUpdateUserAccessMutation();

  const [confirmChange, setConfirmChange] = useState<
    | {
        userId: string;
        next: AccessType;
        email?: string;
      }
    | null
  >(null);

  const handleChangeAccess = useCallback(
    async (userId: string, next: AccessType) => {
      try {
        if (next === "all") {
          await updateAccess({ userId, role: "", action: "revoke" });
        } else {
          await updateAccess({ userId, role: next, action: "grant" });
        }
      } catch (e) {
        console.error(e);
      }
    },
    [updateAccess]
  );

  const accessLabel = useCallback((v: AccessType) => {
    if (v === "doubao_only") return "豆包";
    if (v === "peppy_only") return "Peppy";
    if (v === "human_only") return "人类咨询";
    return "全部";
  }, []);

  const columns = useMemo(
    () => [
      { header: "姓名", field: "name", width: '140px' },
      { header: "手机号", field: "phone", width: '140px' },
      {
        header: "邮箱",
        field: "email",
        width: '280px',
        cellRenderer: (p: any) => (
          <span className="block truncate max-w-full" title={p?.data?.email || ''}>
            {p?.data?.email || '-'}
          </span>
        ),
      },
      {
        header: "服务分类",
        field: "access_type",
        width: '140px',
        cellRenderer: (p: any) => (
          <select
            className="px-2 py-1 border rounded"
            value={(p?.data?.access_type || "all") as AccessType}
            onClick={(e) => { e.stopPropagation() }}
            onMouseDown={(e) => { e.stopPropagation() }}
            onKeyDown={(e) => { e.stopPropagation() }}
            onChange={(e) => {
              e.stopPropagation()
              const next = e.target.value as AccessType;
              setConfirmChange({
                userId: p?.data?.user_id,
                email: p?.data?.email,
                next,
              });
            }}
            disabled={accessPending}
          >
            <option value="doubao_only">豆包</option>
            <option value="peppy_only">Peppy</option>
            <option value="human_only">人类咨询</option>
          </select>
        ),
      },
      { header: "预约次数", field: "appointment_count", width: '120px' },
      {
        header: "最近预约时间",
        field: "last_appointment_at",
        width: '200px',
        cellRenderer: (p: any) =>
          p.data.last_appointment_at
            ? new Date(p.data.last_appointment_at).toLocaleString()
            : "-",
      },
      {
        header: "操作",
        width: '140px',
        cellRenderer: (p: any) => (
          <button
            className="px-3 py-1 bg-blue-600 text-white rounded"
            onClick={() => {
              setModalUserId(p.data.user_id);
              setModalUserName(p.data.name || "");
            }}
          >
            查看预约
          </button>
        ),
      },
      {
        header: "非预约会话",
        width: '140px',
        cellRenderer: (p: any) => {
          const uid = p?.data?.user_id as string
          if (!uid) return <span className="text-gray-400">-</span>
          const known = hasNonApptMapRef.current[uid]
          const isLoading = loadingSetRef.current.has(uid)
          if (isLoading) return <span className="text-gray-400">检查中…</span>
          if (!known) return <span className="text-gray-400">-</span>
          return (
            <a className="text-blue-600 hover:underline" href={`/admin/chat-viewer?userId=${encodeURIComponent(uid)}&isAppointment=false`} target="_blank" rel="noreferrer">查看</a>
          )
        }
      },
    ],
    // 仅依赖最小化、稳定的引用，避免 columns 变化导致 Grid 重建
    [accessPending]
  );

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-2">
        <select
		className="px-2 py-1 border rounded"
          value={accessType}
          onChange={(e) => {
            const v = e.target.value as AccessType;
            setAccessType(v);
          }}
        >
          <option value="all">全部分类</option>
          <option value="doubao_only">豆包</option>
          <option value="peppy_only">Peppy</option>
          <option value="human_only">人类</option>
        </select>
        <span className="text-xs text-gray-500">支持服务分类筛选</span>
      </div>

      <DataTable
        columns={columns}
        data={users}
        height={520}
        loading={isLoading}
        searchPlaceholder="搜索姓名/手机号/邮箱"
        preservePagination={true}
      />

      <UserAppointmentsModal
        open={!!modalUserId}
        onClose={() => {
          setModalUserId(null);
        }}
        userId={modalUserId || ""}
        userName={modalUserName}
      />

      {confirmChange && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded shadow-xl w-[90vw] max-w-md">
            <div className="p-4 border-b text-lg font-semibold">确认变更</div>
            <div className="p-4 space-y-2 text-sm">
              <div>
                确认将
                <span className="mx-1 font-semibold">{confirmChange.email || '该用户'}</span>
                的服务分类调整为
                <span className="mx-1 font-semibold">{accessLabel(confirmChange.next)}</span>
                吗？
              </div>
              <div className="text-gray-500">变更后将立即生效。</div>
            </div>
            <div className="p-3 border-t flex justify-end gap-2">
              <button
                className="px-3 py-1 rounded border"
                onClick={() => setConfirmChange(null)}
              >
                取消
              </button>
              <button
                className="px-3 py-1 rounded bg-blue-600 text-white disabled:opacity-60"
                disabled={accessPending}
                onClick={async () => {
                  if (!confirmChange) return
                  await handleChangeAccess(confirmChange.userId, confirmChange.next)
                  setConfirmChange(null)
                }}
              >
                确认
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
