import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  listAdminUsers,
  listAdminChatSessions,
  listAdminChatMessages,
  listAdminUserAppointments,
  grantAdminUserAccess,
  revokeAdminUserAccess,
  updateAdminAppointmentStatus,
} from "../lib/adminApi";

// Query Keys
export const adminKeys = {
  users: (params: Record<string, unknown>) => ["admin-users", params] as const,
  userAppointments: (userId: string, params: Record<string, unknown>) =>
    ["admin-user-appointments", userId, params] as const,
  chatSessions: (
    userId: string,
    aiModel?: string | null,
    appointmentId?: number | null,
    page?: number,
    pageSize?: number
  ) =>
    [
      "admin-chat-sessions",
      userId,
      aiModel ?? null,
      appointmentId ?? null,
      page,
      pageSize,
    ] as const,
  chatMessages: (sessionId: string, page?: number, pageSize?: number) =>
    ["admin-chat-messages", sessionId, page, pageSize] as const,
  userAccessPolicy: (userId: string) => ["user-access-policy", userId] as const,
};

// Users
export interface UseAdminUsersParams {
  q?: string;
  accessType?: string;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  order?: "asc" | "desc";
}

export function useAdminUsersQuery(params: UseAdminUsersParams) {
  return useQuery({
    queryKey: adminKeys.users(params as Record<string, unknown>),
    queryFn: async () => {
      const res = await listAdminUsers(params as any);
      return res;
    },
  });
}

// User appointments (modal)
export interface UseUserAppointmentsParams {
  userId: string;
  page?: number;
  pageSize?: number;
  status?: string;
  category?: "all" | "doubao" | "peppy" | "human";
}

export function useUserAppointmentsQuery(params: UseUserAppointmentsParams) {
  const { userId, ...rest } = params;
  return useQuery({
    queryKey: adminKeys.userAppointments(userId, rest),
    queryFn: async () => {
      const res = await listAdminUserAppointments({ userId, ...rest });
      return res;
    },
    enabled: !!userId,
  });
}

// Chat sessions (left pane)
export interface UseAdminChatSessionsParams {
  userId: string;
  aiModel?: "doubao" | "peppy";
  appointmentId?: number;
  page?: number;
  pageSize?: number;
}

export function useAdminChatSessionsQuery(params: UseAdminChatSessionsParams) {
  const { userId, aiModel, appointmentId, page, pageSize } = params;
  return useQuery({
    queryKey: adminKeys.chatSessions(
      userId,
      aiModel ?? null,
      appointmentId ?? null,
      page,
      pageSize
    ),
    queryFn: async () => {
      const res = await listAdminChatSessions({
        userId,
        aiModel,
        appointmentId,
        page,
        pageSize,
      } as any);
      return res;
    },
    enabled: !!userId,
  });
}

// Chat messages (right pane)
export interface UseAdminChatMessagesParams {
  sessionId: string;
  page?: number;
  pageSize?: number;
}

export function useAdminChatMessagesQuery(params: UseAdminChatMessagesParams) {
  const { sessionId, page, pageSize } = params;
  return useQuery({
    queryKey: adminKeys.chatMessages(sessionId, page, pageSize),
    queryFn: async () => {
      const res = await listAdminChatMessages({
        sessionId,
        page,
        pageSize,
      } as any);
      return res;
    },
    enabled: !!sessionId,
  });
}

// Access policy
export function useUserAccessPolicyQuery(userId: string) {
  return useQuery({
    queryKey: adminKeys.userAccessPolicy(userId),
    queryFn: async () => {
      const res = await revokeAdminUserAccess(userId, "__noop__");
      return res;
    },
    enabled: !!userId && false,
  });
}

// Mutations
export function useUpdateUserAccessMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      userId,
      role,
      action,
    }: {
      userId: string;
      role: string;
      action: "grant" | "revoke";
    }) => {
      if (action === "grant") return grantAdminUserAccess(userId, role);
      return revokeAdminUserAccess(userId, role);
    },
    // 乐观更新，立即更新表格中的该用户 access_type
    onMutate: async (vars) => {
      await qc.cancelQueries({ queryKey: ["admin-users"] })
      const previous = qc.getQueriesData({ queryKey: ["admin-users"] })
      const nextAccess = vars.action === 'grant' ? vars.role : null

      previous.forEach(([key, snapshot]: any) => {
        if (!snapshot) return
        const users = snapshot.users || snapshot.items
        if (Array.isArray(users)) {
          const updated = users.map((u: any) => (
            u.user_id === vars.userId ? { ...u, access_type: nextAccess } : u
          ))
          const payload = snapshot.users
            ? { ...snapshot, users: updated }
            : { ...snapshot, items: updated }
          qc.setQueryData(key as any, payload)
        }
      })

      return { previous }
    },
    onError: (_err, _vars, ctx) => {
      ctx?.previous?.forEach?.(([key, data]: any) => {
        qc.setQueryData(key as any, data)
      })
    },
    onSettled: (_data, _err, vars) => {
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      qc.invalidateQueries({ queryKey: adminKeys.userAccessPolicy(vars.userId) });
    },
  });
}

export function useUpdateAppointmentStatusMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      appointmentId,
      status,
      userId,
    }: {
      appointmentId: number;
      status: string;
      userId?: string;
    }) => {
      return updateAdminAppointmentStatus(appointmentId, status);
    },
    onSuccess: (_data, vars) => {
      if (vars.userId) {
        qc.invalidateQueries({
          queryKey: ["admin-user-appointments", vars.userId],
        });
      }
    },
  });
}
