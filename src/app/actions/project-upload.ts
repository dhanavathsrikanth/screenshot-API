"use server";

import { auth } from "@clerk/nextjs/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getUserPlan, isCustomerUploadAllowed } from "@/lib/plans";
import { verifyProjectOwnership } from "@/app/actions/projects";
import {
  encryptUploadSecret,
  testCustomerDestination,
  validateDestinationInput,
  type UploadProvider,
} from "@/lib/storage/customer-upload";

export type UploadDestinationPublic = {
  project_id: string;
  provider: UploadProvider;
  bucket: string;
  region: string;
  endpoint: string | null;
  access_key_id: string;
  public_url_prefix: string | null;
  path_prefix: string;
  force_path_style: boolean;
  enabled: boolean;
  last_tested_at: string | null;
  last_test_ok: boolean | null;
  last_test_error: string | null;
};

export async function getUploadDestination(projectId: string): Promise<UploadDestinationPublic | null> {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");
  if (!(await verifyProjectOwnership(userId, projectId))) throw new Error("Project not found.");

  const supabase = createServiceClient();
  const { data } = await supabase
    .from("project_upload_destinations")
    .select(
      "project_id, provider, bucket, region, endpoint, access_key_id, public_url_prefix, path_prefix, force_path_style, enabled, last_tested_at, last_test_ok, last_test_error"
    )
    .eq("project_id", projectId)
    .eq("user_id", userId)
    .maybeSingle();
  return (data as UploadDestinationPublic | null) ?? null;
}

export async function listUploadDestinations(): Promise<UploadDestinationPublic[]> {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("project_upload_destinations")
    .select(
      "project_id, provider, bucket, region, endpoint, access_key_id, public_url_prefix, path_prefix, force_path_style, enabled, last_tested_at, last_test_ok, last_test_error"
    )
    .eq("user_id", userId);
  if (error) throw error;
  return (data ?? []) as UploadDestinationPublic[];
}

export async function saveUploadDestination(input: {
  projectId: string;
  provider: UploadProvider;
  bucket: string;
  region: string;
  endpoint?: string;
  accessKeyId: string;
  secretAccessKey: string;
  publicUrlPrefix?: string;
  pathPrefix?: string;
  enabled?: boolean;
}): Promise<UploadDestinationPublic> {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");
  if (!(await verifyProjectOwnership(userId, input.projectId))) throw new Error("Project not found.");

  const plan = await getUserPlan(userId);
  if (!isCustomerUploadAllowed(plan)) {
    throw new Error("Customer bucket upload requires the Pro plan or above.");
  }

  const supabase = createServiceClient();
  const existing = await supabase
    .from("project_upload_destinations")
    .select("secret_encrypted, access_key_id")
    .eq("project_id", input.projectId)
    .eq("user_id", userId)
    .maybeSingle();

  const secret = input.secretAccessKey.trim();
  if (!secret && !existing.data?.secret_encrypted) {
    throw new Error("Secret access key is required.");
  }

  const validated = await validateDestinationInput({
    provider: input.provider,
    bucket: input.bucket,
    region: input.region,
    endpoint: input.endpoint,
    accessKeyId: input.accessKeyId,
    secretAccessKey: secret || "placeholder-will-be-replaced",
    publicUrlPrefix: input.publicUrlPrefix,
    pathPrefix: input.pathPrefix,
  });
  if (!validated.ok) throw new Error(validated.message);
  const n = validated.normalized;

  const secretToStore = secret
    ? encryptUploadSecret(n.secretAccessKey, input.projectId)
    : (existing.data!.secret_encrypted as string);
  const secretForTest = secret ? n.secretAccessKey : null;

  if (secretForTest) {
    await testCustomerDestination({
      provider: n.provider,
      bucket: n.bucket,
      region: n.region,
      endpoint: n.endpoint ?? null,
      access_key_id: n.accessKeyId,
      secretAccessKey: secretForTest,
      public_url_prefix: n.publicUrlPrefix ?? null,
      path_prefix: n.pathPrefix ?? "screenshots",
      force_path_style: n.forcePathStyle ?? true,
      project_id: input.projectId,
    });
  }

  const row = {
    project_id: input.projectId,
    user_id: userId,
    provider: n.provider,
    bucket: n.bucket,
    region: n.region,
    endpoint: n.endpoint ?? null,
    access_key_id: n.accessKeyId,
    secret_encrypted: secretToStore,
    public_url_prefix: n.publicUrlPrefix ?? null,
    path_prefix: n.pathPrefix ?? "screenshots",
    force_path_style: n.forcePathStyle ?? true,
    enabled: input.enabled ?? true,
    last_tested_at: secretForTest ? new Date().toISOString() : undefined,
    last_test_ok: secretForTest ? true : undefined,
    last_test_error: secretForTest ? null : undefined,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("project_upload_destinations")
    .upsert(row, { onConflict: "project_id" })
    .select(
      "project_id, provider, bucket, region, endpoint, access_key_id, public_url_prefix, path_prefix, force_path_style, enabled, last_tested_at, last_test_ok, last_test_error"
    )
    .single();
  if (error) throw error;
  return data as UploadDestinationPublic;
}

export async function deleteUploadDestination(projectId: string): Promise<void> {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");
  if (!(await verifyProjectOwnership(userId, projectId))) throw new Error("Project not found.");
  const supabase = createServiceClient();
  const { error } = await supabase
    .from("project_upload_destinations")
    .delete()
    .eq("project_id", projectId)
    .eq("user_id", userId);
  if (error) throw error;
}

export async function testSavedUploadDestination(projectId: string): Promise<void> {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");
  if (!(await verifyProjectOwnership(userId, projectId))) throw new Error("Project not found.");

  const supabase = createServiceClient();
  const { data } = await supabase
    .from("project_upload_destinations")
    .select("*")
    .eq("project_id", projectId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!data) throw new Error("No destination configured.");

  const { decryptUploadSecret } = await import("@/lib/storage/customer-upload");
  try {
    await testCustomerDestination({
      provider: data.provider,
      bucket: data.bucket,
      region: data.region,
      endpoint: data.endpoint,
      access_key_id: data.access_key_id,
      secretAccessKey: decryptUploadSecret(data.secret_encrypted, projectId),
      public_url_prefix: data.public_url_prefix,
      path_prefix: data.path_prefix,
      force_path_style: data.force_path_style,
      project_id: projectId,
    });
    await supabase
      .from("project_upload_destinations")
      .update({ last_tested_at: new Date().toISOString(), last_test_ok: true, last_test_error: null })
      .eq("project_id", projectId);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await supabase
      .from("project_upload_destinations")
      .update({ last_tested_at: new Date().toISOString(), last_test_ok: false, last_test_error: message })
      .eq("project_id", projectId);
    throw new Error(message);
  }
}
