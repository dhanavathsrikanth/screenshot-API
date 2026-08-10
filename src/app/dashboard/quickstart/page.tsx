import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { listApiKeys } from "@/app/actions/api-keys";
import { QuickStart } from "@/components/dashboard/quick-start";

export default async function QuickStartPage() {
  const { userId } = await auth();
  if (!userId) redirect("/");

  let firstKeyPrefix: string | null = null;
  try {
    const keys = await listApiKeys();
    firstKeyPrefix = keys.find((k) => k.is_active)?.key_prefix ?? null;
  } catch {
    // ignore
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Quick Start</h1>
        <p className="text-sm text-zinc-500 mt-1">
          Get started with the ScreenshotAPI API in seconds.
        </p>
      </div>
      <QuickStart apiKeyPrefix={firstKeyPrefix} />
    </div>
  );
}
