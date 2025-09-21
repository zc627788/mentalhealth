import React, { useMemo, useState } from "react";
import { useUserAppointmentsQuery } from "@/hooks/useAdminQueries";
import { useQueries } from "@tanstack/react-query";
import { listAdminChatSessions } from "@/lib/adminApi";
import DataTable from "./DataTable";

export default function UserAppointmentsModal({
  open,
  onClose,
  userId,
  userName,
}: {
  open: boolean;
  onClose: () => void;
  userId: string;
  userName: string;
}) {
  const page = 1;
  const pageSize = 9999;
  const [status, setStatus] = useState<string>("");
  const [category, setCategory] = useState<
    "all" | "doubao" | "peppy" | "human"
  >("all");

  const { data, isLoading } = useUserAppointmentsQuery({
    userId,
    page,
    pageSize,
    status: undefined,
    category: "all",
  });
  console.log("🚀 ~ file: UserAppointmentsModal.tsx:12 ~ data:", data);
  const allItems = useMemo(
    () => (data as any)?.appointments || (data as any)?.items || [],
    [data]
  );

  const filteredItems = useMemo(() => {
    return allItems.filter((a: any) => {
      const matchStatus = status ? a.status === status : true;
      let matchCategory = true;
      if (category !== "all") {
        if (category === "human")
          matchCategory = a.appointment_type === "human";
        if (category === "doubao")
          matchCategory =
            a.appointment_type === "ai" && a.ai_model === "doubao";
        if (category === "peppy")
          matchCategory = a.appointment_type === "ai" && a.ai_model === "peppy";
      }
      return matchStatus && matchCategory;
    });
  }, [allItems, status, category]);

  // 为所有 AI 预约并行检测是否有对应的聊天会话
  const aiAppointmentIds = useMemo(
    () => filteredItems.filter((a: any) => a.appointment_type === "ai").map((a: any) => a.id),
    [filteredItems]
  )
  const presenceQueries = useQueries({
    queries: aiAppointmentIds.map((aid: number) => ({
      queryKey: ["appt-session-exists", userId, aid],
      queryFn: async () => {
        const res = await listAdminChatSessions({ userId, appointmentId: aid, isAppointment: true, page: 1, pageSize: 1 } as any)
        const sessions = (res as any)?.sessions || (res as any)?.items || []
        return sessions.length > 0
      },
      enabled: !!userId,
      staleTime: 5 * 60_000,
      gcTime: 30 * 60_000,
      retry: false,
    }))
  })
  const apptHasSessionMap = useMemo(() => {
    const m: Record<number, boolean> = {}
    presenceQueries.forEach((q, i) => { m[aiAppointmentIds[i]] = (q.data as boolean) ?? false })
    return m
  }, [presenceQueries, aiAppointmentIds])
  const loadingSet = useMemo(() => {
    const s = new Set<number>()
    presenceQueries.forEach((q, i) => { if (q.isLoading || q.isFetching) s.add(aiAppointmentIds[i]) })
    return s
  }, [presenceQueries, aiAppointmentIds])

  const columns = useMemo(
    () => [
      { header: "日期", field: "appointment_date", width: "120px" },
      {
        header: "时间",
        width: "160px",
        cellRenderer: (p: any) => {
          const r = p?.data || {};
          const st = (r.start_time || "").slice(0, 5);
          const et = (r.end_time || "").slice(0, 5);
          return `${st} - ${et}`;
        },
      },
      {
        header: "类型",
        width: "160px",
        cellRenderer: (p: any) => {
          const r = p?.data || {};
          console.log("🚀 ~ file: UserAppointmentsModal.tsx:38 ~  r:", r);
          if (r.appointment_type === "ai") return `AI-${r.ai_model || ""}`;
          const name = r.counselor_name ? `(${r.counselor_name})` : "";
          return `人类${name}`;
        },
      },
      { header: "状态", field: "status", width: "120px" },
      {
        header: "会议链接",
        width: "260px",
        cellRenderer: (p: any) => {
          const r = p?.data || {};
          return r.appointment_type === "human" && r.meeting_link ? (
            <span
              className="block truncate"
              title={r.meeting_link}
            >
              {r.meeting_link}
            </span>
          ) : (
            <span className="text-gray-400">-</span>
          );
        },
      },
  
       {
         header: "操作",
         width: "120px",
         cellRenderer: (p: any) => {
           const r = p?.data || {}
           if (r.appointment_type !== "ai") return <span className="text-gray-400">-</span>
           if (loadingSet.has(r.id)) return <span className="text-gray-400">检查中…</span>
           const has = apptHasSessionMap[r.id]
           if (!has) return <span className="text-gray-400">暂未对话</span>
           return (
             <a
               className="text-blue-600 hover:underline"
               href={`/admin/chat-viewer?userId=${encodeURIComponent(r.user_id)}&appointmentId=${r.id}`}
               target="_blank"
               rel="noreferrer"
             >
               查看聊天
             </a>
           )
         },
       },
    ],
    [apptHasSessionMap, loadingSet]
  );

  // 将数据映射为 DataTable 需要的字段顺序（便于 cellRenderer 读取）
  const tableData = filteredItems.map((a: any) => ({
    appointment_date: a.appointment_date,
    start_time: a.start_time,
    end_time: a.end_time,
    appointment_type: a.appointment_type,
    ai_model: a.ai_model,
    meeting_link: a.meeting_link,
    notes: a.notes,
    user_id: a.user_id,
    id: a.id,
    status: a.status,
    counselor_name: a.counselor_name,
  }));

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded shadow-xl w-[95vw] max-w-6xl h-[81vh] flex flex-col">
        <div className="p-4 border-b flex items-center justify-between">
          <div className="font-semibold">{userName || "用户"} 的预约记录</div>
          <button className="text-gray-500 hover:text-black" onClick={onClose}>
            关闭
          </button>
        </div>
        <div className="p-3 flex flex-wrap gap-3 items-center ">
          <select
            value={category}
            onChange={(e) => {
              setCategory(e.target.value as any);
            }}
            className="px-2 py-1 border rounded"
          >
            <option value="all">全部</option>
            <option value="doubao">豆包</option>
            <option value="peppy">Peppy</option>
            <option value="human">人类</option>
          </select>
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
            }}
            className="px-2 py-1 border rounded"
          >
            <option value="">全部状态</option>
            <option value="confirmed">已确认</option>
            <option value="cancelled">已取消</option>
            <option value="pending">待确认</option>
          </select>
        </div>
        <div className="flex-1 overflow-auto p-2">
          <DataTable
            columns={columns as any}
            data={tableData}
            height={700}
            loading={isLoading}
            className="border rounded p-2"
          />
        </div>
      </div>
    </div>
  );
}
