import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { listProjects, type ProjectRow } from "@/app/actions/projects";
import { listUploadDestinations } from "@/app/actions/project-upload";
import { getUserPlan, isCustomerUploadAllowed } from "@/lib/plans";
import { ProjectsManager } from "@/components/dashboard/projects-manager";
import { PageHeader } from "@/components/dashboard/page-header";

export default async function ProjectsPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  let projects: ProjectRow[] = [];
  let plan: Awaited<ReturnType<typeof getUserPlan>> = "free";
  let destinations: Awaited<ReturnType<typeof listUploadDestinations>> = [];
  try {
    [projects, plan, destinations] = await Promise.all([
      listProjects(),
      getUserPlan(userId),
      listUploadDestinations().catch(() => []),
    ]);
  } catch {
    projects = [];
  }

  return (
    <>
      <PageHeader
        eyebrow="Projects"
        title="Projects"
        description="Organize API keys, screenshots, and usage per environment or application. Pro plans can copy captures into your own S3, R2, or GCS bucket."
      />
      <ProjectsManager
        initialProjects={projects}
        destinations={destinations}
        customerUploadAllowed={isCustomerUploadAllowed(plan)}
      />
    </>
  );
}
