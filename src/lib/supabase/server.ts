import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { auth } from "@clerk/nextjs/server";
import { supabaseConfig } from "@/lib/env";

export async function createClient() {
  const { getToken } = await auth();
  const token = await getToken();

  return createSupabaseClient(supabaseConfig.url, supabaseConfig.publishableKey, {
    global: {
      headers: token
        ? { Authorization: `Bearer ${token}` }
        : {},
    },
  });
}

export function createServiceClient() {
  return createSupabaseClient(supabaseConfig.url, supabaseConfig.serviceRoleKey);
}
