// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

interface SendSMSPayload {
  phoneNumber: string;
  type?: 'register' | 'login';
}

interface SMSResponse {
  success?: boolean;
  message?: string;
  expiresIn?: number;
  error?: string;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
  'Connection': 'keep-alive'
}

// 腾讯云短信服务配置
const TENCENT_CONFIG = {
  secretId: Deno.env.get('TENCENT_SECRET_ID')||'AKIDV4RbXGl37xb2GJA1kPwIRN8g1b9WhgS3',
  secretKey: Deno.env.get('TENCENT_SECRET_KEY')||'lNn27zVs2zjGZgqshKo6B4lFWaT8a4PX',
  sdkAppId: Deno.env.get('TENCENT_SMS_SDK_APP_ID')||'1401039635',
  signName: Deno.env.get('TENCENT_SMS_SIGN_NAME') || '心理咨询系统',
  templateId: Deno.env.get('TENCENT_SMS_TEMPLATE_ID') || '1234567',
}

// 生成6位数字验证码
function generateVerificationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

// HMAC-SHA256 实现
async function hmacSha256(key: string, message: string): Promise<string> {
  const encoder = new TextEncoder()
  const keyData = encoder.encode(key)
  const messageData = encoder.encode(message)
  
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData)
  const hashArray = Array.from(new Uint8Array(signature))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

