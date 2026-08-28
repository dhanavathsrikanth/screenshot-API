"use client";

import { UserProfile } from "@clerk/nextjs";

export function SettingsProfile() {
  return (
    <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-white dark:bg-slate-900">
      <div className="border-b border-[var(--border)] px-6 py-4">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">Profile & account</h2>
        <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
          Update your name, email, password, and security settings.
        </p>
      </div>
      <UserProfile
        routing="hash"
        appearance={{
          elements: {
            rootBox: "w-full",
            card: "w-full shadow-none border-0 rounded-none",
            navbar: "hidden",
            navbarMobileMenuRow: "hidden",
            headerTitle: "text-base",
          },
        }}
      />
    </div>
  );
}
