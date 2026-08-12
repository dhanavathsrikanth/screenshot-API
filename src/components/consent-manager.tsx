"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Analytics } from "@vercel/analytics/react";
import Link from "next/link";
import {
  readConsent,
  subscribeConsent,
  writeConsent,
  trackConsentEvent,
  CONSENT_OPEN_EVENT,
  CONSENT_IMPRESSION_KEY,
  type ConsentState,
} from "@/lib/consent";

function useConsent(): ConsentState {
  return useSyncExternalStore(subscribeConsent, readConsent, () => null);
}

function useMounted(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );
}

// The Vercel Analytics component appends its loader to <head> via a script tag.
// Unmounting <Analytics /> alone leaves the script running until reload, so on
// "Essential only" we remove it from the DOM to stop tracking immediately.
function removeAnalyticsScripts() {
  if (typeof document === "undefined") return;
  document
    .querySelectorAll('script[src*="vercel"]')
    .forEach((script) => {
      const src = script.getAttribute("src") ?? "";
      if (src.includes("/insights/script") || src.includes("vercel-scripts.com")) {
        script.remove();
      }
    });
}

export function ConsentManager() {
  const consent = useConsent();
  const mounted = useMounted();
  const [open, setOpen] = useState(false);
  const impressionSent = useRef(false);

  const showBanner = mounted && (consent === null || open);

  // Reopen the banner when the footer "Cookie Settings" button dispatches the
  // open event, so users can change an existing choice without a reload.
  useEffect(() => {
    if (typeof window === "undefined") return;
    function handleOpen() {
      setOpen(true);
    }
    window.addEventListener(CONSENT_OPEN_EVENT, handleOpen);
    return () => window.removeEventListener(CONSENT_OPEN_EVENT, handleOpen);
  }, []);

  // Record a single banner impression per browsing session when the user has
  // no stored choice yet. Best-effort; never affects rendering.
  useEffect(() => {
    if (consent !== null || impressionSent.current) return;
    if (typeof window === "undefined") return;

    impressionSent.current = true;
    try {
      if (window.sessionStorage.getItem(CONSENT_IMPRESSION_KEY)) return;
      window.sessionStorage.setItem(CONSENT_IMPRESSION_KEY, "1");
    } catch {
      // Session storage unavailable — still track the impression once per mount.
    }
    trackConsentEvent("impression");
  }, [consent]);

  function acceptAll() {
    writeConsent("accepted");
    trackConsentEvent("accept");
    setOpen(false);
  }

  function essentialOnly() {
    removeAnalyticsScripts();
    writeConsent("rejected");
    trackConsentEvent("reject");
    setOpen(false);
  }

  return (
    <>
      {consent === "accepted" && <Analytics />}
      {showBanner && (
        <div className="fixed inset-x-0 bottom-0 z-50 p-4 sm:p-6">
          <div className="mx-auto max-w-3xl rounded-xl border border-[var(--border)] bg-zinc-50/95 p-5 shadow-2xl backdrop-blur dark:bg-zinc-950/95">
            <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
              We use cookies to keep the Service working and, if you agree, to
              understand how it is used. Essential cookies are always active.
              You can change your choice at any time.
            </p>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
              <button
                type="button"
                onClick={acceptAll}
                className="rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--primary-hover)]"
              >
                Accept all
              </button>
              <button
                type="button"
                onClick={essentialOnly}
                className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-900"
              >
                Essential only
              </button>
              <Link
                href="/cookies"
                className="text-sm text-[var(--primary)] underline underline-offset-4 sm:ml-auto"
              >
                Cookie Policy
              </Link>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
