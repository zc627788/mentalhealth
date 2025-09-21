import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@2'

type AccessType = 'doubao_only' | 'peppy_only' | 'human_only'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json'
}

function ok(body: unknown) { return new Response(JSON.stringify(body), { status: 200, headers: corsHeaders }) }
function bad(message: string, status = 400) { return new Response(JSON.stringify({ error: { code: 'BAD_REQUEST', message } }), { status, headers: corsHeaders }) }

async function assertAdmin(supabase: ReturnType<typeof createClient>, auth?: string) {
  if (!auth) return false
  const token = auth.replace('Bearer ', '')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
  // 如果是 Service Role Key，直接通过
  if (token === serviceRoleKey) return true
  
  try {
    const { data: user } = await supabase.auth.getUser(token)
    if (!user?.user) return false
    const { data: admin } = await supabase.from('admin_users').select('id').eq('id', user.user.id).maybeSingle()
    return !!admin
  } catch {
    return false
  }
}

console.info('admin-user-access started')

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  
  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '')
    const isAdmin = await assertAdmin(supabase, req.headers.get('Authorization') || undefined)
    if (!isAdmin) return bad('Unauthorized', 401)

    // 只接受 POST，只从 body 拿参数
    if (req.method !== 'POST') return bad('Method not allowed, use POST with body', 405)
    
    const body = await req.json().catch(() => null) as { action?: 'list'|'grant'|'revoke', userId?: string, access_type?: AccessType, reason?: string, role?: string } | null
    if (!body) return bad('Request body is required')

    const action = body.action || 'list'

    if (action === 'list') {
      if (!body.userId) return bad('userId is required')
      const { data, error } = await supabase
        .from('user_access_policies')
        .select('user_id, access_type, updated_at, reason')
        .eq('user_id', body.userId)
      if (error) return bad(error.message, 500)
      return ok({ success: true, data: { access: data || [] } })
    }

    if (action === 'grant') {
      if (!body.userId) return bad('userId is required')
      // 兼容客户端入参 role
      const incomingAccess = (body.access_type || (body.role as AccessType))
      if (!incomingAccess) return bad('access_type is required')
      const { data, error } = await supabase
        .from('user_access_policies')
        .upsert({
          user_id: body.userId,
          access_type: incomingAccess,
          reason: body.reason || null,
          updated_at: new Date().toISOString(),
        })
        .select()
        .maybeSingle()
      if (error) return bad(error.message, 500)
      return ok({ success: true, data: { userId: body.userId, role: incomingAccess, granted: true } })
    }

    if (action === 'revoke') {
      if (!body.userId) return bad('userId is required')
      const roleToRevoke = (body.access_type || (body.role as AccessType))
      const q = supabase.from('user_access_policies').delete().eq('user_id', body.userId)
      const { error } = roleToRevoke ? await q.eq('access_type', roleToRevoke) : await q
      if (error) return bad(error.message, 500)
      return ok({ success: true, data: { userId: body.userId, revoked: true } })
    }

    return bad('Unknown action')
  } catch (e: any) {
    console.error('admin-user-access error', e)
    return bad('Internal error', 500)
  }
})