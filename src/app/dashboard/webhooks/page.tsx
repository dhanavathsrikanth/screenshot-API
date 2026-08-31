import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { listWebhookEndpoints, getWebhookDeliveries } from "@/app/actions/webhooks";
import { listProjects } from "@/app/actions/projects";
import { WebhooksManager } from "@/components/dashboard/webhooks-manager";
import { PageHeader } from "@/components/dashboard/page-header";

export default async function WebhooksPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  let endpoints: Awaited<ReturnType<typeof listWebhookEndpoints>> = [];
  let deliveries: Awaited<ReturnType<typeof getWebhookDeliveries>> = [];
  let projects: Awaited<ReturnType<typeof listProjects>> = [];
  try {
    [endpoints, deliveries, projects] = await Promise.all([
      listWebhookEndpoints(),
      getWebhookDeliveries(),
      listProjects(),
    ]);
  } catch {
    endpoints = [];
    deliveries = [];
    projects = [];
  }

  return (
    <>
      <PageHeader
        eyebrow="Webhooks"
        title="Webhook Endpoints"
        description="Deliver signed HTTP callbacks when screenshots complete, fail, or quota is exceeded."
        actions={<span className="text-xs text-[var(--dim)]">{endpoints.length} endpoints</span>}
      />
      <WebhooksManager
        initialEndpoints={endpoints}
        initialDeliveries={deliveries}
        projects={projects}
      />
    </>
  );
}
