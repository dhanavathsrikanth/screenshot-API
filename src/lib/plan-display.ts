import type { PlanId } from "@/lib/plans";

export const PLAN_LABELS: Record<PlanId, string> = {
  free: "Free",
  starter: "Starter",
  pro: "Pro",
  scale: "Scale",
};

export const PLAN_BADGE_CLASSES: Record<PlanId, string> = {
  free: "bg-[var(--muted)] text-[var(--dim)]",
  starter: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  pro: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
  scale: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
};

export function getPlanLabel(plan: string | undefined | null): string {
  if (plan && plan in PLAN_LABELS) return PLAN_LABELS[plan as PlanId];
  if (!plan) return "Free";
  return plan.charAt(0).toUpperCase() + plan.slice(1);
}

export function getPlanBadgeClass(plan: string | undefined | null): string {
  if (plan && plan in PLAN_BADGE_CLASSES) return PLAN_BADGE_CLASSES[plan as PlanId];
  return PLAN_BADGE_CLASSES.free;
}
