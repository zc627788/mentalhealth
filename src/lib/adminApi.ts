import { supabase, supabaseAnonKey, supabaseUrl } from "./supabase";

export interface ApiErrorShape {
  code?: string;
  message: string;
  details?: unknown;
}

export interface ApiEnvelope<T> {
  success?: boolean;
  data?: T;
  error?: ApiErrorShape | string;
  meta?: unknown;
}

export interface AdminCallOptions {
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

async function callEdgeFunction<TResponse>(
  functionName: string,
  payload: Record<string, unknown>,
  options?: AdminCallOptions
): Promise<TResponse> {
  const url = `${supabaseUrl.replace(/\/$/, "")}/functions/v1/${functionName}`

  // 当前登录态 JWT
  const { data: sessionData } = await supabase.auth.getSession()
  const accessToken = sessionData?.session?.access_token

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'apikey': supabaseAnonKey,
    ...(accessToken ? { 'Authorization': `Bearer ${accessToken}` } : {}),
    ...(options?.headers || {}),
  }

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload ?? {}),
    signal: options?.signal,
  })

  let json: any = null
  try { json = await res.json() } catch { json = null }

  if (!res.ok) {
    const msg = (json && (json.error?.message || json.message)) || `HTTP ${res.status}`
    throw new Error(msg)
  }

  const envelope = json as ApiEnvelope<TResponse>
  if (envelope && typeof envelope === 'object' && ('success' in envelope || 'data' in envelope || 'error' in envelope)) {
    if ((envelope as ApiEnvelope<TResponse>).error) {
      const err = (envelope as ApiEnvelope<TResponse>).error as ApiErrorShape | string
      throw new Error(typeof err === 'string' ? err : err.message || '请求失败')
    }
    return (envelope as ApiEnvelope<TResponse>).data as TResponse
  }

  return json as TResponse
}

// =============================
// admin-chat-sessions
// =============================
export interface AdminChatSession {
  id: string;
  user_id: string;
  session_name?: string;
  ai_model?: string;
  is_active: boolean;
  is_appointment?: boolean;
  appointment_id?: number | null;
  message_count?: number;
  last_message_at?: string;
  created_at?: string;
}

export interface ListChatSessionsParams {
  page?: number;
  pageSize?: number;
  userId?: string;
  activeOnly?: boolean;
}

export async function listAdminChatSessions(
  params: ListChatSessionsParams = {},
  options?: AdminCallOptions
) {
  return callEdgeFunction<{
    sessions: AdminChatSession[];
    meta?: { total?: number; page?: number; pageSize?: number };
  }>("admin-chat-sessions", { action: "list", ...params }, options);
}

export async function getAdminChatSession(
  sessionId: string,
  options?: AdminCallOptions
) {
  return callEdgeFunction<AdminChatSession>(
    "admin-chat-sessions",
    { action: "get", sessionId },
    options
  );
}

export async function closeAdminChatSession(
  sessionId: string,
  options?: AdminCallOptions
) {
  return callEdgeFunction<{ sessionId: string; closed: boolean }>(
    "admin-chat-sessions",
    { action: "close", sessionId },
    options
  );
}

// =============================
// admin-chat-messages
// =============================
export interface AdminChatMessage {
  id: string;
  session_id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

export interface ListChatMessagesParams {
  sessionId: string;
  page?: number;
  pageSize?: number;
}

export async function listAdminChatMessages(
  params: ListChatMessagesParams,
  options?: AdminCallOptions
) {
  return callEdgeFunction<{
    messages: AdminChatMessage[];
    meta?: { total?: number; page?: number; pageSize?: number };
  }>("admin-chat-messages", { action: "list", ...params }, options);
}

export async function deleteAdminChatMessage(
  messageId: string,
  options?: AdminCallOptions
) {
  return callEdgeFunction<{ messageId: string; deleted: boolean }>(
    "admin-chat-messages",
    { action: "delete", messageId },
    options
  );
}

// =============================
// admin-users
// =============================
export interface AdminUserSummary {
  id: string;
  email?: string;
  phone?: string;
  name?: string;
  created_at?: string;
  last_sign_in_at?: string;
  role?: string;
}

export interface ListAdminUsersParams {
  page?: number;
  pageSize?: number;
  keyword?: string;
  role?: string;
}

export async function listAdminUsers(
  params: ListAdminUsersParams = {},
  options?: AdminCallOptions
) {
  return callEdgeFunction<{
    users: AdminUserSummary[];
    meta?: { total?: number; page?: number; pageSize?: number };
  }>("admin-users", { action: "list", ...params }, options);
}

export async function getAdminUser(userId: string, options?: AdminCallOptions) {
  return callEdgeFunction<AdminUserSummary>(
    "admin-users",
    { action: "get", userId },
    options
  );
}

export async function updateAdminUser(
  userId: string,
  updates: Record<string, unknown>,
  options?: AdminCallOptions
) {
  return callEdgeFunction<{ userId: string; updated: boolean }>(
    "admin-users",
    { action: "update", userId, updates },
    options
  );
}

export async function deleteAdminUser(
  userId: string,
  options?: AdminCallOptions
) {
  return callEdgeFunction<{ userId: string; deleted: boolean }>(
    "admin-users",
    { action: "delete", userId },
    options
  );
}

// =============================
// admin-user-appointments
// =============================
export interface AdminAppointmentSummary {
  id: number;
  user_id: string;
  appointment_date: string;
  start_time: string;
  end_time: string;
  topic?: string;
  description?: string;
  status: string;
  counselor_name?: string;
  urgency?: string;
  appointment_type?: string;
  ai_model?: string;
  meeting_link?: string;
  created_at?: string;
}

export interface ListAdminAppointmentsParams {
  userId?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}

export async function listAdminUserAppointments(
  params: ListAdminAppointmentsParams = {},
  options?: AdminCallOptions
) {
  return callEdgeFunction<{
    appointments: AdminAppointmentSummary[];
    meta?: { total?: number; page?: number; pageSize?: number };
  }>("admin-user-appointments", { action: "list", ...params }, options);
}

export async function updateAdminAppointmentStatus(
  appointmentId: number,
  status: string,
  options?: AdminCallOptions
) {
  return callEdgeFunction<{ appointmentId: number; status: string }>(
    "admin-user-appointments",
    { action: "updateStatus", appointmentId, status },
    options
  );
}

// =============================
// admin-user-access
// =============================
export interface AdminUserAccessRecord {
  user_id: string;
  role: string;
  granted_at?: string;
  granted_by?: string;
}

export async function listAdminUserAccess(
  userId: string,
  options?: AdminCallOptions
) {
  return callEdgeFunction<{ access: AdminUserAccessRecord[] }>(
    "admin-user-access",
    { action: "list", userId },
    options
  );
}

export async function grantAdminUserAccess(
  userId: string,
  role: string,
  options?: AdminCallOptions
) {
  return callEdgeFunction<{ userId: string; role: string; granted: boolean }>(
    "admin-user-access",
    { action: "grant", userId, role },
    options
  );
}

export async function revokeAdminUserAccess(
  userId: string,
  role: string,
  options?: AdminCallOptions
) {
  return callEdgeFunction<{ userId: string; role: string; revoked: boolean }>(
    "admin-user-access",
    { action: "revoke", userId, role },
    options
  );
}


