// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@2'

type AccessType = 'doubao_only' | 'peppy_only' | 'human_only'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json'
}

function ok(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), { status: 200, headers: corsHeaders, ...init })
}

function badRequest(message: string, init?: ResponseInit) {
  return new Response(JSON.stringify({ error: { code: 'BAD_REQUEST', message } }), { status: 400, headers: corsHeaders, ...init })
}

function unauthorized(message = 'Unauthorized') {
  return new Response(JSON.stringify({ error: { code: 'UNAUTHORIZED', message } }), { status: 401, headers: corsHeaders })
}

function serverError(message: string) {
  return new Response(JSON.stringify({ error: { code: 'SERVER_ERROR', message } }), { status: 500, headers: corsHeaders })
}

interface QueryParams {
  q?: string
  accessType?: 'all' | AccessType
  page?: number
  pageSize?: number
  sortBy?: 'name' | 'created_at' | 'last_appointment_at' | 'appointment_count'
  order?: 'asc' | 'desc'
}

const MAX_PAGE_SIZE = 100

async function assertAdmin(supabase: ReturnType<typeof createClient>, authHeader?: string) {
  if (!authHeader) return false
  const token = authHeader.replace('Bearer ', '')
  const { data: user } = await supabase.auth.getUser(token)
  if (!user?.user) return false
  const { data: admin } = await supabase
    .from('admin_users')
    .select('id')
    .eq('id', user.user.id)
    .maybeSingle()
  return !!admin
}

function parseParams(url: URL): QueryParams {
  const page = Math.max(1, Number(url.searchParams.get('page') || '1'))
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Number(url.searchParams.get('pageSize') || '20')))
  const q = url.searchParams.get('q') || undefined
  const accessType = (url.searchParams.get('accessType') as QueryParams['accessType']) || undefined
  const sortBy = (url.searchParams.get('sortBy') as QueryParams['sortBy']) || 'last_appointment_at'
  const order = (url.searchParams.get('order') as QueryParams['order']) || 'desc'
  return { page, pageSize, q, accessType, sortBy, order }
}

function maskEmail(email?: string | null) {
  if (!email) return null
  const [name, domain] = email.split('@')
  if (!domain) return email
  const n = name.length
  const masked = n <= 2 ? name[0] + '*' : name[0] + '*'.repeat(Math.max(1, n - 2)) + name[n - 1]
  return `${masked}@${domain}`
}

console.info('admin-users function started')

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '')
    const authed = await assertAdmin(supabase, req.headers.get('Authorization') || undefined)
    if (!authed) return unauthorized()

    const url = new URL(req.url)
    let { page, pageSize, q, accessType, sortBy, order } = parseParams(url)

    // 支持从 POST JSON body 读取参数（兼容 supabase.functions.invoke）
    if (req.method === 'POST') {
      try {
        const body = await req.json()
        page = Math.max(1, Number(body?.page ?? page))
        pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Number(body?.pageSize ?? pageSize)))
        q = body?.q ?? q
        accessType = body?.accessType ?? accessType
        sortBy = body?.sortBy ?? sortBy
        order = body?.order ?? order
      } catch {}
    }

    // 基础用户信息
    const from = (page - 1) * pageSize
    const to = from + pageSize - 1

    // 0) （默认策略已由 SQL 触发器/回填保障，此处不再处理）

    // 1) 拉取 user_profiles（使用同步后的权威字段）
    let query = supabase
      .from('user_profiles')
      .select('id, display_name, email, phone, providers, provider_type, auth_created_at, last_sign_in_at', { count: 'exact' })

    if (q) {
      // 在 display_name/phone/email 上过滤
      query = query.or(`display_name.ilike.%${q}%,phone.ilike.%${q}%,email.ilike.%${q}%`)
    }

    query = query.range(from, to)

    const { data: users, error, count } = await query
    if (error) return serverError(error.message)

    const userIds = (users || []).map((u) => u.id)

    // 2) 分类表（若无记录则视为 peppy_only）
    const { data: policies } = await supabase
      .from('user_access_policies')
      .select('user_id, access_type')
      .in('user_id', userIds)

    // 3) 预约统计
    const { data: appts } = await supabase
      .from('appointments')
      .select('user_id, created_at')
      .in('user_id', userIds)

    const countMap = new Map<string, number>()
    const lastAtMap = new Map<string, string | null>()
    if (appts) {
      for (const uid of userIds) {
        countMap.set(uid, 0)
        lastAtMap.set(uid, null)
      }
      for (const a of appts) {
        const uid = a.user_id as string
        countMap.set(uid, (countMap.get(uid) || 0) + 1)
        const prev = lastAtMap.get(uid)
        if (!prev || new Date(a.created_at) > new Date(prev)) {
          lastAtMap.set(uid, a.created_at)
        }
      }
    }

    // 4) 聚合
    const policyMap = new Map<string, AccessType | null>()
    for (const uid of userIds) {
      const p = (policies || []).find((x) => x.user_id === uid)
      policyMap.set(uid, (p?.access_type as AccessType) || 'human_only')
    }

    let items = (users || []).map((u) => ({
      user_id: u.id,
      name: (u as any).display_name ?? null,
      phone: (u as any).phone ?? null,
      email: (u as any).email ?? null,
      providers: (u as any).providers ?? [],
      provider_type: (u as any).provider_type ?? null,
      auth_created_at: (u as any).auth_created_at ?? null,
      last_sign_in_at: (u as any).last_sign_in_at ?? null,
      access_type: policyMap.get(u.id) || null,
      appointment_count: countMap.get(u.id) || 0,
      last_appointment_at: lastAtMap.get(u.id) || null,
    }))

    // 5) accessType 过滤
    if (accessType && accessType !== 'all') {
      items = items.filter((it) => it.access_type === accessType)
    }

    // 6) 排序
    items.sort((a, b) => {
      const dir = order === 'asc' ? 1 : -1
      const av = (a as any)[sortBy]
      const bv = (b as any)[sortBy]
      if (av == null && bv == null) return 0
      if (av == null) return 1
      if (bv == null) return -1
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir
      return String(av).localeCompare(String(bv)) * dir
    })

    const meta = { total: count ?? items.length, page, pageSize }
    return ok({ success: true, data: { users: items }, meta })
  } catch (e: any) {
    console.error('admin-users error', e)
    return serverError(e?.message || 'Internal error')
  }
})



