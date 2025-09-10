import React, { useState, useEffect } from "react";
import { ChatStorageService, ChatSession } from "../lib/chatStorage";
import { useLocation } from "react-router-dom";
import { supabase } from "@/lib/supabase";

interface ChatHistorySidebarProps {
  aiModel: string;
  isAppointment: boolean;
  currentSessionId: number | null;
  onSessionSelect: (sessionId: number) => void;
  onNewSession: () => void;
  onDeleteSession: (sessionId: number) => void;
  onGoBack: () => void;
  chatStorage: ChatStorageService | null;
}

export default function ChatHistorySidebar({
  aiModel,
  isAppointment,
  currentSessionId,
  onSessionSelect,
  onNewSession,
  onDeleteSession,
  onGoBack,
  chatStorage,
}: ChatHistorySidebarProps) {
  const location = useLocation();
  const appointmentFromHistory = location.state?.appointment;
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showNewSessionTooltip, setShowNewSessionTooltip] = useState(false);

  const [appointmentInfo, setAppointmentInfo] = useState<{
    [key: number]: any;
  }>({});

  // 加载会话列表
  const loadSessions = async () => {
    if (!chatStorage) return;

    setIsLoading(true);
    try {
      const userSessions = await chatStorage.getUserSessions(
        aiModel,
        isAppointment
      );
      setSessions(userSessions);

      if (isAppointment) {
        const appointmentIds = userSessions
          .filter((session) => session.appointment_id)
          .map((session) => session.appointment_id);

        if (appointmentIds.length > 0) {
          const { data: appointments } = await supabase
            .from("appointments")
            .select("id, start_time, end_time, appointment_date, topic")
            .in("id", appointmentIds);

          if (appointments) {
            const appointmentMap = {};
            appointments.forEach((apt) => {
              appointmentMap[apt.id] = apt;
            });
            setAppointmentInfo(appointmentMap);
          }
        }
      }
    } catch (error) {
      console.error("加载会话列表失败:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSessions();
  }, [chatStorage, aiModel, isAppointment]);

  // 处理新建会话
  const handleNewSession = async () => {
    if (!chatStorage) return;

    try {
      // 检查会话数量限制
      const canCreate = await chatStorage.checkSessionLimit(
        aiModel,
        isAppointment
      );
      if (!canCreate) {
        alert("历史对话话题超过30条需要先删除其他的，再新建");
        return;
      }

      await onNewSession();
      // 重新加载会话列表
      await loadSessions();
    } catch (error) {
      console.error("创建新会话失败:", error);
      alert("创建新会话失败，请重试");
    }
  };

  // 处理删除会话
  const handleDeleteSession = async (sessionId: number) => {
    if (!chatStorage) return;

    if (window.confirm("确定要删除这个对话记录吗？删除后无法恢复。")) {
      try {
        await chatStorage.deleteSession(sessionId);
        await loadSessions();
        onDeleteSession(sessionId);
      } catch (error) {
        console.error("删除会话失败:", error);
        alert("删除会话失败，请重试");
      }
    }
  };

  // 截断会话名称
  const truncateSessionName = (name: string, maxLength: number = 20) => {
    return name.length > maxLength
      ? name.substring(0, maxLength) + "..."
      : name;
  };

  return (
    <div className="w-80 bg-white border-r border-gray-200 flex flex-col h-full">
      {/* 头部 */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <button
              onClick={onGoBack}
              className="text-gray-500 hover:text-gray-700 p-1 rounded-lg hover:bg-gray-100 transition-colors"
              title="返回"
            >
              <svg
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M15 19l-7-7 7-7"
                />
              </svg>
            </button>
            <h2 className="text-lg font-semibold text-gray-900">
              {isAppointment ? "预约对话" : "非预约对话"}
            </h2>
          </div>
          {/* 只有非预约模式才显示新建按钮 */}
          {!isAppointment && (
            <div className="relative">
              <button
                onClick={handleNewSession}
                onMouseEnter={() => setShowNewSessionTooltip(true)}
                onMouseLeave={() => setShowNewSessionTooltip(false)}
                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                title="新建对话"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M12 4v16m8-8H4"
                  />
                </svg>
              </button>
              {showNewSessionTooltip && (
                <div className="absolute right-0 top-full mt-1 px-2 py-1 bg-gray-800 text-white text-xs rounded shadow-lg z-10">
                  新建对话
                </div>
              )}
            </div>
          )}
        </div>
        <div className="text-sm text-gray-500">{sessions.length}/30 个对话</div>
      </div>

      {/* 会话列表 */}
      <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100 hover:scrollbar-thumb-gray-400">
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
          </div>
        ) : sessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-gray-500">
            <svg
              className="w-8 h-8 mb-2"
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
            <p className="text-sm">暂无对话记录</p>
          </div>
        ) : (
          <div className="p-2">
            {sessions.map((session) => (
              <div
                key={session.id}
                className={`group relative p-3 mb-2 rounded-lg cursor-pointer transition-colors ${
                  currentSessionId === session.id
                    ? "bg-blue-50 border border-blue-200"
                    : "hover:bg-gray-50 border border-transparent"
                }`}
                onClick={() => onSessionSelect(session.id)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <h3
                      className="text-sm font-medium text-gray-900 truncate"
                      title={
                        appointmentInfo?.[session.appointment_id]?.topic ||
                        session.session_name
                      }
                    >
                      {truncateSessionName(
                        appointmentInfo?.[session.appointment_id]?.topic ||
                          session.session_name
                      )}
                    </h3>
                    <div className="flex items-center mt-1 text-xs text-gray-500">
                      {isAppointment &&
                        session.appointment_id &&
                        appointmentInfo[session.appointment_id] && (
                          <>
                            <span>预约时间</span>
                            <span className="mx-1">•</span>
                            {
                              appointmentInfo[session.appointment_id].start_time
                            }{" "}
                            - {appointmentInfo[session.appointment_id].end_time}
                          </>
                        )}
                      {!isAppointment && (
                        <>
                          <span>创建时间</span>
                          <span className="mx-1">•</span>
                          {session.created_at}
                        </>
                      )}
                    </div>
                  </div>
                  {/* 只有非预约模式才显示删除按钮 */}
                  {!isAppointment && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteSession(session.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500 transition-all"
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
                      </svg>
                    </button>
                  )}
                </div>
                {currentSessionId === session.id && (
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500 rounded-r"></div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 底部信息 */}
      <div className="p-4 border-t border-gray-200 text-xs text-gray-500">
        <div className="flex items-center justify-between">
          <span>{aiModel === "doubao" ? "智心助手" : "Peppy助手"}</span>
          <span>{isAppointment ? "预约模式" : "非预约模式"}</span>
        </div>
      </div>
    </div>
  );
}
