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

export const dodoConfig = {
  apiKey: env("DODO_PAYMENTS_API_KEY"),
  webhookSecret: env("DODO_PAYMENTS_WEBHOOK_SECRET"),
  environment: env("DODO_PAYMENTS_ENVIRONMENT", "test_mode"),
  returnUrlSuccess: env("DODO_RETURN_URL_SUCCESS", "http://localhost:3000/dashboard/plan"),
  returnUrlCancel: env("DODO_RETURN_URL_CANCEL", "http://localhost:3000/dashboard/plan"),
} as const;
