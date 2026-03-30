import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";

export default function Dashboard() {
  const { t } = useTranslation();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [showAppointmentModal, setShowAppointmentModal] = useState(false);
  const [selectedAiService, setSelectedAiService] = useState("");

  const displayName =
    user?.email?.includes("temp.local")
      ? user.email.replace("@temp.local", "")
      : user?.email || "";

  const handleSignOut = async () => {
    setIsLoading(true);
    try {
      await signOut();
      navigate("/login");
    } finally {
      setIsLoading(false);
    }
  };

  const checkAiServicesSetting = async () => {
    try {
      const { data } = await supabase
        .from("system_settings")
        .select("setting_value")
        .eq("setting_key", "ai_appointment_required")
        .maybeSingle();

      return data?.setting_value === "true";
    } catch (error) {
      console.error("Failed to fetch AI settings:", error);
      return false;
    }
  };

  const handleAiServiceClick = async (serviceName: string, servicePath: string) => {
    const needsAppointment = await checkAiServicesSetting();

    if (needsAppointment) {
      setSelectedAiService(serviceName);
      setShowAppointmentModal(true);
      return;
    }

    navigate(servicePath, { state: { forceNonAppointment: true } });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <h1 className="text-xl font-semibold text-gray-900">
              {t("dashboard.title")}
            </h1>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-700">
                {t("dashboard.welcome", { email: displayName })}
              </span>
              <button
                onClick={handleSignOut}
                disabled={isLoading}
                className="text-sm text-gray-500 hover:text-gray-700 disabled:opacity-50"
              >
                {isLoading ? t("common.loggingOut") : t("common.logout")}
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">
            {t("dashboard.aiSection")}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-center mb-4">
                <div className="bg-blue-100 p-3 rounded-full">
                  <svg
                    className="h-6 w-6 text-blue-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                    />
                  </svg>
                </div>
                <div className="ml-4">
                  <h3 className="text-lg font-medium text-gray-900">
                    {t("dashboard.doubaoTitle")}
                  </h3>
                  <p className="text-sm text-blue-600">
                    {t("dashboard.doubaoSubtitle")}
                  </p>
                </div>
              </div>
              <p className="text-gray-600 text-sm mb-4">
                {t("dashboard.doubaoDescription")}
              </p>
              <div className="text-xs text-blue-600 mb-3">
                {t("dashboard.doubaoFeature")}
              </div>
              <button
                onClick={() =>
                  handleAiServiceClick(t("dashboard.doubaoTitle"), "/chat-doubao")
                }
                className="w-full py-2 px-4 rounded-md transition-colors bg-blue-600 text-white hover:bg-blue-700"
              >
                {t("dashboard.startChat")}
              </button>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">
            {t("dashboard.quickAccess")}
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <button
              onClick={() =>
                handleAiServiceClick(t("dashboard.doubaoTitle"), "/chat-doubao")
              }
              className="flex flex-col items-center p-4 text-center rounded-lg transition-colors hover:bg-gray-50"
            >
              <svg
                className="h-8 w-8 text-blue-600 mb-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-4l-4 4z"
                />
              </svg>
              <span className="text-sm text-gray-700">{t("dashboard.doubaoTitle")}</span>
            </button>

            <button
              onClick={() => navigate("/my-appointments")}
              className="flex flex-col items-center p-4 text-center hover:bg-gray-50 rounded-lg transition-colors"
            >
              <svg
                className="h-8 w-8 text-orange-600 mb-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
              <span className="text-sm text-gray-700">
                {t("dashboard.myAppointments")}
              </span>
            </button>

            <button
              onClick={() => navigate("/admin")}
              className="flex flex-col items-center p-4 text-center hover:bg-gray-50 rounded-lg transition-colors"
            >
              <svg
                className="h-8 w-8 text-gray-600 mb-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
              <span className="text-sm text-gray-700">{t("dashboard.admin")}</span>
            </button>
          </div>
        </div>

        <div className="mt-8 text-center text-xs text-gray-500">
          {t("dashboard.footer")}
        </div>
      </main>

      {showAppointmentModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center mb-4">
              <div className="bg-orange-100 p-2 rounded-full mr-3">
                <svg
                  className="h-6 w-6 text-orange-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900">
                {t("route.appointmentRequiredTitle")}
              </h3>
            </div>
            <p className="text-gray-600 mb-6">
              <span className="font-medium text-orange-600">
                {selectedAiService}
              </span>{" "}
              {t("route.appointmentRequiredBody")}
            </p>
            <div className="flex space-x-4 justify-end">
              <button
                onClick={() => setShowAppointmentModal(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
              >
                {t("common.cancel")}
              </button>
              <button
                onClick={() => navigate("/appointment")}
                className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
              >
                {t("route.goToAppointment")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
