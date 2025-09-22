import { useMutation } from "@tanstack/react-query";
import { sendSmsSpug, verifySmsSpug } from "@/lib/smsApi";

export interface SendSMSVars {
  phoneNumber: string;
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
    mutationFn: async ({ phoneNumber, cooldownSeconds = 60 }: SendSMSVars) => {
      return sendSmsSpug({ phoneNumber, cooldownSeconds });
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
