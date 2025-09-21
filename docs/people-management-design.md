## 人员管理模块一条龙设计（高可维护版本）

### 目标与范围
- 目标：为《管理后台》新增“人员管理”Tab，提供注册用户的统一视图、快速检索与服务分类配置，并可查看单个用户的预约记录及AI聊天记录/人类会议纪要。
- 范围：
  - 后端数据建模与访问控制（Supabase 表/视图/Edge Functions）
  - 接口协议与查询规范（分页/搜索/过滤）
  - 前端结构（组件拆分）、react-query 状态管理与权限 Gate
  - 与现有预约/聊天体系的对齐与不破坏原则

### 现状与关键实体（对齐现有 schema）
- 预约：`appointments`（appointment_type: human|ai，ai_model: doubao|peppy，notes 会议纪要，user_email）
- 可用时段：`counselor_availability`（human/ai + ai_model）
- 聊天：`chat_sessions`（ai_model、appointment_id、is_appointment）与 `chat_messages`（session_id、ai_model）
- 用户资料：`user_profiles`（name、phone）与 `profiles`（full_name、phone 等）
- 系统设置：`system_settings.ai_appointment_required`

问题与约束：
- 管理端需要“用户邮箱”用于检索或展示，但邮箱通常在 `auth.users`，建议通过 Edge Function 侧取数统一聚合与脱敏控制。

### 数据建模与访问控制
1) 新增用户服务分类表（解耦访问策略，便于审计与扩展）
```sql
create table if not exists public.user_access_policies (
  user_id uuid primary key references auth.users(id) on delete cascade,
  access_type varchar not null check (access_type in ('doubao_only','peppy_only','human_only')),
  assigned_by uuid references public.admin_users(id),
  reason text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists user_access_policies_access_type_idx on public.user_access_policies (access_type);
```

2) 管理端读取聚合视图（可选，若使用 Edge Function 可不建视图）
```sql
-- 视图示例：拼出人员管理页的主表格需要的核心字段
create or replace view public.v_user_overview as
select
  up.id as user_id,
  coalesce(up.name, p.full_name) as name,
  up.phone as phone,
  null::text as email -- 由 Edge Function 注入，或保留空
  , uap.access_type,
  -- 基本统计（示例：总预约数、最近一次预约时间）
  (select count(*) from public.appointments a where a.user_id = up.id) as appointment_count,
  (select max(a.created_at) from public.appointments a where a.user_id = up.id) as last_appointment_at
from public.user_profiles up
left join public.profiles p on p.id = up.id
left join public.user_access_policies uap on uap.user_id = up.id;
```

3) 访问控制（RLS/函数）
- 建议管理端所有读写经 Edge Functions 完成，函数内以服务密钥或基于 `admin_users` 角色校验，避免直接暴露 `auth.users`。
- 前端仅访问 Edge Functions，减少 RLS 复杂度，确保邮箱等敏感字段只在管理端显示。

### Edge Functions（接口契约）
统一前缀：`/admin/*`，仅管理员调用。

- GET `/admin/users`
  - 查询参数：`q`（关键字：name/phone/email），`accessType`（all|doubao_only|peppy_only|human_only），`page`，`pageSize`（默认 20），`sortBy`（name|created_at|last_appointment_at），`order`（asc|desc）。
  - 返回：
    ```json
    {
      "items": [
        {
          "user_id": "uuid",
          "name": "张三",
          "phone": "138****",
          "email": "z***@xx.com",
          "access_type": "doubao_only",
          "appointment_count": 5,
          "last_appointment_at": "2025-09-18T10:00:00Z"
        }
      ],
      "page": 1,
      "pageSize": 20,
      "total": 123
    }
    ```

- GET `/admin/users/{userId}/appointments`
  - 查询参数：`page`、`pageSize`、`status`（可选）
  - 返回字段对齐 `appointments`：日期/时间/类型/模型/状态/meeting_link/notes 等。

- GET `/admin/chat-sessions`
  - 查询参数：`userId`（必填）、`aiModel`（可选：doubao|peppy）、`appointmentId`（可选）。
  - 返回：该用户在条件下的会话列表（`id`、`created_at`、`message_count`、`last_message_at`）。

- GET `/admin/chat-messages`
  - 查询参数：`sessionId`（必填），可分页。
  - 返回：消息流（只读）。

- PATCH `/admin/users/{userId}/access`
  - Body：`{ access_type: 'doubao_only' | 'peppy_only' | 'human_only', reason?: string }`
  - 逻辑：upsert 到 `user_access_policies`。

