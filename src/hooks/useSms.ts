import { useMutation } from "@tanstack/react-query";
import { sendSmsSpug, verifySmsSpug } from "@/lib/smsApi";

export interface SendSMSVars {
  phoneNumber: string;
  type?: 'login' | 'register';
  cooldownSeconds?: number;
}

export interface VerifySMSVars {
  phoneNumber: string;
  code: string;
  type: "login" | "register";
  name?: string;
}

export interface VerifySMSResult {
  success?: boolean;
  message?: string;
  error?: string;
  loginUrl?: string;
}

export function useSendSMSCode() {
  return useMutation({
    mutationFn: async ({ phoneNumber, type, cooldownSeconds = 60 }: SendSMSVars) => {
      return sendSmsSpug({ phoneNumber, type, cooldownSeconds });
    },
    retry: false,
  });
}

export function useVerifySMSCode() {
  return useMutation<VerifySMSResult, Error, VerifySMSVars>({
    mutationFn: async ({ phoneNumber, code, type, name }: VerifySMSVars) => {
      const redirectTo = `${window.location.origin}/auth/callback`;
      return verifySmsSpug({ phoneNumber, verificationCode: code, type, name, redirectTo });
    },
    retry: false,
  });
}
