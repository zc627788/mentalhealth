import React, { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../contexts/AuthContext";
import { useUserAppointments } from "../hooks/useQueries";

interface Appointment {
  id: number;
  appointment_date: string;
  start_time: string;
  end_time: string;
  topic: string;
  description: string;
  status: "confirmed" | "cancelled" | "completed";
  urgency: string;
  meeting_link?: string;
  counselor_name: string;
  created_at: string;
}

const urgencyLabelKey: Record<string, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  urgent: "Urgent",
};

export default function MyAppointments() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const { data: appointments = [], isLoading } = useUserAppointments(user?.id || "");
  const [filter, setFilter] = useState<"all" | "upcoming" | "past">("all");

  const locale = i18n.language === "zh-CN" ? "zh-CN" : "en-US";

  const filteredAppointments = useMemo(() => {
    return appointments.filter((appointment: Appointment) => {
      const appointmentDate = new Date(appointment.appointment_date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (filter === "upcoming") {
        return appointmentDate >= today && appointment.status === "confirmed";
      }

      if (filter === "past") {
        return (
          appointmentDate < today ||
          appointment.status === "completed" ||
          appointment.status === "cancelled"
        );
      }

      return true;
    });
  }, [appointments, filter]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "confirmed":
        return "bg-green-100 text-green-800";
      case "cancelled":
        return "bg-red-100 text-red-800";
      case "completed":
        return "bg-blue-100 text-blue-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getStatusText = (status: Appointment["status"]) =>
    t(`myAppointments.status.${status}`);

  const isUpcoming = (appointment: Appointment) => {
    const appointmentDate = new Date(appointment.appointment_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return appointmentDate >= today && appointment.status === "confirmed";
  };

  const copyMeetingLink = async (link: string) => {
    await navigator.clipboard.writeText(link);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-8 py-6">
            <h1 className="text-3xl font-bold text-white">{t("myAppointments.title")}</h1>
            <p className="text-blue-100 mt-2">{t("myAppointments.subtitle")}</p>
          </div>

          <div className="border-b border-gray-200">
            <nav className="flex space-x-8 px-8">
              {[
                { key: "all", label: t("myAppointments.all") },
                { key: "upcoming", label: t("myAppointments.upcoming") },
                { key: "past", label: t("myAppointments.history") },
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setFilter(tab.key as typeof filter)}
                  className={`py-4 px-1 border-b-2 font-medium text-sm ${
                    filter === tab.key
                      ? "border-indigo-500 text-indigo-600"
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          <div className="p-8">
            {isLoading ? (
              <div className="text-center py-10 text-gray-500">{t("common.loading")}</div>
            ) : filteredAppointments.length === 0 ? (
              <div className="text-center py-12">
                <h3 className="mt-2 text-sm font-medium text-gray-900">
                  {filter === "upcoming" && t("myAppointments.emptyUpcoming")}
                  {filter === "past" && t("myAppointments.emptyHistory")}
                  {filter === "all" && t("myAppointments.emptyAll")}
                </h3>
                {filter !== "past" && (
                  <p className="mt-1 text-sm text-gray-500">
                    {t("myAppointments.emptyHint")}
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-6">
                {filteredAppointments.map((appointment: Appointment) => (
                  <div
                    key={appointment.id}
                    className="border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow"
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-semibold text-gray-900">
                            {appointment.topic}
                          </h3>
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(
                              appointment.status
                            )}`}
                          >
                            {getStatusText(appointment.status)}
                          </span>
                          {isUpcoming(appointment) && (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                              {t("myAppointments.upcomingBadge")}
                            </span>
                          )}
                        </div>
                        <p className="text-gray-600 mb-3">{appointment.description}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="font-medium text-gray-700">{t("myAppointments.date")}</span>
                        <p className="text-gray-900">
                          {new Intl.DateTimeFormat(locale, {
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                            weekday: "long",
                          }).format(new Date(appointment.appointment_date))}
                        </p>
                      </div>
                      <div>
                        <span className="font-medium text-gray-700">{t("myAppointments.time")}</span>
                        <p className="text-gray-900">
                          {appointment.start_time.slice(0, 5)} - {appointment.end_time.slice(0, 5)}
                        </p>
                      </div>
                      <div>
                        <span className="font-medium text-gray-700">{t("myAppointments.counselor")}</span>
                        <p className="text-gray-900">{appointment.counselor_name}</p>
                      </div>
                      <div>
                        <span className="font-medium text-gray-700">{t("myAppointments.urgency")}</span>
                        <p className="text-gray-900">
                          {urgencyLabelKey[appointment.urgency] || appointment.urgency}
                        </p>
                      </div>
                    </div>

                    {appointment.meeting_link ? (
                      <div className="mt-4 p-4 bg-green-50 rounded-lg border border-green-200">
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex-1">
                            <h4 className="font-medium text-green-800">
                              {t("myAppointments.meetingReady")}
                            </h4>
                            <p className="text-sm text-green-600 mt-1">
                              {t("myAppointments.meetingReadyHint")}
                            </p>
                            <p className="text-xs text-green-500 mt-2 break-all">
                              <span className="font-medium">
                                {t("myAppointments.meetingLink")}:
                              </span>{" "}
                              {appointment.meeting_link}
                            </p>
                          </div>
                          <div className="flex flex-col space-y-2">
                            <a
                              href={appointment.meeting_link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center px-4 py-2 rounded-md text-sm font-medium text-white bg-green-600 hover:bg-green-700 transition-colors"
                            >
                              {t("myAppointments.joinMeeting")}
                            </a>
                            <button
                              onClick={() => copyMeetingLink(appointment.meeting_link!)}
                              className="inline-flex items-center px-3 py-1 border border-green-300 rounded-md text-xs font-medium text-green-700 bg-green-50 hover:bg-green-100 transition-colors"
                            >
                              {t("myAppointments.copyLink")}
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : appointment.status === "confirmed" ? (
                      <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                        <h4 className="font-medium text-blue-800">
                          {t("myAppointments.meetingPending")}
                        </h4>
                        <p className="text-sm text-blue-600 mt-1">
                          {t("myAppointments.meetingPendingHint")}
                        </p>
                      </div>
                    ) : null}

                    <div className="mt-4 text-xs text-gray-500">
                      {t("myAppointments.createdAt")}:{" "}
                      {new Intl.DateTimeFormat(locale, {
                        year: "numeric",
                        month: "2-digit",
                        day: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      }).format(new Date(appointment.created_at))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="mt-8 text-center">
          <button
            onClick={() => window.history.back()}
            className="inline-flex items-center px-6 py-3 rounded-md text-base font-medium text-indigo-600 bg-white hover:bg-gray-50 shadow-sm"
          >
            {t("myAppointments.backHome")}
          </button>
        </div>
      </div>
    </div>
  );
}
