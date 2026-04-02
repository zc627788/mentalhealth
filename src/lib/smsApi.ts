import { supabase, supabaseAnonKey, supabaseUrl } from './supabase'

export interface ApiErrorShape {
  code?: string
  message: string
  details?: unknown
}

export interface ApiEnvelope<T> {
  success?: boolean
  data?: T
  error?: ApiErrorShape | string
  meta?: unknown
}

export interface SmsCallOptions {
  headers?: Record<string, string>
  signal?: AbortSignal
}

async function callEdgeFunction<TResponse>(
  functionName: string,
  payload: unknown,
  options?: SmsCallOptions
): Promise<TResponse> {
  const url = `${supabaseUrl.replace(/\/$/, '')}/functions/v1/${functionName}`

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    apikey: supabaseAnonKey,
    Authorization: `Bearer ${supabaseAnonKey}`,
    ...(options?.headers || {}),
  }

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload ?? {}),
  })

  let json: any = null
  try {
    json = await res.json()
  } catch {
    json = null
  }



  const envelope = json as ApiEnvelope<TResponse>
  if (
    envelope &&
    typeof envelope === 'object' &&
    ('success' in envelope || 'data' in envelope || 'error' in envelope)
  ) {
    if ((envelope as ApiEnvelope<TResponse>).error) {
      const err = (envelope as ApiEnvelope<TResponse>).error as ApiErrorShape | string
      throw new Error(typeof err === 'string' ? err : err.message || '请求失败')
    }
    return (envelope as ApiEnvelope<TResponse>) as TResponse
  }

  return json as TResponse
}

// ==============
// SMS APIs
// ==============

export interface SendSmsCodeParams {
  phoneNumber: string
  type?: 'login' | 'register'
  cooldownSeconds?: number
  templateId?: string
}

export async function sendSmsCode(params: SendSmsCodeParams, options?: SmsCallOptions) {
  return callEdgeFunction<{ success?: boolean; message?: string }>('send-sms-spug', params, options)
}

export interface VerifySmsSpugParams {
  phoneNumber: string
  verificationCode: string
  type?: 'register' | 'login'
  name?: string
  redirectTo?: string
}

export interface VerifySmsSpugResponse {
  success?: boolean
  message?: string
  error?: string
  loginUrl?: string
}

export async function verifySmsSpug(params: VerifySmsSpugParams, options?: SmsCallOptions) {
  return callEdgeFunction<VerifySmsSpugResponse>('verify-sms', params, options)
}

export async function sendSmsSpug(params: SendSmsCodeParams, options?: SmsCallOptions) {
  return callEdgeFunction<{ success?: boolean; message?: string }>('send-sms-spug', params, options)
}


