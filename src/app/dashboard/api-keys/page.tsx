import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { listApiKeys } from "@/app/actions/api-keys";
import { listProjects, type ProjectRow } from "@/app/actions/projects";
import { ApiKeysManager } from "@/components/dashboard/api-keys-manager";
import { PageHeader } from "@/components/dashboard/page-header";

export default async function ApiKeysPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  let apiKeys: Awaited<ReturnType<typeof listApiKeys>> = [];
  try {
    apiKeys = await listApiKeys();
  } catch {
    apiKeys = [];
  }

  let projects: ProjectRow[] = [];
  try {
    projects = await listProjects();
  } catch {
    projects = [];
  }

  return (
    <>
      <PageHeader
        eyebrow="API Keys"
        title="Manage API Keys"
        description="Secret keys for server calls, plus access_key + signing secret for GET signed URLs (OG tags, img src)."
      />
      <ApiKeysManager initialKeys={apiKeys} projects={projects} />
    </>
  );
}
