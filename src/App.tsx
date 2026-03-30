import React, { useEffect, useState } from "react";
import {
  BrowserRouter as Router,
  Navigate,
  Route,
  Routes,
  useNavigate,
} from "react-router-dom";
import { useTranslation } from "react-i18next";
import LanguageSwitcher from "./components/LanguageSwitcher";
import AdminChatViewer from "./components/AdminChatViewer";
import AdminDashboard from "./components/AdminDashboard";
import AdminLogin from "./components/AdminLogin";
import AdminPeople from "./components/AdminPeople";
import Appointment from "./components/Appointment";
import AuthCallback from "./components/AuthCallback";
import ChatDoubao from "./components/ChatDoubao";
import ChatPeppy from "./components/ChatPeppy";
import Dashboard from "./components/Dashboard";
import Login from "./components/Login";
import MyAppointments from "./components/MyAppointments";
import Register from "./components/Register";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { QueryProvider } from "./lib/queryClient";
import { supabase } from "./lib/supabase";
import "./App.css";

async function resolveRedirectPath() {
  const { data } = await supabase
    .from("system_settings")
    .select("setting_value")
    .eq("setting_key", "ai_appointment_required")
    .maybeSingle();

  return data?.setting_value === "true" ? "/appointment" : "/dashboard";
}

function LoadingScreen() {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <div className="text-gray-600">{t("common.loading")}</div>
      </div>
    </div>
  );
}

function RootRedirect() {
  const { user, loading } = useAuth();
  const [redirectPath, setRedirectPath] = useState<string | null>(null);

  useEffect(() => {
    let disposed = false;

    const run = async () => {
      if (loading) return;
      if (!user) {
        setRedirectPath("/login");
        return;
      }

      try {
        const path = await resolveRedirectPath();
        if (!disposed) setRedirectPath(path);
      } catch (error) {
        console.error("Failed to resolve root redirect:", error);
        if (!disposed) setRedirectPath("/appointment");
      }
    };

    run();

    return () => {
      disposed = true;
    };
  }, [user?.id, loading]);

  if (loading || redirectPath === null) return <LoadingScreen />;
  return <Navigate to={redirectPath} replace />;
}

function ProtectedRoute({
  children,
  path,
}: {
  children: React.ReactNode;
  path?: string;
}) {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [checking, setChecking] = useState(false);
  const [allowed, setAllowed] = useState(true);

  useEffect(() => {
    let disposed = false;

    const checkRouteAccess = async () => {
      if (!user || !path) return;
      if (!["/chat-doubao", "/chat-peppy", "/dashboard"].includes(path)) return;

      setChecking(true);
      try {
        const { data: aiAppointmentRequired } = await supabase
          .from("system_settings")
          .select("setting_value")
          .eq("setting_key", "ai_appointment_required")
          .maybeSingle();

        if (aiAppointmentRequired?.setting_value !== "true") {
          if (!disposed) setAllowed(true);
          return;
        }

        const { data: userAppointments } = await supabase
          .from("appointments")
          .select(
            "appointment_type, ai_model, appointment_date, start_time, status"
          )
          .eq("user_id", user.id)
          .eq("status", "confirmed");

        const hasValidAiAppointment = userAppointments?.some((apt) => {
          if (apt.appointment_type !== "ai") return false;

          const appointmentDateTime = new Date(
            `${apt.appointment_date}T${apt.start_time}`
          );
          if (appointmentDateTime > new Date()) return false;

          return (
            (path === "/chat-doubao" && apt.ai_model === "doubao") ||
            (path === "/chat-peppy" && apt.ai_model === "peppy")
          );
        });

        if (!disposed) setAllowed(Boolean(hasValidAiAppointment) || path === "/dashboard");
      } catch (error) {
        console.error("Failed to verify route access:", error);
      } finally {
        if (!disposed) setChecking(false);
      }
    };

    checkRouteAccess();

    return () => {
      disposed = true;
    };
  }, [user?.id, path]);

  useEffect(() => {
    if (!checking && user && !allowed && path !== "/dashboard") {
      navigate("/appointment", { replace: true });
    }
  }, [allowed, checking, navigate, path, user]);

  if (loading || checking) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" replace />;
  if (!allowed && path !== "/dashboard") return null;
  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const [redirectPath, setRedirectPath] = useState<string | null>(null);

  useEffect(() => {
    let disposed = false;

    const run = async () => {
      if (!user) return;
      try {
        const path = await resolveRedirectPath();
        if (!disposed) setRedirectPath(path);
      } catch (error) {
        console.error("Failed to redirect authenticated public route:", error);
        if (!disposed) setRedirectPath("/appointment");
      }
    };

    run();

    return () => {
      disposed = true;
    };
  }, [user?.id]);

  if (loading || (user && redirectPath === null)) return <LoadingScreen />;
  if (user && redirectPath) return <Navigate to={redirectPath} replace />;
  return <>{children}</>;
}

function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative">
      <div className="fixed right-4 top-4 z-[80]">
        <LanguageSwitcher />
      </div>
      {children}
    </div>
  );
}

function AppRoutes() {
  return (
    <Router>
      <Routes>
        <Route
          path="/login"
          element={
            <AppShell>
              <PublicRoute>
                <Login />
              </PublicRoute>
            </AppShell>
          }
        />
        <Route
          path="/register"
          element={
            <AppShell>
              <PublicRoute>
                <Register />
              </PublicRoute>
            </AppShell>
          }
        />
        <Route path="/auth/callback" element={<AppShell><AuthCallback /></AppShell>} />
        <Route path="/" element={<AppShell><RootRedirect /></AppShell>} />
        <Route
          path="/dashboard"
          element={
            <AppShell>
              <ProtectedRoute path="/dashboard">
                <Dashboard />
              </ProtectedRoute>
            </AppShell>
          }
        />
        <Route
          path="/chat-doubao"
          element={
            <AppShell>
              <ProtectedRoute path="/chat-doubao">
                <ChatDoubao />
              </ProtectedRoute>
            </AppShell>
          }
        />
        <Route
          path="/chat-peppy"
          element={
            <AppShell>
              <ProtectedRoute path="/chat-peppy">
                <ChatPeppy />
              </ProtectedRoute>
            </AppShell>
          }
        />
        <Route
          path="/appointment"
          element={
            <AppShell>
              <ProtectedRoute>
                <Appointment />
              </ProtectedRoute>
            </AppShell>
          }
        />
        <Route
          path="/my-appointments"
          element={
            <AppShell>
              <ProtectedRoute>
                <MyAppointments />
              </ProtectedRoute>
            </AppShell>
          }
        />
        <Route path="/admin" element={<AppShell><AdminLogin /></AppShell>} />
        <Route
          path="/admin/dashboard"
          element={<AppShell><AdminDashboard /></AppShell>}
        />
        <Route path="/admin/people" element={<AppShell><AdminPeople /></AppShell>} />
        <Route
          path="/admin/chat-viewer"
          element={<AppShell><AdminChatViewer /></AppShell>}
        />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </Router>
  );
}

function App() {
  return (
    <QueryProvider>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </QueryProvider>
  );
}

export default App;
