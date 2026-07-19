import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { auth } from "@clerk/nextjs/server";
import { supabaseConfig } from "@/lib/env";

export async function createClient() {
  const { getToken } = await auth();

  return createSupabaseClient(supabaseConfig.url, supabaseConfig.publishableKey, {
    async accessToken() {
      return getToken();
    },
  });
}

export function createServiceClient() {
  return createSupabaseClient(supabaseConfig.url, supabaseConfig.serviceRoleKey);
}
