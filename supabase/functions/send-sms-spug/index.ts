import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

interface SendSMSPayload {
  phoneNumber: string;
  type?: "register" | "login";
  templateId?: string;
  codeLength?: number;
  cooldownSeconds?: number;
  ttlSeconds?: number;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
  Connection: "keep-alive",
};

const INTERNATIONAL_PHONE_PATTERN = /^\+[1-9]\d{6,14}$/;

function sanitizePhoneInput(value: string) {
  const trimmed = value.trim();
  const hasLeadingPlus = trimmed.startsWith("+");
  const digitsOnly = trimmed.replace(/\D/g, "");

  if (!digitsOnly) {
    return hasLeadingPlus ? "+" : "";
  }

  return hasLeadingPlus ? `+${digitsOnly}` : digitsOnly;
}

function parsePhoneNumber(value: string) {
  const compact = sanitizePhoneInput(value);
  if (!compact) {
    return {
      isDomestic: false,
      isValid: false,
      normalizedPhone: null as string | null,
    };
  }

  const mainlandMatch = compact.match(/^(?:\+?86)?(1[3-9]\d{9})$/);
  if (mainlandMatch) {
    return {
      isDomestic: true,
      isValid: true,
      normalizedPhone: mainlandMatch[1],
    };
  }

  if (INTERNATIONAL_PHONE_PATTERN.test(compact)) {
    return {
      isDomestic: false,
      isValid: true,
      normalizedPhone: compact,
    };
  }

  return {
    isDomestic: false,
    isValid: false,
    normalizedPhone: null as string | null,
  };
}

function getPhoneLookupValues(
  parsedPhone: ReturnType<typeof parsePhoneNumber>
) {
  if (!parsedPhone.normalizedPhone) {
    return [];
  }

  if (parsedPhone.isDomestic) {
    return [
      parsedPhone.normalizedPhone,
      `86${parsedPhone.normalizedPhone}`,
      `+86${parsedPhone.normalizedPhone}`,
    ];
  }

  return [
    parsedPhone.normalizedPhone,
    parsedPhone.normalizedPhone.replace(/^\+/, ""),
  ];
}

function generateCode(length: number) {
  const min = Math.pow(10, length - 1);
  const max = Math.pow(10, length) - 1;
  return String(Math.floor(Math.random() * (max - min + 1)) + min);
}

async function sendDomesticSms(
  phoneNumber: string,
  code: string,
  templateId: string
) {
  if (!templateId) {
    throw new Error("Domestic SMS template is not configured.");
  }

  const url = `https://push.spug.cc/sms/${encodeURIComponent(templateId)}`;
  const response = await fetch(
    `${url}?code=${encodeURIComponent(code)}&to=${encodeURIComponent(phoneNumber)}`,
    { method: "GET" }
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Spug SMS send failed:", errorText);
    throw new Error("Failed to send domestic SMS.");
  }
}

