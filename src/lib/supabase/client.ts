import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { useSession } from "@clerk/nextjs";
import { supabaseConfig } from "@/lib/env";

export function useSupabaseClient() {
  const { session } = useSession();

  return createSupabaseClient(
    supabaseConfig.url,
    supabaseConfig.publishableKey,
    {
      async accessToken() {
        return session?.getToken() ?? null;
      },
    }
  );
}
