import { useTranslation } from "react-i18next";
import { Language, useLanguageStore } from "@/store/languageStore";

const languages: Language[] = ["zh-CN", "en"];

export default function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { t } = useTranslation();
  const { language, setLanguage } = useLanguageStore();

  return (
    <div
      className={`inline-flex items-center rounded-full border border-slate-200 bg-white/90 p-1 shadow-sm ${
        compact ? "gap-0.5" : ""
      }`}
    >
      <span
        className={`text-xs font-medium text-slate-500 ${
          compact ? "px-1.5" : "px-2"
        }`}
      >
        {t("language.switchLabel")}
      </span>
      {languages.map((item) => {
        const active = item === language;
        return (
          <button
            key={item}
            type="button"
            onClick={() => setLanguage(item)}
            className={`rounded-full text-xs font-medium transition-colors ${
              compact ? "px-2.5 py-1" : "px-3 py-1"
            } ${
              active
                ? "bg-slate-900 text-white"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            {item === "zh-CN" ? t("common.chinese") : t("common.english")}
          </button>
        );
      })}
    </div>
  );
}
