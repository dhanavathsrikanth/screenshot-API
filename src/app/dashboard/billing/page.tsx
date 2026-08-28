import { redirect } from "next/navigation";

// Billing was merged into Plan & Billing (/dashboard/plan). This redirect
// preserves old links/bookmarks.
export default function BillingPage() {
  redirect("/dashboard/plan");
}
