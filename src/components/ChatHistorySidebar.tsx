import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ChatSession, ChatStorageService } from "../lib/chatStorage";
import { supabase } from "@/lib/supabase";

interface ChatHistorySidebarProps {
  aiModel: string;
  isAppointment: boolean;
  currentSessionId: number | null;
  refreshToken?: number;
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
  refreshToken = 0,
  onSessionSelect,
  onNewSession,
  onDeleteSession,
  onGoBack,
  chatStorage,
}: ChatHistorySidebarProps) {
  const { t } = useTranslation();
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [appointmentInfo, setAppointmentInfo] = useState<Record<number, any>>({});

  const loadSessions = async () => {
    if (!chatStorage) return;
    setIsLoading(true);

    try {
      const userSessions = await chatStorage.getUserSessions(aiModel, isAppointment);
      setSessions(userSessions);

      if (!isAppointment) return;

      const appointmentIds = userSessions
        .filter((session) => session.appointment_id)
        .map((session) => session.appointment_id);

      if (!appointmentIds.length) return;

      const { data: appointments } = await supabase
        .from("appointments")
        .select("id, start_time, end_time, appointment_date, topic")
        .in("id", appointmentIds);

      const map: Record<number, any> = {};
      appointments?.forEach((item) => {
        map[item.id] = item;
      });
      setAppointmentInfo(map);
    } catch (error) {
      console.error("Failed to load sessions:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSessions();
  }, [chatStorage, aiModel, isAppointment, refreshToken]);

  const handleNewSession = async () => {
    if (!chatStorage) return;

    try {
      const canCreate = await chatStorage.checkSessionLimit(aiModel, isAppointment);
      if (!canCreate) {
        alert(t("sidebar.sessionLimit"));
        return;
      }

      await onNewSession();
      await loadSessions();
    } catch (error) {
      console.error("Failed to create session:", error);
      alert(t("sidebar.createFailed"));
    }
  };

  const handleDeleteSession = async (sessionId: number) => {
    if (!chatStorage) return;
    if (!window.confirm(t("sidebar.deleteConfirm"))) return;

    try {
      await chatStorage.deleteSession(sessionId);
      await loadSessions();
      onDeleteSession(sessionId);
    } catch (error) {
      console.error("Failed to delete session:", error);
      alert(t("sidebar.deleteFailed"));
    }
  };

  const truncateSessionName = (name: string, maxLength = 28) =>
    name.length > maxLength ? `${name.slice(0, maxLength)}...` : name;

  return (
    <div className="w-[22rem] min-w-[22rem] bg-white border-r border-gray-200 flex flex-col h-full">
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <button
              onClick={onGoBack}
              className="text-gray-500 hover:text-gray-700 p-1 rounded-lg hover:bg-gray-100 transition-colors"
              title={t("sidebar.back")}
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M15 19l-7-7 7-7"
                />
              </svg>
            </button>
            <h2 className="text-lg font-semibold text-gray-900">
              {isAppointment ? t("sidebar.appointmentChats") : t("sidebar.freeChats")}
            </h2>
          </div>
          {!isAppointment && (
            <button
              onClick={handleNewSession}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              title={t("sidebar.newChat")}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M12 4v16m8-8H4"
                />
              </svg>
            </button>
          )}
        </div>
        <div className="text-sm text-gray-500">
          {t("sidebar.sessionsCount", { count: sessions.length })}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100 hover:scrollbar-thumb-gray-400">
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
          </div>
        ) : sessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-gray-500">
            <p className="text-sm">{t("sidebar.noSessions")}</p>
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
                    <h3 className="text-sm font-medium text-gray-900 truncate">
                      {truncateSessionName(
                        appointmentInfo?.[session.appointment_id]?.topic || session.session_name
                      )}
                    </h3>
                    <div className="flex items-center mt-1 text-xs text-gray-500">
                      {isAppointment && session.appointment_id && appointmentInfo[session.appointment_id] ? (
                        <>
                          <span>{t("sidebar.appointmentTime")}</span>
                          <span className="mx-1">|</span>
                          {appointmentInfo[session.appointment_id].start_time} -{" "}
                          {appointmentInfo[session.appointment_id].end_time}
                        </>
                      ) : (
                        <>
                          <span>{t("sidebar.createdAt")}</span>
                          <span className="mx-1">|</span>
                          {session.created_at}
                        </>
                      )}
                    </div>
                  </div>
                  {!isAppointment && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteSession(session.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500 transition-all"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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

      <div className="p-4 border-t border-gray-200 text-xs text-gray-500">
        <div className="flex items-center justify-between">
          <span>
            {aiModel === "doubao"
              ? t("sidebar.assistantDoubao")
              : t("sidebar.assistantPeppy")}
          </span>
          <span>{isAppointment ? t("sidebar.appointmentMode") : t("sidebar.freeMode")}</span>
        </div>
      </div>
    </div>
  );
}
