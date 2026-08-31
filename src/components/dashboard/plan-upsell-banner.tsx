"use client";

import type { PlanId } from "@/lib/plans";
import { upgradeReasons } from "@/lib/marketing";
import { UpgradeButton } from "@/components/upgrade-button";

export function PlanUpsellBanner({ plan }: { plan: PlanId }) {
  if (plan !== "free") return null;

  return (
    <div className="rounded-xl border border-orange-200 bg-gradient-to-r from-orange-50 to-amber-50 p-4 dark:border-orange-800/60 dark:from-orange-950/30 dark:to-amber-950/20">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-orange-900 dark:text-orange-200">
            Shipping screenshots to users? Upgrade to Starter — $9/mo
          </p>
          <ul className="mt-2 space-y-1">
            {upgradeReasons.starter.slice(0, 3).map((item) => (
              <li key={item} className="flex items-start gap-2 text-xs text-orange-800 dark:text-orange-300">
                <svg className="mt-0.5 h-3.5 w-3.5 shrink-0 text-orange-500" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                </svg>
                {item}
              </li>
            ))}
          </ul>
        </div>
        <UpgradeButton className="shrink-0 whitespace-nowrap" />
      </div>
    </div>
  );
}
