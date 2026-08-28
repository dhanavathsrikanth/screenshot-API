import { redirect } from "next/navigation";

// Tracking was merged into Analytics (request breakdowns + API key health
// live there now). This redirect preserves old links/bookmarks.
export default function TrackingPage() {
  redirect("/dashboard/analytics");
}
