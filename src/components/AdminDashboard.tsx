import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { format, parseISO, addDays } from "date-fns";
import { zhCN } from "date-fns/locale";

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
  counselor_type?: string;
  ai_model?: string;
  created_at: string;
  updated_at: string;
}

interface CounselorAvailability {
  id: string;
  counselor_id: string;
  availability_date: string;
  start_time: string;
  end_time: string;
  is_booked: boolean;
  notes?: string;
  created_at: string;
  counselor?: Counselor;
}

interface Appointment {
  id: number;
  user_id: string;
  counselor_id?: string;
  appointment_date: string;
  start_time: string;
  end_time: string;
  topic: string;
  description: string;
  status: string;
  urgency: string;
  user_email?: string;
  meeting_link?: string;
  created_at: string;
  availability_id?: string;
}

interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: string;
}

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [adminUser, setAdminUser] = useState<AdminUser | null>(null);
  const [counselors, setCounselors] = useState<Counselor[]>([]);
  const [availabilities, setAvailabilities] = useState<CounselorAvailability[]>(
    []
  );
  const [appointments, setAppointments] = useState<Appointment[]>([]);

  const [activeTab, setActiveTab] = useState<
    "counselors" | "availability" | "appointments" | "meetings" | "settings"
  >("counselors");
  const [loading, setLoading] = useState(true);

  // Counselor Management
  const [showAddCounselor, setShowAddCounselor] = useState(false);
  const [editingCounselor, setEditingCounselor] = useState<Counselor | null>(
    null
  );
  const [counselorForm, setCounselorForm] = useState({
    name: "",
    title: "",
    speciality: "",
    experience: "",
    bio: "",
    photo_url: "",
  });

  // Availability Management
  const [showAddAvailability, setShowAddAvailability] = useState(false);
  const [selectedCounselorId, setSelectedCounselorId] = useState<string>("");
  const [availabilityForm, setAvailabilityForm] = useState({
    counselor_id: "",
    counselor_type: "human",
    ai_model: "",
    availability_date: "",
    start_time: "",
    end_time: "",
    notes: "",
  });

  // Batch Availability Management
  const [showBatchAvailability, setShowBatchAvailability] = useState(false);
  const [batchForm, setBatchForm] = useState({
    counselor_id: "",
    counselor_type: "human",
    ai_model: "",
    template_type: "weekly",
    date_range: {
      start_date: "",
      end_date: "",
    },
    time_slots: [
      {
        days_of_week: [1, 2, 3, 4, 5], // 周一到周五
        start_time: "09:00",
        end_time: "10:00",
        notes: "",
      },
    ],
    specific_dates: [],
  });

  // Meeting Link Management
  const [selectedAppointment, setSelectedAppointment] =
    useState<Appointment | null>(null);
  const [showMeetingLinkModal, setShowMeetingLinkModal] = useState(false);
  const [meetingLinkForm, setMeetingLinkForm] = useState({
    meeting_platform: "Zoom",
    meeting_url: "",
    meeting_id: "",
    meeting_password: "",
    additional_info: "",
  });

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>("");
  const [success, setSuccess] = useState<string>("");

  // System Settings
  const [systemSettings, setSystemSettings] = useState<{
    [key: string]: string;
  }>({});
  const [settingsForm, setSettingsForm] = useState({
    ai_appointment_required: "true",
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadCounselors(),
        loadAvailabilities(),
        loadAppointments(),
        loadSystemSettings(),
      ]);
    } catch (error) {
      console.error("加载数据错误:", error);
      setError("加载数据失败，请刷新页面重试");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const adminData = sessionStorage.getItem("admin_user");
    if (!adminData) {
      navigate("/admin");
      return;
    }
    setAdminUser(JSON.parse(adminData));
    loadData();
  }, [navigate, loadData]);

  const loadCounselors = async () => {
    const { data, error } = await supabase
      .from("counselors")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("加载咨询师错误:", error);
      throw error;
    }
    setCounselors(data || []);
  };

  const loadAvailabilities = async () => {
    const { data, error } = await supabase
      .from("counselor_availability")
      .select("*")
      .order("availability_date", { ascending: true })
      .order("start_time", { ascending: true });

    if (error) {
      console.error("加载可用时间错误:", error);
      throw error;
    }

    // 获取咨询师信息
    const availabilitiesWithCounselors = await Promise.all(
      (data || []).map(async (availability) => {
        const { data: counselorData } = await supabase
          .from("counselors")
          .select("*")
          .eq("id", availability.counselor_id)
          .maybeSingle();

        return {
          ...availability,
          counselor: counselorData,
        };
      })
    );

    setAvailabilities(availabilitiesWithCounselors);
  };

  const loadAppointments = async () => {
    const { data, error } = await supabase
      .from("appointments")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("加载预约错误:", error);
      throw error;
    }
    setAppointments(data || []);
  };

  const loadSystemSettings = async () => {
    try {
      const { data, error } = await supabase
        .from("system_settings")
        .select("*");

      if (error) {
        console.error("加载系统设置错误:", error);
        return;
      }

      const settings: { [key: string]: string } = {};
      data?.forEach((setting) => {
        settings[setting.setting_key] = setting.setting_value;
      });

      setSystemSettings(settings);
      setSettingsForm({
        ai_appointment_required: settings.ai_appointment_required || "true",
      });
    } catch (error) {
      console.error("加载系统设置错误:", error);
    }
  };

  // 移除 meeting_links 表的依赖，直接使用 appointments 表的 meeting_link 字段

  const handleLogout = () => {
    sessionStorage.removeItem("admin_user");
    navigate("/admin");
  };

  // Counselor Management Functions
  const handleSaveCounselor = async () => {
    if (
      !counselorForm.name.trim() ||
      !counselorForm.title.trim() ||
      !counselorForm.speciality.trim()
    ) {
      setError("请填写完整的咨询师信息");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      if (editingCounselor) {
        // Update existing counselor
        const { error } = await supabase
          .from("counselors")
          .update({
            ...counselorForm,
            updated_at: new Date().toISOString(),
          })
          .eq("id", editingCounselor.id);

        if (error) throw error;
        setSuccess("咨询师信息更新成功");
      } else {
        // Add new counselor
        const { error } = await supabase.from("counselors").insert([
          {
            ...counselorForm,
            available: true,
          },
        ]);

        if (error) throw error;
        setSuccess("咨询师添加成功");
      }

      // Reset form
      setCounselorForm({
        name: "",
        title: "",
        speciality: "",
        experience: "",
        bio: "",
        photo_url: "",
      });
      setShowAddCounselor(false);
      setEditingCounselor(null);
      await loadCounselors();
    } catch (error: any) {
      setError(error.message || "操作失败，请稍后重试");
    } finally {
      setSubmitting(false);
    }
  };

  // Availability Management Functions
  const handleAddAvailability = async () => {
    if (
      !availabilityForm.availability_date ||
      !availabilityForm.start_time ||
      !availabilityForm.end_time
    ) {
      setError("请填写完整的时间段信息");
      return;
    }

    if (
      availabilityForm.counselor_type === "human" &&
      !availabilityForm.counselor_id
    ) {
      setError("请选择咨询师");
      return;
    }

    if (
      availabilityForm.counselor_type === "ai" &&
      !availabilityForm.ai_model
    ) {
      setError("请选择AI模型");
      return;
    }

    if (availabilityForm.start_time >= availabilityForm.end_time) {
      setError("结束时间必须晚于开始时间");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      // 使用默认管理员UUID
      const adminUUID = "00000000-0000-0000-0000-000000000001";

      const { error } = await supabase.from("counselor_availability").insert([
        {
          counselor_id:
            availabilityForm.counselor_type === "ai"
              ? availabilityForm.ai_model === "doubao"
                ? "00000000-0000-0000-0000-000000000001"
                : availabilityForm.ai_model === "peppy"
                ? "00000000-0000-0000-0000-000000000002"
                : availabilityForm.counselor_id
              : availabilityForm.counselor_id,
          counselor_type: availabilityForm.counselor_type,
          ai_model:
            availabilityForm.counselor_type === "ai"
              ? availabilityForm.ai_model
              : null,
          availability_date: availabilityForm.availability_date,
          start_time: availabilityForm.start_time,
          end_time: availabilityForm.end_time,
          notes: availabilityForm.notes,
          created_by: adminUUID,
        },
      ]);

      if (error) throw error;

      setSuccess("可用时间添加成功");
      setAvailabilityForm({
        counselor_id: "",
        counselor_type: "human",
        ai_model: "",
        availability_date: "",
        start_time: "",
        end_time: "",
        notes: "",
      });
      setShowAddAvailability(false);
      await loadAvailabilities();
    } catch (error: any) {
      console.error("添加可用时间错误:", error);
      setError(error.message || "添加失败，请稍后重试");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteAvailability = async (id: string) => {
    if (!confirm("确定要删除这个时间段吗？")) {
      return;
    }

    try {
      const { error } = await supabase
        .from("counselor_availability")
        .delete()
        .eq("id", id);

      if (error) throw error;

      setSuccess("时间段删除成功");
      await loadAvailabilities();
    } catch (error: any) {
      setError(error.message || "删除失败，请稍后重试");
    }
  };

  // Meeting Link Management Functions
  const handleAddMeetingLink = async () => {
    if (!selectedAppointment || !meetingLinkForm.meeting_url.trim()) {
      setError("请选择预约并填写会议链接");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      // 构建完整的会议信息
      let meetingInfo = meetingLinkForm.meeting_url.trim();

      if (meetingLinkForm.meeting_id.trim()) {
        meetingInfo += `\n会议ID: ${meetingLinkForm.meeting_id.trim()}`;
      }

      if (meetingLinkForm.meeting_password.trim()) {
        meetingInfo += `\n会议密码: ${meetingLinkForm.meeting_password.trim()}`;
      }

      if (meetingLinkForm.additional_info.trim()) {
        meetingInfo += `\n其他信息: ${meetingLinkForm.additional_info.trim()}`;
      }

      // 调用邮件发送Edge Function
      const { data, error } = await supabase.functions.invoke(
        "send-meeting-notification",
        {
          body: {
            appointmentId: selectedAppointment.id,
            meetingLink: meetingLinkForm.meeting_url.trim(),
            adminNote: meetingLinkForm.additional_info.trim() || undefined,
          },
        }
      );

      if (error) throw error;
      if (data?.error) throw new Error(data.error.message);

      setSuccess("会议链接添加成功，已发送邮件通知用户");
      setMeetingLinkForm({
        meeting_platform: "Zoom",
        meeting_url: "",
        meeting_id: "",
        meeting_password: "",
        additional_info: "",
      });
      setShowMeetingLinkModal(false);
      setSelectedAppointment(null);
      await loadAppointments();
    } catch (error: any) {
      console.error("添加会议链接错误:", error);
      setError(error.message || "添加失败，请稍后重试");
    } finally {
      setSubmitting(false);
    }
  };

  // Batch Availability Management Functions
  const handleBatchAvailability = async () => {
    if (!batchForm.counselor_id || !batchForm.template_type) {
      setError("请选择咨询师和模板类型");
      return;
    }

    if (batchForm.template_type === "weekly") {
      if (!batchForm.date_range.start_date || !batchForm.date_range.end_date) {
        setError("请选择日期范围");
        return;
      }
      if (batchForm.time_slots.length === 0) {
        setError("请添加时间段");
        return;
      }
    }

    setSubmitting(true);
    setError("");

    try {
      const { data: sessionData } = await supabase.auth.getSession();

      const { data, error } = await supabase.functions.invoke(
        "batch-availability",
        {
          body: batchForm,
          headers: {
            Authorization: `Bearer ${sessionData.session?.access_token}`,
          },
        }
      );

      if (error) throw error;
      if (data?.error) throw new Error(data.error.message);

      setSuccess(data?.data?.message || "批量设置成功");
      setShowBatchAvailability(false);
      await loadAvailabilities();
    } catch (error: any) {
      console.error("批量设置错误:", error);
      setError(error.message || "批量设置失败，请稍后重试");
    } finally {
      setSubmitting(false);
    }
  };

  const addTimeSlot = () => {
    setBatchForm((prev) => ({
      ...prev,
      time_slots: [
        ...prev.time_slots,
        {
          days_of_week: [1, 2, 3, 4, 5],
          start_time: "09:00",
          end_time: "10:00",
          notes: "",
        },
      ],
    }));
  };

  const removeTimeSlot = (index: number) => {
    setBatchForm((prev) => ({
      ...prev,
      time_slots: prev.time_slots.filter((_, i) => i !== index),
    }));
  };

  const updateTimeSlot = (index: number, field: string, value: any) => {
    setBatchForm((prev) => ({
      ...prev,
      time_slots: prev.time_slots.map((slot, i) =>
        i === index ? { ...slot, [field]: value } : slot
      ),
    }));
  };

  const getDayName = (dayIndex: number) => {
    const days = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
    return days[dayIndex];
  };

  // System Settings Functions
  const handleSaveSettings = async () => {
    // 防止重复提交
    if (submitting) {
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      // 更新每个设置
      for (const [key, value] of Object.entries(settingsForm)) {
        // 使用 upsert 并指定正确的冲突解决策略
        const { error } = await supabase.from("system_settings").upsert(
          {
            setting_key: key,
            setting_value: value,
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: "setting_key",
            ignoreDuplicates: false,
          }
        );

        if (error) {
          console.error("保存设置错误:", error);
          throw error;
        }
      }

      setSuccess("系统设置保存成功");
      await loadSystemSettings();
    } catch (error: any) {
      console.error("保存设置失败:", error);
      setError(error.message || "保存失败，请稍后重试");
    } finally {
      setSubmitting(false);
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
    return timeStr.substring(0, 5);
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
      pending: "text-yellow-600 bg-yellow-50 border-yellow-200",
      confirmed: "text-green-600 bg-green-50 border-green-200",
      completed: "text-blue-600 bg-blue-50 border-blue-200",
      cancelled: "text-red-600 bg-red-50 border-red-200",
    };
    return (
      colorMap[status as keyof typeof colorMap] ||
      "text-gray-600 bg-gray-50 border-gray-200"
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">加载中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-4">
              <h1 className="text-2xl font-bold text-gray-900">管理员控制台</h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">
                欢迎，{adminUser?.name || adminUser?.email}
              </span>
              <button
                onClick={handleLogout}
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
              {[
                { id: "counselors", name: "咨询师管理" },
                { id: "availability", name: "时间管理" },
                { id: "appointments", name: "预约管理" },
                { id: "meetings", name: "会议链接" },
                { id: "settings", name: "系统设置" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                    activeTab === tab.id
                      ? "border-blue-500 text-blue-600"
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                  }`}
                >
                  {tab.name}
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* Error/Success Messages */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-800 text-sm">{error}</p>
            <button
              onClick={() => setError("")}
              className="mt-2 text-red-600 hover:text-red-700 text-sm underline"
            >
              关闭
            </button>
          </div>
        )}

        {success && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-green-800 text-sm">{success}</p>
            <button
              onClick={() => setSuccess("")}
              className="mt-2 text-green-600 hover:text-green-700 text-sm underline"
            >
              关闭
            </button>
          </div>
        )}

        {/* Content */}
        {activeTab === "counselors" && (
          <div className="bg-white rounded-lg shadow-sm border">
            <div className="p-6 border-b border-gray-200">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold text-gray-900">
                  咨询师管理
                </h2>
                <button
                  onClick={() => {
                    setShowAddCounselor(true);
                    setEditingCounselor(null);
                    setCounselorForm({
                      name: "",
                      title: "",
                      speciality: "",
                      experience: "",
                      bio: "",
                      photo_url: "",
                    });
                  }}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  添加咨询师
                </button>
              </div>
            </div>

            {counselors.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500">暂无咨询师</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {counselors.map((counselor) => (
                  <div key={counselor.id} className="p-6 hover:bg-gray-50">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <h3 className="font-semibold text-lg text-gray-900">
                            {counselor.name}
                          </h3>
                          <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
                            {counselor.title}
                          </span>
                          <span
                            className={`px-2 py-1 text-xs font-medium rounded-full ${
                              counselor.available
                                ? "bg-green-100 text-green-800"
                                : "bg-red-100 text-red-800"
                            }`}
                          >
                            {counselor.available ? "可用" : "不可用"}
                          </span>
                        </div>

                        <div className="space-y-1 text-sm text-gray-600">
                          <p>专长：{counselor.speciality}</p>
                          <p>经验：{counselor.experience}</p>
                          <p>评分：{counselor.rating}/5.0</p>
                          {counselor.bio && <p>简介：{counselor.bio}</p>}
                        </div>
                      </div>

                      <div className="flex space-x-2">
                        <button
                          onClick={() => {
                            setEditingCounselor(counselor);
                            setCounselorForm({
                              name: counselor.name,
                              title: counselor.title,
                              speciality: counselor.speciality,
                              experience: counselor.experience,
                              bio: counselor.bio || "",
                              photo_url: counselor.photo_url || "",
                            });
                            setShowAddCounselor(true);
                          }}
                          className="px-3 py-1 text-xs font-medium text-blue-600 hover:text-blue-700 border border-blue-200 rounded hover:bg-blue-50 transition-colors"
                        >
                          编辑
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Add/Edit Counselor Modal */}
            {showAddCounselor && (
              <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
                <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
                  <div className="mt-3">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">
                      {editingCounselor ? "编辑咨询师" : "添加咨询师"}
                    </h3>

                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          姓名 *
                        </label>
                        <input
                          type="text"
                          value={counselorForm.name}
                          onChange={(e) =>
                            setCounselorForm((prev) => ({
                              ...prev,
                              name: e.target.value,
                            }))
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="请输入咨询师姓名"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          职称 *
                        </label>
                        <input
                          type="text"
                          value={counselorForm.title}
                          onChange={(e) =>
                            setCounselorForm((prev) => ({
                              ...prev,
                              title: e.target.value,
                            }))
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="如：高级心理咨询师"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          专业领域 *
                        </label>
                        <input
                          type="text"
                          value={counselorForm.speciality}
                          onChange={(e) =>
                            setCounselorForm((prev) => ({
                              ...prev,
                              speciality: e.target.value,
                            }))
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="如：焦虑症、抑郁症治疗"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          从业经验
                        </label>
                        <input
                          type="text"
                          value={counselorForm.experience}
                          onChange={(e) =>
                            setCounselorForm((prev) => ({
                              ...prev,
                              experience: e.target.value,
                            }))
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="如：8年临床经验"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          个人简介
                        </label>
                        <textarea
                          value={counselorForm.bio}
                          onChange={(e) =>
                            setCounselorForm((prev) => ({
                              ...prev,
                              bio: e.target.value,
                            }))
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="简要介绍咨询师的专业背景和特长"
                          rows={3}
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          头像链接
                        </label>
                        <input
                          type="url"
                          value={counselorForm.photo_url}
                          onChange={(e) =>
                            setCounselorForm((prev) => ({
                              ...prev,
                              photo_url: e.target.value,
                            }))
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="头像图片链接（可选）"
                        />
                      </div>
                    </div>

                    <div className="flex justify-end space-x-3 mt-6">
                      <button
                        onClick={() => {
                          setShowAddCounselor(false);
                          setEditingCounselor(null);
                          setCounselorForm({
                            name: "",
                            title: "",
                            speciality: "",
                            experience: "",
                            bio: "",
                            photo_url: "",
                          });
                        }}
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        取消
                      </button>
                      <button
                        onClick={handleSaveCounselor}
                        disabled={submitting}
                        className={`px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors ${
                          submitting
                            ? "bg-gray-400 cursor-not-allowed"
                            : "bg-blue-600 hover:bg-blue-700"
                        }`}
                      >
                        {submitting ? "保存中..." : "保存"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === "availability" && (
          <div className="bg-white rounded-lg shadow-sm border">
            <div className="p-6 border-b border-gray-200">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold text-gray-900">
                  时间管理
                </h2>
                <div className="flex space-x-3">
                  <button
                    onClick={() => {
                      setShowBatchAvailability(true);
                      setBatchForm({
                        counselor_id: "",
                        counselor_type: "human",
                        ai_model: "",
                        template_type: "weekly",
                        date_range: {
                          start_date: "",
                          end_date: "",
                        },
                        time_slots: [
                          {
                            days_of_week: [1, 2, 3, 4, 5],
                            start_time: "09:00",
                            end_time: "10:00",
                            notes: "",
                          },
                        ],
                        specific_dates: [],
                      });
                    }}
                    className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors"
                  >
                    批量设置
                  </button>
                  <button
                    onClick={() => {
                      setShowAddAvailability(true);
                      setAvailabilityForm({
                        counselor_id: "",
                        counselor_type: "human",
                        ai_model: "",
                        availability_date: "",
                        start_time: "",
                        end_time: "",
                        notes: "",
                      });
                    }}
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    添加可用时间
                  </button>
                </div>
              </div>
            </div>

            {availabilities.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500">暂无可用时间设置</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {availabilities.map((availability) => (
                  <div key={availability.id} className="p-6 hover:bg-gray-50">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <h3 className="font-semibold text-lg text-gray-900">
                            {availability.counselor?.name || "未知咨询师"}
                          </h3>
                          <span
                            className={`px-2 py-1 text-xs font-medium rounded-full ${
                              availability.is_booked
                                ? "bg-red-100 text-red-800"
                                : "bg-green-100 text-green-800"
                            }`}
                          >
                            {availability.is_booked ? "已预约" : "可预约"}
                          </span>
                        </div>

                        <div className="space-y-1 text-sm text-gray-600">
                          <p>
                            日期：{formatDate(availability.availability_date)}
                          </p>
                          <p>
                            时间：{formatTime(availability.start_time)} -{" "}
                            {formatTime(availability.end_time)}
                          </p>
                          {availability.notes && (
                            <p>备注：{availability.notes}</p>
                          )}
                        </div>
                      </div>

                      <div className="flex space-x-2">
                        {!availability.is_booked && (
                          <button
                            onClick={() =>
                              handleDeleteAvailability(availability.id)
                            }
                            className="px-3 py-1 text-xs font-medium text-red-600 hover:text-red-700 border border-red-200 rounded hover:bg-red-50 transition-colors"
                          >
                            删除
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Add Availability Modal */}
            {showAddAvailability && (
              <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
                <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
                  <div className="mt-3">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">
                      添加可用时间
                    </h3>

                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          服务类型 *
                        </label>
                        <select
                          value={availabilityForm.counselor_type}
                          onChange={(e) => {
                            setAvailabilityForm((prev) => ({
                              ...prev,
                              counselor_type: e.target.value,
                            }));
                          }}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                          <option value="human">人类咨询师</option>
                          {settingsForm.ai_appointment_required === "true" && (
                            <option value="ai">AI服务</option>
                          )}
                        </select>
                      </div>

                      {availabilityForm.counselor_type === "human" && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            咨询师 *
                          </label>
                          <select
                            value={availabilityForm.counselor_id}
                            onChange={(e) =>
                              setAvailabilityForm((prev) => ({
                                ...prev,
                                counselor_id: e.target.value,
                              }))
                            }
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          >
                            <option value="">请选择咨询师</option>
                            {counselors
                              .filter(
                                (c) =>
                                  c.available &&
                                  ![
                                    "00000000-0000-0000-0000-000000000002",
                                    "00000000-0000-0000-0000-000000000001",
                                  ].includes(c.id)
                              )
                              .map((counselor) => (
                                <option key={counselor.id} value={counselor.id}>
                                  {counselor.name} - {counselor.title}
                                </option>
                              ))}
                          </select>
                        </div>
                      )}

                      {availabilityForm.counselor_type === "ai" && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            AI模型 *
                          </label>
                          <select
                            value={availabilityForm.ai_model}
                            onChange={(e) =>
                              setAvailabilityForm((prev) => ({
                                ...prev,
                                ai_model: e.target.value,
                              }))
                            }
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          >
                            <option value="">请选择AI模型</option>
                            {counselors
                              .filter(
                                (c) =>
                                  c.available &&
                                  [
                                    "00000000-0000-0000-0000-000000000002",
                                    "00000000-0000-0000-0000-000000000001",
                                  ].includes(c.id)
                              )
                              .map((counselor) => (
                                <option
                                  key={counselor.id}
                                  value={
                                    counselor.id ===
                                    "00000000-0000-0000-0000-000000000002"
                                      ? "peppy"
                                      : "doubao"
                                  }
                                >
                                  {counselor.name} - {counselor.title}
                                </option>
                              ))}
                          </select>
                        </div>
                      )}

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          日期 *
                        </label>
                        <input
                          type="date"
                          value={availabilityForm.availability_date}
                          onChange={(e) =>
                            setAvailabilityForm((prev) => ({
                              ...prev,
                              availability_date: e.target.value,
                            }))
                          }
                          min={new Date().toISOString().split("T")[0]}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            开始时间 *
                          </label>
                          <input
                            type="time"
                            value={availabilityForm.start_time}
                            onChange={(e) =>
                              setAvailabilityForm((prev) => ({
                                ...prev,
                                start_time: e.target.value,
                              }))
                            }
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            结束时间 *
                          </label>
                          <input
                            type="time"
                            value={availabilityForm.end_time}
                            onChange={(e) =>
                              setAvailabilityForm((prev) => ({
                                ...prev,
                                end_time: e.target.value,
                              }))
                            }
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          备注
                        </label>
                        <textarea
                          value={availabilityForm.notes}
                          onChange={(e) =>
                            setAvailabilityForm((prev) => ({
                              ...prev,
                              notes: e.target.value,
                            }))
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="可选的备注信息"
                          rows={2}
                        />
                      </div>
                    </div>

                    <div className="flex justify-end space-x-3 mt-6">
                      <button
                        onClick={() => {
                          setShowAddAvailability(false);
                          setAvailabilityForm({
                            counselor_id: "",
                            counselor_type: "human",
                            ai_model: "",
                            availability_date: "",
                            start_time: "",
                            end_time: "",
                            notes: "",
                          });
                        }}
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        取消
                      </button>
                      <button
                        onClick={handleAddAvailability}
                        disabled={submitting}
                        className={`px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors ${
                          submitting
                            ? "bg-gray-400 cursor-not-allowed"
                            : "bg-blue-600 hover:bg-blue-700"
                        }`}
                      >
                        {submitting ? "添加中..." : "添加"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === "appointments" && (
          <div className="bg-white rounded-lg shadow-sm border">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">预约管理</h2>
            </div>

            {appointments.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500">暂无预约记录</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {appointments.map((appointment) => {
                  return (
                    <div key={appointment.id} className="p-6 hover:bg-gray-50">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center space-x-3 mb-2">
                            <h3 className="font-semibold text-lg text-gray-900">
                              {appointment.topic}
                            </h3>
                            <span
                              className={`px-2 py-1 text-xs font-medium rounded-full border ${getStatusColor(
                                appointment.status
                              )}`}
                            >
                              {getStatusText(appointment.status)}
                            </span>
                            {appointment.meeting_link && (
                              <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
                                已设会议链接
                              </span>
                            )}
                          </div>

                          <div className="space-y-1 text-sm text-gray-600">
                            <p>
                              时间：{formatDate(appointment.appointment_date)}{" "}
                              {formatTime(appointment.start_time)} -{" "}
                              {formatTime(appointment.end_time)}
                            </p>
                            <p>用户邮箱：{appointment.user_email}</p>
                            <p>紧急程度：{appointment.urgency}</p>
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

                        <div className="flex space-x-2">
                          {appointment.status === "confirmed" &&
                            !appointment.meeting_link && (
                              <button
                                onClick={() => {
                                  setSelectedAppointment(appointment);
                                  setShowMeetingLinkModal(true);
                                  setMeetingLinkForm({
                                    meeting_platform: "Zoom",
                                    meeting_url: "",
                                    meeting_id: "",
                                    meeting_password: "",
                                    additional_info: "",
                                  });
                                }}
                                className="px-3 py-1 text-xs font-medium text-blue-600 hover:text-blue-700 border border-blue-200 rounded hover:bg-blue-50 transition-colors"
                              >
                                设置会议链接
                              </button>
                            )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Meeting Link Modal */}
            {showMeetingLinkModal && selectedAppointment && (
              <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
                <div className="relative top-20 mx-auto p-5 border w-[32rem] shadow-lg rounded-md bg-white">
                  <div className="mt-3">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">
                      设置会议链接
                    </h3>

                    <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                      <h4 className="font-medium text-blue-900">预约信息</h4>
                      <p className="text-sm text-blue-700">
                        主题：{selectedAppointment.topic}
                      </p>
                      <p className="text-sm text-blue-700">
                        时间：{formatDate(selectedAppointment.appointment_date)}{" "}
                        {formatTime(selectedAppointment.start_time)}
                      </p>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          会议平台 *
                        </label>
                        <select
                          value={meetingLinkForm.meeting_platform}
                          onChange={(e) =>
                            setMeetingLinkForm((prev) => ({
                              ...prev,
                              meeting_platform: e.target.value,
                            }))
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                          <option value="Zoom">Zoom</option>
                          <option value="腾讯会议">腾讯会议</option>
                          <option value="钉钉">钉钉</option>
                          <option value="飞书">飞书</option>
                          <option value="其他">其他</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          会议链接 *
                        </label>
                        <input
                          type="url"
                          value={meetingLinkForm.meeting_url}
                          onChange={(e) =>
                            setMeetingLinkForm((prev) => ({
                              ...prev,
                              meeting_url: e.target.value,
                            }))
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="请输入完整的会议链接"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          会议ID
                        </label>
                        <input
                          type="text"
                          value={meetingLinkForm.meeting_id}
                          onChange={(e) =>
                            setMeetingLinkForm((prev) => ({
                              ...prev,
                              meeting_id: e.target.value,
                            }))
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="会议ID（如有）"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          会议密码
                        </label>
                        <input
                          type="text"
                          value={meetingLinkForm.meeting_password}
                          onChange={(e) =>
                            setMeetingLinkForm((prev) => ({
                              ...prev,
                              meeting_password: e.target.value,
                            }))
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="会议密码（如有）"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          其他信息
                        </label>
                        <textarea
                          value={meetingLinkForm.additional_info}
                          onChange={(e) =>
                            setMeetingLinkForm((prev) => ({
                              ...prev,
                              additional_info: e.target.value,
                            }))
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="其他需要告知用户的信息"
                          rows={3}
                        />
                      </div>
                    </div>

                    <div className="flex justify-end space-x-3 mt-6">
                      <button
                        onClick={() => {
                          setShowMeetingLinkModal(false);
                          setSelectedAppointment(null);
                          setMeetingLinkForm({
                            meeting_platform: "Zoom",
                            meeting_url: "",
                            meeting_id: "",
                            meeting_password: "",
                            additional_info: "",
                          });
                        }}
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        取消
                      </button>
                      <button
                        onClick={handleAddMeetingLink}
                        disabled={submitting}
                        className={`px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors ${
                          submitting
                            ? "bg-gray-400 cursor-not-allowed"
                            : "bg-blue-600 hover:bg-blue-700"
                        }`}
                      >
                        {submitting ? "设置中..." : "设置会议链接"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === "meetings" && (
          <div className="bg-white rounded-lg shadow-sm border">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">
                会议链接管理
              </h2>
              <p className="text-sm text-gray-600 mt-2">
                查看已设置会议链接的预约
              </p>
            </div>

            {appointments.filter((a) => a.meeting_link).length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500">暂无设置会议链接的预约</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {appointments
                  .filter((a) => a.meeting_link)
                  .map((appointment) => {
                    return (
                      <div
                        key={appointment.id}
                        className="p-6 hover:bg-gray-50"
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="flex items-center space-x-3 mb-2">
                              <h3 className="font-semibold text-lg text-gray-900">
                                {appointment.topic}
                              </h3>
                              <span
                                className={`px-2 py-1 text-xs font-medium rounded-full border ${getStatusColor(
                                  appointment.status
                                )}`}
                              >
                                {getStatusText(appointment.status)}
                              </span>
                              <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">
                                已设置会议链接
                              </span>
                            </div>

                            <div className="space-y-1 text-sm text-gray-600 mb-3">
                              <p>
                                时间：{formatDate(appointment.appointment_date)}{" "}
                                {formatTime(appointment.start_time)} -{" "}
                                {formatTime(appointment.end_time)}
                              </p>
                              <p>用户邮箱：{appointment.user_email}</p>
                              <p>
                                会议链接：
                                <a
                                  href={appointment.meeting_link}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-600 hover:text-blue-800 underline"
                                >
                                  {appointment.meeting_link}
                                </a>
                              </p>
                            </div>

                            {appointment.description && (
                              <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                                <p className="text-sm text-gray-700">
                                  <span className="font-medium">
                                    预约描述：
                                  </span>
                                  {appointment.description}
                                </p>
                              </div>
                            )}
                          </div>

                          <div className="flex space-x-2">
                            <button
                              onClick={() => {
                                setSelectedAppointment(appointment);
                                setShowMeetingLinkModal(true);
                                setMeetingLinkForm({
                                  meeting_platform: "Zoom",
                                  meeting_url: appointment.meeting_link || "",
                                  meeting_id: "",
                                  meeting_password: "",
                                  additional_info: "",
                                });
                              }}
                              className="px-3 py-1 text-xs font-medium text-orange-600 hover:text-orange-700 border border-orange-200 rounded hover:bg-orange-50 transition-colors"
                            >
                              更新链接
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        )}

        {activeTab === "settings" && (
          <div className="bg-white rounded-lg shadow-sm border">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">系统设置</h2>
              <p className="text-sm text-gray-600 mt-2">管理系统全局设置</p>
            </div>

            <div className="p-6">
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    AI服务预约模式
                  </label>
                  <select
                    value={settingsForm.ai_appointment_required}
                    onChange={(e) =>
                      setSettingsForm((prev) => ({
                        ...prev,
                        ai_appointment_required: e.target.value,
                      }))
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="true">AI服务需要预约</option>
                    <option value="false">AI服务直接访问</option>
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    控制AI服务是否需要预约时间段
                  </p>
                </div>

                <div className="flex justify-end">
                  <button
                    onClick={handleSaveSettings}
                    disabled={submitting}
                    className={`px-6 py-2 text-sm font-medium text-white rounded-lg transition-colors ${
                      submitting
                        ? "bg-gray-400 cursor-not-allowed"
                        : "bg-blue-600 hover:bg-blue-700"
                    }`}
                  >
                    {submitting ? "保存中..." : "保存设置"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
