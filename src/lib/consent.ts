export const CONSENT_KEY = "screenshotapi_consent";
export const CONSENT_EVENT = "screenshotapi-consent-change";

export type ConsentValue = "accepted" | "rejected";
export type ConsentState = ConsentValue | null;

function isHttps(): boolean {
  if (typeof window === "undefined") return false;
  return window.location.protocol === "https:";
}

function notifyConsentChange() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(CONSENT_EVENT));
}

export function readConsent(): ConsentState {
  if (typeof window === "undefined") return null;
  try {
    const value = window.localStorage.getItem(CONSENT_KEY);
    if (value === "accepted" || value === "rejected") return value;
  } catch {
    return null;
  }
  return null;
}

function buildCookie(value: string, maxAge: number): string {
  const secure = isHttps() ? "; Secure" : "";
  return `${CONSENT_KEY}=${value}; path=/; max-age=${maxAge}; SameSite=Lax${secure}`;
}

export function writeConsent(value: ConsentValue) {
  try {
    window.localStorage.setItem(CONSENT_KEY, value);
  } catch {
    return;
  }
  try {
    document.cookie = buildCookie(value, 365 * 24 * 60 * 60);
  } catch {
    return;
  }
  notifyConsentChange();
}

export function clearConsent() {
  try {
    window.localStorage.removeItem(CONSENT_KEY);
  } catch {
    return;
  }
  try {
    document.cookie = buildCookie("", 0);
  } catch {
    return;
  }
  notifyConsentChange();
}

export function subscribeConsent(onChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(CONSENT_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CONSENT_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}
