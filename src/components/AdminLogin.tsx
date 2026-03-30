import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";

export default function AdminLogin() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setError("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.email || !formData.password) {
      setError(t("adminLogin.errors.required"));
      return;
    }

    setLoading(true);
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: formData.email,
        password: formData.password,
      });

      if (signInError) {
        setError(t("adminLogin.errors.invalid"));
        return;
      }

      const { error: adminCheckError } = await supabase.functions.invoke(
        "admin-users",
        { body: { page: 1, pageSize: 1 } }
      );

      if (adminCheckError) {
        await supabase.auth.signOut();
        setError(t("adminLogin.errors.unauthorized"));
        return;
      }

      navigate("/admin/dashboard");
    } catch (error) {
      console.error("Admin login failed:", error);
      setError(t("adminLogin.errors.failed"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
          {t("adminLogin.title")}
        </h2>
        <p className="mt-2 text-sm text-gray-600">{t("adminLogin.subtitle")}</p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <form className="space-y-6" onSubmit={handleSubmit}>
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                {t("adminLogin.email")}
              </label>
              <div className="mt-1">
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={formData.email}
                  onChange={handleInputChange}
                  className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder={t("adminLogin.emailPlaceholder")}
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                {t("adminLogin.password")}
              </label>
              <div className="mt-1">
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={formData.password}
                  onChange={handleInputChange}
                  className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder={t("adminLogin.passwordPlaceholder")}
                />
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center py-2 px-4 rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? t("adminLogin.submitting") : t("adminLogin.submit")}
              </button>
            </div>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={() => navigate("/dashboard")}
              className="text-sm text-indigo-600 hover:text-indigo-500"
            >
              {t("adminLogin.backToUser")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
