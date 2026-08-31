import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { isAdminUser } from "@/lib/admin";
import { getConsentSummary, getContactMessages, listUsersWithRoles } from "@/app/actions/admin";
import { getAdminNotifications } from "@/app/actions/admin-notifications";
import { recentRequests } from "@/app/actions/support";
import { ConsentAnalytics } from "@/components/dashboard/consent-analytics";
import { ContactInbox } from "@/components/dashboard/contact-inbox";
import { RequestDiagnostics } from "@/components/dashboard/request-diagnostics";
import { AdminRoleManager } from "@/components/dashboard/admin-role-manager";
import { StorageAlerts } from "@/components/dashboard/storage-alerts";
import { PageHeader } from "@/components/dashboard/page-header";

export default async function AdminPage() {
  const { userId } = await auth();
  const isAdmin = await isAdminUser(userId);
  if (!isAdmin) redirect("/dashboard");

  const [summary, messages, requests, users, notifications] = await Promise.all([
    getConsentSummary().catch(() => null),
    getContactMessages().catch(() => []),
    recentRequests(25).catch(() => []),
    listUsersWithRoles().catch(() => []),
    getAdminNotifications(50).catch(() => []),
  ]);

  return (
    <>
      <PageHeader
        eyebrow="Admin"
        title="Admin"
        description="Roles, consent analytics, contact inbox, and request diagnostics"
      />

      <StorageAlerts notifications={notifications} />
      <AdminRoleManager initialUsers={users} />
      <RequestDiagnostics initialRequests={requests} />
      <ConsentAnalytics summary={summary} />
      <ContactInbox messages={messages} />
    </>
  );
}
