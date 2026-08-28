"use client";

import { UserProfile } from "@clerk/nextjs";

export function SettingsProfile() {
  return (
    <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)] dark:bg-[var(--card)]">
      <div className="border-b border-[var(--border)] px-6 py-4">
        <h2 className="text-sm font-semibold text-[var(--ink)] dark:text-[var(--ink)]">Profile & account</h2>
        <p className="mt-0.5 text-xs text-[var(--dim)] dark:text-[var(--dim)]">
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
