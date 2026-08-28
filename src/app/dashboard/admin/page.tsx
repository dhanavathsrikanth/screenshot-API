import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { isAdminUser } from "@/lib/admin";
import { getConsentSummary, getContactMessages, listUsersWithRoles } from "@/app/actions/admin";
import { recentRequests } from "@/app/actions/support";
import { ConsentAnalytics } from "@/components/dashboard/consent-analytics";
import { ContactInbox } from "@/components/dashboard/contact-inbox";
import { RequestDiagnostics } from "@/components/dashboard/request-diagnostics";
import { AdminRoleManager } from "@/components/dashboard/admin-role-manager";
import { PageHeader } from "@/components/dashboard/page-header";

export default async function AdminPage() {
  const { userId } = await auth();
  const isAdmin = await isAdminUser(userId);
  if (!isAdmin) redirect("/dashboard");

  const [summary, messages, requests, users] = await Promise.all([
    getConsentSummary().catch(() => null),
    getContactMessages().catch(() => []),
    recentRequests(25).catch(() => []),
    listUsersWithRoles().catch(() => []),
  ]);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Admin"
        title="Admin"
        description="Roles, consent analytics, contact inbox, and request diagnostics"
      />

      <AdminRoleManager initialUsers={users} />
      <RequestDiagnostics initialRequests={requests} />
      <ConsentAnalytics summary={summary} />
      <ContactInbox messages={messages} />
    </div>
  );
}
