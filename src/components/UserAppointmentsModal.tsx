import React, { useMemo, useState } from "react";
import { useQueries } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useUserAppointmentsQuery } from "@/hooks/useAdminQueries";
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
  const { t } = useTranslation();
  const [status, setStatus] = useState("");
  const [category, setCategory] = useState<"all" | "doubao" | "peppy" | "human">(
    "all"
  );

  const { data, isLoading } = useUserAppointmentsQuery({
    userId,
    page: 1,
    pageSize: 9999,
    status: undefined,
    category: "all",
  });

  const allItems = useMemo(
    () => (data as any)?.appointments || (data as any)?.items || [],
    [data]
  );

  const filteredItems = useMemo(() => {
    return allItems.filter((appointment: any) => {
      const matchStatus = status ? appointment.status === status : true;
      let matchCategory = true;

      if (category !== "all") {
        if (category === "human") matchCategory = appointment.appointment_type === "human";
        if (category === "doubao") {
          matchCategory =
            appointment.appointment_type === "ai" && appointment.ai_model === "doubao";
        }
        if (category === "peppy") {
          matchCategory =
            appointment.appointment_type === "ai" && appointment.ai_model === "peppy";
        }
      }

      return matchStatus && matchCategory;
    });
  }, [allItems, category, status]);

  const aiAppointmentIds = useMemo(
    () =>
      filteredItems
        .filter((appointment: any) => appointment.appointment_type === "ai")
        .map((appointment: any) => appointment.id),
    [filteredItems]
  );

  const presenceQueries = useQueries({
    queries: aiAppointmentIds.map((appointmentId: number) => ({
      queryKey: ["appt-session-exists", userId, appointmentId],
      queryFn: async () => {
        const result = await listAdminChatSessions({
          userId,
          appointmentId,
          isAppointment: true,
          page: 1,
          pageSize: 1,
        } as any);
        const sessions = (result as any)?.sessions || (result as any)?.items || [];
        return sessions.length > 0;
      },
      enabled: !!userId,
      staleTime: 5 * 60_000,
      gcTime: 30 * 60_000,
      retry: false,
    })),
  });

  const apptHasSessionMap = useMemo(() => {
    const map: Record<number, boolean> = {};
    presenceQueries.forEach((query, index) => {
      map[aiAppointmentIds[index]] = (query.data as boolean) ?? false;
    });
    return map;
  }, [aiAppointmentIds, presenceQueries]);

  const loadingSet = useMemo(() => {
    const set = new Set<number>();
    presenceQueries.forEach((query, index) => {
      if (query.isLoading || query.isFetching) {
        set.add(aiAppointmentIds[index]);
      }
    });
    return set;
  }, [aiAppointmentIds, presenceQueries]);

  const columns = useMemo(
    () => [
      { header: t("userAppointmentsModal.columns.date"), field: "appointment_date", width: "120px" },
      {
        header: t("userAppointmentsModal.columns.time"),
        width: "160px",
        cellRenderer: (params: any) => {
          const row = params?.data || {};
          return `${(row.start_time || "").slice(0, 5)} - ${(row.end_time || "").slice(0, 5)}`;
        },
      },
      {
        header: t("userAppointmentsModal.columns.type"),
        width: "160px",
        cellRenderer: (params: any) => {
          const row = params?.data || {};
          if (row.appointment_type === "ai") return `AI-${row.ai_model || ""}`;
          const name = row.counselor_name ? ` (${row.counselor_name})` : "";
          return t("userAppointmentsModal.humanType", { name });
        },
      },
      { header: t("userAppointmentsModal.columns.status"), field: "status", width: "120px" },
      {
        header: t("userAppointmentsModal.columns.meetingLink"),
        width: "260px",
        cellRenderer: (params: any) => {
          const row = params?.data || {};
          return row.appointment_type === "human" && row.meeting_link ? (
            <span className="block truncate" title={row.meeting_link}>
              {row.meeting_link}
            </span>
          ) : (
            <span className="text-gray-400">-</span>
          );
        },
      },
      {
        header: t("userAppointmentsModal.columns.actions"),
        width: "120px",
        cellRenderer: (params: any) => {
          const row = params?.data || {};
          if (row.appointment_type !== "ai") return <span className="text-gray-400">-</span>;
          if (loadingSet.has(row.id)) {
            return <span className="text-gray-400">{t("userAppointmentsModal.checking")}</span>;
          }
          if (!apptHasSessionMap[row.id]) {
            return <span className="text-gray-400">{t("userAppointmentsModal.noChat")}</span>;
          }
          return (
            <a
              className="text-blue-600 hover:underline"
              href={`/admin/chat-viewer?userId=${encodeURIComponent(row.user_id)}&appointmentId=${row.id}`}
              target="_blank"
              rel="noreferrer"
            >
              {t("userAppointmentsModal.viewChat")}
            </a>
          );
        },
      },
    ],
    [apptHasSessionMap, loadingSet, t]
  );

  const tableData = filteredItems.map((appointment: any) => ({
    appointment_date: appointment.appointment_date,
    start_time: appointment.start_time,
    end_time: appointment.end_time,
    appointment_type: appointment.appointment_type,
    ai_model: appointment.ai_model,
    meeting_link: appointment.meeting_link,
    user_id: appointment.user_id,
    id: appointment.id,
    status: appointment.status,
    counselor_name: appointment.counselor_name,
  }));

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded shadow-xl w-[95vw] max-w-6xl h-[81vh] flex flex-col">
        <div className="p-4 border-b flex items-center justify-between">
          <div className="font-semibold">
            {t("userAppointmentsModal.title", {
              user: userName || t("userAppointmentsModal.userFallback"),
            })}
          </div>
          <button className="text-gray-500 hover:text-black" onClick={onClose}>
            {t("userAppointmentsModal.close")}
          </button>
        </div>
        <div className="p-3 flex flex-wrap gap-3 items-center">
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as any)}
            className="px-2 py-1 border rounded"
          >
            <option value="all">{t("userAppointmentsModal.all")}</option>
            <option value="doubao">{t("userAppointmentsModal.doubao")}</option>
            <option value="peppy">{t("userAppointmentsModal.peppy")}</option>
            <option value="human">{t("userAppointmentsModal.human")}</option>
          </select>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="px-2 py-1 border rounded"
          >
            <option value="">{t("userAppointmentsModal.allStatus")}</option>
            <option value="confirmed">{t("userAppointmentsModal.confirmed")}</option>
            <option value="cancelled">{t("userAppointmentsModal.cancelled")}</option>
            <option value="pending">{t("userAppointmentsModal.pending")}</option>
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
