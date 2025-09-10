import React, { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";

export default function Dashboard() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [aiServicesAvailable, setAiServicesAvailable] = useState(true);

  useEffect(() => {
    const checkAiServicesSetting = async () => {
      try {
        const { data } = await supabase
          .from("system_settings")
          .select("setting_value")
          .eq("setting_key", "ai_appointment_required")
          .maybeSingle();

        // 如果AI服务需要预约，则禁用直接访问
        if (data?.setting_value === "true") {
          setAiServicesAvailable(false);
        }
      } catch (error) {
        console.error("获取AI服务设置失败:", error);
      }
    };

    checkAiServicesSetting();
  }, []);

  const handleSignOut = async () => {
    setIsLoading(true);
    try {
      await signOut();
      navigate("/login");
    } catch (error) {
      console.error("Sign out error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <h1 className="text-xl font-semibold text-gray-900">
              心理咨询服务平台
            </h1>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-700">
                欢迎，{user?.user_metadata?.name || user?.email}
              </span>
              <button
                onClick={handleSignOut}
                disabled={isLoading}
                className="text-sm text-gray-500 hover:text-gray-700 disabled:opacity-50"
              >
                {isLoading ? "退出中..." : "退出"}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        {/* AI Services Section */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">
            AI心理陪伴服务
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* 智心助手(豆包) */}
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
                    智心助手(豆包)
                  </h3>
                  <p className="text-sm text-blue-600">AI心理陪伴</p>
                </div>
              </div>
              <p className="text-gray-600 text-sm mb-4">
                基于豆包大模型的温暖治愈对话服务，24/7在线陪伴，提供专业的心理支持和建议。
              </p>
              <div className="text-xs text-blue-600 mb-3">
                ✨ 豆包大模型 | 温暖陪伴
              </div>
              <button
                onClick={() =>
                  navigate("/chat-doubao", {
                    state: { forceNonAppointment: true },
                  })
                }
                disabled={!aiServicesAvailable}
                className={`w-full py-2 px-4 rounded-md transition-colors ${
                  aiServicesAvailable
                    ? "bg-blue-600 text-white hover:bg-blue-700"
                    : "bg-gray-400 text-white cursor-not-allowed"
                }`}
              >
                {aiServicesAvailable ? "开始对话" : "需要预约"}
              </button>
            </div>

            {/* Peppy助手 */}
            <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-center mb-4">
                <div className="bg-purple-100 p-3 rounded-full">
                  <svg
                    className="h-6 w-6 text-purple-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                    />
                  </svg>
                </div>
                <div className="ml-4">
                  <h3 className="text-lg font-medium text-gray-900">
                    Peppy助手
                  </h3>
                  <p className="text-sm text-purple-600">AI心理陪伴</p>
                </div>
              </div>
              <p className="text-gray-600 text-sm mb-4">
                活泼开朗的AI伙伴，用轻松愉快的方式陪伴你，提供积极正面的心理支持。
              </p>
              <div className="text-xs text-purple-600 mb-3">
                ✨ Peppy AI | 积极陪伴
              </div>
              <button
                onClick={() =>
                  navigate("/chat-peppy", {
                    state: { forceNonAppointment: true },
                  })
                }
                disabled={!aiServicesAvailable}
                className={`w-full py-2 px-4 rounded-md transition-colors ${
                  aiServicesAvailable
                    ? "bg-purple-600 text-white hover:bg-purple-700"
                    : "bg-gray-400 text-white cursor-not-allowed"
                }`}
              >
                {aiServicesAvailable ? "开始对话" : "需要预约"}
              </button>
            </div>
          </div>
        </div>

        {/* Professional Services Section */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">
            专业咨询服务
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* 专业咨询师 */}
            <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-center mb-4">
                <div className="bg-green-100 p-3 rounded-full">
                  <svg
                    className="h-6 w-6 text-green-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                    />
                  </svg>
                </div>
                <div className="ml-4">
                  <h3 className="text-lg font-medium text-gray-900">
                    专业咨询师
                  </h3>
                  <p className="text-sm text-green-600">一对一专业咨询</p>
                </div>
              </div>
              <p className="text-gray-600 text-sm mb-4">
                与我们认证的专业心理咨询师一对一交流，获得个性化的心理支持和专业指导。
              </p>
              <div className="text-xs text-green-600 mb-3">
                ✨ 认证咨询师 | 专业服务
              </div>
              <button
                onClick={() => navigate("/appointment")}
                className="w-full bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 transition-colors"
              >
                预约咨询师
              </button>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">快速访问</h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <button
              onClick={() => navigate("/chat-doubao")}
              disabled={!aiServicesAvailable}
              className={`flex flex-col items-center p-4 text-center rounded-lg transition-colors ${
                aiServicesAvailable
                  ? "hover:bg-gray-50"
                  : "opacity-50 cursor-not-allowed"
              }`}
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
              <span className="text-sm text-gray-700">智心助手</span>
            </button>

            <button
              onClick={() => navigate("/chat-peppy")}
              disabled={!aiServicesAvailable}
              className={`flex flex-col items-center p-4 text-center rounded-lg transition-colors ${
                aiServicesAvailable
                  ? "hover:bg-gray-50"
                  : "opacity-50 cursor-not-allowed"
              }`}
            >
              <svg
                className="h-8 w-8 text-purple-600 mb-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                />
              </svg>
              <span className="text-sm text-gray-700">Peppy助手</span>
            </button>

            <button
              onClick={() => navigate("/appointment")}
              className="flex flex-col items-center p-4 text-center hover:bg-gray-50 rounded-lg transition-colors"
            >
              <svg
                className="h-8 w-8 text-green-600 mb-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M8 7V3a2 2 0 012-2h4a2 2 0 012 2v4m-4 8l-4-4m0 0l4-4m-4 4h12"
                />
              </svg>
              <span className="text-sm text-gray-700">预约咨询师</span>
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
              <span className="text-sm text-gray-700">我的预约</span>
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
              <span className="text-sm text-gray-700">管理后台</span>
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center text-xs text-gray-500">
          Created by MiniMax Agent
        </div>
      </main>
    </div>
  );
}
