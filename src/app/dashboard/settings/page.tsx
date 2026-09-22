import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { SettingsProfile } from "@/components/dashboard/settings-profile";
import { PageHeader } from "@/components/dashboard/page-header";

export default async function SettingsPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  return (
    <>
      <PageHeader
        eyebrow="Settings"
        title="Account Settings"
        description="Profile and account preferences"
      />

      {/* Profile */}
      <SettingsProfile />

    </>
  );
}
