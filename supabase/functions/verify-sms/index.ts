import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

interface VerifySMSPayload {
  phoneNumber: string;
  verificationCode: string;
  type?: "register" | "login";
  name?: string;
  password?: string;
  randomId?: string;
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
      authEmail: "",
      isDomestic: false,
      isValid: false,
      normalizedPhone: null as string | null,
    };
  }

  const mainlandMatch = compact.match(/^(?:\+?86)?(1[3-9]\d{9})$/);
  if (mainlandMatch) {
    const mainlandNumber = mainlandMatch[1];

    return {
      authEmail: `${mainlandNumber}@temp.local`,
      isDomestic: true,
      isValid: true,
      normalizedPhone: mainlandNumber,
    };
  }

  if (INTERNATIONAL_PHONE_PATTERN.test(compact)) {
    const intlDigits = compact.slice(1);

    return {
      authEmail: `phone-${intlDigits}@temp.local`,
      isDomestic: false,
      isValid: true,
      normalizedPhone: compact,
    };
  }

  return {
    authEmail: "",
    isDomestic: false,
    isValid: false,
    normalizedPhone: null as string | null,
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const {
      phoneNumber,
      verificationCode,
      type = "register",
      name,
      password,
      randomId,
    } = (await req.json()) as VerifySMSPayload;

    if (!phoneNumber || !verificationCode) {
      return new Response(
        JSON.stringify({ error: "Phone number and verification code are required." }),
        { status: 400, headers: corsHeaders }
      );
    }

    const parsedPhone = parsePhoneNumber(phoneNumber);
    if (
      !parsedPhone.isValid ||
      !parsedPhone.normalizedPhone ||
      !parsedPhone.authEmail
    ) {
      return new Response(
        JSON.stringify({
          error:
            "Enter a valid phone number. Mainland China numbers can use 11 digits, and international numbers should include the country code.",
        }),
        { status: 400, headers: corsHeaders }
      );
    }

    if (!/^\d{6}$/.test(verificationCode)) {
      return new Response(
        JSON.stringify({ error: "Verification code format is invalid." }),
        { status: 400, headers: corsHeaders }
      );
    }

    const { data: codeData, error: codeError } = await supabaseClient
      .from("sms_verification_codes")
      .select("*")
      .eq("phone_number", parsedPhone.normalizedPhone)
      .eq("verification_code", verificationCode)
      .eq("is_used", false)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1);

    if (codeError) {
      console.error("Failed to query verification code:", codeError);
      return new Response(
        JSON.stringify({ error: "System error. Please try again later." }),
        { status: 500, headers: corsHeaders }
      );
    }

    if (!codeData || codeData.length === 0) {
      return new Response(
        JSON.stringify({ error: "Verification code is invalid or expired." }),
        { status: 400, headers: corsHeaders }
      );
    }

    await supabaseClient
      .from("sms_verification_codes")
      .update({ is_used: true })
      .eq("id", codeData[0].id);

    if (type === "register") {
      if (!name) {
        return new Response(
          JSON.stringify({ error: "Name is required for registration." }),
          { status: 400, headers: corsHeaders }
        );
      }

      const { data: existingUser } = await supabaseClient
        .from("user_profiles")
        .select("id")
        .eq("phone", parsedPhone.normalizedPhone)
        .limit(1);

      if (existingUser && existingUser.length > 0) {
        return new Response(
          JSON.stringify({ error: "This phone number is already registered." }),
          { status: 400, headers: corsHeaders }
        );
      }

      const userPassword = password || Math.random().toString(36).slice(-12);
      const { data: authData, error: authError } =
        await supabaseClient.auth.admin.createUser({
          email: parsedPhone.authEmail,
          password: userPassword,
          user_metadata: {
            phone: parsedPhone.normalizedPhone,
            name,
          },
        });

      if (authError) {
        console.error("Failed to create auth user:", authError);
        return new Response(
          JSON.stringify({ error: "Registration failed. Please try again later." }),
          { status: 500, headers: corsHeaders }
        );
      }

      const { error: profileError } = await supabaseClient
        .from("user_profiles")
        .insert({
          id: authData.user.id,
          phone: parsedPhone.normalizedPhone,
          display_name: name,
        });

      if (profileError) {
        console.error("Failed to create user profile:", profileError);
        await supabaseClient.auth.admin.deleteUser(authData.user.id);

        return new Response(
          JSON.stringify({ error: "Registration failed. Please try again later." }),
          { status: 500, headers: corsHeaders }
        );
      }

      const { data: regLink, error: regLinkErr } =
        await supabaseClient.auth.admin.generateLink({
          type: "magiclink",
          email: parsedPhone.authEmail,
          options: {
            redirectTo: `${Deno.env.get("SITE_URL")}/auth/callback`,
          },
        });

      if (regLinkErr) {
        console.error("Failed to generate register magic link:", regLinkErr);
        return new Response(
          JSON.stringify({ error: "Registered successfully, but failed to create the login link." }),
          { status: 500, headers: corsHeaders }
        );
      }

      if (randomId) {
        const normalizedCode = randomId.trim().toUpperCase();
        const { error: markRandomIdError } = await supabaseClient
          .from("random_ids")
          .update({
            is_used: true,
            user_id: authData.user.id,
            used_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("code", normalizedCode)
          .eq("is_used", false);

        if (markRandomIdError) {
          console.error("Failed to mark random ID as used:", markRandomIdError);
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: "Registration completed.",
          userId: authData.user.id,
          loginUrl: (regLink as any)?.properties?.action_link,
        }),
        { status: 200, headers: corsHeaders }
      );
    }

    if (type === "login") {
      const { data: userProfile } = await supabaseClient
        .from("user_profiles")
        .select("id, display_name")
        .eq("phone", parsedPhone.normalizedPhone)
        .limit(1);

      if (!userProfile || userProfile.length === 0) {
        return new Response(
          JSON.stringify({ error: "This phone number is not registered yet." }),
          { status: 400, headers: corsHeaders }
        );
      }

      const { data: tokenData, error: tokenError } =
        await supabaseClient.auth.admin.generateLink({
          type: "magiclink",
          email: parsedPhone.authEmail,
          options: {
            redirectTo: `${Deno.env.get("SITE_URL")}/auth/callback`,
          },
        });

      if (tokenError) {
        console.error("Failed to generate login magic link:", tokenError);
        return new Response(
          JSON.stringify({ error: "Login failed. Please try again later." }),
          { status: 500, headers: corsHeaders }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: "Login completed.",
          userId: userProfile[0].id,
          userName: userProfile[0].display_name,
          loginUrl: (tokenData as any).properties?.action_link,
        }),
        { status: 200, headers: corsHeaders }
      );
    }

    return new Response(JSON.stringify({ error: "Invalid operation type." }), {
      status: 400,
      headers: corsHeaders,
    });
  } catch (error) {
    console.error("verify-sms error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error." }),
      { status: 500, headers: corsHeaders }
    );
  }
});
