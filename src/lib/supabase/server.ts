import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { auth } from "@clerk/nextjs/server";
import { supabaseConfig } from "@/lib/env";

// Cap how long any single Supabase request may take. Without a net timeout,
// an unreachable backend can hang a server-rendered page (e.g. /dashboard) for
// minutes while the OS retries TCP. These are read/light-write paths, so a
// generous-but-bounded timeout lets the surrounding try/catch fall back fast
// instead of blocking the render.
const SUPABASE_TIMEOUT_MS = 8000;

function fetchWithTimeout(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SUPABASE_TIMEOUT_MS);
  return fetch(input, { ...init, signal: controller.signal }).finally(() =>
    clearTimeout(timer)
  );
}

export async function createClient() {
  const { getToken } = await auth();
  const token = await getToken();

  return createSupabaseClient(supabaseConfig.url, supabaseConfig.publishableKey, {
    global: {
      fetch: fetchWithTimeout,
      headers: token
        ? { Authorization: `Bearer ${token}` }
        : {},
    },
  });
}

export function createServiceClient() {
  return createSupabaseClient(supabaseConfig.url, supabaseConfig.serviceRoleKey, {
    global: {
      fetch: fetchWithTimeout,
    },
  });
}
