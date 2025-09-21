import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@2'

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
  const serviceRoleKey = Deno.env.get('SERVICE_ROLE_KEY') || ''
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

console.info('admin-chat-messages started')

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  
  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '')
    const isAdmin = await assertAdmin(supabase, req.headers.get('Authorization') || undefined)
    if (!isAdmin) return bad('Unauthorized', 401)

    // 只接受 POST，只从 body 拿参数
    if (req.method !== 'POST') return bad('Method not allowed, use POST with body', 405)
    
    const body = await req.json().catch(() => null)
    if (!body) return bad('Request body is required')
    
    const sessionId = body.sessionId
    const page = Math.max(1, Number(body.page || 1))
    const pageSize = Math.min(100, Math.max(1, Number(body.pageSize || 50)))

    if (!sessionId) return bad('sessionId is required')

    const from = (page - 1) * pageSize
    const to = from + pageSize - 1

    const { data, error, count } = await supabase
      .from('chat_messages')
      .select('id, session_id, user_id, sender, message, ai_model, metadata, created_at', { count: 'exact' })
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true })
      .range(from, to)

    if (error) return bad(error.message, 500)

    const items = (data || []).map((m) => ({
      id: m.id,
      session_id: m.session_id,
      user_id: m.user_id,
      sender: m.sender,
      content: m.message,
      ai_model: m.ai_model,
      metadata: m.metadata,
      created_at: m.created_at,
    }))

    const meta = { total: count ?? items.length, page, pageSize }
    return ok({ success: true, data: { messages: items }, meta })
  } catch (e: any) {
    console.error('admin-chat-messages error', e)
    return bad('Internal error', 500)
  }
})