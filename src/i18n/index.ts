import i18n from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { initReactI18next } from "react-i18next";
import { resources } from "./resources";
import {
  normalizeLanguage,
  useLanguageStore,
} from "@/store/languageStore";

const savedLanguage =
  typeof window !== "undefined" ? localStorage.getItem("app-language") : null;
const initialLanguage = normalizeLanguage(savedLanguage);

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    lng: initialLanguage,
    fallbackLng: "en",
    interpolation: {
      escapeValue: false,
    },
  });

document.documentElement.lang = initialLanguage;

useLanguageStore.getState().setLanguage(initialLanguage);

useLanguageStore.subscribe((state) => {
  if (i18n.language !== state.language) {
    i18n.changeLanguage(state.language);
  }
});

export default i18n;