说明：若短期不做 Functions，可用 SQL 视图 + RLS，但邮箱检索/显示仍建议经函数完成（服务端聚合）。

### 前端架构（组件拆分与路由）
- 新增路由组件
  - `src/components/AdminPeople.tsx`：人员管理主界面（作为 `AdminDashboard` 的一个 Tab）
  - `src/components/AdminChatViewer.tsx`：管理员只读聊天查看页

- AdminDashboard 扩展 Tab
  - 在原 Tabs 中新增 `people`：人员管理

- 人员管理页结构
  1. 顶部筛选栏
     - 关键字输入（name/phone/email）
  2. 表格（react-query + 虚拟化可选）
     - 列：姓名、手机号、邮箱、服务分类（可编辑）、预约次数、最近预约时间、操作
     - 操作：查看预约记录
  3. 预约记录弹窗（`<UserAppointmentsModal />`）
     - 分类下拉（全部/豆包/Peppy/人类）
     - 表格列：日期、时间、类型（AI/人类+模型）、状态、会议链接标识、会议纪要标识、操作
     - 操作：
       - 若 AI：查看聊天（新开 `AdminChatViewer` 并带上 `userId` + `appointmentId`）
       - 若人类：若 `notes` 存在，操作单元格为空,需要把会议链接带上即可

- 管理员聊天查看页（只读）
  - 查询参数：`userId`、`aiModel?`、`appointmentId?`
  - 左侧：会话列表（根据查询条件）
  - 右侧：消息列表（不可编辑、不可发送）

### React Query 设计
- Queries
  - `useAdminUsersQuery({ q, accessType, page, pageSize, sortBy, order })`
    - key: `['admin-users', params]`
  - `useUserAppointmentsQuery({ userId, page, pageSize, status })`
    - key: `['admin-user-appointments', userId, params]`
  - `useAdminChatSessionsQuery({ userId, aiModel, appointmentId })`
    - key: `['admin-chat-sessions', userId, aiModel, appointmentId]`
  - `useAdminChatMessagesQuery({ sessionId, page })`
    - key: `['admin-chat-messages', sessionId, page]`

- Mutations
  - `useUpdateUserAccessMutation()`
    - 成功后 `invalidateQueries(['admin-users'])` 与 `invalidateQueries(['user-access-policy', userId])`

- UI 状态
  - 弹窗开关、当前选中用户/预约行使用局部 `useState`
  - 数据获取、缓存、加载态、错误态全部交给 react-query

### 业务规则与拦截点（Gate）
1) 全站 Gate（新增 Hook：`useUserAccessPolicy(userId)`）
   - 预约页数据过滤：
     - `human_only` → 仅显示 `counselor_type='human'`
     - `doubao_only` → 仅 `counselor_type='ai' and ai_model='doubao'`
     - `peppy_only` → 仅 `counselor_type='ai' and ai_model='peppy'`
   - 聊天入口：
     - 进入 `ChatDoubao` 必须 `doubao_only`；进入 `ChatPeppy` 必须 `peppy_only`
     - 即使 `ai_appointment_required=false`，`human_only` 用户也不允许直接进入 AI

2) 与系统设置 `ai_appointment_required` 的协同
   - true：AI 必须经预约进入（现有前台已实现），再叠加用户分类 Gate
   - false：允许无预约进入，但严格按用户分类限制模型与通道

### UX 细节
- 表格内编辑分类采用单元格下拉选择，保存成功气泡提示；失败回滚。
- 搜索与筛选保持 URL 同步，支持分享/回访（可用 `useSearchParams`）。
- 预约记录弹窗支持分页；会议纪要为长文本时提供折叠/展开。
- 聊天查看页消息按时间排序，支持按关键词过滤（可迭代）。

### 渐进式落地计划
1) 数据侧
   - 建表 `user_access_policies`
   - 临时先不做视图，优先 Edge Functions 汇聚 name/phone/email/分类/统计

2) 接口侧
   - 实现 `/admin/users` 与 `/admin/users/{id}/appointments`
   - 实现 `/admin/chat-sessions`、`/admin/chat-messages`
   - 实现 `/admin/users/{id}/access`（upsert 分类）

3) 前端侧
   - 新增 `AdminPeople.tsx`、`UserAppointmentsModal.tsx`、`AdminChatViewer.tsx`
   - 接入 react-query hooks，完成列表/弹窗/查看页
   - 在 `AdminDashboard` 加入 `people` Tab
   - 在预约/聊天入口处接入 `useUserAccessPolicy` Gate

4) 验收
   - 人员管理页可搜索/分页/编辑分类
   - 预约记录弹窗可查看 AI 聊天与人类会议纪要
   - 聊天查看页按用户/模型/预约 ID 查看只读聊天
   - 预约与聊天入口遵守“分类 + 系统设置”双重限制

