import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { isAdminUser } from "@/lib/admin";
import { getConsentSummary, getContactMessages } from "@/app/actions/admin";
import { ConsentAnalytics } from "@/components/dashboard/consent-analytics";
import { ContactInbox } from "@/components/dashboard/contact-inbox";

export default async function AdminPage() {
  const { userId } = await auth();
  const isAdmin = await isAdminUser(userId);
  if (!isAdmin) redirect("/dashboard");

  const [summary, messages] = await Promise.all([
    getConsentSummary().catch(() => null),
    getContactMessages().catch(() => []),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Admin</h1>
        <p className="text-sm text-zinc-500">Cookie consent analytics and contact inbox</p>
      </div>

      <ConsentAnalytics summary={summary} />
      <ContactInbox messages={messages} />
    </div>
  );
}
