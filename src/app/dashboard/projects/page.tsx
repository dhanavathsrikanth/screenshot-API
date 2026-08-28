import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { listProjects, type ProjectRow } from "@/app/actions/projects";
import { ProjectsManager } from "@/components/dashboard/projects-manager";
import { PageHeader } from "@/components/dashboard/page-header";

export default async function ProjectsPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  let projects: ProjectRow[] = [];
  try {
    projects = await listProjects();
  } catch {
    projects = [];
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Projects"
        title="Projects"
        description="Organize API keys, screenshots, and usage per environment or application."
      />
      <ProjectsManager initialProjects={projects} />
    </div>
  );
}
