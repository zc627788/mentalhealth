import React, { useState, useRef, useEffect, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../contexts/AuthContext";
import { supabase, supabaseUrl, supabaseAnonKey } from "../lib/supabase";
import {
  ChatStorageService,
  ChatMessage,
  ChatSession,
} from "../lib/chatStorage";
import ChatHistorySidebar from "./ChatHistorySidebar";
import { callDoubaoStreamDirectly } from "@/lib/callDoubaoStreamDirectly";

interface Message {
  id: string;
  content: string;
  role: "user" | "assistant";
  timestamp: Date;
}

export default function ChatDoubao() {
  const { t } = useTranslation();
  const { user, signOut } = useAuth();
  const location = useLocation();
  const { appointment: appointmentFromHistory, forceNonAppointment } =
    location.state || {};

  const navigate = useNavigate();

  // 默认欢迎消息
  const defaultMessage: Message = {
    id: "1",
    content: t("chat.doubaoWelcome"),
    role: "assistant",
    timestamp: new Date(),
  };

  // 初始化聊天存储服务
  const chatStorage = useMemo(
    () => (user ? new ChatStorageService(user.id) : null),
    [user]
  );
  const aiModel = "doubao";

  const [messages, setMessages] = useState<Message[]>([defaultMessage]);
  const [inputMessage, setInputMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [conversationHistory, setConversationHistory] = useState<
    Array<{ role: string; content: string }>
  >([]);
  const [isAppointmentMode, setIsAppointmentMode] = useState(false); // 是否为预约模式
  const [isAppointmentActive, setIsAppointmentActive] = useState(false); // 预约是否有效
  const [currentSessionId, setCurrentSessionId] = useState<number | null>(null);
  const [currentAppointmentId, setCurrentAppointmentId] = useState<
    number | null
  >(null);

  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // 检查当前预约状态
  // 请替换为这个版本
  const checkAppointmentStatus = async () => {
    if (!user) {
      return { isMode: false, isActive: false, id: null };
    }

    try {
      const { data: appointments } = await supabase
        .from("appointments")
        .select("id, appointment_date, start_time, end_time")
        .eq("user_id", user.id)
        .eq("appointment_type", "ai")
        .eq("ai_model", "doubao")
        .eq("status", "confirmed")
        .order("appointment_date", { ascending: false })
        .order("start_time", { ascending: false })
        .limit(1);

      if (appointments && appointments.length > 0) {
        const appointment = appointments[0];
        const now = new Date();
        const startTime = new Date(
          `${appointment.appointment_date}T${appointment.start_time}`
        );
        const endTime = new Date(
          `${appointment.appointment_date}T${appointment.end_time}`
        );
        const appointmentIsActive = now >= startTime && now <= endTime;

        return {
          isMode: true,
          isActive: appointmentIsActive,
          id: appointment.id,
        };
      } else {
        return { isMode: false, isActive: false, id: null };
      }
    } catch (error) {
      console.error("检查预约状态失败:", error);
      return { isMode: false, isActive: false, id: null };
    }
  };
  // 处理返回逻辑
  const handleGoBack = async () => {
    try {
      const { data: aiAppointmentRequired } = await supabase
        .from("system_settings")
        .select("setting_value")
        .eq("setting_key", "ai_appointment_required")
        .maybeSingle();

      if (aiAppointmentRequired?.setting_value === "true") {
        navigate("/appointment");
      } else {
        navigate("/dashboard");
      }
    } catch (error) {
      console.error("检查跳转路径失败:", error);
      navigate("/appointment"); // 默认跳转到预约页面
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // 初始化聊天记录
  const initStartedRef = useRef(false);

  useEffect(() => {
    const initializeChat = async () => {
      if (!chatStorage || initStartedRef.current) {
        return;
      }
      // 立即、同步地设置标志位，防止后续的重复执行
      initStartedRef.current = true;

      setIsLoadingHistory(true);

      try {
        let sessionToLoad: number | null = null;
        let appointmentInfo: {
          isMode: boolean;
          isActive: boolean;
          id: number | null;
        };

        if (appointmentFromHistory) {
          const now = new Date();
          const endTime = new Date(
            `${appointmentFromHistory.appointment_date}T${appointmentFromHistory.end_time}`
          );
          appointmentInfo = {
            isMode: true,
            isActive: now <= endTime,
            id: appointmentFromHistory.id,
          };
          sessionToLoad = await chatStorage.getOrCreateAppointmentSession(
            aiModel,
            appointmentFromHistory.id
          );
        } else if (forceNonAppointment) {
          appointmentInfo = { isMode: false, isActive: false, id: null };
          sessionToLoad = await chatStorage.getCurrentSession(aiModel, false);
        } else {
          appointmentInfo = await checkAppointmentStatus();

          if (appointmentInfo.isMode && appointmentInfo.id) {
            sessionToLoad = await chatStorage.getOrCreateAppointmentSession(
              aiModel,
              appointmentInfo.id
            );
          } else {
            sessionToLoad = await chatStorage.getCurrentSession(aiModel, false);
          }
        }

        let messagesToLoad: ChatMessage[] = [];
        if (sessionToLoad) {
          messagesToLoad = await chatStorage.getSessionMessages(sessionToLoad);
        }

        setCurrentSessionId(sessionToLoad);
        setIsAppointmentMode(appointmentInfo.isMode);
        setIsAppointmentActive(appointmentInfo.isActive);
        setCurrentAppointmentId(appointmentInfo.id);

        if (messagesToLoad.length > 0) {
          const formattedMessages: Message[] = [
            defaultMessage,
            ...messagesToLoad.map((msg) => ({
              id: String(msg.id),
              content: msg.content,
              role: msg.role as "user" | "assistant",
              timestamp: new Date(msg.timestamp),
            })),
          ];
          setMessages(formattedMessages);
          setConversationHistory(
            messagesToLoad.map((msg) => ({
              role: msg.role,
              content: msg.content,
            }))
          );
        } else {
          setMessages([defaultMessage]);
          setConversationHistory([]);
        }
      } catch (error) {
        console.error("初始化聊天失败:", error);
      } finally {
        setIsLoadingHistory(false);
        setIsInitialized(true);
      }
    };

    initializeChat();
  }, [chatStorage, appointmentFromHistory, forceNonAppointment]);

  // 定期检查预约状态（每分钟检查一次）
  useEffect(() => {
    if (!user || !isAppointmentMode) return; // 只在预约模式下检查

    const interval = setInterval(async () => {
      const newStatus = await checkAppointmentStatus();
      // 只有当状态真正改变时才更新
      if (newStatus.isActive !== isAppointmentActive) {
        setIsAppointmentActive(newStatus.isActive);
      }
    }, 60000);

    return () => clearInterval(interval);
  }, [user, isAppointmentMode, isAppointmentActive]);

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isLoading || !isInitialized) {
      return;
    }

    // 预约模式下检查预约是否有效
    if (isAppointmentMode && !isAppointmentActive) {
      const expiredMessage: Message = {
        id: Date.now().toString(),
        content: t("chat.expiredReply"),
        role: "assistant",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, expiredMessage]);
      return;
    }

    const userMessage = inputMessage.trim();
    setInputMessage("");
    setIsLoading(true);

    // 添加用户消息
    const newUserMessage: Message = {
      id: Date.now().toString(),
      content: userMessage,
      role: "user",
      timestamp: new Date(),
    };

    // 为AI响应创建一个占位符，这是实现流式更新的基础
    const aiPlaceholderMessage: Message = {
      id: (Date.now() + 1).toString(),
      content: "",
      role: "assistant",
      timestamp: new Date(),
    };

    setMessages((prevMessages) => [
      ...prevMessages,
      newUserMessage,
      aiPlaceholderMessage,
    ]);

    // 保存到数据库和本地存储
    if (chatStorage) {
      try {
        await chatStorage.saveMessage(
          newUserMessage,
          aiModel,
          isAppointmentMode,
          currentAppointmentId || undefined
        );
      } catch (error) {
        console.error("保存用户消息到数据库失败:", error);
      }
    }

    // 更新对话历史
    const newHistory = [
      ...conversationHistory,
      { role: "user", content: userMessage },
    ];
    setConversationHistory(newHistory);

    try {
      // 使用流式输出调用智心助手
      let fullResponse = "";
      let isFirstChunk = true;
      setIsTyping(true);
      await callDoubaoStreamDirectly(
        userMessage,
        conversationHistory,
        (chunk: string) => {
          if (isFirstChunk) {
            setIsLoading(false); // 收到第一个数据块，表示连接成功，关闭全局加载

            isFirstChunk = false;
          }

          fullResponse += chunk;

          setMessages((prevMessages) => {
            // 复制一份最新的消息数组
            const updatedMessages = [...prevMessages];
            const lastMessageIndex = updatedMessages.length - 1;

            // 安全地更新最后一条消息（即我们的AI占位符）的内容
            if (
              lastMessageIndex >= 0 &&
              updatedMessages[lastMessageIndex].role === "assistant"
            ) {
              updatedMessages[lastMessageIndex].content = fullResponse;
            }
            return updatedMessages; // 返回更新后的数组
          });
        }
      );

      // 流式输出完成后，保存完整消息
      const finalAIMessage = { ...aiPlaceholderMessage, content: fullResponse };
      if (chatStorage) {
        await chatStorage.saveMessage(
          finalAIMessage,
          aiModel,
          isAppointmentMode,
          currentAppointmentId || undefined
        );
      }
      setConversationHistory([
        ...newHistory,
        { role: "assistant", content: fullResponse },
      ]);
    } catch (error) {
      console.error("发送消息错误:", error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: t("chat.genericError"),
        role: "assistant",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev.slice(0, -1), errorMessage]);
    } finally {
      setIsTyping(false);
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const clearChat = async () => {
    if (!chatStorage) return;

    try {
      // 清空当前会话的消息（保留会话）
      await chatStorage.clearCurrentSessionMessages(
        aiModel,
        isAppointmentMode,
        currentAppointmentId || undefined
      );

      const resetMessages = [defaultMessage];
      setMessages(resetMessages);
      setConversationHistory([]);
    } catch (error) {
      console.error("清空对话失败:", error);
    }
  };

  // 处理会话选择
  const handleSessionSelect = async (sessionId: number) => {
    if (!chatStorage) return;

    try {
      // 切换会话
      await chatStorage.switchSession(sessionId);
      setCurrentSessionId(sessionId);

      // 获取会话信息，检查是否属于预约
      const { data: sessionData } = await supabase
        .from("chat_sessions")
        .select("appointment_id, is_appointment")
        .eq("id", sessionId)
        .single();

      if (sessionData?.is_appointment && sessionData?.appointment_id) {
        const { data: appointment } = await supabase
          .from("appointments")
          .select("appointment_date, start_time, end_time")
          .eq("id", sessionData.appointment_id)
          .single();

        if (appointment) {
          const now = new Date();
          const startTime = new Date(
            `${appointment.appointment_date}T${appointment.start_time}`
          );
          const endTime = new Date(
            `${appointment.appointment_date}T${appointment.end_time}`
          );

          // 检查预约是否过期
          const isExpired = now > endTime;
          if (isExpired) {
            // 预约已过期，禁用输入
            setIsAppointmentActive(false);
          } else {
            // 预约未过期，启用输入
            setIsAppointmentActive(true);
          }
        }
      } else {
        setIsAppointmentActive(true);
      }

      // 加载会话消息
      const sessionMessages = await chatStorage.getSessionMessages(sessionId);

      if (sessionMessages.length > 0) {
        const formattedMessages: Message[] = [
          defaultMessage,
          ...sessionMessages.map((msg) => ({
            id: msg.id,
            content: msg.content,
            role: msg.role,
            timestamp: msg.timestamp,
          })),
        ];
        setMessages(formattedMessages);

        // 重建对话历史
        const history = sessionMessages.map((msg) => ({
          role: msg.role,
          content: msg.content,
        }));
        setConversationHistory(history);
      } else {
        // 如果会话没有消息，显示默认欢迎消息
        setMessages([defaultMessage]);
        setConversationHistory([]);
      }
    } catch (error) {
      console.error("切换会话失败:", error);
    }
  };

  // 处理新建会话
  const handleNewSession = async () => {
    if (!chatStorage) return;

    try {
      const newSessionId = await chatStorage.createNewSession(
        aiModel,
        false,
        undefined
      );

      setCurrentSessionId(newSessionId);

      setIsAppointmentMode(false);
      setIsAppointmentActive(false);
      setCurrentAppointmentId(null);

      const resetMessages = [defaultMessage];
      setMessages(resetMessages);
      setConversationHistory([]);
    } catch (error) {
      console.error("创建新会话失败:", error);
    }
  };

  // 处理删除会话
  const handleDeleteSession = (sessionId: number) => {
    if (currentSessionId === sessionId) {
      // 如果删除的是当前会话，重置为默认状态
      setMessages([defaultMessage]);
      setConversationHistory([]);
      setCurrentSessionId(null);
    }
  };

  return (
    <div className="h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex overflow-hidden">
      {/* 侧边栏 */}
      {sidebarOpen && (
        <div className="h-full">
          <ChatHistorySidebar
            aiModel={aiModel}
            isAppointment={isAppointmentMode}
            currentSessionId={currentSessionId}
            onSessionSelect={handleSessionSelect}
            onNewSession={handleNewSession}
            onDeleteSession={handleDeleteSession}
            onGoBack={handleGoBack}
            chatStorage={chatStorage}
          />
        </div>
      )}

      {/* 主聊天区域 */}
      <div className="flex-1 flex flex-col h-full">
        {/* Header - 固定头部 */}
        <header className="bg-white shadow-sm border-b flex-shrink-0">
          <div className="px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => setSidebarOpen(!sidebarOpen)}
                  className="text-gray-500 hover:text-gray-700"
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
                      d="M4 6h16M4 12h16M4 18h16"
                    />
                  </svg>
                </button>
                <div className="flex items-center space-x-3">
                  <div className="bg-blue-100 p-2 rounded-full">
                    <svg
                      className="h-5 w-5 text-blue-600"
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
                  <div>
                    <h1 className="text-xl font-semibold text-gray-900">
                      {t("dashboard.doubaoTitle")}
                    </h1>
                    <p className="text-sm text-blue-600">{t("dashboard.doubaoSubtitle")}</p>
                  </div>
                </div>
                {!forceNonAppointment && (
                  <span
                    className={`px-2 py-1 text-xs rounded-full ${
                      isAppointmentActive
                        ? "bg-green-100 text-green-800"
                        : "bg-orange-100 text-orange-800"
                    }`}
                  >
                    {isAppointmentActive
                      ? t("chat.appointmentActive")
                      : t("chat.appointmentEnded")}
                  </span>
                )}
              </div>
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => setShowClearConfirm(true)}
                  className="text-sm text-gray-500 hover:text-gray-700"
                >{t("chat.clearCurrent")}</button>
                <span className="text-sm text-gray-700">
                  {user.email.includes("temp.local")
                    ? user.email.replace("@temp.local", "")
                    : user?.email}
                </span>
                <button
                  onClick={handleSignOut}
                  className="text-sm text-gray-500 hover:text-gray-700"
                >{t("common.logout")}</button>
              </div>
            </div>
          </div>
        </header>

        {/* Chat Messages */}
        <div className="flex-1 px-4 sm:px-6 lg:px-8 py-6 overflow-y-auto scrollbar-thin scrollbar-thumb-blue-300 scrollbar-track-blue-100 hover:scrollbar-thumb-blue-400">
          <div className="space-y-4">
            {/* Loading History Indicator */}
            {isLoadingHistory && (
              <div className="flex justify-center">
                <div className="bg-white text-gray-900 shadow-sm border border-blue-100 px-4 py-3 rounded-2xl">
                  <div className="flex items-center space-x-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                    <span className="text-sm text-gray-500">{t("chat.typingDoubao")}</span>
                  </div>
                </div>
              </div>
            )}

            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${
                  message.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`max-w-xs md:max-w-md lg:max-w-lg xl:max-w-xl px-4 py-3 rounded-2xl ${
                    message.role === "user"
                      ? "bg-blue-600 text-white"
                      : "bg-white text-gray-900 shadow-sm border border-blue-100"
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap leading-relaxed">
                    {message.content}
                  </p>
                  <p
                    className={`text-xs mt-2 ${
                      message.role === "user"
                        ? "text-blue-100"
                        : "text-gray-500"
                    }`}
                  >
                    {message.timestamp.toLocaleTimeString()}
                  </p>
                </div>
              </div>
            ))}

            {/* Typing Indicator */}
            {isTyping && (
              <div className="flex justify-start">
                <div className="bg-white text-gray-900 shadow-sm border border-blue-100 px-4 py-3 rounded-2xl max-w-xs">
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-gray-500">
                      智心助手正在回复
                    </span>
                    <div className="flex space-x-1">
                      <div
                        className="w-1 h-1 bg-blue-400 rounded-full animate-bounce"
                        style={{ animationDelay: "0ms" }}
                      ></div>
                      <div
                        className="w-1 h-1 bg-blue-400 rounded-full animate-bounce"
                        style={{ animationDelay: "150ms" }}
                      ></div>
                      <div
                        className="w-1 h-1 bg-blue-400 rounded-full animate-bounce"
                        style={{ animationDelay: "300ms" }}
                      ></div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input Area */}
        <div className="border-t flex-shrink-0">
          <div className="px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex space-x-4">
              <div className="flex-1">
                <textarea
                  ref={inputRef}
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder={
                    isAppointmentMode && !isAppointmentActive
                      ? t("chat.inputDisabled")
                      : t("chat.inputPlaceholder")
                  }
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                  rows={3}
                  maxLength={1000}
                  disabled={
                    isLoading || (isAppointmentMode && !isAppointmentActive)
                  }
                />
                <div className="flex justify-between items-center mt-2">
                  <span className="text-xs text-gray-500">
                    {inputMessage.length}/1000
                  </span>
                  <div className="text-xs text-blue-600">{t("dashboard.doubaoFeature")}</div>
                </div>
              </div>
              <button
                onClick={handleSendMessage}
                disabled={
                  isLoading ||
                  !inputMessage.trim() ||
                  (isAppointmentMode && !isAppointmentActive)
                }
                className={`px-6 py-3 rounded-xl font-medium text-white transition-colors self-start ${
                  isLoading ||
                  !inputMessage.trim() ||
                  (isAppointmentMode && !isAppointmentActive)
                    ? "bg-gray-400 cursor-not-allowed"
                    : "bg-blue-600 hover:bg-blue-700"
                }`}
              >
                {isLoading ? (
                  <svg
                    className="animate-spin h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                ) : (
                  t("common.send")
                )}
              </button>
            </div>
          </div>
        </div>

        {/* 清空对话确认弹窗 */}
        {showClearConfirm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">{t("chat.clearTitle")}</h3>
              <p className="text-gray-600 mb-6">{t("chat.clearBody")}</p>
              <div className="flex space-x-4 justify-end">
                <button
                  onClick={() => setShowClearConfirm(false)}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
                >{t("common.cancel")}</button>
                <button
                  onClick={() => {
                    clearChat();
                    setShowClearConfirm(false);
                  }}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                >{t("chat.clearConfirm")}</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
