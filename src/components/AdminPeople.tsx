import React, { useCallback, useMemo, useRef, useState } from "react";
import { useQueries } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  useAdminUsersQuery,
  useUpdateUserAccessMutation,
} from "@/hooks/useAdminQueries";
import { useAdminRealtimeSync } from "@/hooks/useAdminRealtimeSync";
import { listAdminChatSessions } from "@/lib/adminApi";
import UserAppointmentsModal from "@/components/UserAppointmentsModal";
import DataTable from "./DataTable";

type AccessType = "all" | "doubao_only" | "peppy_only" | "human_only";

export default function AdminPeople() {
  const { t } = useTranslation();
  useAdminRealtimeSync();

  const [accessType, setAccessType] = useState<AccessType>("all");
  const { data, isLoading } = useAdminUsersQuery({
    page: 1,
    pageSize: 9999,
    accessType,
    sortBy: "last_appointment_at",
    order: "desc",
  });
  const users = (data as any)?.users || (data as any)?.items || [];

  const [modalUserId, setModalUserId] = useState<string | null>(null);
  const [modalUserName, setModalUserName] = useState("");
  const [confirmChange, setConfirmChange] = useState<{
    userId: string;
    next: AccessType;
    email?: string;
  } | null>(null);

  const { mutateAsync: updateAccess, isPending: accessPending } =
    useUpdateUserAccessMutation();

  const userIds = useMemo(
    () => users.map((user: any) => user.user_id).filter(Boolean),
    [users]
  );

  const presenceQueries = useQueries({
    queries: userIds.map((uid) => ({
      queryKey: ["non-appt-presence", uid],
      queryFn: async () => {
        const result = await listAdminChatSessions({
          userId: uid,
          isAppointment: false,
          page: 1,
          pageSize: 1,
        } as any);
        const sessions = (result as any)?.sessions || (result as any)?.items || [];
        return sessions.length > 0;
      },
      enabled: !!uid,
      staleTime: 5 * 60_000,
      gcTime: 30 * 60_000,
      retry: false,
    })),
  });

  const hasNonApptMapRef = useRef<Record<string, boolean>>({});
  const loadingSetRef = useRef<Set<string>>(new Set());

  hasNonApptMapRef.current = userIds.reduce((acc, uid, index) => {
    acc[uid] = Boolean(presenceQueries[index]?.data);
    return acc;
  }, {} as Record<string, boolean>);

  loadingSetRef.current = new Set(
    userIds.filter((uid, index) => {
      const query = presenceQueries[index];
      return query?.isLoading || query?.isFetching;
    })
  );

  const accessLabel = useCallback(
    (value: AccessType) => {
      switch (value) {
        case "doubao_only":
          return t("adminPeople.doubao");
        case "peppy_only":
          return t("adminPeople.peppy");
        case "human_only":
          return t("adminPeople.human");
        default:
          return t("adminPeople.allCategories");
      }
    },
    [t]
  );

  const handleChangeAccess = useCallback(
    async (userId: string, next: AccessType) => {
      if (next === "all") {
        await updateAccess({ userId, role: "", action: "revoke" });
      } else {
        await updateAccess({ userId, role: next, action: "grant" });
      }
    },
    [updateAccess]
  );

  const columns = useMemo(
    () => [
      { header: t("adminPeople.columns.name"), field: "name", width: "140px" },
      { header: t("adminPeople.columns.phone"), field: "phone", width: "140px" },
      {
        header: t("adminPeople.columns.email"),
        field: "email",
        width: "280px",
      },
      {
        header: t("adminPeople.columns.accessType"),
        field: "access_type",
        width: "140px",
        cellRenderer: (params: any) => (
          <select
            className="px-2 py-1 border rounded"
            value={(params?.data?.access_type || "all") as AccessType}
            onChange={(e) =>
              setConfirmChange({
                userId: params?.data?.user_id,
                email: params?.data?.email,
                next: e.target.value as AccessType,
              })
            }
            disabled={accessPending}
          >
            <option value="doubao_only">{t("adminPeople.doubao")}</option>
            <option value="peppy_only">{t("adminPeople.peppy")}</option>
            <option value="human_only">{t("adminPeople.human")}</option>
          </select>
        ),
      },
      {
        header: t("adminPeople.columns.appointmentCount"),
        field: "appointment_count",
        width: "120px",
      },
      {
        header: t("adminPeople.columns.lastAppointmentAt"),
        field: "last_appointment_at",
        width: "200px",
        cellRenderer: (params: any) =>
          params.data.last_appointment_at
            ? new Date(params.data.last_appointment_at).toLocaleString()
            : "-",
      },
      {
        header: t("adminPeople.columns.actions"),
        width: "140px",
        cellRenderer: (params: any) => (
          <button
            className="px-3 py-1 bg-blue-600 text-white rounded"
            onClick={() => {
              setModalUserId(params.data.user_id);
              setModalUserName(params.data.name || "");
            }}
          >
            {t("adminPeople.viewAppointments")}
          </button>
        ),
      },
      {
        header: t("adminPeople.nonAppointmentChat"),
        width: "140px",
        cellRenderer: (params: any) => {
          const uid = params?.data?.user_id as string;
          if (!uid) return <span className="text-gray-400">-</span>;
          if (loadingSetRef.current.has(uid)) {
            return <span className="text-gray-400">{t("adminPeople.checking")}</span>;
          }
          if (!hasNonApptMapRef.current[uid]) {
            return <span className="text-gray-400">-</span>;
          }
          return (
            <a
              className="text-blue-600 hover:underline"
              href={`/admin/chat-viewer?userId=${encodeURIComponent(uid)}&isAppointment=false`}
              target="_blank"
              rel="noreferrer"
            >
              {t("adminPeople.view")}
            </a>
          );
        },
      },
    ],
    [accessPending, t]
  );

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-2">
        <select
          className="px-2 py-1 border rounded"
          value={accessType}
          onChange={(e) => setAccessType(e.target.value as AccessType)}
        >
          <option value="all">{t("adminPeople.allCategories")}</option>
          <option value="doubao_only">{t("adminPeople.doubao")}</option>
          <option value="peppy_only">{t("adminPeople.peppy")}</option>
          <option value="human_only">{t("adminPeople.human")}</option>
        </select>
        <span className="text-xs text-gray-500">{t("adminPeople.filterHint")}</span>
      </div>

      <DataTable
        columns={columns}
        data={users}
        height={520}
        loading={isLoading}
        searchPlaceholder={t("adminPeople.searchPlaceholder")}
        preservePagination={true}
      />

      <UserAppointmentsModal
        open={!!modalUserId}
        onClose={() => setModalUserId(null)}
        userId={modalUserId || ""}
        userName={modalUserName}
      />

      {confirmChange && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded shadow-xl w-[90vw] max-w-md">
            <div className="p-4 border-b text-lg font-semibold">
              {t("adminPeople.confirmTitle")}
            </div>
            <div className="p-4 space-y-2 text-sm">
              <div>
                {t("adminPeople.confirmBody", {
                  email: confirmChange.email || "-",
                  next: accessLabel(confirmChange.next),
                })}
              </div>
              <div className="text-gray-500">{t("adminPeople.effectiveImmediately")}</div>
            </div>
            <div className="p-3 border-t flex justify-end gap-2">
              <button className="px-3 py-1 rounded border" onClick={() => setConfirmChange(null)}>
                {t("common.cancel")}
              </button>
              <button
                className="px-3 py-1 rounded bg-blue-600 text-white disabled:opacity-60"
                disabled={accessPending}
                onClick={async () => {
                  if (!confirmChange) return;
                  await handleChangeAccess(confirmChange.userId, confirmChange.next);
                  setConfirmChange(null);
                }}
              >
                {t("common.confirm")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
