import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useSendSMSCode } from "@/hooks/useSms";
import { supabase } from "@/lib/supabase";
import SliderCaptchaDialog from "./SliderCaptchaDialog";
import { useCaptchaGate } from "@/hooks/useCaptchaGate";
import { useAuth } from "../contexts/AuthContext";

interface RegisterFormData {
  name: string;
  phoneNumber: string;
  password: string;
  confirmPassword: string;
  randomId: string;
}

interface RegisterFormErrors {
  name?: string;
  phoneNumber?: string;
  password?: string;
  confirmPassword?: string;
  randomId?: string;
  general?: string;
}

type RegisterAction = "sendCode" | "submit";

const CAPTCHA_TTL_MINUTES = 2;

export default function Register() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { signUpWithPhone } = useAuth();
  const sendSms = useSendSMSCode();

  const [formData, setFormData] = useState<RegisterFormData>({
    name: "",
    phoneNumber: "",
    password: "",
    confirmPassword: "",
    randomId: "",
  });
  const [errors, setErrors] = useState<RegisterFormErrors>({});
  const [isLoading, setIsLoading] = useState(false);
  const [verificationCode, setVerificationCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [canResend, setCanResend] = useState(true);
  const [smsTip, setSmsTip] = useState("");
  const [randomIdValidated, setRandomIdValidated] = useState(false);
  const [randomIdValidating, setRandomIdValidating] = useState(false);
  const captchaGate = useCaptchaGate<RegisterAction>(
    `${formData.phoneNumber.trim()}:${formData.randomId.trim().toUpperCase()}`,
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
    const nextErrors: RegisterFormErrors = {};

    if (!formData.name.trim()) {
      nextErrors.name = t("register.errors.nameRequired");
    } else if (formData.name.length < 2) {
      nextErrors.name = t("register.errors.nameShort");
    } else if (formData.name.length > 50) {
      nextErrors.name = t("register.errors.nameLong");
    }

    if (!formData.phoneNumber.trim()) {
      nextErrors.phoneNumber = t("register.errors.phoneRequired");
    } else if (!/^1[3-9]\d{9}$/.test(formData.phoneNumber)) {
      nextErrors.phoneNumber = t("register.errors.phoneInvalid");
    }

    if (!formData.randomId.trim()) {
      nextErrors.randomId = t("register.errors.randomIdRequired");
    } else if (!/^[A-Za-z0-9]{5}$/.test(formData.randomId)) {
      nextErrors.randomId = t("register.errors.randomIdInvalid");
    } else if (!randomIdValidated) {
      nextErrors.randomId = t("register.errors.randomIdValidateFirst");
    }

    if (!formData.password.trim()) {
      nextErrors.password = t("register.errors.passwordRequired");
    } else if (formData.password.length < 6) {
      nextErrors.password = t("register.errors.passwordShort");
    } else if (formData.password.length > 72) {
      nextErrors.password = t("register.errors.passwordLong");
    }

    if (!formData.confirmPassword.trim()) {
      nextErrors.confirmPassword = t("register.errors.confirmPasswordRequired");
    } else if (formData.password !== formData.confirmPassword) {
      nextErrors.confirmPassword = t("register.errors.passwordMismatch");
    }

    if (!verificationCode.trim()) {
      nextErrors.general = t("register.errors.codeRequired");
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleValidateRandomId = async () => {
    if (!formData.randomId.trim()) {
      setErrors({ randomId: t("register.errors.randomIdRequired") });
      return;
    }

    if (!/^[A-Za-z0-9]{5}$/.test(formData.randomId)) {
      setErrors({ randomId: t("register.errors.randomIdInvalid") });
      return;
    }

    setRandomIdValidating(true);
    setErrors((prev) => ({ ...prev, randomId: undefined }));

    try {
      const { data, error } = await supabase.functions.invoke("verify-random-id", {
        body: { code: formData.randomId.trim().toUpperCase() },
      });

      if (error) {
        throw error;
      }

      if (data?.success) {
        setRandomIdValidated(true);
        setSmsTip(t("register.randomIdSuccess"));
      } else {
        setRandomIdValidated(false);
        setErrors({
          randomId: data?.message || t("register.errors.randomIdUnavailable"),
        });
      }
    } catch (error) {
      setRandomIdValidated(false);
      setErrors({ randomId: t("register.errors.randomIdFailed") });
    } finally {
      setRandomIdValidating(false);
    }
  };

  const sendCodeRequest = async () => {
    if (!canResend) return;

    setErrors({});
    setIsLoading(true);
    try {
      const result = await sendSms.mutateAsync({
        phoneNumber: formData.phoneNumber,
        type: "register",
        cooldownSeconds: 60,
      });
      setCodeSent(true);
      setSmsTip((result as any)?.message || t("login.smsSent"));
      setCountdown(60);
    } catch (error: any) {
      setErrors({
        general: error?.message || t("login.errors.sendFailed"),
      });
      setSmsTip("");
    } finally {
      setIsLoading(false);
    }
  };

  const submitRequest = async () => {
    setIsLoading(true);
    try {
      const result = await signUpWithPhone(
        formData.phoneNumber,
        formData.password,
        verificationCode,
        formData.name,
        formData.randomId
      );

      if (result.error) {
        setErrors({ general: result.error });
        return;
      }

      navigate("/login", {
        state: {
          message: t("register.successMessage"),
        },
      });
    } catch (error: any) {
      setErrors({
        general: error?.message || t("register.errors.registerFailed"),
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendCode = async () => {
    setErrors({});

    if (!randomIdValidated) {
      setErrors({ randomId: t("register.errors.randomIdValidateFirst") });
      return;
    }

    if (!/^1[3-9]\d{9}$/.test(formData.phoneNumber)) {
      setErrors({ phoneNumber: t("register.errors.phoneInvalid") });
      return;
    }

    if (!formData.name.trim()) {
      setErrors({ name: t("register.errors.nameRequired") });
      return;
    }

    if (!captchaGate.requestVerification("sendCode")) {
      return;
    }

    await sendCodeRequest();
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

    if (errors[name as keyof RegisterFormErrors]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }));
    }

    if (name === "randomId") {
      setRandomIdValidated(false);
      setSmsTip("");
      captchaGate.resetVerification();
    }

    if (name === "phoneNumber") {
      captchaGate.resetVerification();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-100 via-white to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            {t("register.title")}
          </h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {errors.general && (
            <div className="bg-red-50 border border-red-200 rounded-md p-3">
              <p className="text-red-800 text-sm">{errors.general}</p>
            </div>
          )}

          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
              {t("register.name")}
            </label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.name ? "border-red-300 bg-red-50" : "border-gray-300"
              }`}
              placeholder={t("register.namePlaceholder")}
              maxLength={50}
              disabled={isLoading}
            />
            {errors.name && <p className="text-red-600 text-xs mt-1">{errors.name}</p>}
          </div>

          <div>
            <label htmlFor="randomId" className="block text-sm font-medium text-gray-700 mb-1">
              {t("register.randomId")}
              <span className="text-gray-500 text-xs ml-2">
                ({t("register.randomIdHint")})
              </span>
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                id="randomId"
                name="randomId"
                value={formData.randomId}
                onChange={handleChange}
                className={`flex-1 px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 uppercase tracking-widest ${
                  errors.randomId ? "border-red-300 bg-red-50" : "border-gray-300"
                } ${randomIdValidated ? "border-green-500 bg-green-50" : ""}`}
                placeholder={t("register.randomIdPlaceholder")}
                maxLength={5}
                autoComplete="off"
                disabled={isLoading || randomIdValidated}
              />
              <button
                type="button"
                onClick={handleValidateRandomId}
                disabled={
                  isLoading ||
                  randomIdValidating ||
                  randomIdValidated ||
                  !formData.randomId.trim()
                }
                className={`px-4 py-2 rounded-md text-sm whitespace-nowrap ${
                  isLoading ||
                  randomIdValidating ||
                  randomIdValidated ||
                  !formData.randomId.trim()
                    ? "bg-gray-200 text-gray-500"
                    : "bg-blue-50 text-blue-700 hover:bg-blue-100"
                }`}
              >
                {randomIdValidated
                  ? t("register.validated")
                  : randomIdValidating
                  ? t("register.validatingId")
                  : t("register.validateId")}
              </button>
            </div>
            {errors.randomId && (
              <p className="text-red-600 text-xs mt-1">{errors.randomId}</p>
            )}
            {randomIdValidated && (
              <p className="text-green-600 text-xs mt-1">{t("register.randomIdSuccess")}</p>
            )}
          </div>

          <div>
            <label htmlFor="phoneNumber" className="block text-sm font-medium text-gray-700 mb-1">
              {t("register.phoneNumber")}
            </label>
            <input
              type="tel"
              id="phoneNumber"
              name="phoneNumber"
              value={formData.phoneNumber}
              onChange={handleChange}
              className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.phoneNumber ? "border-red-300 bg-red-50" : "border-gray-300"
              }`}
              placeholder={t("register.phonePlaceholder")}
              maxLength={11}
              disabled={isLoading}
            />
            {errors.phoneNumber && (
              <p className="text-red-600 text-xs mt-1">{errors.phoneNumber}</p>
            )}
          </div>

          <div>
            <label htmlFor="verificationCode" className="block text-sm font-medium text-gray-700 mb-1">
              {t("register.code")}
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                id="verificationCode"
                value={verificationCode}
                onChange={(e) =>
                  setVerificationCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                }
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 tracking-widest"
                placeholder={t("register.codePlaceholder")}
                maxLength={6}
                disabled={isLoading}
              />
              <button
                type="button"
                onClick={handleSendCode}
                disabled={isLoading || !canResend || !randomIdValidated}
                className={`px-3 py-2 rounded-md text-sm whitespace-nowrap ${
                  isLoading || !canResend || !randomIdValidated
                    ? "bg-gray-200 text-gray-500"
                    : "bg-blue-50 text-blue-700 hover:bg-blue-100"
                }`}
              >
                {codeSent
                  ? countdown > 0
                    ? `${countdown}s`
                    : t("register.resendCode")
                  : t("register.getCode")}
              </button>
            </div>
            {smsTip && <p className="text-xs text-blue-600 mt-1">{smsTip}</p>}
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
              {t("register.password")}
              <span className="text-gray-500 text-xs font-normal ml-1">
                ({t("register.passwordHint")})
              </span>
            </label>
            <input
              type="password"
              id="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.password ? "border-red-300 bg-red-50" : "border-gray-300"
              }`}
              placeholder={t("register.passwordPlaceholder")}
              minLength={6}
              maxLength={72}
              disabled={isLoading}
            />
            {errors.password && (
              <p className="text-red-600 text-xs mt-1">{errors.password}</p>
            )}
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
              {t("register.confirmPassword")}
            </label>
            <input
              type="password"
              id="confirmPassword"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.confirmPassword ? "border-red-300 bg-red-50" : "border-gray-300"
              }`}
              placeholder={t("register.confirmPasswordPlaceholder")}
              minLength={6}
              maxLength={72}
              disabled={isLoading}
            />
            {errors.confirmPassword && (
              <p className="text-red-600 text-xs mt-1">{errors.confirmPassword}</p>
            )}
          </div>

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
                    : t("captcha.registerHint")}
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
            className={`w-full py-2 px-4 rounded-md font-medium text-white transition-colors ${
              isLoading
                ? "bg-gray-400 cursor-not-allowed"
                : "bg-blue-600 hover:bg-blue-700"
            }`}
          >
            {isLoading ? t("register.submitting") : t("register.submit")}
          </button>

          <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
            <p className="text-blue-800 text-xs">
              <strong>{t("register.helpTitle")}:</strong> {t("register.helpText")}
            </p>
          </div>
        </form>

        <div className="mt-6 text-center">
          <p className="text-gray-600 text-sm">
            {t("register.hasAccount")}{" "}
            <Link to="/login" className="text-blue-600 hover:text-blue-800 font-medium">
              {t("register.loginNow")}
            </Link>
          </p>
        </div>

        <div className="mt-4 text-center">
          <p className="text-xs text-gray-500">{t("register.createdBy")}</p>
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
