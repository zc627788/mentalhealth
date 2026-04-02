import { parsePhoneNumberFromString } from "libphonenumber-js/max";

export interface ParsedPhoneInput {
  authEmail: string;
  isDomestic: boolean;
  isValid: boolean;
  normalizedPhone: string | null;
}

const MAINLAND_PHONE_PATTERN = /^1[3-9]\d{9}$/;
const MAINLAND_WITH_COUNTRY_CODE_PATTERN = /^(?:86)?(1[3-9]\d{9})$/;

export function sanitizePhoneInput(value: string) {
  const trimmed = value.trim();
  const hasLeadingPlus = trimmed.startsWith("+");
  const digitsOnly = trimmed.replace(/\D/g, "");

  if (!digitsOnly) {
    return hasLeadingPlus ? "+" : "";
  }

  return hasLeadingPlus ? `+${digitsOnly}` : digitsOnly;
}

function isMainlandChinaMobile(value: string) {
  return MAINLAND_PHONE_PATTERN.test(value);
}

function normalizeFromDomesticDigits(value: string): ParsedPhoneInput {
  return {
    authEmail: `${value}@temp.local`,
    isDomestic: true,
    isValid: true,
    normalizedPhone: value,
  };
}

export function parsePhoneInput(value: string): ParsedPhoneInput {
  const compact = sanitizePhoneInput(value);
  if (!compact) {
    return {
      authEmail: "",
      isDomestic: false,
      isValid: false,
      normalizedPhone: null,
    };
  }

  const mainlandMatch = compact.match(/^\+?(?:86)?(1[3-9]\d{9})$/);
  if (mainlandMatch) {
    return normalizeFromDomesticDigits(mainlandMatch[1]);
  }

  if (!compact.startsWith("+")) {
    const fallbackDigits = compact.replace(/\D/g, "");
    const domesticDigits = fallbackDigits.match(MAINLAND_WITH_COUNTRY_CODE_PATTERN);
    if (domesticDigits) {
      return normalizeFromDomesticDigits(domesticDigits[1]);
    }
  }

  const parsedPhone = parsePhoneNumberFromString(compact, "CN");
  if (parsedPhone?.isValid()) {
    const e164Phone = parsedPhone.number;
    const digitsOnly = parsedPhone.nationalNumber;

    if (parsedPhone.country === "CN" && isMainlandChinaMobile(digitsOnly)) {
      return normalizeFromDomesticDigits(digitsOnly);
    }

    const intlDigits = e164Phone.replace(/\D/g, "");

    return {
      authEmail: `phone-${intlDigits}@temp.local`,
      isDomestic: false,
      isValid: true,
      normalizedPhone: e164Phone,
    };
  }

  return {
    authEmail: "",
    isDomestic: false,
    isValid: false,
    normalizedPhone: null,
  };
}

export function isValidPhoneInput(value: string) {
  return parsePhoneInput(value).isValid;
}

export function normalizePhoneNumber(value: string) {
  return parsePhoneInput(value).normalizedPhone;
}

export function isMainlandPhoneNumber(value: string) {
  return MAINLAND_PHONE_PATTERN.test(value);
}
