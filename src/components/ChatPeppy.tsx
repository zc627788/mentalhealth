import React, { useState, useRef, useEffect, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { supabase, supabaseUrl, supabaseAnonKey } from "../lib/supabase";
import {
  ChatStorageService,
  LocalStorageHelper,
  ChatMessage,
  ChatSession,
} from "../lib/chatStorage";
import ChatHistorySidebar from "./ChatHistorySidebar";

interface Message {
  id: string;
  content: string;
  role: "user" | "assistant";
  timestamp: Date;
}

export default function ChatPeppy() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { appointment: appointmentFromHistory, forceNonAppointment } =
    location.state || {};

  // 默认欢迎消息
  const defaultMessage: Message = {
    id: "1",
    content:
      "嗨！我是Peppy助手！😊 我是一个活泼开朗的AI伙伴，专门为你提供积极正面的心理支持！无论你今天心情如何，我都会用最阳光的方式陪伴你～ 有什么开心的事想分享，或者需要我帮你调整心情的吗？",
    role: "assistant",
    timestamp: new Date(),
  };

  // 初始化聊天存储服务
  const chatStorage = useMemo(
    () => (user ? new ChatStorageService(user.id) : null),
    [user]
  );

  const aiModel = "peppy";

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
  // 请替换为这个版本
  const initStartedRef = useRef(false);

  useEffect(() => {
    const initializeChat = async () => {
      // 核心改动：检查 ref 标志位，如果已经开始初始化，则直接返回
      if (!chatStorage || initStartedRef.current) {
        return;
      }
      // 立即、同步地设置标志位，防止后续的重复执行
      initStartedRef.current = true;

      setIsLoadingHistory(true);

      try {
        // 步骤 1: 确定要加载的会话ID (sessionToLoad) 和当前的预约状态 (appointmentInfo)
        let sessionToLoad: number | null = null;
        let appointmentInfo: {
          isMode: boolean;
          isActive: boolean;
          id: number | null;
        };

        if (appointmentFromHistory) {
          // 分支 A: 从预约历史记录跳转而来
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
            // 对于非预约模式，获取最新的会话
            sessionToLoad = await chatStorage.getCurrentSession(aiModel, false);
          }
        }

        // 步骤 2: 根据确定的 sessionToLoad 加载消息
        let messagesToLoad: ChatMessage[] = [];
        if (sessionToLoad) {
          messagesToLoad = await chatStorage.getSessionMessages(sessionToLoad);
        }

        // 步骤 3: 所有数据获取完毕，在最后统一更新所有 React State
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
    const interval = setInterval(() => {
      checkAppointmentStatus();
    }, 60000); // 60秒检查一次

    return () => clearInterval(interval);
  }, [user]);

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  const callPeppyStream = async (
    userMessage: string,
    onChunk: (chunk: string) => void
  ): Promise<void> => {
    try {

      // 先尝试流式输出
      const response = await fetch(
        `${supabaseUrl}/functions/v1/peppy-chat-stream`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${supabaseAnonKey}`,
            Accept: "text/event-stream",
          },
          body: JSON.stringify({
            message: userMessage,
            conversationHistory: conversationHistory,
          }),
        }
      );


      if (!response.ok) {
        console.error("响应错误:", response.status, response.statusText);
        throw new Error("AI服务暂时不可用");
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("无法读取响应流");
      }

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") {
              return;
            }
            try {
              const parsed = JSON.parse(data);
              if (parsed.content) {
                onChunk(parsed.content);
              }
            } catch (e) {
              // 忽略解析错误，继续处理下一行
            }
          }
        }
      }
    } catch (error) {
      console.error("AI聊天错误:", error);
      onChunk(
        "哎呀！我刚刚有点小故障呢～😅 不过没关系，我还在这里陪着你！你可以再试一次，或者换个话题聊聊～ 我永远是你的阳光小助手！✨"
      );
    }
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isLoading || !isInitialized) {
      return;
    }

    // 预约模式下检查预约是否有效
    if (isAppointmentMode && !isAppointmentActive) {
      const expiredMessage: Message = {
        id: Date.now().toString(),
        content:
          "抱歉，您的预约时间已结束。您可以查看我们的对话历史，或者重新预约时间继续咨询。",
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

    const updatedMessages = [...messages, newUserMessage];
    setMessages(updatedMessages);

    // 保存到数据库和本地存储
    if (chatStorage) {
      try {
        await chatStorage.saveMessage(
          newUserMessage,
          aiModel,
          isAppointmentActive,
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

    // 创建AI消息占位符
    const newAIMessage: Message = {
      id: (Date.now() + 1).toString(),
      content: "",
      role: "assistant",
      timestamp: new Date(),
    };

    const messagesWithAI = [...updatedMessages, newAIMessage];
    setMessages(messagesWithAI);

    // 显示打字效果
    setIsTyping(true);

    try {
      // 使用流式输出调用Peppy助手
      let fullResponse = "";
      await callPeppyStream(userMessage, (chunk: string) => {
        fullResponse += chunk;
        // 更新AI消息内容
        const updatedAIMessage = { ...newAIMessage, content: fullResponse };
        const currentMessages = [...updatedMessages, updatedAIMessage];
        setMessages(currentMessages);
      });

      // 流式输出完成后，保存完整消息
      const finalAIMessage = { ...newAIMessage, content: fullResponse };
      const finalMessages = [...updatedMessages, finalAIMessage];

      // 保存到数据库和本地存储
      if (chatStorage) {
        try {
          await chatStorage.saveMessage(
            finalAIMessage,
            aiModel,
            isAppointmentActive,
            currentAppointmentId || undefined
          );
        } catch (error) {
          console.error("保存AI消息到数据库失败:", error);
        }
      }

      // 更新对话历史
      const finalHistory = [
        ...newHistory,
        { role: "assistant", content: fullResponse },
      ];
      setConversationHistory(finalHistory);
    } catch (error) {
      console.error("发送消息错误:", error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        content:
          "哎呀！我刚刚有点小故障呢～😅 不过没关系，我还在这里陪着你！你可以再试一次，或者换个话题聊聊～ 我永远是你的阳光小助手！✨",
        role: "assistant",
        timestamp: new Date(),
      };
      const errorMessages = [...updatedMessages, errorMessage];
      setMessages(errorMessages);
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
        isAppointmentActive,
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
      // 创建新会话
      const newSessionId = await chatStorage.createNewSession(
        aiModel,
        isAppointmentActive,
        currentAppointmentId || undefined
      );
      setCurrentSessionId(newSessionId);

      // 重置消息
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
    <div className="h-screen bg-gradient-to-br from-purple-50 to-pink-100 flex overflow-hidden">
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
                  <div className="bg-purple-100 p-2 rounded-full">
                    <svg
                      className="h-5 w-5 text-purple-600"
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
                  <div>
                    <h1 className="text-xl font-semibold text-gray-900">
                      Peppy助手
                    </h1>
                    <p className="text-sm text-purple-600">AI心理陪伴</p>
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
                    {isAppointmentActive ? "预约进行中" : "预约已结束"}
                  </span>
                )}
              </div>
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => setShowClearConfirm(true)}
                  className="text-sm text-gray-500 hover:text-gray-700"
                >
                  清空当前对话
                </button>
                <span className="text-sm text-gray-700">
                  {user?.user_metadata?.name || user?.email}
                </span>
                <button
                  onClick={handleSignOut}
                  className="text-sm text-gray-500 hover:text-gray-700"
                >
                  退出
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* Chat Messages */}
        <div className="flex-1 px-4 sm:px-6 lg:px-8 py-6 overflow-y-auto scrollbar-thin scrollbar-thumb-purple-300 scrollbar-track-purple-100 hover:scrollbar-thumb-purple-400">
          <div className="space-y-4">
            {/* Loading History Indicator */}
            {isLoadingHistory && (
              <div className="flex justify-center">
                <div className="bg-white text-gray-900 shadow-sm border border-purple-100 px-4 py-3 rounded-2xl">
                  <div className="flex items-center space-x-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-600"></div>
                    <span className="text-sm text-gray-500">
                      正在加载聊天记录...
                    </span>
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
                      ? "bg-purple-600 text-white"
                      : "bg-white text-gray-900 shadow-sm border border-purple-100"
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap leading-relaxed">
                    {message.content}
                  </p>
                  <p
                    className={`text-xs mt-2 ${
                      message.role === "user"
                        ? "text-purple-100"
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
                <div className="bg-white text-gray-900 shadow-sm border border-purple-100 px-4 py-3 rounded-2xl max-w-xs">
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-gray-500">Peppy正在回复</span>
                    <div className="flex space-x-1">
                      <div
                        className="w-1 h-1 bg-purple-400 rounded-full animate-bounce"
                        style={{ animationDelay: "0ms" }}
                      ></div>
                      <div
                        className="w-1 h-1 bg-purple-400 rounded-full animate-bounce"
                        style={{ animationDelay: "150ms" }}
                      ></div>
                      <div
                        className="w-1 h-1 bg-purple-400 rounded-full animate-bounce"
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
                      ? "预约时间已结束，无法发送消息"
                      : "输入您的消息...按Enter发送，Shift+Enter换行 😊"
                  }
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 resize-none"
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
                  <div className="text-xs text-purple-600">
                    Peppy AI | 积极陪伴 ✨
                  </div>
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
                    : "bg-purple-600 hover:bg-purple-700"
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
                  "发送 ✨"
                )}
              </button>
            </div>
          </div>
        </div>

        {/* 清空对话确认弹窗 */}
        {showClearConfirm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                确认清空对话
              </h3>
              <p className="text-gray-600 mb-6">
                确定要清空当前对话吗？历史记录不会删除，只是清空当前聊天内容。
              </p>
              <div className="flex space-x-4 justify-end">
                <button
                  onClick={() => setShowClearConfirm(false)}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={() => {
                    clearChat();
                    setShowClearConfirm(false);
                  }}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                >
                  确认清空
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
