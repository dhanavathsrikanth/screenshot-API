import { redirect } from "next/navigation";

// SLA monitoring was merged into Analytics (Reliability section). This
// redirect preserves old links/bookmarks.
export default function SLAPage() {
  redirect("/dashboard/analytics");
}
