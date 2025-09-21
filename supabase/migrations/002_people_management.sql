-- 人员管理：用户访问策略表与索引
create table if not exists public.user_access_policies (
  user_id uuid primary key references auth.users(id) on delete cascade,
  access_type varchar not null check (access_type in ('doubao_only','peppy_only','human_only')),
  assigned_by uuid references public.admin_users(id),
  reason text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists user_access_policies_access_type_idx on public.user_access_policies (access_type);

comment on table public.user_access_policies is '用户服务分类与访问策略：doubao_only|peppy_only|human_only';
comment on column public.user_access_policies.access_type is '访问类别：豆包AI/Peppy AI/人类咨询师';


