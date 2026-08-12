"use client";

import { useSyncExternalStore } from "react";
import { Analytics } from "@vercel/analytics/react";
import Link from "next/link";
import {
  readConsent,
  subscribeConsent,
  writeConsent,
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

export function ConsentManager() {
  const consent = useConsent();
  const mounted = useMounted();
  const showBanner = mounted && consent === null;

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
                onClick={() => writeConsent("accepted")}
                className="rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--primary-hover)]"
              >
                Accept all
              </button>
              <button
                type="button"
                onClick={() => writeConsent("rejected")}
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
