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
  last_message_at: string | null;
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

export class ChatStorageService {
  private userId: string;
  private currentSessionId: number | null = null;

  constructor(userId: string) {
    this.userId = userId;
  }

  private buildSessionName(aiModel: string, isAppointment: boolean) {
    const assistantName =
      aiModel === "doubao"
        ? "智心助手"
        : aiModel === "peppy"
        ? "Peppy助手"
        : "通用聊天";

    return `${isAppointment ? "预约" : "非预约"} - ${assistantName} - ${new Date().toLocaleString()}`;
  }

  private async deactivateSessions(
    aiModel: string,
    isAppointment: boolean,
    appointmentId?: number
  ) {
    let query = supabase
      .from("chat_sessions")
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq("user_id", this.userId)
      .eq("ai_model", aiModel)
      .eq("is_appointment", isAppointment)
      .eq("is_active", true);

    if (isAppointment && appointmentId) {
      query = query.eq("appointment_id", appointmentId);
    }

    const { error } = await query;

    if (error) {
      console.error("Failed to deactivate sessions:", error);
      throw error;
    }
  }

  private async createSessionRecord(
    aiModel: string,
    isAppointment: boolean,
    appointmentId?: number
  ): Promise<number> {
    await this.deactivateSessions(aiModel, isAppointment, appointmentId);

    const { data, error } = await supabase
      .from("chat_sessions")
      .insert({
        user_id: this.userId,
        session_name: this.buildSessionName(aiModel, isAppointment),
        ai_model: aiModel,
        is_active: true,
        is_appointment: isAppointment,
        appointment_id: isAppointment ? appointmentId ?? null : null,
        message_count: 0,
        last_message_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (error || !data) {
      console.error("Failed to create chat session:", error);
      throw error ?? new Error("Failed to create chat session");
    }

    this.currentSessionId = data.id;
    return data.id;
  }

  async getCurrentSession(
    aiModel: string,
    isAppointment: boolean = false,
    appointmentId?: number
  ): Promise<number | null> {
    if (this.currentSessionId) {
      return this.currentSessionId;
    }

    let query = supabase
      .from("chat_sessions")
      .select("id")
      .eq("user_id", this.userId)
      .eq("ai_model", aiModel)
      .eq("is_appointment", isAppointment)
      .order("is_active", { ascending: false })
      .order("last_message_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(1);

    if (isAppointment && appointmentId) {
      query = query.eq("appointment_id", appointmentId);
    }

    const { data, error } = await query.maybeSingle();

    if (error) {
      console.error("Failed to get current session:", error);
      throw error;
    }

    if (!data) {
      return null;
    }

    this.currentSessionId = data.id;
    return data.id;
  }

  async ensureSession(
    aiModel: string,
    isAppointment: boolean = false,
    appointmentId?: number
  ): Promise<number> {
    const existingSessionId = await this.getCurrentSession(
      aiModel,
      isAppointment,
      appointmentId
    );

    if (existingSessionId) {
      return existingSessionId;
    }

    return this.createSessionRecord(aiModel, isAppointment, appointmentId);
  }

  async saveMessage(
    message: ChatMessage,
    aiModel: string,
    isAppointment: boolean = false,
    appointmentId?: number
  ): Promise<number | null> {
    try {
      const sessionId = await this.ensureSession(
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
        console.error("Failed to save message:", error);
        throw error;
      }

      await this.updateSessionStats(sessionId);
      return sessionId;
    } catch (error) {
      console.error("Failed to persist message:", error);
      return null;
    }
  }

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

      if (!sessionId) {
        return [];
      }

      const { data: messages, error } = await supabase
        .from("chat_messages")
        .select("*")
        .eq("session_id", sessionId)
        .order("created_at", { ascending: true });

      if (error) {
        console.error("Failed to load messages:", error);
        return [];
      }

      return (messages || []).map((msg) => ({
        id: msg.metadata?.client_id || msg.id.toString(),
        content: msg.message,
        role: msg.sender === "user" ? "user" : "assistant",
        timestamp: new Date(msg.created_at),
        sessionId: msg.session_id,
        aiModel: msg.ai_model,
      }));
    } catch (error) {
      console.error("Failed to load messages:", error);
      return [];
    }
  }

  private async updateSessionStats(sessionId: number): Promise<void> {
    try {
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
        console.error("Failed to update session stats:", error);
      }
    } catch (error) {
      console.error("Failed to update session stats:", error);
    }
  }

