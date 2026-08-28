import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { listWebhookEndpoints, getWebhookDeliveries } from "@/app/actions/webhooks";
import { WebhooksManager } from "@/components/dashboard/webhooks-manager";
import { PageHeader } from "@/components/dashboard/page-header";

export default async function WebhooksPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  let endpoints: Awaited<ReturnType<typeof listWebhookEndpoints>> = [];
  let deliveries: Awaited<ReturnType<typeof getWebhookDeliveries>> = [];
  try {
    [endpoints, deliveries] = await Promise.all([listWebhookEndpoints(), getWebhookDeliveries()]);
  } catch {
    endpoints = [];
    deliveries = [];
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Webhooks"
        title="Webhook Endpoints"
        description="Deliver signed HTTP callbacks when screenshots complete or fail."
        actions={<span className="text-xs text-[var(--dim)]">{endpoints.length} endpoints</span>}
      />
      <WebhooksManager initialEndpoints={endpoints} initialDeliveries={deliveries} />
    </div>
  );
}
