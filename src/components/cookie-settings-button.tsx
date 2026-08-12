"use client";

import { clearConsent } from "@/lib/consent";

export function CookieSettingsButton() {
  function openCookieSettings() {
    clearConsent();
    window.location.reload();
  }

  return (
    <button
      type="button"
      onClick={openCookieSettings}
      className="text-sm text-zinc-600 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
    >
      Cookie Settings
    </button>
  );
}
