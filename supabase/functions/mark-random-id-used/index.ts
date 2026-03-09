import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json'
}

interface RequestBody {
  code: string
  userId: string
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { code, userId }: RequestBody = await req.json()

    // 验证输入
    if (!code || !userId) {
      return new Response(
        JSON.stringify({ success: false, message: '参数不完整' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const normalizedCode = code.trim().toUpperCase()

    // 更新 ID 状态为已使用
    const { error } = await supabaseClient
      .from('random_ids')
      .update({
        is_used: true,
        user_id: userId,
        used_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('code', normalizedCode)
      .eq('is_used', false) // 确保只更新未使用的 ID

    if (error) {
      console.error('更新 random_ids 失败:', error)
      return new Response(
        JSON.stringify({ success: false, message: '数据库更新失败' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ success: true, message: '随机 ID 已标记为已使用' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (err: any) {
    console.error('标记随机 ID 异常:', err)
    return new Response(
      JSON.stringify({ success: false, message: '服务器错误，请稍后重试' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
