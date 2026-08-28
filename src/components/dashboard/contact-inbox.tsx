"use client";

import { useTransition } from "react";
import { markContactMessageRead } from "@/app/actions/admin";
import type { ContactMessage } from "@/app/actions/admin";

export function ContactInbox({ messages }: { messages: ContactMessage[] }) {
  const [pending, startTransition] = useTransition();

  const newCount = messages.filter((m) => m.status === "new").length;

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="eyebrow text-[var(--dim)]">Contact Inbox</h2>
        {newCount > 0 && (
          <span className="rounded-full bg-orange-600 text-white text-xs font-medium px-2.5 py-1">
            {newCount} unread
          </span>
        )}
      </div>

      {messages.length === 0 ? (
        <div className="card p-5 text-sm text-[var(--dim)]">
          No messages yet. Submissions from the /contact form appear here.
        </div>
      ) : (
        <div className="space-y-3">
          {messages.map((m) => (
            <div
              key={m.id}
              className={`card p-5 ${m.status === "new" ? "border-l-4 border-l-orange-500" : ""}`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{m.name}</p>
                  <p className="text-xs text-[var(--dim)]">
                    {m.email} &middot; {new Date(m.created_at).toLocaleString()}
                  </p>
                  {m.subject && <p className="mt-2 text-sm font-medium">{m.subject}</p>}
                  <p className="mt-1 text-sm text-[var(--dim)] dark:text-[var(--dim)] whitespace-pre-wrap break-words">
                    {m.message}
                  </p>
                </div>
                {m.status === "new" ? (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() =>
                      startTransition(() => {
                        void markContactMessageRead(m.id);
                      })
                    }
                    className="flex-shrink-0 rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--dim)] dark:text-[var(--dim)] hover:bg-[var(--muted)] dark:hover:bg-[var(--muted)] disabled:opacity-50 transition-colors"
                  >
                    Mark as read
                  </button>
                ) : (
                  <span className="flex-shrink-0 rounded-full bg-[var(--muted)] dark:bg-[var(--muted)] text-[var(--dim)] dark:text-[var(--dim)] px-2.5 py-1 text-xs">
                    Read
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
