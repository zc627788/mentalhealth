// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@2'

interface VerifySMSPayload {
  phoneNumber: string;
  verificationCode: string;
  type?: 'register' | 'login';
  name?: string;
  password?: string;
  randomId?: string;
}

interface VerifySMSResponse {
  success?: boolean;
  message?: string;
  userId?: string;
  userName?: string;
  loginUrl?: string;
  error?: string;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
  'Connection': 'keep-alive'
}

console.info('SMS verification service started');

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { phoneNumber, verificationCode, type = 'register', name, password, randomId }: VerifySMSPayload = await req.json()

    if (!phoneNumber || !verificationCode) {
      return new Response(JSON.stringify({ error: '手机号和验证码不能为空' }), {
        status: 400, headers: corsHeaders
      })
    }

    const phoneRegex = /^1[3-9]\d{9}$/
    if (!phoneRegex.test(phoneNumber)) {
      return new Response(JSON.stringify({ error: '手机号格式不正确' }), {
        status: 400, headers: corsHeaders
      })
    }

    if (!/^\d{6}$/.test(verificationCode)) {
      return new Response(JSON.stringify({ error: '验证码格式不正确' }), {
        status: 400, headers: corsHeaders
      })
    }

    // 查找有效的验证码
    const { data: codeData, error: codeError } = await supabaseClient
      .from('sms_verification_codes')
      .select('*')
      .eq('phone_number', phoneNumber)
      .eq('verification_code', verificationCode)
      .eq('is_used', false)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)

    if (codeError) {
      console.error('查询验证码失败:', codeError)
      return new Response(JSON.stringify({ error: '系统错误，请稍后重试' }), {
        status: 500, headers: corsHeaders
      })
    }

    if (!codeData || codeData.length === 0) {
      return new Response(JSON.stringify({ error: '验证码无效或已过期' }), {
        status: 400, headers: corsHeaders
      })
    }

    // 标记验证码为已使用
    await supabaseClient
      .from('sms_verification_codes')
      .update({ is_used: true })
      .eq('id', codeData[0].id)

    if (type === 'register') {
      if (!name) {
        return new Response(JSON.stringify({ error: '注册时姓名不能为空' }), {
          status: 400, headers: corsHeaders
        })
      }

      // 检查手机号是否已注册
      const { data: existingUser } = await supabaseClient
        .from('user_profiles')
        .select('id')
        .eq('phone', phoneNumber)
        .limit(1)

      if (existingUser && existingUser.length > 0) {
        return new Response(JSON.stringify({ error: '该手机号已注册，请直接登录' }), {
          status: 400, headers: corsHeaders
        })
      }

      // 创建用户
      const userPassword = password || Math.random().toString(36).slice(-12)
      const { data: authData, error: authError } = await supabaseClient.auth.admin.createUser({
        email: `${phoneNumber}@temp.local`,
        password: userPassword,
        user_metadata: { phone: phoneNumber, name: name }
      })

      if (authError) {
        console.error('创建用户失败:', authError)
        return new Response(JSON.stringify({ error: '注册失败，请稍后重试' }), {
          status: 500, headers: corsHeaders
        })
      }

      // 创建用户 profile - 使用 display_name 字段
      const { error: profileError } = await supabaseClient
        .from('user_profiles')
        .insert({
          id: authData.user.id,
          phone: phoneNumber,
          display_name: name
        })

      if (profileError) {
        console.error('创建用户 profile 失败:', profileError)
        await supabaseClient.auth.admin.deleteUser(authData.user.id)
        return new Response(JSON.stringify({ error: '注册失败，请稍后重试' }), {
          status: 500, headers: corsHeaders
        })
      }

      // 生成登录链接
      const { data: regLink, error: regLinkErr } = await supabaseClient.auth.admin.generateLink({
        type: 'magiclink',
        email: `${phoneNumber}@temp.local`,
        options: { redirectTo: `${Deno.env.get('SITE_URL')}/auth/callback` }
      })

      if (regLinkErr) {
        console.error('生成注册登录链接失败:', regLinkErr)
        return new Response(JSON.stringify({ error: '注册成功但生成登录链接失败' }), {
          status: 500, headers: corsHeaders
        })
      }

      // 如果传入了 randomId，标记为已使用并记录用户 ID
      if (randomId) {
        const normalizedCode = randomId.trim().toUpperCase()
        const { error: markRandomIdError } = await supabaseClient
          .from('random_ids')
          .update({
            is_used: true,
            user_id: authData.user.id,
            used_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('code', normalizedCode)
          .eq('is_used', false)

        if (markRandomIdError) {
          console.error('标记随机 ID 失败:', markRandomIdError)
          // 不影响主流程，只记录日志
        } else {
          console.log(`随机 ID ${normalizedCode} 已标记为已使用，用户 ID: ${authData.user.id}`)
        }
      }

      return new Response(JSON.stringify({
        success: true,
        message: '注册成功',
        userId: authData.user.id,
        loginUrl: (regLink as any)?.properties?.action_link
      }), { status: 200, headers: corsHeaders })

    } else if (type === 'login') {
      // 登录流程 - 使用 display_name 字段
      const { data: userProfile } = await supabaseClient
        .from('user_profiles')
        .select('id, display_name')
        .eq('phone', phoneNumber)
        .limit(1)

      if (!userProfile || userProfile.length === 0) {
        return new Response(JSON.stringify({ error: '该手机号未注册，请先注册' }), {
          status: 400, headers: corsHeaders
        })
      }

      const { data: tokenData, error: tokenError } = await supabaseClient.auth.admin.generateLink({
        type: 'magiclink',
        email: `${phoneNumber}@temp.local`,
        options: { redirectTo: `${Deno.env.get('SITE_URL')}/auth/callback` }
      })

      if (tokenError) {
        console.error('生成登录链接失败:', tokenError)
        return new Response(JSON.stringify({ error: '登录失败，请稍后重试' }), {
          status: 500, headers: corsHeaders
        })
      }

      return new Response(JSON.stringify({
        success: true,
        message: '登录成功',
        userId: userProfile[0].id,
        userName: userProfile[0].display_name,
        loginUrl: (tokenData as any).properties?.action_link
      }), { status: 200, headers: corsHeaders })
    }

    return new Response(JSON.stringify({ error: '无效的操作类型' }), {
      status: 400, headers: corsHeaders
    })

  } catch (error) {
    console.error('验证短信验证码错误:', error)
    return new Response(JSON.stringify({ error: '服务器内部错误' }), {
      status: 500, headers: corsHeaders
    })
  }
});
