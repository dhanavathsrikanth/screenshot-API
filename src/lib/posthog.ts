import { PostHog } from "posthog-node";

let client: PostHog | null = null;

export function getPostHog(): PostHog | null {
  const key = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST;
  if (!key || !host) return null;
  if (!client) {
    client = new PostHog(key, {
      host,
      flushAt: 1,
      flushInterval: 0,
      enableExceptionAutocapture: true,
    });
  }
  return client;
}

export async function trackServerEvent({
  userId,
  event,
  properties,
}: {
  userId: string;
  event: string;
  properties?: Record<string, unknown>;
}): Promise<void> {
  const ph = getPostHog();
  if (!ph) return;
  ph.capture({ distinctId: userId, event, properties });
  await ph.flush();
}
