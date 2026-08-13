import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { listApiKeys } from "@/app/actions/api-keys";
import { ApiKeysManager } from "@/components/dashboard/api-keys-manager";
import { PageHeader } from "@/components/dashboard/page-header";

type ApiKey = {
  id: string;
  name: string;
  key_prefix: string;
  is_active: boolean;
  last_used_at: string | null;
  created_at: string;
};

export default async function ApiKeysPage() {
  const { userId } = await auth();
  if (!userId) redirect("/");

  let apiKeys: ApiKey[] = [];
  try {
    apiKeys = await listApiKeys();
  } catch {
    apiKeys = [];
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="API Keys"
        title="Manage API Keys"
        description="Manage keys for programmatic access to the API."
      />
      <ApiKeysManager initialKeys={apiKeys} />
    </div>
  );
}
