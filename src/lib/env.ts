export function env(key: string, fallback?: string): string {
  const value = process.env[key] ?? fallback;
  if (!value) {
    throw new Error(`Missing environment variable: ${key}`);
  }
  return value;
}

export const supabaseConfig = {
  url: env("NEXT_PUBLIC_SUPABASE_URL"),
  publishableKey: env("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"),
  serviceRoleKey: env("SUPABASE_SERVICE_ROLE_KEY"),
} as const;