### 风险与折中
- 邮箱数据源：若短期无法在函数中访问 `auth.users`，可退化为显示最近一次 `appointments.user_email`；功能可用但检索不完备。
- 历史数据缺口：老用户无分类时默认 `human_only`，并在人员管理页提供“未设置分类”筛选做补齐。
- 聊天溯源：以 `chat_sessions.appointment_id` 建立预约与会话的绑定；若历史数据缺少该字段，查看页支持按时间范围列出会话作为兜底。

---
此方案强调：访问策略解耦、接口集中、react-query 驱动数据与缓存、UI 组件低耦合，确保长期可维护与可演进。

### 接口契约（入参/出参）

通用约定：
- 所有时间字段使用 ISO 8601 字符串（UTC）。
- 分页：`page` 从 1 开始，`pageSize` 默认 20，最大 100。
- 错误：统一 `{ error: { code: string, message: string } }`。

1) GET `/admin/users`
- Query
  - `q?: string`（在 name/phone/email 上模糊匹配）
  - `accessType?: 'all' | 'doubao_only' | 'peppy_only' | 'human_only'`
  - `page?: number`
  - `pageSize?: number`
  - `sortBy?: 'name' | 'created_at' | 'last_appointment_at' | 'appointment_count'`
  - `order?: 'asc' | 'desc'`
- Response
```json
{
  "items": [
    {
      "user_id": "uuid",
      "name": "张三",
      "phone": "138****",
      "email": "z***@xx.com",
      "access_type": "doubao_only",
      "appointment_count": 5,
      "last_appointment_at": "2025-09-18T10:00:00Z"
    }
  ],
  "page": 1,
  "pageSize": 20,
  "total": 123
}
```

2) GET `/admin/users/{userId}/appointments`
- Query
  - `page?: number`
  - `pageSize?: number`
  - `status?: 'confirmed' | 'cancelled' | 'completed'`
- Response
```json
{
  "items": [
    {
      "id": 101,
      "appointment_date": "2025-09-20",
      "start_time": "10:00:00",
      "end_time": "11:00:00",
      "appointment_type": "ai",
      "ai_model": "doubao",
      "status": "confirmed",
      "meeting_link": "https://...",
      "notes": "...",
      "topic": "焦虑",
      "description": "...",
      "created_at": "2025-09-18T09:00:00Z"
    }
  ],
  "page": 1,
  "pageSize": 20,
  "total": 42
}
```

3) GET `/admin/chat-sessions`
- Query
  - `userId: string`
  - `aiModel?: 'doubao' | 'peppy'`
  - `appointmentId?: number`
- Response
```json
{
  "items": [
    {
      "id": 2001,
      "ai_model": "doubao",
      "is_appointment": true,
      "appointment_id": 101,
      "message_count": 23,
      "last_message_at": "2025-09-18T10:30:00Z",
      "created_at": "2025-09-18T10:00:00Z"
    }
  ]
}
```

4) GET `/admin/chat-messages`
- Query
  - `sessionId: number`
  - `page?: number`
  - `pageSize?: number`
- Response
```json
{
  "items": [
    {
      "id": 90001,
      "session_id": 2001,
      "user_id": "uuid",
      "sender": "user", // user|ai
      "content": "...",
      "ai_model": "doubao",
      "metadata": {},
      "created_at": "2025-09-18T10:05:00Z"
    }
  ],
  "page": 1,
  "pageSize": 50,
  "total": 230
}
```

5) PATCH `/admin/users/{userId}/access`
- Body
```json
{
  "access_type": "doubao_only",
  "reason": "初始配置"
}
```
- Response
```json
{
  "user_id": "uuid",
  "access_type": "doubao_only",
  "updated_at": "2025-09-18T10:00:00Z"
}
```

### 前端 TypeScript 类型与 Hooks 签名

