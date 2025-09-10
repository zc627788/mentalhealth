import { supabase } from "./supabase";

export interface ChatMessage {
  id: string;
  content: string;
  role: "user" | "assistant";
  timestamp: Date;
  sessionId?: number;
  aiModel?: string;
}

export interface ChatSession {
  id: number;
  user_id: string;
  session_name: string;
  ai_model: string;
  is_active: boolean;
  is_appointment: boolean;
  appointment_id: number | null;
  message_count: number;
  last_message_at: string;
  created_at: string;
  updated_at: string;
}

export interface UserChatPreferences {
  id: number;
  user_id: string;
  default_ai_model: string;
  auto_save_sessions: boolean;
  session_retention_days: number;
  created_at: string;
  updated_at: string;
}

// 聊天存储服务类
export class ChatStorageService {
  private userId: string;
  private currentSessionId: number | null = null;

  constructor(userId: string) {
    this.userId = userId;
  }

  // 获取或创建当前会话
  async getCurrentSession(
    aiModel: string,
    isAppointment: boolean = false,
    appointmentId?: number
  ): Promise<number> {
    if (this.currentSessionId) {
      return this.currentSessionId;
    }

    try {
      // 查找活跃的会话，根据预约状态区分
      let query = supabase
        .from("chat_sessions")
        .select("id")
        .eq("user_id", this.userId)
        .eq("ai_model", aiModel)
        .eq("is_active", true)
        .eq("is_appointment", isAppointment)
        .order("created_at", { ascending: false })
        .limit(1);

      // 如果是预约模式，需要根据 appointment_id 查找
      if (isAppointment && appointmentId) {
        query = query.eq("appointment_id", appointmentId);
      }

      const { data: existingSession, error: findError } = await query.single();

      if (existingSession && !findError) {
        this.currentSessionId = existingSession.id;
        return this.currentSessionId;
      }

      // 创建新会话
      const { data: newSession, error: createError } = await supabase
        .from("chat_sessions")
        .insert({
          user_id: this.userId,
          session_name: `${isAppointment ? "预约" : "非预约"} - ${
            aiModel === "doubao"
              ? "智心助手"
              : aiModel === "peppy"
              ? "Peppy助手"
              : "通用聊天"
          } - ${new Date().toLocaleString()}`,
          ai_model: aiModel,
          is_active: true,
          is_appointment: isAppointment,
          appointment_id: isAppointment ? appointmentId : null,
          message_count: 0,
          last_message_at: new Date().toISOString(),
        })
        .select("id")
        .single();

      if (createError) {
        console.error("创建会话失败:", createError);
        throw createError;
      }

      this.currentSessionId = newSession.id;
      return this.currentSessionId;
    } catch (error) {
      console.error("获取会话失败:", error);
      throw error;
    }
  }

  // 保存消息到数据库
  async saveMessage(
    message: ChatMessage,
    aiModel: string,
    isAppointment: boolean = false,
    appointmentId?: number
  ): Promise<void> {
    try {
      const sessionId = await this.getCurrentSession(
        aiModel,
        isAppointment,
        appointmentId
      );

      const { error } = await supabase.from("chat_messages").insert({
        session_id: sessionId,
        user_id: this.userId,
        message: message.content,
        sender: message.role === "user" ? "user" : "ai",
        ai_model: aiModel,
        metadata: {
          client_id: message.id,
          timestamp: message.timestamp.toISOString(),
        },
      });

      if (error) {
        console.error("保存消息失败:", error);
        throw error;
      }

      // 更新会话统计
      await this.updateSessionStats(sessionId);
    } catch (error) {
      console.error("保存消息到数据库失败:", error);
      // 不抛出错误，允许继续使用本地存储
    }
  }

  // 从数据库加载消息
  async loadMessages(
    aiModel: string,
    isAppointment: boolean = false,
    appointmentId?: number
  ): Promise<ChatMessage[]> {
    try {
      const sessionId = await this.getCurrentSession(
        aiModel,
        isAppointment,
        appointmentId
      );

      const { data: messages, error } = await supabase
        .from("chat_messages")
        .select("*")
        .eq("session_id", sessionId)
        .order("created_at", { ascending: true });

      if (error) {
        console.error("加载消息失败:", error);
        return [];
      }

      return messages.map((msg) => ({
        id: msg.metadata?.client_id || msg.id.toString(),
        content: msg.message,
        role: msg.sender === "user" ? "user" : "assistant",
        timestamp: new Date(msg.created_at),
        sessionId: msg.session_id,
        aiModel: msg.ai_model,
      }));
    } catch (error) {
      console.error("从数据库加载消息失败:", error);
      return [];
    }
  }

