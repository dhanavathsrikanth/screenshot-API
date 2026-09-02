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
        eyebrow="Develop · Credentials"
        title="API keys"
        description="Create a single API key per use — give it a name and an expiry, and you’re done. Expired keys are rejected automatically."
      />
      <div className="flex flex-wrap gap-2 -mt-2 mb-1 text-xs">
        <span className="inline-flex items-center gap-1 rounded-full bg-[var(--muted)] border border-[var(--border)] px-3 py-1 text-[var(--dim)]">
          {apiKeys.length === 0 ? "No keys yet — create your first one below" : `${apiKeys.length} key${apiKeys.length !== 1 ? "s" : ""} · keep sk_… on the server`}
        </span>
        <a href="/docs#quickstart" className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--card)] px-3 py-1 font-medium hover:bg-[var(--muted)] transition-colors">
          Quick start in docs →
        </a>
        <a href="/docs#authentication" className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--card)] px-3 py-1 font-medium hover:bg-[var(--muted)] transition-colors">
          Authentication docs
        </a>
        <a href="/dashboard/playground" className="inline-flex items-center gap-1.5 rounded-full bg-orange-600 px-3 py-1 font-medium text-white hover:bg-orange-700 transition-colors">
          Try in Playground →
        </a>
      </div>
      <ApiKeysManager initialKeys={apiKeys} projects={projects} />
    </>
  );
}
