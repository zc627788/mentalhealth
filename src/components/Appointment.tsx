import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";
import { format, parseISO, isAfter, startOfDay } from "date-fns";
import { id, zhCN } from "date-fns/locale";
import { useRealtimeTable } from "../hooks/useRealtimeTable";

interface Counselor {
  id: string;
  name: string;
  title: string;
  speciality: string;
  experience: string;
  rating: number;
  photo_url?: string;
  bio?: string;
  available: boolean;
}

interface Availability {
  id: string;
  counselor_id: string;
  counselor_type?: string;
  ai_model?: string;
  availability_date: string;
  start_time: string;
  end_time: string;
  is_booked: boolean;
  notes?: string;
}

interface AvailabilityWithCounselor extends Availability {
  counselor: Counselor;
}

interface UserAppointment {
  id: number;
  appointment_date: string;
  start_time: string;
  end_time: string;
  topic: string;
  description: string;
  status: string;
  counselor_name?: string;
  urgency: string;
  created_at: string;
  appointment_type?: string;
  ai_model?: string;
  meeting_link?: string;
}

interface FormData {
  availability_id: string;
  topic: string;
  description: string;
  urgency: "low" | "medium" | "high" | "urgent";
}

export default function Appointment() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [availabilities, setAvailabilities] = useState<
    AvailabilityWithCounselor[]
  >([]);
  const [userAppointments, setUserAppointments] = useState<UserAppointment[]>(
    []
  );

  const [activeTab, setActiveTab] = useState<"book" | "history">("book");
  const [selectedAvailability, setSelectedAvailability] =
    useState<AvailabilityWithCounselor | null>(null);
  const [formData, setFormData] = useState<FormData>({
    availability_id: "",
    topic: "",
    description: "",
    urgency: "medium",
  });
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState(false);
  const [error, setError] = useState<string>("");
  const [success, setSuccess] = useState<string>("");
  const [aiAppointmentRequired, setAiAppointmentRequired] =
    useState<boolean>(false);
  const [showNonAppointmentModal, setShowNonAppointmentModal] = useState(false);

  // 实时监听可用时间段的更新
  useRealtimeTable({
    table: "counselor_availability",
    onUpdate: (payload) => {
      // 当某个时间段被预约时，更新其状态但保留在列表中
      if (payload.new.is_booked) {
        setAvailabilities((prev) =>
          prev.map((item) =>
            item.id === payload.new.id ? { ...item, is_booked: true } : item
          )
        );

        // 如果用户正在选择这个时间段，清除选择
        if (selectedAvailability?.id === payload.new.id) {
          setSelectedAvailability(null);
          setFormData({
            availability_id: "",
            topic: "",
            description: "",
            urgency: "medium",
          });
          setError("您选择的时间段刚刚被其他用户预约，请选择其他时间");
        }
      } else {
        // 当时间段被取消预约时，更新其状态
        setAvailabilities((prev) =>
          prev.map((item) =>
            item.id === payload.new.id ? { ...item, is_booked: false } : item
          )
        );
      }
    },
    onInsert: (payload) => {
      // 当新增可用时间段时，实时加载咨询师信息并添加到列表
      loadSingleAvailability(payload.new);
    },
    onDelete: (payload) => {
      // 当删除时间段时，从列表中移除
      setAvailabilities((prev) =>
        prev.filter((item) => item.id !== payload.old.id)
      );

      if (selectedAvailability?.id === payload.old.id) {
        setSelectedAvailability(null);
        setFormData({
          availability_id: "",
          topic: "",
          description: "",
          urgency: "medium",
        });
      }
    },
  });

  // 监听用户预约的更新
  useRealtimeTable({
    table: "appointments",
    filter: `user_id=eq.${user?.id}`,
    onInsert: (payload) => {
      // 当添加新预约时，实时更新预约列表
      setUserAppointments((prev) => [payload.new, ...prev]);
    },
    onUpdate: (payload) => {
      // 当预约状态更新时，实时更新
      setUserAppointments((prev) =>
        prev.map((appointment) =>
          appointment.id === payload.new.id ? payload.new : appointment
        )
      );
    },
    onDelete: (payload) => {
      // 当预约被删除时，从列表中移除
      setUserAppointments((prev) =>
        prev.filter((appointment) => appointment.id !== payload.old.id)
      );
    },
  });

  // 实时监听用户访问权限变化
  useRealtimeTable({
    table: "user_access_policies",
    onUpdate: (payload) => {
      // 当用户的 access_type 发生变化时，重新加载可用时间段
      if (payload.new.user_id === user?.id) {
        // 清除当前选择的时间段，因为可能不再有权限预约
        setSelectedAvailability(null);
        setFormData({
          availability_id: "",
          topic: "",
          description: "",
          urgency: "medium",
        });
        setError("");
        setSuccess("您的访问权限已更新，如未自动刷新，请手动刷新可用预约选项...");
        // 重新加载可用时间段
        loadAvailableSlots();
      }
    },
  });

  const loadAvailableSlots = useCallback(async () => {
    try {
      const now = new Date();
      const today = now.toISOString().split("T")[0];
      const currentTime = now.toTimeString().split(" ")[0].substring(0, 5); // HH:MM format

      // 获取所有时间段（包括已预约的）
      const { data: availabilityData, error: availabilityError } =
        await supabase
          .from("counselor_availability")
          .select("*")
          .gte("availability_date", today)
          .order("availability_date", { ascending: true })
          .order("start_time", { ascending: true });

      if (availabilityError) {
        throw availabilityError;
      }

      if (!availabilityData || availabilityData.length === 0) {
        setAvailabilities([]);
        return;
      }

      // 过滤掉已结束的时间段（根据end_time）
      const validAvailabilityData = availabilityData.filter((availability) => {
        const availabilityEndDateTime = new Date(
          `${availability.availability_date}T${availability.end_time}`
        );
        return availabilityEndDateTime > now; // 只保留未结束的时间段
      });

      // 获取当前用户的预约记录，用于过滤掉用户自己已预约的时间段
      const { data: userAppointmentsData } = await supabase
        .from("appointments")
        .select("availability_id")
        .eq("user_id", user?.id)
        .eq("status", "confirmed");

      const userBookedAvailabilityIds = new Set(
        userAppointmentsData?.map((apt) => apt.availability_id) || []
      );

       // 获取用户的访问权限
       const { data: userAccessPolicy } = await supabase
         .from('user_access_policies')
         .select('access_type')
         .eq('user_id', user?.id)
         .maybeSingle();
       
       const userAccessType = userAccessPolicy?.access_type || 'human_only';

       // 过滤掉当前用户已预约的时间段
       const filteredAvailabilityData = validAvailabilityData.filter(
         (availability) => !userBookedAvailabilityIds.has(availability.id)
       );

       // 根据用户 access_type 过滤可用时间段
       const accessFilteredData = filteredAvailabilityData.filter((availability) => {
         // 如果是人工咨询师时间段
         if (availability.counselor_type === 'human' || !availability.counselor_type) {
           return userAccessType === 'human_only';
         }
         
         // 如果是 AI 咨询师时间段
         if (availability.counselor_type === 'ai') {
           if (userAccessType === 'doubao_only') {
             return availability.ai_model === 'doubao';
           }
           if (userAccessType === 'peppy_only') {
             return availability.ai_model === 'peppy';
           }
           // human_only 用户不能预约 AI 咨询
           return false;
         }
         
         return false;
       });

      // 获取咨询师信息
      const counselorIds = [
        ...new Set(accessFilteredData.map((item) => item.counselor_id)),
      ];
      const { data: counselorData, error: counselorError } = await supabase
        .from("counselors")
        .select("*")
        .in("id", counselorIds)
        .eq("available", true);

      if (counselorError) {
        throw counselorError;
      }

      // 合并数据
      const availabilitiesWithCounselors = accessFilteredData
        .map((availability) => {
          const counselor = counselorData?.find(
            (c) => c.id === availability.counselor_id
          );

          // 如果没有找到咨询师记录，但这是AI预约，创建默认信息
          if (!counselor && availability.counselor_type === "ai") {
            const aiCounselor = {
              id: availability.counselor_id,
              name:
                availability.ai_model === "doubao"
                  ? "豆包AI助手"
                  : availability.ai_model === "peppy"
                  ? "PeppyAI助手"
                  : "AI智能助手",
              title: "AI心理咨询师",
              speciality: "AI心理支持、情绪疏导、认知行为指导",
              experience: "AI技术支持",
              rating: 5.0,
              bio: "基于先进AI技术的智能心理咨询助手，提供24/7心理支持服务",
              available: true,
            };
            return { ...availability, counselor: aiCounselor };
          }

          return counselor ? { ...availability, counselor } : null;
        })
        .filter(Boolean) as AvailabilityWithCounselor[];

      setAvailabilities(availabilitiesWithCounselors);
    } catch (error) {
      console.error("加载可用时间错误:", error);
      throw error;
    }
  }, [user?.id]);

  // 加载单个可用时间段（用于实时更新）
  const loadSingleAvailability = async (availabilityData: any) => {
    try {
      const { data: counselorData } = await supabase
        .from("counselors")
        .select("*")
        .eq("id", availabilityData.counselor_id)
        .eq("available", true)
        .maybeSingle();

      if (counselorData && !availabilityData.is_booked) {
        const newAvailability = {
          ...availabilityData,
          counselor: counselorData,
        };
        setAvailabilities((prev) => {
          // 检查是否已存在，避免重复
          const exists = prev.some((item) => item.id === newAvailability.id);
          if (!exists) {
            return [...prev, newAvailability].sort((a, b) => {
              const dateComparison = a.availability_date.localeCompare(
                b.availability_date
              );
              if (dateComparison !== 0) return dateComparison;
              return a.start_time.localeCompare(b.start_time);
            });
          }
          return prev;
        });
      }
    } catch (error) {
      console.error("加载单个可用时间错误:", error);
    }
  };

  const loadUserAppointments = useCallback(async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from("appointments")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) {
        throw error;
      }

      setUserAppointments(data || []);
    } catch (error) {
      console.error("加载用户预约错误:", error);
      throw error;
    }
  }, [user]);

  const loadAiAppointmentSetting = useCallback(async () => {
    try {
      const { data: aiAppointmentRequired } = await supabase
        .from("system_settings")
        .select("setting_value")
        .eq("setting_key", "ai_appointment_required")
        .maybeSingle();

      setAiAppointmentRequired(aiAppointmentRequired?.setting_value === "true");
    } catch (error) {
      console.error("加载AI预约设置错误:", error);
      // 默认设置为false
      setAiAppointmentRequired(false);
    }
  }, []);

  // 检查AI服务是否需要预约
  const checkAiServicesSetting = async () => {
    try {
      const { data } = await supabase
        .from("system_settings")
        .select("setting_value")
        .eq("setting_key", "ai_appointment_required")
        .maybeSingle();

      return data?.setting_value === "true";
    } catch (error) {
      console.error("获取AI服务设置失败:", error);
      return false;
    }
  };

  // 处理AI服务进入
  const handleAiServiceEntry = async (appointment: UserAppointment) => {
    const needsAppointment = await checkAiServicesSetting();
    
    if (needsAppointment) {
      // 需要预约，直接进入
      const destination = appointment.ai_model === "doubao" ? "/chat-doubao" : "/chat-peppy";
      navigate(destination, { state: { appointment } });
    } else {
      // 不需要预约，显示弹窗
      setShowNonAppointmentModal(true);
    }
  };

  // 确认跳转到Dashboard
  const handleConfirmToDashboard = () => {
    setShowNonAppointmentModal(false);
    navigate("/dashboard");
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadAvailableSlots(),
        loadUserAppointments(),
        loadAiAppointmentSetting(),
      ]);
    } catch (error) {
      console.error("加载数据错误:", error);
      setError("加载数据失败，请刷新页面重试");
    } finally {
      setLoading(false);
    }
  }, [loadAvailableSlots, loadUserAppointments, loadAiAppointmentSetting]);

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user?.id, loadData]);

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  const handleBookAppointment = async () => {
    if (!selectedAvailability || !user) {
      setError("请选择预约时间");
      return;
    }

    if (!formData.topic.trim()) {
      setError("请输入咨询主题");
      return;
    }

    if (!formData.description.trim() || formData.description.length < 20) {
      setError("请详细描述您的情况（至少20个字符）");
      return;
    }

    setBooking(true);
    setError("");
    setSuccess("");

    try {
      const { data: sessionData } = await supabase.auth.getSession();

      if (!sessionData.session) {
        throw new Error("用户会话已过期，请重新登录");
      }

      // 直接插入预约记录
      const appointmentData: any = {
        user_id: user.id,
        appointment_type: selectedAvailability.counselor_type,
        appointment_date: selectedAvailability.availability_date,
        start_time: selectedAvailability.start_time,
        end_time: selectedAvailability.end_time,
        topic: formData.topic.trim(),
        description: formData.description.trim(),
        urgency: formData.urgency,
        counselor_id: selectedAvailability.counselor_id,
        counselor_name: selectedAvailability.counselor.name,
        availability_id: selectedAvailability.id,
        user_email: user.email || "",
        status: "confirmed",
      };

      // 如果是AI预约，添加ai_model字段
      if (selectedAvailability.counselor_type === "ai") {
        appointmentData.ai_model = selectedAvailability.ai_model;
      }

      const { data, error } = await supabase
        .from("appointments")
        .insert([appointmentData])
        .select();

      if (error) {
        throw error;
      }

      // 更新可用时间段为已预约
      const { error: updateError } = await supabase
        .from("counselor_availability")
        .update({ is_booked: true })
        .eq("id", selectedAvailability.id);

      if (updateError) {
        console.error("更新可用时间段状态失败:", updateError);
      }

      setSuccess("预约成功！咨询师将会尽快确认您的预约。");
      setSelectedAvailability(null);
      setFormData({
        availability_id: "",
        topic: "",
        description: "",
        urgency: "medium",
      });

      // 重新加载数据
      await loadData();
    } catch (error: any) {
      console.error("预约错误:", error);
      setError(error.message || "预约失败，请稍后重试");
    } finally {
      setBooking(false);
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      return format(parseISO(dateStr), "yyyy年MM月dd日 EEEE", { locale: zhCN });
    } catch {
      return dateStr;
    }
  };

  const formatTime = (timeStr: string) => {
    try {
      return timeStr.substring(0, 5);
    } catch {
      return timeStr;
    }
  };

  const getStatusText = (status: string) => {
    const statusMap = {
      pending: "待确认",
      confirmed: "已确认",
      completed: "已完成",
      cancelled: "已取消",
    };
    return statusMap[status as keyof typeof statusMap] || status;
  };

  const getStatusColor = (status: string) => {
    const colorMap = {
      pending: "text-yellow-600 bg-yellow-50",
      confirmed: "text-green-600 bg-green-50",
      completed: "text-blue-600 bg-blue-50",
      cancelled: "text-red-600 bg-red-50",
    };
    return (
      colorMap[status as keyof typeof colorMap] || "text-gray-600 bg-gray-50"
    );
  };

  const getUrgencyText = (urgency: string) => {
    const urgencyMap = {
      low: "一般",
      medium: "中等",
      high: "紧急",
      urgent: "非常紧急",
    };
    return urgencyMap[urgency as keyof typeof urgencyMap] || urgency;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">加载中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-4">
              <h1 className="text-2xl font-bold text-gray-900">心理咨询预约</h1>
              <nav className="flex space-x-1">
                {!aiAppointmentRequired && (
                  <button
                    onClick={() => navigate("/dashboard")}
                    className="px-3 py-2 text-sm font-medium text-gray-600 hover:text-blue-600 transition-colors"
                  >
                    首页
                  </button>
                )}
                <span className="px-3 py-2 text-sm font-medium text-blue-600 border-b-2 border-blue-600">
                  预约服务
                </span>
              </nav>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">欢迎，{user?.email}</span>
              <button
                onClick={handleSignOut}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
              >
                退出登录
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Tabs */}
        <div className="mb-6">
          <div className="border-b border-gray-200">
            <nav className="flex space-x-8">
              <button
                onClick={() => setActiveTab("book")}
                className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === "book"
                    ? "border-blue-500 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                预约咨询
              </button>
              <button
                onClick={() => setActiveTab("history")}
                className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === "history"
                    ? "border-blue-500 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                我的预约
              </button>
            </nav>
          </div>
        </div>

        {/* Error/Success Messages */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-800 text-sm">{error}</p>
          </div>
        )}

        {success && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-green-800 text-sm">{success}</p>
          </div>
        )}

        {/* Content */}
        {activeTab === "book" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Available Slots */}
            <div className="lg:col-span-2">
              <div className="bg-white rounded-lg shadow-sm border p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-6">
                  可预约时间
                </h2>

                {availabilities.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="text-gray-400 mb-2">
                      <svg
                        className="mx-auto h-12 w-12"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                        />
                      </svg>
                    </div>
                    <p className="text-gray-500">暂无可预约时间</p>
                    <p className="text-gray-400 text-sm mt-1">
                      请稍后查看或联系客服
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {availabilities.map((availability) => (
                      <div
                        key={availability.id}
                        className={`border rounded-lg p-4 transition-all ${
                          availability.is_booked
                            ? "border-gray-300 bg-gray-100 cursor-not-allowed opacity-60"
                            : selectedAvailability?.id === availability.id
                            ? "border-blue-500 bg-blue-50 cursor-pointer"
                            : "border-gray-200 hover:border-blue-300 hover:bg-gray-50 cursor-pointer"
                        }`}
                        onClick={() => {
                          if (!availability.is_booked) {
                            setSelectedAvailability(availability);
                            setFormData((prev) => ({
                              ...prev,
                              availability_id: availability.id,
                            }));
                            setError("");
                          }
                        }}
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="flex items-center space-x-3 mb-2">
                              <h3 className="font-semibold text-lg text-gray-900">
                                {availability.counselor.name}
                              </h3>
                              <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
                                {availability.counselor.title}
                              </span>
                            </div>

                            <p className="text-gray-600 mb-2">
                              专长：{availability.counselor.speciality}
                            </p>

                            <div className="flex items-center space-x-4 text-sm text-gray-500">
                              <span>
                                经验：{availability.counselor.experience}
                              </span>
                              <span>
                                评分：{availability.counselor.rating}/5.0
                              </span>
                            </div>
                          </div>

                          <div className="text-right">
                            <div className="text-lg font-semibold text-blue-600">
                              {formatDate(availability.availability_date)}
                            </div>
                            <div className="text-gray-600">
                              {formatTime(availability.start_time)} -{" "}
                              {formatTime(availability.end_time)}
                            </div>
                            {availability.is_booked && (
                              <div className="text-xs text-red-600 font-medium mt-1">
                                已被预约
                              </div>
                            )}
                            {availability.notes && (
                              <div className="text-xs text-gray-500 mt-1">
                                {availability.notes}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Booking Form */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded-lg shadow-sm border p-6 sticky top-8">
                <h2 className="text-xl font-semibold text-gray-900 mb-6">
                  预约信息
                </h2>

                {selectedAvailability ? (
                  <div className="space-y-6">
                    <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                      <h4 className="font-medium text-blue-900 mb-1">
                        {selectedAvailability.counselor.name}
                      </h4>
                      <p className="text-sm text-blue-700">
                        {formatDate(selectedAvailability.availability_date)}
                      </p>
                      <p className="text-sm text-blue-700">
                        {formatTime(selectedAvailability.start_time)} -{" "}
                        {formatTime(selectedAvailability.end_time)}
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        咨询主题 *
                      </label>
                      <input
                        type="text"
                        value={formData.topic}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            topic: e.target.value,
                          }))
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="请输入咨询主题"
                        maxLength={200}
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        {formData.topic.length}/200
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        详细描述 *
                      </label>
                      <textarea
                        value={formData.description}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            description: e.target.value,
                          }))
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="请详细描述您的情况和需要咨询的问题（至少20个字符）"
                        rows={4}
                        maxLength={1000}
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        {formData.description.length}/1000（至少20个字符）
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        紧急程度
                      </label>
                      <select
                        value={formData.urgency}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            urgency: e.target.value as any,
                          }))
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="low">一般</option>
                        <option value="medium">中等</option>
                        <option value="high">紧急</option>
                        <option value="urgent">非常紧急</option>
                      </select>
                    </div>

                    <button
                      onClick={handleBookAppointment}
                      disabled={booking}
                      className={`w-full py-3 px-4 rounded-lg font-medium transition-colors ${
                        booking
                          ? "bg-gray-400 text-white cursor-not-allowed"
                          : "bg-blue-600 text-white hover:bg-blue-700"
                      }`}
                    >
                      {booking ? (
                        <div className="flex items-center justify-center">
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                          提交中...
                        </div>
                      ) : (
                        "确认预约"
                      )}
                    </button>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <div className="text-gray-400 mb-2">
                      <svg
                        className="mx-auto h-8 w-8"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                    </div>
                    <p className="text-gray-500">请选择预约时间</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === "history" && (
          <div className="bg-white rounded-lg shadow-sm border">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">预约历史</h2>
            </div>

            {userAppointments.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-gray-400 mb-2">
                  <svg
                    className="mx-auto h-12 w-12"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                </div>
                <p className="text-gray-500">暂无预约记录</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {userAppointments.map((appointment) => (
                  <div key={appointment.id} className="p-6 hover:bg-gray-50">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <h3 className="font-semibold text-lg text-gray-900">
                            {appointment.topic}
                          </h3>
                          <span
                            className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(
                              appointment.status
                            )}`}
                          >
                            {getStatusText(appointment.status)}
                          </span>
                        </div>

                        <div className="space-y-1 text-sm text-gray-600">
                          {appointment.counselor_name && (
                            <p>咨询师：{appointment.counselor_name}</p>
                          )}
                          <p>
                            时间：{formatDate(appointment.appointment_date)}{" "}
                            {formatTime(appointment.start_time)} -{" "}
                            {formatTime(appointment.end_time)}
                          </p>
                          <p>紧急程度：{getUrgencyText(appointment.urgency)}</p>
                          <p>
                            预约时间：
                            {format(
                              parseISO(appointment.created_at),
                              "yyyy-MM-dd HH:mm",
                              { locale: zhCN }
                            )}
                          </p>
                        </div>

                        {appointment.description && (
                          <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                            <p className="text-sm text-gray-700">
                              <span className="font-medium">描述：</span>
                              {appointment.description}
                            </p>
                          </div>
                        )}
                      </div>

                      {/* AI预约的进入按钮 */}
                      {appointment.appointment_type === "ai" &&
                        appointment.status === "confirmed" && (
                          <div className="ml-4">
                            {(() => {
                              const appointmentStartTime = new Date(
                                `${appointment.appointment_date}T${appointment.start_time}`
                              );
                              const now = new Date();
                              const isTimeReached = appointmentStartTime <= now;

                              return (
                                <button
                                  onClick={() => handleAiServiceEntry(appointment)}
                                  disabled={!isTimeReached}
                                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                                    isTimeReached
                                      ? "bg-blue-600 text-white hover:bg-blue-700"
                                      : "bg-gray-300 text-gray-500 cursor-not-allowed"
                                  }`}
                                  title={
                                    (!isTimeReached && "未到开始时间") || ""
                                  }
                                >
                                  点击进入
                                </button>
                              );
                            })()}
                          </div>
                        )}
                    </div>

                    {/* 会议链接显示 */}
                    {appointment.meeting_link ? (
                      <div className="mt-4 p-4 bg-green-50 rounded-lg border border-green-200">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <h4 className="font-medium text-green-800">
                              会议链接已安排
                            </h4>
                            <p className="text-sm text-green-600 mt-1">
                              请按时参加咨询，建议提前5分钟加入
                            </p>
                            <p className="text-xs text-green-500 mt-2 break-all">
                              <span className="font-medium">链接：</span>
                              {appointment.meeting_link}
                            </p>
                          </div>
                          <div className="flex flex-col space-y-2 ml-4">
                            <a
                              href={appointment.meeting_link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-colors"
                            >
                              加入会议
                              <svg
                                className="ml-2 -mr-1 w-4 h-4"
                                fill="currentColor"
                                viewBox="0 0 20 20"
                              >
                                <path
                                  fillRule="evenodd"
                                  d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z"
                                  clipRule="evenodd"
                                />
                              </svg>
                            </a>
                            <button
                              onClick={() => {
                                navigator.clipboard
                                  .writeText(appointment.meeting_link!)
                                  .then(() => {
                                    // 简单的成功提示
                                    const button =
                                      document.activeElement as HTMLButtonElement;
                                    const originalText = button.textContent;
                                    button.textContent = "已复制!";
                                    button.style.backgroundColor = "#10B981";
                                    setTimeout(() => {
                                      button.textContent = originalText;
                                      button.style.backgroundColor = "";
                                    }, 2000);
                                  })
                                  .catch(() => {
                                    // 降级处理：手动选中文本
                                    const textArea =
                                      document.createElement("textarea");
                                    textArea.value = appointment.meeting_link!;
                                    document.body.appendChild(textArea);
                                    textArea.select();
                                    document.execCommand("copy");
                                    document.body.removeChild(textArea);

                                    const button =
                                      document.activeElement as HTMLButtonElement;
                                    const originalText = button.textContent;
                                    button.textContent = "已复制!";
                                    button.style.backgroundColor = "#10B981";
                                    setTimeout(() => {
                                      button.textContent = originalText;
                                      button.style.backgroundColor = "";
                                    }, 2000);
                                  });
                              }}
                              className="inline-flex items-center px-3 py-1 border border-green-300 rounded-md text-xs font-medium text-green-700 bg-green-50 hover:bg-green-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-colors"
                            >
                              <svg
                                className="mr-1 h-3 w-3"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth="2"
                                  d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                                />
                              </svg>
                              复制链接
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : appointment.status === "confirmed" &&
                      appointment.appointment_type === "human" ? (
                      <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                        <div className="flex items-center">
                          <div className="flex-shrink-0">
                            <svg
                              className="h-5 w-5 text-blue-400"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth="2"
                                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                              />
                            </svg>
                          </div>
                          <div className="ml-3">
                            <h4 className="font-medium text-blue-800">
                              会议安排中
                            </h4>
                            <p className="text-sm text-blue-600 mt-1">
                              咨询师正在安排会议链接，请耐心等待
                            </p>
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 非预约状态弹窗 */}
      {showNonAppointmentModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center mb-4">
              <div className="bg-green-100 p-2 rounded-full mr-3">
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
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900">
                AI服务已开放
              </h3>
            </div>
            <p className="text-gray-600 mb-6">
              目前AI心理陪伴服务已开放，无需预约即可使用。
              您可以直接在首页开始与AI助手对话。
            </p>
            <div className="flex space-x-4 justify-end">
              <button
                onClick={() => setShowNonAppointmentModal(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleConfirmToDashboard}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                去首页
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
