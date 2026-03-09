import React, { createContext, useContext, useEffect, useState } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase, getAuthErrorMessage } from "../lib/supabase";

interface UserProfile {
  id: string;
  display_name?: string | null;
}

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
    // Load initial user with timeout protection
    const loadUser = async () => {
      try {
        // 设置超时保护
        const userPromise = supabase.auth.getUser();
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error("用户加载超时")), 8000)
        );

        const {
          data: { user },
          error,
        } = (await Promise.race([userPromise, timeoutPromise])) as any;

        if (error) {
          console.error("获取用户失败:", error);
        }

        setUser(user);
      } catch (error) {
        console.error("加载用户异常:", error);
        // 即使出错也要设置用户为 null，避免无限 loading
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    // 设置最大等待时间，防止无限 loading
    const timeoutId = setTimeout(() => {
      console.warn("用户加载超时，强制设置 loading = false");
      setLoading(false);
    }, 10000);

    loadUser();

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const u = session?.user || null;
      setUser(u);

      setLoading(false);
      // 清除超时定时器
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    });

    return () => {
      subscription.unsubscribe();
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
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
      return { error: getAuthErrorMessage(error.message || "登录失败") };
    }
  };

  const signInWithPassword = async (
    phoneNumber: string,
    password: string
  ): Promise<{ error: string | null }> => {
    try {
      // 使用手机号 + 密码登录
      // 由于用户是用 temp email 创建的，需要使用 email 登录
      const { error } = await supabase.auth.signInWithPassword({
        email: `${phoneNumber}@temp.local`,
        password,
      });
      if (error) {
        return { error: getAuthErrorMessage(error.message) };
      }
      return { error: null };
    } catch (error: any) {
      return { error: getAuthErrorMessage(error.message || "登录失败") };
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
          data: {
            name: name,
          },
          emailRedirectTo: `${window.location.protocol}//${window.location.host}/auth/callback`,
        },
      });
      if (error) {
        return { error: getAuthErrorMessage(error.message) };
      }
      return { error: null };
    } catch (error: any) {
      return { error: getAuthErrorMessage(error.message || "注册失败") };
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
      // 调用 Edge Function 完成手机号 + 密码 + 验证码注册
      // verify-sms 会验证验证码，如果成功会创建用户会话
      const { data, error } = await supabase.functions.invoke('verify-sms', {
        body: {
          phoneNumber,
          verificationCode,
          type: 'register',
          name,
          password, // 传递密码用于设置
          randomId // 传递随机 ID，在创建用户成功后标记为已使用
        }
      })

      if (error) {
        return { error: error.message }
      }

      if (data?.error) {
        return { error: data.error }
      }

      // 注册成功后，Edge Function 会返回 loginUrl，自动完成登录
      if (data?.loginUrl) {
        window.location.href = data.loginUrl
      }

      return { error: null }
    } catch (error: any) {
      return { error: getAuthErrorMessage(error.message || "注册失败") };
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const value = {
    user,
    loading,
    signIn,
    signInWithPassword,
    signUp,
    signUpWithPhone,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