async function sendInternationalSms(
  phoneNumber: string,
  code: string,
  type: string
) {
  const apikey = Deno.env.get("YUNPIAN_API_KEY") || "";
  if (!apikey) {
    throw new Error("International SMS provider is not configured.");
  }

  const intlApiUrl =
    Deno.env.get("YUNPIAN_INTL_SMS_URL") ||
    "https://sms.yunpian.com/v2/sms/single_send.json";
  const template =
    Deno.env.get("YUNPIAN_INTL_TEMPLATE") ||
    "[Mental Health] Your verification code is #code#, valid for ten minutes. Please ignore if not initiated by you.";
  const text = template.replaceAll("#code#", code);

  const body = new URLSearchParams({
    apikey,
    mobile: phoneNumber,
    text,
  });

  const response = await fetch(intlApiUrl, {
    method: "POST",
    headers: {
      Accept: "application/json;charset=utf-8",
      "Content-Type": "application/x-www-form-urlencoded;charset=utf-8",
    },
    body: body.toString(),
  });

  const result = await response.json().catch(() => null);
  if (!response.ok || !result || result.code !== 0) {
    console.error("Yunpian international SMS send failed:", result);
    const errorMessage =
      result?.msg ||
      `Failed to send ${type === "register" ? "registration" : "login"} SMS.`;
    throw new Error(errorMessage);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const {
      phoneNumber,
      type,
      templateId = Deno.env.get("SPUG_TEMPLATE_ID") || "",
      codeLength = 6,
      cooldownSeconds = 180,
      ttlSeconds = 600,
    } = (await req.json()) as SendSMSPayload;

    const parsedPhone = parsePhoneNumber(phoneNumber || "");
    if (!parsedPhone.isValid || !parsedPhone.normalizedPhone) {
      return new Response(
        JSON.stringify({
          error:
            "Enter a valid phone number. Mainland China numbers can use 11 digits, and international numbers should include the country code, for example +12025550123.",
        }),
        { status: 400, headers: corsHeaders }
      );
    }

    const phoneLookupValues = getPhoneLookupValues(parsedPhone);

    if (type === "login") {
      const { data: existingUser } = await supabase
        .from("user_profiles")
        .select("id")
        .in("phone", phoneLookupValues)
        .limit(1);

      if (!existingUser || existingUser.length === 0) {
        return new Response(
          JSON.stringify({ error: "This phone number is not registered yet." }),
          { status: 400, headers: corsHeaders }
        );
      }
    } else if (type === "register") {
      const { data: existingUser } = await supabase
        .from("user_profiles")
        .select("id")
        .in("phone", phoneLookupValues)
        .limit(1);

      if (existingUser && existingUser.length > 0) {
        return new Response(
          JSON.stringify({ error: "This phone number is already registered." }),
          { status: 400, headers: corsHeaders }
        );
      }
    }

    const cooldownSince = new Date(
      Date.now() - cooldownSeconds * 1000
    ).toISOString();
    const { data: recent, error: recentError } = await supabase
      .from("sms_verification_codes")
      .select("created_at")
      .eq("phone_number", parsedPhone.normalizedPhone)
      .gt("created_at", cooldownSince)
      .order("created_at", { ascending: false })
      .limit(1);

    if (recentError) {
      console.error("SMS cooldown query failed:", recentError);
      return new Response(
        JSON.stringify({ error: "System error. Please try again later." }),
        { status: 500, headers: corsHeaders }
      );
    }

    if (recent && recent.length > 0) {
      const lastSentAt = new Date(recent[0].created_at as string).getTime();
      const remain = Math.max(
        0,
        Math.ceil((cooldownSeconds * 1000 - (Date.now() - lastSentAt)) / 1000)
      );

      return new Response(
        JSON.stringify({
          error: `Too many requests. Please try again in ${remain} seconds.`,
        }),
        {
          status: 429,
          headers: { ...corsHeaders, "Retry-After": String(remain) },
        }
      );
    }

    const verificationCode = generateCode(codeLength);
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();
    const { error: insertError } = await supabase
      .from("sms_verification_codes")
      .insert({
        phone_number: parsedPhone.normalizedPhone,
        verification_code: verificationCode,
        is_used: false,
        expires_at: expiresAt,
      });

    if (insertError) {
      console.error("Failed to store verification code:", insertError);
      return new Response(
        JSON.stringify({ error: "System error. Please try again later." }),
        { status: 500, headers: corsHeaders }
      );
    }

    if (parsedPhone.isDomestic) {
      await sendDomesticSms(
        parsedPhone.normalizedPhone,
        verificationCode,
        templateId
      );
    } else {
      await sendInternationalSms(
        parsedPhone.normalizedPhone,
        verificationCode,
        type || "login"
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Verification code sent.",
      }),
      { status: 200, headers: corsHeaders }
    );
  } catch (error) {
    console.error("send-sms-spug error:", error);
    const message =
      error instanceof Error ? error.message : "Internal server error.";

    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: corsHeaders,
    });
  }
});