  // 更新会话统计
  private async updateSessionStats(sessionId: number): Promise<void> {
    try {
      // 先获取当前消息数量
      const { data: currentSession } = await supabase
        .from("chat_sessions")
        .select("message_count")
        .eq("id", sessionId)
        .single();

      const { error } = await supabase
        .from("chat_sessions")
        .update({
          message_count: (currentSession?.message_count || 0) + 1,
          last_message_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", sessionId);

      if (error) {
        console.error("更新会话统计失败:", error);
      }
    } catch (error) {
      console.error("更新会话统计失败:", error);
    }
  }

  // 获取用户的所有会话
  async getUserSessions(
    aiModel?: string,
    isAppointment?: boolean
  ): Promise<ChatSession[]> {
    try {
      let query = supabase
        .from("chat_sessions")
        .select("*")
        .eq("user_id", this.userId)
        .order("last_message_at", { ascending: false });

      if (aiModel) {
        query = query.eq("ai_model", aiModel);
      }

      if (isAppointment !== undefined) {
        query = query.eq("is_appointment", isAppointment);
      }

      const { data: sessions, error } = await query;

      if (error) {
        console.error("获取用户会话失败:", error);
        return [];
      }

      return sessions || [];
    } catch (error) {
      console.error("获取用户会话失败:", error);
      return [];
    }
  }

  // 切换会话
  async switchSession(sessionId: number): Promise<void> {
    try {
      // 停用当前会话
      if (this.currentSessionId) {
        await supabase
          .from("chat_sessions")
          .update({ is_active: false })
          .eq("id", this.currentSessionId);
      }

      // 激活新会话
      await supabase
        .from("chat_sessions")
        .update({ is_active: true })
        .eq("id", sessionId);

      this.currentSessionId = sessionId;
    } catch (error) {
      console.error("切换会话失败:", error);
      throw error;
    }
  }

  // 创建新会话
  async createNewSession(
    aiModel: string,
    isAppointment: boolean = false,
    appointmentId?: number
  ): Promise<number> {
    try {
      // 停用当前会话
      if (this.currentSessionId) {
        await supabase
          .from("chat_sessions")
          .update({ is_active: false })
          .eq("id", this.currentSessionId);
      }

      // 创建新会话
      const { data: newSession, error } = await supabase
        .from("chat_sessions")
        .insert({
          user_id: this.userId,
          session_name: `${isAppointment ? "预约" : "非预约"} - ${
            aiModel === "doubao"
              ? "智心助手"
              : aiModel === "peppy"
              ? "Peppy助手"
              : "通用聊天"
          } - ${new Date().toLocaleString()}`,
          ai_model: aiModel,
          is_active: true,
          is_appointment: isAppointment,
          appointment_id: isAppointment ? appointmentId : null,
          message_count: 0,
          last_message_at: new Date().toISOString(),
        })
        .select("id")
        .single();

      if (error) {
        console.error("创建新会话失败:", error);
        throw error;
      }

      this.currentSessionId = newSession.id;
      return this.currentSessionId;
    } catch (error) {
      console.error("创建新会话失败:", error);
      throw error;
    }
  }

  // 删除会话
  async deleteSession(sessionId: number): Promise<void> {
    try {
      // 删除会话中的所有消息
      await supabase.from("chat_messages").delete().eq("session_id", sessionId);

      // 删除会话
      await supabase.from("chat_sessions").delete().eq("id", sessionId);

      // 如果删除的是当前会话，重置当前会话ID
      if (this.currentSessionId === sessionId) {
        this.currentSessionId = null;
      }
    } catch (error) {
      console.error("删除会话失败:", error);
      throw error;
    }
  }

  // 获取用户偏好设置
  async getUserPreferences(): Promise<UserChatPreferences | null> {
    try {
      const { data: preferences, error } = await supabase
        .from("user_chat_preferences")
        .select("*")
        .eq("user_id", this.userId)
        .single();

      if (error && error.code !== "PGRST116") {
        // PGRST116 = no rows returned
        console.error("获取用户偏好失败:", error);
        return null;
      }

      return preferences;
    } catch (error) {
      console.error("获取用户偏好失败:", error);
      return null;
    }
  }

  // 更新用户偏好设置
  async updateUserPreferences(
    preferences: Partial<UserChatPreferences>
  ): Promise<void> {
    try {
      const { error } = await supabase.from("user_chat_preferences").upsert({
        user_id: this.userId,
        ...preferences,
        updated_at: new Date().toISOString(),
      });

      if (error) {
        console.error("更新用户偏好失败:", error);
        throw error;
      }
    } catch (error) {
      console.error("更新用户偏好失败:", error);
      throw error;
    }
  }

  // 获取指定会话的消息
  async getSessionMessages(sessionId: number): Promise<ChatMessage[]> {
    try {
      const { data: messages, error } = await supabase
        .from("chat_messages")
        .select("*")
        .eq("session_id", sessionId)
        .order("created_at", { ascending: true });

      if (error) {
        console.error("获取会话消息失败:", error);
        return [];
      }

      return messages.map((msg) => ({
        id: msg.metadata?.client_id || msg.id.toString(),
        content: msg.message,
        role: msg.sender === "user" ? "user" : "assistant",
        timestamp: new Date(msg.created_at),
        sessionId: msg.session_id,
        aiModel: msg.ai_model,
      }));
    } catch (error) {
      console.error("获取会话消息失败:", error);
      return [];
    }
  }

  // 检查会话数量限制
  async checkSessionLimit(
    aiModel: string,
    isAppointment: boolean
  ): Promise<boolean> {
    try {
      const sessions = await this.getUserSessions(aiModel, isAppointment);
      return sessions.length < 30;
    } catch (error) {
      console.error("检查会话限制失败:", error);
      return true; // 出错时允许创建
    }
  }

  // 清空当前会话的消息（保留会话）
  async clearCurrentSessionMessages(
    aiModel: string,
    isAppointment: boolean,
    appointmentId?: number
  ): Promise<void> {
    try {
      const sessionId = await this.getCurrentSession(
        aiModel,
        isAppointment,
        appointmentId
      );

      // 删除会话中的所有消息
      await supabase.from("chat_messages").delete().eq("session_id", sessionId);

      // 重置会话统计
      await supabase
        .from("chat_sessions")
        .update({
          message_count: 0,
          last_message_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", sessionId);
    } catch (error) {
      console.error("清空会话消息失败:", error);
      throw error;
    }
  }

  // 根据预约ID获取或创建会话（预约专用）
  async getOrCreateAppointmentSession(
    aiModel: string,
    appointmentId: number
  ): Promise<number> {
    try {
      // 查找该预约的现有会话
      const { data: existingSession, error: findError } = await supabase
        .from("chat_sessions")
        .select("id")
        .eq("user_id", this.userId)
        .eq("ai_model", aiModel)
        .eq("is_appointment", true)
        .eq("appointment_id", appointmentId)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (existingSession && !findError) {
        this.currentSessionId = existingSession.id;
        return this.currentSessionId;
      }

      // 创建新的预约会话
      const { data: newSession, error: createError } = await supabase
        .from("chat_sessions")
        .insert({
          user_id: this.userId,
          session_name: `预约 - ${
            aiModel === "doubao"
              ? "智心助手"
              : aiModel === "peppy"
              ? "Peppy助手"
              : "通用聊天"
          } - ${new Date().toLocaleString()}`,
          ai_model: aiModel,
          is_active: true,
          is_appointment: true,
          appointment_id: appointmentId,
          message_count: 0,
          last_message_at: new Date().toISOString(),
        })
        .select("id")
        .single();

      if (createError) {
        console.error("创建预约会话失败:", createError);
        throw createError;
      }

      this.currentSessionId = newSession.id;
      return this.currentSessionId;
    } catch (error) {
      console.error("获取预约会话失败:", error);
      throw error;
    }
  }
}

// 本地存储辅助函数（作为备用）
export const LocalStorageHelper = {
  // 保存到本地存储
  saveMessages: (key: string, messages: ChatMessage[]) => {
    try {
      localStorage.setItem(key, JSON.stringify(messages));
    } catch (error) {
      console.error("保存到本地存储失败:", error);
    }
  },

  // 从本地存储加载
  loadMessages: (key: string): ChatMessage[] => {
    try {
      const stored = localStorage.getItem(key);
      if (stored) {
        const parsed = JSON.parse(stored);
        return parsed.map((msg: any) => ({
          ...msg,
          timestamp: new Date(msg.timestamp),
        }));
      }
    } catch (error) {
      console.error("从本地存储加载失败:", error);
    }
    return [];
  },

  // 清除本地存储
  clearMessages: (key: string) => {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.error("清除本地存储失败:", error);
    }
  },
};
