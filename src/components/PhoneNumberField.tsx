import * as Popover from "@radix-ui/react-popover";
import { Command } from "cmdk";
import { Check, ChevronDown, Search } from "lucide-react";
import { useMemo, useState } from "react";
import {
  defaultCountries,
  parseCountry,
  type CountryIso2,
  usePhoneInput,
} from "react-international-phone";
import { useTranslation } from "react-i18next";
import { sanitizePhoneInput } from "@/lib/phone";
import { cn } from "@/lib/utils";

interface PhoneNumberFieldProps {
  disabled?: boolean;
  error?: string;
  id: string;
  name?: string;
  onChange: (value: string) => void;
  placeholder: string;
  value: string;
}

const DEFAULT_COUNTRY: CountryIso2 = "cn";
const PREFERRED_COUNTRIES: CountryIso2[] = [
  "cn",
  "us",
  "gb",
  "ca",
  "au",
  "sg",
  "jp",
];

function toPhoneInputValue(value: string) {
  const compact = sanitizePhoneInput(value);
  if (!compact) return "";

  const mainlandMatch = compact.match(/^(?:\+?86)?(1[3-9]\d{9})$/);
  if (mainlandMatch) {
    return `+86${mainlandMatch[1]}`;
  }

  if (compact.startsWith("+")) {
    return compact;
  }

  return `+${compact}`;
}

function getFlagEmoji(iso2?: string) {
  if (!iso2 || iso2.length !== 2) return "GL";

  return iso2
    .toUpperCase()
    .replace(/./g, (char) => String.fromCodePoint(127397 + char.charCodeAt(0)));
}

