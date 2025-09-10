import React, { useEffect, useState } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useNavigate,
} from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";

import Login from "./components/Login";
import Register from "./components/Register";
import Dashboard from "./components/Dashboard";
import ChatDoubao from "./components/ChatDoubao";
import ChatPeppy from "./components/ChatPeppy";
import Appointment from "./components/Appointment";
import MyAppointments from "./components/MyAppointments";
import AuthCallback from "./components/AuthCallback";
import AdminLogin from "./components/AdminLogin";
import AdminDashboard from "./components/AdminDashboard";
import "./App.css";
import { supabase } from "./lib/supabase";

// Root Redirect Component
function RootRedirect() {
  const { user, loading } = useAuth();
  const [redirectPath, setRedirectPath] = useState<string | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [debugInfo, setDebugInfo] = useState<string>('');

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    
    const checkRedirectPath = async () => {
      setDebugInfo(`用户状态: ${user ? '已登录' : '未登录'}, 加载中: ${loading}`);
      
      if (user && !loading) {
        setIsChecking(true);
        setDebugInfo('开始查询系统设置...');
        try {
          // 设置超时保护
          const settingsPromise = supabase
            .from("system_settings")
            .select("setting_value")
            .eq("setting_key", "ai_appointment_required")
            .maybeSingle();
          
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('数据库查询超时')), 5000)
          );
          
          const { data: aiAppointmentRequired, error } = await Promise.race([settingsPromise, timeoutPromise]) as any;

          if (error) {
            console.error("查询系统设置失败:", error);
            setDebugInfo(`查询失败: ${error.message}`);
          } else {
            setDebugInfo(`查询成功: ${aiAppointmentRequired?.setting_value || 'null'}`);
          }

          // 根据设置决定跳转路径
          if (aiAppointmentRequired?.setting_value === "true") {
            setRedirectPath("/appointment");
          } else {
            setRedirectPath("/dashboard");
          }
        } catch (error: any) {
          console.error("检查跳转路径失败:", error);
          setDebugInfo(`异常: ${error.message}`);
          // 出错时默认跳转到预约页面
          setRedirectPath("/appointment");
        } finally {
          setIsChecking(false);
        }
      } else if (!loading && !user) {
        // 用户未登录，直接跳转到登录页
        setRedirectPath("/login");
      }
    };

    // 设置最大等待时间
    timeoutId = setTimeout(() => {
      console.warn('RootRedirect 超时，默认跳转到预约页面');
      setDebugInfo('超时，使用默认跳转');
      setRedirectPath("/appointment");
      setIsChecking(false);
    }, 15000);

    checkRedirectPath();

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [user, loading]);

  // 显示加载状态直到确定跳转路径
  if (loading || isChecking || redirectPath === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <div className="text-gray-600 mb-2">正在加载...</div>
          {debugInfo && (
            <div className="text-sm text-gray-500">{debugInfo}</div>
          )}
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // 直接跳转到确定的路径
  return <Navigate to={redirectPath} replace />;
}

