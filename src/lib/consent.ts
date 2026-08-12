export const CONSENT_KEY = "screenshotapi_consent";
export const CONSENT_EVENT = "screenshotapi-consent-change";
export const CONSENT_OPEN_EVENT = "screenshotapi-consent-open";
export const CONSENT_IMPRESSION_KEY = "screenshotapi_consent_impression";

export type ConsentValue = "accepted" | "rejected";
export type ConsentState = ConsentValue | null;
export type ConsentEventType = "impression" | "accept" | "reject";

function isHttps(): boolean {
  if (typeof window === "undefined") return false;
  return window.location.protocol === "https:";
}

function notifyConsentChange() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(CONSENT_EVENT));
}

// Reads consent from localStorage first, then falls back to the cookie.
// The cookie survives even when localStorage is blocked or throws (private
// browsing, storage disabled), which is what kept the banner reappearing.
export function readConsent(): ConsentState {
  if (typeof window === "undefined") return null;

  try {
    const value = window.localStorage.getItem(CONSENT_KEY);
    if (value === "accepted" || value === "rejected") return value;
  } catch {
    // localStorage unavailable — fall through to the cookie.
  }

  try {
    const match = document.cookie
      .split("; ")
      .find((part) => part.startsWith(`${CONSENT_KEY}=`));
    const value = match?.split("=")[1];
    if (value === "accepted" || value === "rejected") return value;
  } catch {
    // Cookies unavailable too — treat as no choice.
  }

  return null;
}

function buildCookie(value: string, maxAge: number): string {
  const secure = isHttps() ? "; Secure" : "";
  return `${CONSENT_KEY}=${value}; path=/; max-age=${maxAge}; SameSite=Lax${secure}`;
}

export function writeConsent(value: ConsentValue) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(CONSENT_KEY, value);
  } catch {
    // Storage blocked — the cookie below still records the choice.
  }

  try {
    document.cookie = buildCookie(value, 365 * 24 * 60 * 60);
  } catch {
    // Cookies blocked — localStorage already recorded the choice.
  }

  notifyConsentChange();
}

export function clearConsent() {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.removeItem(CONSENT_KEY);
  } catch {
    // Ignore storage failures; still clear the cookie.
  }

  try {
    document.cookie = buildCookie("", 0);
  } catch {
    // Ignore cookie failures.
  }

  notifyConsentChange();
}

// Reopens the consent banner so the user can change an existing choice.
export function openConsentSettings() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(CONSENT_OPEN_EVENT));
}

// Records a consent event (impression / accept / reject) on the backend so
// the owner can review banner behavior. Fire-and-forget: never blocks UI.
export function trackConsentEvent(type: ConsentEventType) {
  if (typeof window === "undefined") return;

  const payload = {
    eventType: type,
    path: window.location.pathname,
  };

  try {
    fetch("/api/consent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      keepalive: true,
    }).catch(() => {});
  } catch {
    // Analytics are best-effort; never break the page over them.
  }
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