export default function PhoneNumberField({
  disabled,
  error,
  id,
  name,
  onChange,
  placeholder,
  value,
}: PhoneNumberFieldProps) {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const phoneValue = useMemo(() => toPhoneInputValue(value), [value]);

  const displayNames = useMemo(() => {
    const DisplayNamesCtor = (Intl as any)?.DisplayNames;
    if (!DisplayNamesCtor) return null;

    return new DisplayNamesCtor([i18n.resolvedLanguage || i18n.language || "en"], {
      type: "region",
    });
  }, [i18n.language, i18n.resolvedLanguage]);

  const countries = useMemo(() => {
    const preferredSet = new Set(PREFERRED_COUNTRIES);
    const parsedCountries = defaultCountries.map((country) => {
      const parsedCountry = parseCountry(country);
      let localizedName = parsedCountry.name;

      try {
        localizedName =
          displayNames?.of(parsedCountry.iso2.toUpperCase()) || parsedCountry.name;
      } catch {
        localizedName = parsedCountry.name;
      }

      return {
        ...parsedCountry,
        localizedName,
        searchValue: [
          localizedName,
          parsedCountry.name,
          parsedCountry.iso2.toUpperCase(),
          `+${parsedCountry.dialCode}`,
          parsedCountry.dialCode,
        ]
          .join(" ")
          .toLowerCase(),
      };
    });

    return parsedCountries.sort((left, right) => {
      const leftPreferred = preferredSet.has(left.iso2);
      const rightPreferred = preferredSet.has(right.iso2);

      if (leftPreferred && rightPreferred) {
        return (
          PREFERRED_COUNTRIES.indexOf(left.iso2) -
          PREFERRED_COUNTRIES.indexOf(right.iso2)
        );
      }

      if (leftPreferred) return -1;
      if (rightPreferred) return 1;
      return left.localizedName.localeCompare(right.localizedName);
    });
  }, [displayNames]);

  const filteredCountries = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return countries;

    return countries.filter((country) => country.searchValue.includes(normalizedQuery));
  }, [countries, query]);

  const { country, inputRef, inputValue, setCountry, handlePhoneValueChange } =
    usePhoneInput({
      defaultCountry: DEFAULT_COUNTRY,
      value: phoneValue,
      countries: defaultCountries,
      disableDialCodeAndPrefix: true,
      disableFormatting: true,
      forceDialCode: true,
      onChange: ({ phone, inputValue: nextInputValue }) => {
        onChange(nextInputValue.trim() ? phone : "");
      },
    });

  const selectedCountry =
    countries.find((item) => item.iso2 === country.iso2) || countries[0];

  return (
    <div
      className={cn(
        "flex overflow-hidden rounded-md border bg-white shadow-sm transition-colors",
        "focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500",
        error ? "border-red-300 bg-red-50/40 focus-within:ring-red-500" : "border-gray-300"
      )}
    >
      <Popover.Root
        open={open}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen);
          if (!nextOpen) {
            setQuery("");
          }
        }}
      >
        <Popover.Trigger asChild>
          <button
            type="button"
            disabled={disabled}
            className={cn(
              "flex min-w-[92px] shrink-0 items-center gap-2 border-r bg-slate-50 px-3 py-2 text-left transition-colors",
              disabled
                ? "cursor-not-allowed border-slate-200 text-slate-400"
                : "border-slate-200 text-slate-700 hover:bg-slate-100"
            )}
            aria-label={t("phoneField.countryAriaLabel")}
          >
            <span className="text-base leading-none">
              {getFlagEmoji(selectedCountry?.iso2)}
            </span>
            <span className="text-sm font-semibold">+{selectedCountry?.dialCode}</span>
            <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
          </button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            align="start"
            sideOffset={8}
            className="z-[90] w-[min(360px,calc(100vw-2rem))] rounded-2xl border border-slate-200 bg-white p-0 shadow-2xl outline-none"
          >
            <Command shouldFilter={false} className="overflow-hidden rounded-2xl">
              <div className="flex items-center gap-2 border-b border-slate-200 px-3 py-3">
                <Search className="h-4 w-4 text-slate-400" />
                <Command.Input
                  value={query}
                  onValueChange={setQuery}
                  placeholder={t("phoneField.searchPlaceholder")}
                  className="h-8 w-full border-none bg-transparent text-sm outline-none placeholder:text-slate-400"
                />
              </div>
              <p className="border-b border-slate-100 px-3 py-2 text-[11px] text-slate-500">
                {t("phoneField.searchHint")}
              </p>
              <Command.List className="max-h-80 overflow-y-auto p-2">
                {filteredCountries.length === 0 ? (
                  <div className="px-3 py-6 text-center text-sm text-slate-500">
                    {t("phoneField.noResults")}
                  </div>
                ) : (
                  filteredCountries.map((item) => {
                    const isSelected = item.iso2 === selectedCountry?.iso2;

                    return (
                      <Command.Item
                        key={item.iso2}
                        value={`${item.localizedName} +${item.dialCode} ${item.iso2}`}
                        onSelect={() => {
                          setCountry(item.iso2, { focusOnInput: true });
                          setOpen(false);
                          setQuery("");
                        }}
                        className={cn(
                          "flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2 text-sm outline-none",
                          "data-[selected=true]:bg-blue-50 data-[selected=true]:text-blue-700"
                        )}
                      >
                        <span className="text-base leading-none">
                          {getFlagEmoji(item.iso2)}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium text-slate-800">
                            {item.localizedName}
                          </p>
                          <p className="truncate text-xs text-slate-500">
                            {item.name} | {item.iso2.toUpperCase()}
                          </p>
                        </div>
                        <span className="text-sm font-semibold text-slate-500">
                          +{item.dialCode}
                        </span>
                        <Check
                          className={cn(
                            "h-4 w-4 shrink-0",
                            isSelected ? "text-blue-600" : "text-transparent"
                          )}
                        />
                      </Command.Item>
                    );
                  })
                )}
              </Command.List>
            </Command>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>

      <input
        id={id}
        name={name}
        ref={inputRef}
        type="tel"
        inputMode="tel"
        autoComplete="tel-national"
        value={inputValue}
        onChange={handlePhoneValueChange}
        placeholder={placeholder}
        disabled={disabled}
        className={cn(
          "h-11 w-full min-w-0 bg-transparent px-3 text-sm text-slate-900 outline-none placeholder:text-slate-400",
          disabled && "cursor-not-allowed text-slate-400"
        )}
      />
    </div>
  );
}
