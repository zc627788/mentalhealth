// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
  Connection: "keep-alive",
};

console.info("SMS verification service started");

Deno.serve(async (req: Request) => {
  // 处理CORS预检请求
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // 创建Supabase客户端（使用 Service Role Key）
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const {
      phoneNumber,
      verificationCode,
      type = "register",
      name,
    } = await req.json();

    // 验证输入参数
    if (!phoneNumber || !verificationCode) {
      const errorResponse = { error: "手机号和验证码不能为空" };
      return new Response(JSON.stringify(errorResponse), {
        status: 400,
        headers: corsHeaders,
      });
    }

    // 验证手机号格式
    const phoneRegex = /^1[3-9]\d{9}$/;
    if (!phoneRegex.test(phoneNumber)) {
      const errorResponse = { error: "手机号格式不正确" };
      return new Response(JSON.stringify(errorResponse), {
        status: 400,
        headers: corsHeaders,
      });
    }

    // 验证验证码格式
    if (!/^\d{6}$/.test(verificationCode)) {
      const errorResponse = { error: "验证码格式不正确" };
      return new Response(JSON.stringify(errorResponse), {
        status: 400,
        headers: corsHeaders,
      });
    }

    // 查找有效的验证码
    const { data: codeData, error: codeError } = await supabaseClient
      .from("sms_verification_codes")
      .select("*")
      .eq("phone_number", phoneNumber)
      .eq("verification_code", verificationCode)
      .eq("is_used", false)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1);

    if (codeError) {
      console.error("查询验证码失败:", codeError);
      const errorResponse = { error: "系统错误，请稍后重试" };
      return new Response(JSON.stringify(errorResponse), {
        status: 500,
        headers: corsHeaders,
      });
    }

    if (!codeData || codeData.length === 0) {
      const errorResponse = { error: "验证码无效或已过期" };
      return new Response(JSON.stringify(errorResponse), {
        status: 400,
        headers: corsHeaders,
      });
    }

    // 标记验证码为已使用
    await supabaseClient
      .from("sms_verification_codes")
      .update({ is_used: true })
      .eq("id", codeData[0].id);

    if (type === "register") {
      // 注册流程
      if (!name) {
        const errorResponse = { error: "注册时姓名不能为空" };
        return new Response(JSON.stringify(errorResponse), {
          status: 400,
          headers: corsHeaders,
        });
      }

      // 检查手机号是否已注册
      const { data: existingUser } = await supabaseClient
        .from("user_profiles")
        .select("id")
        .eq("phone", phoneNumber)
        .limit(1);

      if (existingUser && existingUser.length > 0) {
        const errorResponse = { error: "该手机号已注册，请直接登录" };
        return new Response(JSON.stringify(errorResponse), {
          status: 400,
          headers: corsHeaders,
        });
      }

      // 创建用户（使用手机号作为用户名）
      const { data: authData, error: authError } =
        await supabaseClient.auth.admin.createUser({
          phone: phoneNumber, // ✅ 核心修正：直接使用 phone 字段
          password: Math.random().toString(36).slice(-12), // 随机密码是OK的
          user_metadata: { name: name }, // ✅ 优化：user_metadata 中只存放自定义信息，如姓名
          phone_confirm: true, // ✅ 关键：标记手机号为已验证
        });

      if (authError) {
        console.error("创建用户失败:", authError);
        const errorResponse = { error: "注册失败，请稍后重试" };
        return new Response(JSON.stringify(errorResponse), {
          status: 500,
          headers: corsHeaders,
        });
      }

      // 创建用户profile
      const { error: profileError } = await supabaseClient
        .from("user_profiles")
        .insert({ id: authData.user.id, phone: phoneNumber, name });

      if (profileError) {
        console.error("创建用户profile失败:", profileError);
        // 删除已创建的用户
        await supabaseClient.auth.admin.deleteUser(authData.user.id);
        const errorResponse = { error: "注册失败，请稍后重试" };
        return new Response(JSON.stringify(errorResponse), {
          status: 500,
          headers: corsHeaders,
        });
      }

      // 注册成功后也生成一次性登录链接，前端直接跳转完成会话建立
      const { data: regLink, error: regLinkErr } =
        await supabaseClient.auth.admin.generateLink({
          type: "magiclink",
          email: `${phoneNumber}@temp.local`,
          options: {
            redirectTo: `${Deno.env.get("SITE_URL")}/auth/callback`,
          },
        });

      if (regLinkErr) {
        console.error("生成注册登录链接失败:", regLinkErr);
        const errorResponse = { error: "注册成功但生成登录链接失败" };
        return new Response(JSON.stringify(errorResponse), {
          status: 500,
          headers: corsHeaders,
        });
      }

      const successResponse = {
        success: true,
        message: "注册成功",
        userId: authData.user.id,
        loginUrl: (regLink as any)?.properties?.action_link,
      };
      return new Response(JSON.stringify(successResponse), {
        status: 200,
        headers: corsHeaders,
      });
    } else if (type === "login") {
      // 登录流程
      const { data: userProfile } = await supabaseClient
        .from("user_profiles")
        .select("id, name")
        .eq("phone", phoneNumber)
        .limit(1);

      if (!userProfile || userProfile.length === 0) {
        const errorResponse = { error: "该手机号未注册，请先注册" };
        return new Response(JSON.stringify(errorResponse), {
          status: 400,
          headers: corsHeaders,
        });
      }

      // 生成一次性登录链接（Magic Link）
      const { data: tokenData, error: tokenError } =
        await supabaseClient.auth.admin.generateLink({
          type: "magiclink",
          email: `${phoneNumber}@temp.local`,
          options: {
            redirectTo: `${Deno.env.get("SITE_URL")}/auth/callback`,
          },
        });

      if (tokenError) {
        console.error("生成登录链接失败:", tokenError);
        const errorResponse = { error: "登录失败，请稍后重试" };
        return new Response(JSON.stringify(errorResponse), {
          status: 500,
          headers: corsHeaders,
        });
      }

      const successResponse = {
        success: true,
        message: "登录成功",
        userId: userProfile[0].id,
        userName: userProfile[0].name,
        loginUrl: (tokenData as any).properties?.action_link,
      };
      return new Response(JSON.stringify(successResponse), {
        status: 200,
        headers: corsHeaders,
      });
    }

    const errorResponse = { error: "无效的操作类型" };
    return new Response(JSON.stringify(errorResponse), {
      status: 400,
      headers: corsHeaders,
    });
  } catch (error) {
    console.error("验证短信验证码错误:", error);
    const errorResponse = { error: "服务器内部错误" };
    return new Response(JSON.stringify(errorResponse), {
      status: 500,
      headers: corsHeaders,
    });
  }
});
