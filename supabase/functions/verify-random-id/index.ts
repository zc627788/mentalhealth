import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json'
}

interface RequestBody {
  code: string
}

interface ResponseBody {
  success: boolean
  message: string
  isUsed?: boolean
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

    const { code }: RequestBody = await req.json()

    // 验证输入
    if (!code || typeof code !== 'string') {
      return new Response(
        JSON.stringify({ success: false, message: '请输入随机 ID' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 规范化 ID (转大写，去除空格)
    const normalizedCode = code.trim().toUpperCase()

    // 验证格式 (5 位字母数字)
    if (!/^[A-Z0-9]{5}$/.test(normalizedCode)) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: '随机 ID 格式不正确，应为 5 位字母或数字' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 查询数据库
    const { data, error } = await supabaseClient
      .from('random_ids')
      .select('code, is_used, user_id')
      .eq('code', normalizedCode)
      .maybeSingle()

    if (error) {
      console.error('查询 random_ids 失败:', error)
      return new Response(
        JSON.stringify({ success: false, message: '数据库查询失败' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ID 不存在
    if (!data) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: 'ID 不存在，请检查您输入的 ID 是否正确' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ID 已使用
    if (data.is_used) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: '该ID 已被使用，请联系管理员',
          isUsed: true
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ID 有效且未使用
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: '随机 ID 验证通过'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (err: any) {
    console.error('验证随机 ID 异常:', err)
    return new Response(
      JSON.stringify({ success: false, message: '服务器错误，请稍后重试' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