// SHA256 实现
async function sha256(message: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(message)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

// 获取日期字符串
function getDate(timestamp: number): string {
  const date = new Date(timestamp * 1000)
  const year = date.getUTCFullYear()
  const month = ("0" + (date.getUTCMonth() + 1)).slice(-2)
  const day = ("0" + date.getUTCDate()).slice(-2)
  return `${year}-${month}-${day}`
}

// 腾讯云短信发送 - 基于官方示例修正
async function sendSMS(phoneNumber: string, code: string): Promise<boolean> {
  try {
    const host = "sms.tencentcloudapi.com"
    const service = "sms"
    const region = ""
    const action = "SendSms"
    const version = "2021-01-11"
    const timestamp = Math.floor(Date.now() / 1000)
    const date = getDate(timestamp)
    
    // 构建请求体 - 注意：这里需要包含所有必要的参数
    const payload = JSON.stringify({
      PhoneNumberSet: [`+86${phoneNumber}`],
      SmsSdkAppId: TENCENT_CONFIG.sdkAppId,
      SignName: TENCENT_CONFIG.signName,
      TemplateId: TENCENT_CONFIG.templateId,
      TemplateParamSet: [code]
    })

    // ************* 步骤 1：拼接规范请求串 *************
    const signedHeaders = "content-type;host"
    const hashedRequestPayload = await sha256(payload)
    const httpRequestMethod = "POST"
    const canonicalUri = "/"
    const canonicalQueryString = ""
    const canonicalHeaders = "content-type:application/json; charset=utf-8\n" + "host:" + host + "\n"

    const canonicalRequest =
      httpRequestMethod +
      "\n" +
      canonicalUri +
      "\n" +
      canonicalQueryString +
      "\n" +
      canonicalHeaders +
      "\n" +
      signedHeaders +
      "\n" +
      hashedRequestPayload

    // ************* 步骤 2：拼接待签名字符串 *************
    const algorithm = "TC3-HMAC-SHA256"
    const hashedCanonicalRequest = await sha256(canonicalRequest)
    const credentialScope = date + "/" + service + "/" + "tc3_request"
    const stringToSign =
      algorithm +
      "\n" +
      timestamp +
      "\n" +
      credentialScope +
      "\n" +
      hashedCanonicalRequest

    // ************* 步骤 3：计算签名 *************
    const kDate = await hmacSha256(date, "TC3" + TENCENT_CONFIG.secretKey!)
    const kService = await hmacSha256(service, kDate)
    const kSigning = await hmacSha256("tc3_request", kService)
    const signature = await hmacSha256(stringToSign, kSigning)

    // ************* 步骤 4：拼接 Authorization *************
    const authorization =
      algorithm +
      " " +
      "Credential=" +
      TENCENT_CONFIG.secretId +
      "/" +
      credentialScope +
      ", " +
      "SignedHeaders=" +
      signedHeaders +
      ", " +
      "Signature=" +
      signature

    // ************* 步骤 5：构造并发起请求 *************
    const headers: Record<string, string> = {
      Authorization: authorization,
      "Content-Type": "application/json; charset=utf-8",
      Host: host,
      "X-TC-Action": action,
      "X-TC-Timestamp": timestamp.toString(),
      "X-TC-Version": version,
    }

    if (region) {
      headers["X-TC-Region"] = region
    }

    const response = await fetch(`https://${host}`, {
      method: 'POST',
      headers,
      body: payload
    })

    const result = await response.json()
    
    if (result.Response && result.Response.Error) {
      console.error('腾讯云短信发送失败:', result.Response.Error)
      return false
    }

    console.log(`腾讯云短信发送成功到 ${phoneNumber}，验证码：${code}`)
    return true
    
  } catch (error) {
    console.error('发送短信失败:', error)
    return false
  }
}

console.info('Tencent SMS service started (manual implementation)');

Deno.serve(async (req: Request) => {
  // 处理CORS预检请求
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 创建Supabase客户端
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { phoneNumber, type = 'register' }: SendSMSPayload = await req.json()

    // 验证手机号格式
    const phoneRegex = /^1[3-9]\d{9}$/
    if (!phoneRegex.test(phoneNumber)) {
      const errorResponse: SMSResponse = { error: '手机号格式不正确' }
      return new Response(
        JSON.stringify(errorResponse),
        { 
          status: 400, 
          headers: corsHeaders
        }
      )
    }

    // 检查发送频率限制（1分钟内只能发送一次）
    const oneMinuteAgo = new Date(Date.now() - 60 * 1000).toISOString()
    const { data: recentCodes } = await supabaseClient
      .from('sms_verification_codes')
      .select('id')
      .eq('phone_number', phoneNumber)
      .gte('created_at', oneMinuteAgo)
      .limit(1)

    if (recentCodes && recentCodes.length > 0) {
      const errorResponse: SMSResponse = { error: '请稍后再试，1分钟内只能发送一次验证码' }
      return new Response(
        JSON.stringify(errorResponse),
        { 
          status: 429, 
          headers: corsHeaders
        }
      )
    }

    // 生成验证码
    const verificationCode = generateVerificationCode()
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000) // 5分钟后过期

    // 保存验证码到数据库
    const { error: dbError } = await supabaseClient
      .from('sms_verification_codes')
      .insert({
        phone_number: phoneNumber,
        verification_code: verificationCode,
        expires_at: expiresAt.toISOString()
      })

    if (dbError) {
      console.error('保存验证码失败:', dbError)
      const errorResponse: SMSResponse = { error: '系统错误，请稍后重试' }
      return new Response(
        JSON.stringify(errorResponse),
        { 
          status: 500, 
          headers: corsHeaders
        }
      )
    }

    // 发送短信
    const smsSent = await sendSMS(phoneNumber, verificationCode)
    
    if (!smsSent) {
      const errorResponse: SMSResponse = { error: '短信发送失败，请稍后重试' }
      return new Response(
        JSON.stringify(errorResponse),
        { 
          status: 500, 
          headers: corsHeaders
        }
      )
    }

    const successResponse: SMSResponse = { 
      success: true, 
      message: '验证码已发送',
      expiresIn: 300 // 5分钟
    }

    return new Response(
      JSON.stringify(successResponse),
      { 
        status: 200, 
        headers: corsHeaders
      }
    )

  } catch (error) {
    console.error('发送短信验证码错误:', error)
    const errorResponse: SMSResponse = { error: '服务器内部错误' }
    return new Response(
      JSON.stringify(errorResponse),
      { 
        status: 500, 
        headers: corsHeaders
      }
    )
  }
});
