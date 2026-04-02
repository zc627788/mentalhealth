import React, { createContext, useContext, useEffect, useState } from "react";
import { User } from "@supabase/supabase-js";
import { supabase, getAuthErrorMessage } from "../lib/supabase";
import i18n from "../i18n";
import { parsePhoneInput } from "../lib/phone";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: (
    email: string,
    password: string
  ) => Promise<{ error: string | null }>;
  signInWithPassword: (
    phoneNumber: string,
    password: string
  ) => Promise<{ error: string | null }>;
  signUp: (
    email: string,
    password: string,
    name: string
  ) => Promise<{ error: string | null }>;
  signUpWithPhone: (
    phoneNumber: string,
    password: string,
    verificationCode: string,
    name: string,
    randomId?: string
  ) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadUser = async () => {
      try {
        const userPromise = supabase.auth.getUser();
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error("User loading timed out")), 8000)
        );

        const {
          data: { user: nextUser },
          error,
        } = (await Promise.race([userPromise, timeoutPromise])) as any;

        if (error) {
          console.error("Failed to load user:", error);
        }

        setUser(nextUser);
      } catch (error) {
        console.error("Unexpected user loading error:", error);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    const timeoutId = setTimeout(() => {
      console.warn("User loading timed out, forcing loading=false");
      setLoading(false);
    }, 10000);

    loadUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
      setLoading(false);
      clearTimeout(timeoutId);
    });

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeoutId);
    };
  }, []);

  const signIn = async (
    email: string,
    password: string
  ): Promise<{ error: string | null }> => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        return { error: getAuthErrorMessage(error.message) };
      }

      return { error: null };
    } catch (error: any) {
      return { error: getAuthErrorMessage(error.message || "Login failed") };
    }
  };

  const signInWithPassword = async (
    phoneNumber: string,
    password: string
  ): Promise<{ error: string | null }> => {
    try {
      const parsedPhone = parsePhoneInput(phoneNumber);
      if (!parsedPhone.isValid || !parsedPhone.authEmail) {
        return {
          error: i18n.t("login.errors.phoneInvalid"),
        };
      }

      const { error } = await supabase.auth.signInWithPassword({
        email: parsedPhone.authEmail,
        password,
      });

      if (error) {
        return { error: getAuthErrorMessage(error.message) };
      }

      return { error: null };
    } catch (error: any) {
      return { error: getAuthErrorMessage(error.message || "Login failed") };
    }
  };

  const signUp = async (
    email: string,
    password: string,
    name: string
  ): Promise<{ error: string | null }> => {
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { name },
          emailRedirectTo: `${window.location.protocol}//${window.location.host}/auth/callback`,
        },
      });

      if (error) {
        return { error: getAuthErrorMessage(error.message) };
      }

      return { error: null };
    } catch (error: any) {
      return { error: getAuthErrorMessage(error.message || "Registration failed") };
    }
  };

  const signUpWithPhone = async (
    phoneNumber: string,
    password: string,
    verificationCode: string,
    name: string,
    randomId?: string
  ): Promise<{ error: string | null }> => {
    try {
      const parsedPhone = parsePhoneInput(phoneNumber);
      if (!parsedPhone.isValid || !parsedPhone.normalizedPhone) {
        return {
          error: i18n.t("register.errors.phoneInvalid"),
        };
      }

      const { data, error } = await supabase.functions.invoke("verify-sms", {
        body: {
          phoneNumber: parsedPhone.normalizedPhone,
          verificationCode,
          type: "register",
          name,
          password,
          randomId,
        },
      });

      if (error) {
        return { error: error.message };
      }

      if (data?.error) {
        return { error: data.error };
      }

      if (data?.loginUrl) {
        window.location.href = data.loginUrl;
      }

      return { error: null };
    } catch (error: any) {
      return { error: getAuthErrorMessage(error.message || "Registration failed") };
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        signIn,
        signInWithPassword,
        signUp,
        signUpWithPhone,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
