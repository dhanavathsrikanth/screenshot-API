/**
 * Shared, serializable shape of a screenshot history row. Lives in its own
 * module so both server actions and client components can import it without
 * pulling server-only code (Supabase/Clerk) into the client bundle.
 */
export type ScreenshotRow = {
  id: string;
  url: string | null;
  storage_url: string | null;
  format: string;
  width: number | null;
  height: number | null;
  file_size_bytes: number | null;
  cached: boolean;
  created_at: string;
  metadata: Record<string, unknown> | null;
};
