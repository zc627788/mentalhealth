import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useSendSMSCode, useVerifySMSCode } from "@/hooks/useSms";
import { supabase } from "../lib/supabase";

interface LoginFormData {
  phoneNumber: string;
  password: string;
}

interface LoginFormErrors {
  phoneNumber?: string;
  password?: string;
  general?: string;
}

type LoginMode = "phoneCode" | "phonePassword";

export default function Login() {
  const [formData, setFormData] = useState<LoginFormData>({
    phoneNumber: "",
    password: "",
  });
  const [errors, setErrors] = useState<LoginFormErrors>({});
  const [isLoading, setIsLoading] = useState(false);
  const [loginMode, setLoginMode] = useState<LoginMode>("phoneCode");
  
  // 验证码相关
  const [verificationCode, setVerificationCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [canResend, setCanResend] = useState(true);
  const [smsTip, setSmsTip] = useState("");
  
  const { signIn, signInWithPassword } = useAuth();
  const sendSms = useSendSMSCode();
  const verifySms = useVerifySMSCode();
  const navigate = useNavigate();

  // 倒计时
  useEffect(() => {
    if (countdown > 0) {
      setCanResend(false);
      const t = setTimeout(() => setCountdown((s) => s - 1), 1000);
      return () => clearTimeout(t);
    } else {
      setCanResend(true);
    }
  }, [countdown]);

  const validateForm = (): boolean => {
    const newErrors: LoginFormErrors = {};

    // Phone validation
    if (!formData.phoneNumber.trim()) {
      newErrors.phoneNumber = "请输入手机号";
    } else if (!/^1[3-9]\d{9}$/.test(formData.phoneNumber)) {
      newErrors.phoneNumber = "手机号格式不正确";
    }

    if (loginMode === "phonePassword") {
      // Password validation
      if (!formData.password.trim()) {
        newErrors.password = "请输入密码";
      } else if (formData.password.length < 6) {
        newErrors.password = "密码至少需要 6 个字符";
      }
    } else {
      // 验证码登录时需要验证码
      if (!verificationCode.trim()) {
        newErrors.general = "请输入短信验证码";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Clear previous errors
    setErrors({});

    // Validate form
    if (!validateForm()) {
      return;
    }

    // Prevent multiple submissions
    if (isLoading) {
      return;
    }

    setIsLoading(true);

    try {
      if (loginMode === "phonePassword") {
        // 手机号 + 密码登录
        // 注意：需要后端支持手机号密码登录
        const { error } = await signInWithPassword(formData.phoneNumber, formData.password);

        if (error) {
          setErrors({ general: error });
        } else {
          // 登录成功，检查 AI 服务预约设置
          try {
            const { data: aiAppointmentRequired } = await supabase
              .from("system_settings")
              .select("setting_value")
              .eq("setting_key", "ai_appointment_required")
              .maybeSingle();

            if (aiAppointmentRequired?.setting_value === "true") {
              navigate("/appointment");
            } else {
              navigate("/dashboard");
            }
          } catch (error) {
            console.error("检查跳转路径失败:", error);
            navigate("/appointment");
          }
        }
      } else {
        // 手机号 + 验证码登录
        try {
          const result = await verifySms.mutateAsync({
            phoneNumber: formData.phoneNumber,
            code: verificationCode,
            type: "login",
          });

          if (result?.loginUrl) {
            window.location.href = result?.loginUrl;
            return;
          }
          
          // 兜底：按系统设置跳转
          try {
            const { data: aiAppointmentRequired } = await supabase
              .from("system_settings")
              .select("setting_value")
              .eq("setting_key", "ai_appointment_required")
              .maybeSingle();
            if (aiAppointmentRequired?.setting_value === "true") {
              navigate("/appointment");
            } else {
              navigate("/dashboard");
            }
          } catch (error) {
            console.error("检查跳转路径失败:", error);
            navigate("/appointment");
          }
        } catch (e: any) {
          setErrors({ general: e?.message || "验证码验证失败" });
        }
      }
    } catch (error: any) {
      setErrors({ general: "操作失败，请稍后重试" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendCode = async () => {
    setErrors({});
    if (!formData.phoneNumber || !/^1[3-9]\d{9}$/.test(formData.phoneNumber)) {
      setErrors({ phoneNumber: "请输入正确的手机号" });
      return;
    }
    if (!canResend) return;

    setIsLoading(true);
    try {
      const res = await sendSms.mutateAsync({
        phoneNumber: formData.phoneNumber,
        type: 'login', // 登录场景
        cooldownSeconds: 60,
      });
      setCodeSent(true);
      setSmsTip((res as any)?.message || "验证码已发送");
      setCountdown(60);
    } catch (e: any) {
      setErrors({ general: e?.message || "发送失败，请稍后重试" });
      setSmsTip("");
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));

    // Clear field error when user starts typing
    if (errors[name as keyof LoginFormErrors]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-100 to-indigo-200 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl p-8 w-full max-w-md">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">欢迎回来</h1>
          <p className="text-gray-600">登录您的心理咨询账户</p>
        </div>

        {/* Login Mode Toggle */}
        <div className="flex bg-gray-100 rounded-lg p-1 mb-6">
          <button
            type="button"
            onClick={() => setLoginMode("phoneCode")}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
              loginMode === "phoneCode"
                ? "bg-white text-blue-600 shadow-sm"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            验证码登录
          </button>
          <button
            type="button"
            onClick={() => setLoginMode("phonePassword")}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
              loginMode === "phonePassword"
                ? "bg-white text-blue-600 shadow-sm"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            密码登录
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* General Error Message */}
          {errors.general && (
            <div className="bg-red-50 border border-red-200 rounded-md p-3">
              <p className="text-red-800 text-sm">{errors.general}</p>
            </div>
          )}

          {/* Phone Field */}
          <div>
            <label
              htmlFor="phoneNumber"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              手机号
            </label>
            <input
              type="tel"
              id="phoneNumber"
              name="phoneNumber"
              value={formData.phoneNumber}
              onChange={handleChange}
              className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${
                errors.phoneNumber
                  ? "border-red-300 bg-red-50"
                  : "border-gray-300"
              }`}
              placeholder="请输入手机号"
              maxLength={11}
              required
              disabled={isLoading}
            />
            {errors.phoneNumber && (
              <p className="text-red-600 text-xs mt-1">
                {errors.phoneNumber}
              </p>
            )}
          </div>

          {/* Phone Code Login */}
          {loginMode === "phoneCode" && (
            <>
              <div>
                <label
                  htmlFor="verificationCode"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  短信验证码
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    id="verificationCode"
                    name="verificationCode"
                    value={verificationCode}
                    onChange={(e) =>
                      setVerificationCode(
                        e.target.value.replace(/\D/g, "").slice(0, 6)
                      )
                    }
                    className={`flex-1 px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors tracking-widest ${
                      errors.general
                        ? "border-red-300 bg-red-50"
                        : "border-gray-300"
                    }`}
                    placeholder="请输入 6 位验证码"
                    maxLength={6}
                    disabled={isLoading}
                  />
                  <button
                    type="button"
                    onClick={handleSendCode}
                    disabled={isLoading || !canResend}
                    className={`px-3 py-2 rounded-md text-sm whitespace-nowrap ${
                      isLoading || !canResend
                        ? "bg-gray-200 text-gray-500"
                        : "bg-blue-50 text-blue-700 hover:bg-blue-100"
                    }`}
                  >
                    {codeSent
                      ? countdown > 0
                        ? `${countdown}s`
                        : "重新发送"
                      : "获取验证码"}
                  </button>
                </div>
                {smsTip && (
                  <p className="text-xs text-blue-600 mt-1">{smsTip}</p>
                )}
              </div>
            </>
          )}

          {/* Phone Password Login */}
          {loginMode === "phonePassword" && (
            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                密码
              </label>
              <input
                type="password"
                id="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${
                  errors.password
                    ? "border-red-300 bg-red-50"
                    : "border-gray-300"
                }`}
                placeholder="请输入密码"
                minLength={6}
                required
                disabled={isLoading}
              />
              {errors.password && (
                <p className="text-red-600 text-xs mt-1">{errors.password}</p>
              )}
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading}
            className={`w-full py-2 px-4 rounded-md font-medium text-white transition-colors duration-200 ${
              isLoading
                ? "bg-gray-400 cursor-not-allowed"
                : "bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            }`}
          >
            {isLoading ? (
              <span className="flex items-center justify-center">
                <svg
                  className="animate-spin -ml-1 mr-3 h-4 w-4 text-white"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                登录中...
              </span>
            ) : (
              "登录"
            )}
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-gray-600 text-sm">
            还没有账户？{' '}
            <Link to="/register" className="text-blue-600 hover:text-blue-800 font-medium">
              立即注册
            </Link>
          </p>
        </div>

        <div className="mt-4 text-center">
          <p className="text-xs text-gray-500">Created by MiniMax Agent</p>
        </div>
      </div>
    </div>
  );
}
