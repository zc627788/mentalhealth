import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useSendSMSCode, useVerifySMSCode } from "@/hooks/useSms";
import SliderCaptchaDialog from "./SliderCaptchaDialog";
import { useCaptchaGate } from "@/hooks/useCaptchaGate";
import { useAuth } from "../contexts/AuthContext";
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
type LoginAction = "sendCode" | "submit";

const CAPTCHA_TTL_MINUTES = 2;

export default function Login() {
  const { t } = useTranslation();
  const [formData, setFormData] = useState<LoginFormData>({
    phoneNumber: "",
    password: "",
  });
  const [errors, setErrors] = useState<LoginFormErrors>({});
  const [isLoading, setIsLoading] = useState(false);
  const [loginMode, setLoginMode] = useState<LoginMode>("phoneCode");
  const [verificationCode, setVerificationCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [canResend, setCanResend] = useState(true);
  const [smsTip, setSmsTip] = useState("");

  const { signInWithPassword } = useAuth();
  const sendSms = useSendSMSCode();
  const verifySms = useVerifySMSCode();
  const navigate = useNavigate();
  const captchaGate = useCaptchaGate<LoginAction>(
    `${loginMode}:${formData.phoneNumber.trim()}`,
    CAPTCHA_TTL_MINUTES * 60 * 1000
  );

  useEffect(() => {
    if (countdown > 0) {
      setCanResend(false);
      const timer = setTimeout(() => setCountdown((value) => value - 1), 1000);
      return () => clearTimeout(timer);
    }
    setCanResend(true);
  }, [countdown]);

  const validateForm = () => {
    const nextErrors: LoginFormErrors = {};

    if (!formData.phoneNumber.trim()) {
      nextErrors.phoneNumber = t("login.errors.phoneRequired");
    } else if (!/^1[3-9]\d{9}$/.test(formData.phoneNumber)) {
      nextErrors.phoneNumber = t("login.errors.phoneInvalid");
    }

    if (loginMode === "phonePassword") {
      if (!formData.password.trim()) {
        nextErrors.password = t("login.errors.passwordRequired");
      } else if (formData.password.length < 6) {
        nextErrors.password = t("login.errors.passwordShort");
      }
    } else if (!verificationCode.trim()) {
      nextErrors.general = t("login.errors.codeRequired");
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const resolvePostLoginPath = async () => {
    const { data: aiAppointmentRequired } = await supabase
      .from("system_settings")
      .select("setting_value")
      .eq("setting_key", "ai_appointment_required")
      .maybeSingle();

    return aiAppointmentRequired?.setting_value === "true"
      ? "/appointment"
      : "/dashboard";
  };

  const submitRequest = async () => {
    setIsLoading(true);

    try {
      if (loginMode === "phonePassword") {
        const { error } = await signInWithPassword(
          formData.phoneNumber,
          formData.password
        );

        if (error) {
          setErrors({ general: error });
          return;
        }
      } else {
        try {
          const result = await verifySms.mutateAsync({
            phoneNumber: formData.phoneNumber,
            code: verificationCode,
            type: "login",
          });

          if ((result as any)?.loginUrl) {
            window.location.href = (result as any).loginUrl;
            return;
          }
        } catch (error: any) {
          setErrors({
            general: error?.message || t("login.errors.verifyFailed"),
          });
          return;
        }
      }

      try {
        navigate(await resolvePostLoginPath());
      } catch (error) {
        console.error("Failed to resolve login redirect:", error);
        navigate("/appointment");
      }
    } catch (error) {
      setErrors({ general: t("login.errors.operationFailed") });
    } finally {
      setIsLoading(false);
    }
  };

  const sendCodeRequest = async () => {
    if (!canResend) return;

    setErrors({});

    setIsLoading(true);
    try {
      const result = await sendSms.mutateAsync({
        phoneNumber: formData.phoneNumber,
        type: "login",
        cooldownSeconds: 60,
      });
      setCodeSent(true);
      setSmsTip((result as any)?.message || t("login.smsSent"));
      setCountdown(60);
    } catch (error: any) {
      setErrors({ general: error?.message || t("login.errors.sendFailed") });
      setSmsTip("");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    if (!validateForm() || isLoading) return;

    if (!captchaGate.requestVerification("submit")) {
      return;
    }

    await submitRequest();
  };

  const handleSendCode = async () => {
    setErrors({});

    if (!/^1[3-9]\d{9}$/.test(formData.phoneNumber)) {
      setErrors({ phoneNumber: t("login.errors.phoneInvalid") });
      return;
    }

    if (!captchaGate.requestVerification("sendCode")) {
      return;
    }

    await sendCodeRequest();
  };

  const handleCaptchaSuccess = () => {
    const nextAction = captchaGate.completeVerification();

    if (nextAction === "sendCode") {
      void sendCodeRequest();
      return;
    }

    if (nextAction === "submit") {
      void submitRequest();
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name as keyof LoginFormErrors]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-100 via-white to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            {t("login.title")}
          </h1>
          <p className="text-gray-600">{t("login.subtitle")}</p>
        </div>

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
            {t("login.phoneCode")}
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
            {t("login.passwordLogin")}
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {errors.general && (
            <div className="bg-red-50 border border-red-200 rounded-md p-3">
              <p className="text-red-800 text-sm">{errors.general}</p>
            </div>
          )}

          <div>
            <label
              htmlFor="phoneNumber"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              {t("login.phoneNumber")}
            </label>
            <input
              type="tel"
              id="phoneNumber"
              name="phoneNumber"
              value={formData.phoneNumber}
              onChange={handleChange}
              className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${
                errors.phoneNumber ? "border-red-300 bg-red-50" : "border-gray-300"
              }`}
              placeholder={t("login.phonePlaceholder")}
              maxLength={11}
              required
              disabled={isLoading}
            />
            {errors.phoneNumber && (
              <p className="text-red-600 text-xs mt-1">{errors.phoneNumber}</p>
            )}
          </div>

          {loginMode === "phoneCode" ? (
            <div>
              <label
                htmlFor="verificationCode"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                {t("login.code")}
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  id="verificationCode"
                  value={verificationCode}
                  onChange={(e) =>
                    setVerificationCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                  className={`flex-1 px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors tracking-widest ${
                    errors.general ? "border-red-300 bg-red-50" : "border-gray-300"
                  }`}
                  placeholder={t("login.codePlaceholder")}
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
                      : t("login.resendCode")
                    : t("login.getCode")}
                </button>
              </div>
              {smsTip && <p className="text-xs text-blue-600 mt-1">{smsTip}</p>}
            </div>
          ) : (
            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                {t("login.password")}
              </label>
              <input
                type="password"
                id="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${
                  errors.password ? "border-red-300 bg-red-50" : "border-gray-300"
                }`}
                placeholder={t("login.passwordPlaceholder")}
                minLength={6}
                required
                disabled={isLoading}
              />
              {errors.password && (
                <p className="text-red-600 text-xs mt-1">{errors.password}</p>
              )}
            </div>
          )}

          <div
            className={`rounded-2xl border p-3 transition-colors ${
              captchaGate.isVerified
                ? "border-emerald-200 bg-emerald-50"
                : "border-slate-200 bg-slate-50"
            }`}
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-slate-900">
                    {t("captcha.title")}
                  </p>
                  <span
                    className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                      captchaGate.isVerified
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-sky-100 text-sky-700"
                    }`}
                  >
                    {captchaGate.isVerified
                      ? t("captcha.verifiedBadge")
                      : t("captcha.requiredBadge")}
                  </span>
                </div>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  {captchaGate.isVerified
                    ? t("captcha.verifiedHint", {
                        minutes: CAPTCHA_TTL_MINUTES,
                      })
                    : t("captcha.loginHint")}
                </p>
                <p className="mt-1 text-[11px] leading-4 text-slate-400">
                  {t("captcha.contextHint")}
                </p>
              </div>
              <button
                type="button"
                onClick={captchaGate.openManually}
                className={`w-full shrink-0 rounded-xl px-3 py-2 text-xs font-semibold transition-colors sm:w-auto ${
                  captchaGate.isVerified
                    ? "border border-emerald-200 bg-white text-emerald-700 hover:bg-emerald-50"
                    : "bg-sky-600 text-white hover:bg-sky-700"
                }`}
              >
                {captchaGate.isVerified
                  ? t("captcha.reverify")
                  : t("captcha.verifyNow")}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className={`w-full py-2 px-4 rounded-md font-medium text-white transition-colors duration-200 ${
              isLoading
                ? "bg-gray-400 cursor-not-allowed"
                : "bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            }`}
          >
            {isLoading ? t("login.submitting") : t("login.submit")}
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-gray-600 text-sm">
            {t("login.noAccount")}{" "}
            <Link to="/register" className="text-blue-600 hover:text-blue-800 font-medium">
              {t("login.registerNow")}
            </Link>
          </p>
        </div>

        <div className="mt-4 text-center">
          <p className="text-xs text-gray-500">{t("login.createdBy")}</p>
        </div>
      </div>

      <SliderCaptchaDialog
        open={captchaGate.isOpen}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            captchaGate.close();
          }
        }}
        onSuccess={handleCaptchaSuccess}
      />
    </div>
  );
}