类型定义（建议放在 `src/types/admin.ts`）：
```ts
export type AccessType = 'doubao_only' | 'peppy_only' | 'human_only';

export interface AdminUserListItem {
  user_id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  access_type: AccessType | null;
  appointment_count: number;
  last_appointment_at: string | null; // ISO string
}

export interface PaginatedResponse<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}

export type AppointmentStatus = 'confirmed' | 'cancelled' | 'completed';
export type AppointmentType = 'ai' | 'human';
export type AiModel = 'doubao' | 'peppy';

export interface AdminAppointmentItem {
  id: number;
  appointment_date: string; // YYYY-MM-DD
  start_time: string; // HH:mm:ss
  end_time: string; // HH:mm:ss
  appointment_type: AppointmentType;
  ai_model?: AiModel;
  status: AppointmentStatus;
  meeting_link?: string | null;
  notes?: string | null; // 会议纪要（人类预约时有可能）
  topic?: string | null;
  description?: string | null;
  created_at: string; // ISO string
}

export interface AdminChatSessionItem {
  id: number;
  ai_model: AiModel;
  is_appointment: boolean;
  appointment_id?: number | null;
  message_count: number;
  last_message_at: string | null; // ISO string
  created_at: string; // ISO string
}

export type ChatSender = 'user' | 'ai';

export interface AdminChatMessageItem {
  id: number;
  session_id: number;
  user_id: string;
  sender: ChatSender;
  content: string;
  ai_model: AiModel;
  metadata?: Record<string, any>;
  created_at: string; // ISO string
}
```

Hooks 签名（建议放在 `src/hooks/useAdminPeople.ts`）：
```ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  AccessType,
  AdminUserListItem,
  PaginatedResponse,
  AdminAppointmentItem,
  AdminChatSessionItem,
  AdminChatMessageItem,
  AppointmentStatus,
  AiModel
} from '@/types/admin';

export interface UseAdminUsersParams {
  q?: string;
  accessType?: 'all' | AccessType;
  page?: number;
  pageSize?: number;
  sortBy?: 'name' | 'created_at' | 'last_appointment_at' | 'appointment_count';
  order?: 'asc' | 'desc';
}

export function useAdminUsersQuery(params: UseAdminUsersParams) {
  return useQuery<PaginatedResponse<AdminUserListItem>>({
    queryKey: ['admin-users', params],
    queryFn: async () => {
      const qs = new URLSearchParams(params as Record<string, string>);
      const res = await fetch(`/admin/users?${qs.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch admin users');
      return res.json();
    },
    keepPreviousData: true,
  });
}

export interface UseUserAppointmentsParams {
  userId: string;
  page?: number;
  pageSize?: number;
  status?: AppointmentStatus;
}

export function useUserAppointmentsQuery(params: UseUserAppointmentsParams) {
  const { userId, ...rest } = params;
  return useQuery<PaginatedResponse<AdminAppointmentItem>>({
    queryKey: ['admin-user-appointments', params],
    queryFn: async () => {
      const qs = new URLSearchParams(rest as Record<string, string>);
      const res = await fetch(`/admin/users/${userId}/appointments?${qs.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch user appointments');
      return res.json();
    },
    enabled: !!userId,
    keepPreviousData: true,
  });
}

export interface UseAdminChatSessionsParams {
  userId: string;
  aiModel?: AiModel;
  appointmentId?: number;
}

export function useAdminChatSessionsQuery(params: UseAdminChatSessionsParams) {
  return useQuery<{ items: AdminChatSessionItem[] }>({
    queryKey: ['admin-chat-sessions', params],
    queryFn: async () => {
      const qs = new URLSearchParams(params as unknown as Record<string, string>);
      const res = await fetch(`/admin/chat-sessions?${qs.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch chat sessions');
      return res.json();
    },
    enabled: !!params.userId,
    staleTime: 30_000,
  });
}

export interface UseAdminChatMessagesParams {
  sessionId: number;
  page?: number;
  pageSize?: number;
}

export function useAdminChatMessagesQuery(params: UseAdminChatMessagesParams) {
  const { sessionId, ...rest } = params;
  return useQuery<PaginatedResponse<AdminChatMessageItem>>({
    queryKey: ['admin-chat-messages', params],
    queryFn: async () => {
      const qs = new URLSearchParams(rest as unknown as Record<string, string>);
      const res = await fetch(`/admin/chat-messages?sessionId=${sessionId}&${qs.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch chat messages');
      return res.json();
    },
    enabled: !!sessionId,
    keepPreviousData: true,
  });
}

export interface UpdateUserAccessBody {
  access_type: AccessType;
  reason?: string;
}

export function useUpdateUserAccessMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, body }: { userId: string; body: UpdateUserAccessBody }) => {
      const res = await fetch(`/admin/users/${userId}/access`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('Failed to update user access');
      return res.json();
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['admin-users'] });
      qc.invalidateQueries({ queryKey: ['user-access-policy', variables.userId] });
    }
  });
}
```

说明：
- 前端只与管理端 Edge Functions 交互，避免直接暴露 `supabase` 行级数据与跨 schema（auth）。
- 所有查询保留 `keepPreviousData`，分页滚动平滑。
- 错误统一抛出，页面统一用 ErrorBoundary/消息条处理。


