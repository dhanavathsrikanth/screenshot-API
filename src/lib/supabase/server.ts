import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { auth } from "@clerk/nextjs/server";
import { supabaseConfig } from "@/lib/env";

export async function createClient() {
  const { getToken } = await auth();
  const token = await getToken();

  return createServerClient(supabaseConfig.url, supabaseConfig.publishableKey, {
    cookies: {
      getAll() {
        return [];
      },
      setAll() {},
    },
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
