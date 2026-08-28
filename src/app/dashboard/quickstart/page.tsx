import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { listApiKeys } from "@/app/actions/api-keys";
import { QuickStart } from "@/components/dashboard/quick-start";
import { PageHeader } from "@/components/dashboard/page-header";

export default async function QuickStartPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  let firstKeyPrefix: string | null = null;
  try {
    const keys = await listApiKeys();
    firstKeyPrefix = keys.find((k) => k.is_active)?.key_prefix ?? null;
  } catch {
    // ignore
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Quick Start"
        title="Get Started in Seconds"
        description="Get started with the ScreenshotAPI API in seconds."
      />
      <QuickStart apiKeyPrefix={firstKeyPrefix} />
    </div>
  );
}