  async getUserSessions(
    aiModel?: string,
    isAppointment?: boolean
  ): Promise<ChatSession[]> {
    try {
      let query = supabase
        .from("chat_sessions")
        .select("*")
        .eq("user_id", this.userId)
        .order("is_active", { ascending: false })
        .order("last_message_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false });

      if (aiModel) {
        query = query.eq("ai_model", aiModel);
      }

      if (isAppointment !== undefined) {
        query = query.eq("is_appointment", isAppointment);
      }

      const { data: sessions, error } = await query;

      if (error) {
        console.error("Failed to get user sessions:", error);
        return [];
      }

      return sessions || [];
    } catch (error) {
      console.error("Failed to get user sessions:", error);
      return [];
    }
  }

  async switchSession(sessionId: number): Promise<void> {
    try {
      const { data: targetSession, error: targetError } = await supabase
        .from("chat_sessions")
        .select("ai_model, is_appointment, appointment_id")
        .eq("id", sessionId)
        .single();

      if (targetError || !targetSession) {
        throw targetError ?? new Error("Failed to load target session");
      }

      await this.deactivateSessions(
        targetSession.ai_model,
        targetSession.is_appointment,
        targetSession.appointment_id ?? undefined
      );

      const { error } = await supabase
        .from("chat_sessions")
        .update({ is_active: true, updated_at: new Date().toISOString() })
        .eq("id", sessionId);

      if (error) {
        console.error("Failed to switch session:", error);
        throw error;
      }

      this.currentSessionId = sessionId;
    } catch (error) {
      console.error("Failed to switch session:", error);
      throw error;
    }
  }

  async createNewSession(
    aiModel: string,
    isAppointment: boolean = false,
    appointmentId?: number
  ): Promise<number> {
    try {
      return await this.createSessionRecord(aiModel, isAppointment, appointmentId);
    } catch (error) {
      console.error("Failed to create new session:", error);
      throw error;
    }
  }

  async deleteSession(sessionId: number): Promise<void> {
    try {
      const { error: messageDeleteError } = await supabase
        .from("chat_messages")
        .delete()
        .eq("session_id", sessionId);

      if (messageDeleteError) {
        throw messageDeleteError;
      }

      const { error: sessionDeleteError } = await supabase
        .from("chat_sessions")
        .delete()
        .eq("id", sessionId);

      if (sessionDeleteError) {
        throw sessionDeleteError;
      }

      if (this.currentSessionId === sessionId) {
        this.currentSessionId = null;
      }
    } catch (error) {
      console.error("Failed to delete session:", error);
      throw error;
    }
  }

  async getUserPreferences(): Promise<UserChatPreferences | null> {
    try {
      const { data: preferences, error } = await supabase
        .from("user_chat_preferences")
        .select("*")
        .eq("user_id", this.userId)
        .single();

      if (error && error.code !== "PGRST116") {
        console.error("Failed to get user preferences:", error);
        return null;
      }

      return preferences;
    } catch (error) {
      console.error("Failed to get user preferences:", error);
      return null;
    }
  }

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
        console.error("Failed to update user preferences:", error);
        throw error;
      }
    } catch (error) {
      console.error("Failed to update user preferences:", error);
      throw error;
    }
  }

  async getSessionMessages(sessionId: number): Promise<ChatMessage[]> {
    try {
      const { data: messages, error } = await supabase
        .from("chat_messages")
        .select("*")
        .eq("session_id", sessionId)
        .order("created_at", { ascending: true });

      if (error) {
        console.error("Failed to get session messages:", error);
        return [];
      }

      return (messages || []).map((msg) => ({
        id: msg.metadata?.client_id || msg.id.toString(),
        content: msg.message,
        role: msg.sender === "user" ? "user" : "assistant",
        timestamp: new Date(msg.created_at),
        sessionId: msg.session_id,
        aiModel: msg.ai_model,
      }));
    } catch (error) {
      console.error("Failed to get session messages:", error);
      return [];
    }
  }

  async checkSessionLimit(
    aiModel: string,
    isAppointment: boolean
  ): Promise<boolean> {
    try {
      const sessions = await this.getUserSessions(aiModel, isAppointment);
      return sessions.length < 30;
    } catch (error) {
      console.error("Failed to check session limit:", error);
      return true;
    }
  }

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

      if (!sessionId) {
        return;
      }

      const { error: messageDeleteError } = await supabase
        .from("chat_messages")
        .delete()
        .eq("session_id", sessionId);

      if (messageDeleteError) {
        throw messageDeleteError;
      }

      const { error: resetError } = await supabase
        .from("chat_sessions")
        .update({
          message_count: 0,
          last_message_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", sessionId);

      if (resetError) {
        throw resetError;
      }
    } catch (error) {
      console.error("Failed to clear current session messages:", error);
      throw error;
    }
  }

  async getOrCreateAppointmentSession(
    aiModel: string,
    appointmentId: number
  ): Promise<number> {
    try {
      const { data: existingSession, error } = await supabase
        .from("chat_sessions")
        .select("id")
        .eq("user_id", this.userId)
        .eq("ai_model", aiModel)
        .eq("is_appointment", true)
        .eq("appointment_id", appointmentId)
        .order("is_active", { ascending: false })
        .order("last_message_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        throw error;
      }

      if (existingSession) {
        this.currentSessionId = existingSession.id;
        return existingSession.id;
      }

      return this.createSessionRecord(aiModel, true, appointmentId);
    } catch (error) {
      console.error("Failed to get or create appointment session:", error);
      throw error;
    }
  }
}

export const LocalStorageHelper = {
  saveMessages: (key: string, messages: ChatMessage[]) => {
    try {
      localStorage.setItem(key, JSON.stringify(messages));
    } catch (error) {
      console.error("Failed to save messages to localStorage:", error);
    }
  },

  loadMessages: (key: string): ChatMessage[] => {
    try {
      const stored = localStorage.getItem(key);
      if (!stored) {
        return [];
      }

      const parsed = JSON.parse(stored);
      return parsed.map((msg: ChatMessage) => ({
        ...msg,
        timestamp: new Date(msg.timestamp),
      }));
    } catch (error) {
      console.error("Failed to load messages from localStorage:", error);
      return [];
    }
  },

  clearMessages: (key: string) => {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.error("Failed to clear messages from localStorage:", error);
    }
  },
};
