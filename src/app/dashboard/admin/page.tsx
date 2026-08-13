import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { isAdminUser } from "@/lib/admin";
import { getConsentSummary, getContactMessages } from "@/app/actions/admin";
import { ConsentAnalytics } from "@/components/dashboard/consent-analytics";
import { ContactInbox } from "@/components/dashboard/contact-inbox";
import { PageHeader } from "@/components/dashboard/page-header";

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
      <PageHeader
        eyebrow="Admin"
        title="Consent & Contacts"
        description="Cookie consent analytics and contact inbox"
      />

      <ConsentAnalytics summary={summary} />
      <ContactInbox messages={messages} />
    </div>
  );
}
