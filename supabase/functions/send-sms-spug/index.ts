// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@2'

interface SendSMSPayload {
  phoneNumber: string;
  type?: 'register' | 'login'; // 区分注册/登录场景
  templateId?: string; // 默认模板 ID
  codeLength?: number; // 默认 6 位
  ttlSeconds?: number; // 默认 300 秒
  cooldownSeconds?: number; // 默认 180 秒（3 分钟）
}

interface SendSMSResponse {
  success?: boolean;
  message?: string;
  error?: string;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
  'Connection': 'keep-alive'
}

function generateCode(length: number) {
  const min = Math.pow(10, length - 1)
  const max = Math.pow(10, length) - 1
  return String(Math.floor(Math.random() * (max - min + 1)) + min)
}

console.info('send-sms-spug started')

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { phoneNumber, type, templateId = Deno.env.get('SPUG_TEMPLATE_ID') || '', codeLength = 6, ttlSeconds = 600, cooldownSeconds = 180 } = await req.json() as SendSMSPayload

    if (!phoneNumber) return new Response(JSON.stringify({ error: '缺少手机号' }), { status: 400, headers: corsHeaders })
    if (!templateId) return new Response(JSON.stringify({ error: '缺少模板 ID' }), { status: 400, headers: corsHeaders })
    if (codeLength < 4 || codeLength > 8) return new Response(JSON.stringify({ error: 'codeLength 范围应为 4-8' }), { status: 400, headers: corsHeaders })

    const phoneRegex = /^1[3-9]\d{9}$/
    if (!phoneRegex.test(phoneNumber)) return new Response(JSON.stringify({ error: '手机号格式不正确' }), { status: 400, headers: corsHeaders })

    // ✅ 根据 type 检查手机号状态
    if (type === 'login') {
      // 登录场景：检查手机号是否已注册
      const { data: existingUser } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('phone', phoneNumber)
        .limit(1)
      
      if (!existingUser || existingUser.length === 0) {
        return new Response(
          JSON.stringify({ error: '该手机号未注册，请先注册' }),
          { status: 400, headers: corsHeaders }
        )
      }
    } else if (type === 'register') {
      // 注册场景：检查手机号是否已注册
      const { data: existingUser } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('phone', phoneNumber)
        .limit(1)
      
      if (existingUser && existingUser.length > 0) {
        return new Response(
          JSON.stringify({ error: '该手机号已注册，请直接登录' }),
          { status: 400, headers: corsHeaders }
        )
      }
    }
    // type 为空时，不检查手机号状态，直接发送验证码

    // 冷却时间检查：同一手机号在 cooldownSeconds 内只允许发送一次
    const cooldownSince = new Date(Date.now() - cooldownSeconds * 1000).toISOString()
    const { data: recent, error: recentErr } = await supabase
      .from('sms_verification_codes')
      .select('created_at')
      .eq('phone_number', phoneNumber)
      .gt('created_at', cooldownSince)
      .order('created_at', { ascending: false })
      .limit(1)
    if (recentErr) {
      console.error('查询冷却窗口失败:', recentErr)
      return new Response(JSON.stringify({ error: '系统错误，请稍后重试' }), { status: 500, headers: corsHeaders })
    }
    if (recent && recent.length > 0) {
      const last = new Date(recent[0].created_at as unknown as string).getTime()
      const now = Date.now()
      const remain = Math.max(0, Math.ceil((cooldownSeconds * 1000 - (now - last)) / 1000))
      const body = { error: `发送过于频繁，请${remain}秒后重试` }
      return new Response(JSON.stringify(body), { status: 429, headers: { ...corsHeaders, 'Retry-After': String(remain) } })
    }

    // 生成验证码
    const code = generateCode(codeLength)

    // 写入验证码表（未使用，带过期）
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString()
    const { error: insertError } = await supabase
      .from('sms_verification_codes')
      .insert({
        phone_number: phoneNumber,
        verification_code: code,
        is_used: false,
        expires_at: expiresAt,
      })
    if (insertError) {
      console.error('写入验证码失败:', insertError)
      return new Response(JSON.stringify({ error: '系统错误，请稍后重试' }), { status: 500, headers: corsHeaders })
    }

    // 调用 Spug 短信服务
    const url = `https://push.spug.cc/send/${encodeURIComponent(templateId)}`
    const spugRes = await fetch(`${url}?code=${encodeURIComponent(code)}&targets=${encodeURIComponent(phoneNumber)}`, { method: 'GET' })
    let spugJson: any = null
    try { spugJson = await spugRes.json() } catch { spugJson = null }
    if (!spugRes.ok) {
      console.error('调用 Spug 失败:', spugJson || spugRes.statusText)
      return new Response(JSON.stringify({ error: '短信通道错误' }), { status: spugRes.status || 500, headers: corsHeaders })
    }

    return new Response(JSON.stringify({ success: true, message: '验证码已发送' }), { status: 200, headers: corsHeaders })

  } catch (e) {
    console.error('send-sms-spug error:', e)
    return new Response(JSON.stringify({ error: '服务器内部错误' }), { status: 500, headers: corsHeaders })
  }
})
