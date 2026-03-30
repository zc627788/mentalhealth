import { create } from "zustand";

export type Language = "zh-CN" | "en";

interface LanguageState {
  language: Language;
  setLanguage: (language: Language) => void;
}

const normalizeLanguage = (value?: string | null): Language => {
  if (!value) return "zh-CN";
  return value.toLowerCase().startsWith("zh") ? "zh-CN" : "en";
};

export const useLanguageStore = create<LanguageState>((set) => ({
  language: normalizeLanguage(
    typeof window !== "undefined" ? localStorage.getItem("app-language") : null
  ),
  setLanguage: (language) => {
    if (typeof window !== "undefined") {
      localStorage.setItem("app-language", language);
      document.documentElement.lang = language;
    }
    set({ language });
  },
}));

export { normalizeLanguage };