// Enhanced Protected Route Component
function ProtectedRoute({
  children,
  path,
}: {
  children: React.ReactNode;
  path?: string;
}) {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [shouldRedirect, setShouldRedirect] = useState(false);
  const [isChecking, setIsChecking] = useState(false);

  useEffect(() => {
    const checkRouteAccess = async () => {
      // 对需要检查的路径进行检查
      if (["/chat-doubao", "/chat-peppy", "/dashboard"].includes(path || "")) {
        setIsChecking(true);

        try {
          // 检查AI服务预约设置
          const { data: aiAppointmentRequired } = await supabase
            .from("system_settings")
            .select("setting_value")
            .eq("setting_key", "ai_appointment_required")
            .maybeSingle();

          // 如果AI服务需要预约，检查用户是否有有效的AI预约
          if (aiAppointmentRequired?.setting_value === "true") {
            // 检查用户是否有有效的AI预约
            const { data: userAppointments } = await supabase
              .from("appointments")
              .select(
                "appointment_type, ai_model, appointment_date, start_time, status"
              )
              .eq("user_id", user.id)
              .eq("status", "confirmed");
            // .gte("appointment_date", new Date().toISOString().split("T")[0]);

            // 检查是否有匹配的AI预约
            const hasValidAiAppointment = userAppointments?.some((apt) => {
              if (apt.appointment_type !== "ai") return false;

              // 检查时间是否匹配
              const appointmentDateTime = new Date(
                `${apt.appointment_date}T${apt.start_time}`
              );
              const now = new Date();

              // 预约时间还没到，不能进入
              if (appointmentDateTime > now) return false;

              // 检查AI模型是否匹配
              if (path === "/chat-doubao" && apt.ai_model === "doubao")
                return true;
              if (path === "/chat-peppy" && apt.ai_model === "peppy")
                return true;

              return false;
            });

            if (!hasValidAiAppointment) {
              setShouldRedirect(true);
              return;
            }
          }
        } catch (error) {
          console.error("检查路由访问权限失败:", error);
          // 出错时默认允许访问
        } finally {
          setIsChecking(false);
        }
      }
    };

    if (user) {
      checkRouteAccess();
    }
  }, [user, path]);

  useEffect(() => {
    if (shouldRedirect) {
      navigate("/appointment", { replace: true });
    }
  }, [shouldRedirect, navigate]);

  if (loading || isChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

// Public Route Component (redirect if already logged in)
function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const [redirectPath, setRedirectPath] = useState<string | null>(null);
  const [isChecking, setIsChecking] = useState(false);

  useEffect(() => {
    const checkRedirectPath = async () => {
      if (user) {
        setIsChecking(true);
        try {
          // 检查AI服务预约设置
          const { data: aiAppointmentRequired } = await supabase
            .from("system_settings")
            .select("setting_value")
            .eq("setting_key", "ai_appointment_required")
            .maybeSingle();

          // 根据设置决定跳转路径
          if (aiAppointmentRequired?.setting_value === "true") {
            setRedirectPath("/appointment");
          } else {
            setRedirectPath("/dashboard");
          }
        } catch (error) {
          console.error("检查跳转路径失败:", error);
          setRedirectPath("/appointment");
        } finally {
          setIsChecking(false);
        }
      }
    };

    checkRedirectPath();
  }, [user]);

  // 显示加载状态直到确定跳转路径
  if (loading || isChecking || (user && redirectPath === null)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (user && redirectPath) {
    return <Navigate to={redirectPath} replace />;
  }

  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Router>
      <Routes>
        {/* Public Routes */}
        <Route
          path="/login"
          element={
            <PublicRoute>
              <Login />
            </PublicRoute>
          }
        />
        <Route
          path="/register"
          element={
            <PublicRoute>
              <Register />
            </PublicRoute>
          }
        />
        <Route path="/auth/callback" element={<AuthCallback />} />

        {/* Root Route - redirect based on AI appointment setting */}
        <Route path="/" element={<RootRedirect />} />

        {/* Protected Routes */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute path="/dashboard">
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/chat-doubao"
          element={
            <ProtectedRoute path="/chat-doubao">
              <ChatDoubao />
            </ProtectedRoute>
          }
        />
        <Route
          path="/chat-peppy"
          element={
            <ProtectedRoute path="/chat-peppy">
              <ChatPeppy />
            </ProtectedRoute>
          }
        />
        <Route
          path="/appointment"
          element={
            <ProtectedRoute>
              <Appointment />
            </ProtectedRoute>
          }
        />
        <Route
          path="/my-appointments"
          element={
            <ProtectedRoute>
              <MyAppointments />
            </ProtectedRoute>
          }
        />

        {/* Admin Routes (Public - no auth required) */}
        <Route path="/admin" element={<AdminLogin />} />
        <Route path="/admin/dashboard" element={<AdminDashboard />} />

        {/* Catch all - redirect to login */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </Router>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}

export default App;
