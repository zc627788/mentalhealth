import React, { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  useAdminChatMessagesQuery,
  useAdminChatSessionsQuery,
} from "@/hooks/useAdminQueries";
import VirtualList from "./VirtualList";

function useQueryParams() {
  const { search } = useLocation();
  return useMemo(() => new URLSearchParams(search), [search]);
}

function Empty({ text }: { text: string }) {
  return (
    <div className="h-full w-full flex items-center justify-center text-gray-500 text-sm">
      {text}
    </div>
  );
}

function Spinner({ text }: { text: string }) {
  return (
    <div className="h-full w-full flex items-center justify-center gap-3 text-gray-500 text-sm">
      <div className="h-5 w-5 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin" />
      <span>{text}</span>
    </div>
  );
}

export default function AdminChatViewer() {
  const { t } = useTranslation();
  const qs = useQueryParams();
  const userId = qs.get("userId") || "";
  const initAppointmentId = qs.get("appointmentId")
    ? Number(qs.get("appointmentId"))
    : undefined;
  const initAiModel = (qs.get("aiModel") as "doubao" | "peppy" | null) || undefined;

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [activeSessionId, setActiveSessionId] = useState("");

  const { data: sessionsData, isLoading: sessionsLoading } =
    useAdminChatSessionsQuery({
      userId,
      aiModel: initAiModel,
      appointmentId: initAppointmentId,
      page,
      pageSize,
    });
  const sessions = (sessionsData as any)?.sessions || (sessionsData as any)?.items || [];

  useEffect(() => {
    if (!activeSessionId && sessions.length > 0) {
      setActiveSessionId(sessions[0].id);
    }
  }, [activeSessionId, sessions]);

  const { data: messagesData, isLoading: messagesLoading } =
    useAdminChatMessagesQuery({
      sessionId: activeSessionId,
      page: 1,
      pageSize: 200,
    });
  const messages = (messagesData as any)?.messages || (messagesData as any)?.items || [];

  const getSessionTypeLabel = (session: any) => {
    if (session.ai_model) return `AI-${session.ai_model}`;
    return session.is_appointment
      ? t("adminChatViewer.appointmentHuman")
      : t("adminChatViewer.freeChat");
  };

  return (
    <div className="h-full flex bg-gradient-to-br from-slate-50 to-white">
      <div className="w-80 border-r flex flex-col bg-white/70 backdrop-blur">
        <div className="p-3 font-semibold border-b flex items-center justify-between">
          <span>{t("adminChatViewer.sessions")}</span>
          <span className="text-xs text-gray-500">
            {t("adminChatViewer.total", { count: sessions.length })}
          </span>
        </div>
        <div className="flex-1">
          {sessionsLoading ? (
            <Spinner text={t("adminChatViewer.loading")} />
          ) : sessions.length === 0 ? (
            <Empty text={t("adminChatViewer.noSessions")} />
          ) : (
            <VirtualList
              height={Math.min(600, Math.max(300, sessions.length * 64))}
              itemHeight={64}
              items={sessions}
              renderItem={(session: any) => (
                <button
                  key={session.id}
                  className={`w-full text-left px-3 py-2 border-t hover:bg-slate-50 transition ${
                    activeSessionId === session.id ? "bg-blue-50" : ""
                  }`}
                  onClick={() => setActiveSessionId(session.id)}
                >
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] bg-blue-100 text-blue-700">
                      {getSessionTypeLabel(session)}
                    </span>
                    <span className="text-xs text-gray-500">
                      {t("adminChatViewer.total", {
                        count: session.message_count ?? 0,
                      })}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500">
                    {session.last_message_at
                      ? new Date(session.last_message_at).toLocaleString()
                      : ""}
                  </div>
                </button>
              )}
            />
          )}
        </div>
        <div className="p-2 border-t flex items-center justify-between text-xs text-gray-600">
          <div>{t("adminChatViewer.total", { count: sessions.length })}</div>
          <div className="flex items-center gap-2">
            <button
              className="px-2 py-1 border rounded"
              disabled={page <= 1}
              onClick={() => setPage((value) => Math.max(1, value - 1))}
            >
              {t("adminChatViewer.prev")}
            </button>
            <span>{page}</span>
            <button className="px-2 py-1 border rounded" onClick={() => setPage((value) => value + 1)}>
              {t("adminChatViewer.next")}
            </button>
            <select
              className="px-2 py-1 border rounded"
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
            >
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col bg-white/60">
        <div className="p-3 border-b font-semibold flex items-center justify-between">
          <span>{t("adminChatViewer.messages")}</span>
          <span className="text-xs text-gray-500">
            {t("adminChatViewer.total", { count: messages.length })}
          </span>
        </div>
        <div className="flex-1 p-3">
          {!activeSessionId ? (
            <Empty text={t("adminChatViewer.selectSession")} />
          ) : messagesLoading ? (
            <Spinner text={t("adminChatViewer.loading")} />
          ) : messages.length === 0 ? (
            <Empty text={t("adminChatViewer.noMessages")} />
          ) : (
            <VirtualList
              height={Math.min(700, Math.max(300, messages.length * 96))}
              itemHeight={96}
              items={messages}
              renderItem={(message: any) => (
                <div
                  key={message.id}
                  className={`py-2 flex ${message.sender === "ai" ? "justify-start" : "justify-end"}`}
                >
                  <div
                    className={`flex items-start gap-2 max-w-[85%] ${
                      message.sender === "ai" ? "" : "flex-row-reverse"
                    }`}
                  >
                    <div
                      className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-semibold ${
                        message.sender === "ai"
                          ? "bg-blue-100 text-blue-700"
                          : "bg-emerald-100 text-emerald-700"
                      }`}
                    >
                      {message.sender === "ai" ? "AI" : "U"}
                    </div>
                    <div
                      className={`px-3 py-2 rounded-2xl text-sm whitespace-pre-wrap break-words shadow-sm border ${
                        message.sender === "ai"
                          ? "bg-white border-blue-100"
                          : "bg-blue-600 text-white border-blue-600"
                      }`}
                    >
                      <div
                        className={`text-[11px] mb-1 ${
                          message.sender === "ai" ? "text-blue-500" : "text-blue-100/90"
                        }`}
                      >
                        {new Date(message.created_at).toLocaleString()}
                      </div>
                      <div>{message.content}</div>
                    </div>
                  </div>
                </div>
              )}
            />
          )}
        </div>
      </div>
    </div>
  );
}
