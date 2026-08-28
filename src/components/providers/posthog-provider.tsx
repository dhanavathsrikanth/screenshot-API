"use client";

import posthog from "posthog-js";
import { useAuth, useUser } from "@clerk/nextjs";
import { useEffect, useRef } from "react";

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  const { isSignedIn, userId } = useAuth();
  const { isLoaded: isUserLoaded, user } = useUser();
  const previousUserId = useRef<string | null>(null);

  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN || !posthog.__loaded) return;

    if (isSignedIn && userId && isUserLoaded) {
      if (previousUserId.current && previousUserId.current !== userId) {
        posthog.reset();
      }

      if (previousUserId.current !== userId) {
        posthog.identify(userId, {
          email: user?.primaryEmailAddress?.emailAddress,
          name: user?.fullName ?? undefined,
        });
        previousUserId.current = userId;
      }
    } else if (previousUserId.current) {
      posthog.reset();
      previousUserId.current = null;
    }
  }, [
    isSignedIn,
    userId,
    isUserLoaded,
    user?.fullName,
    user?.primaryEmailAddress?.emailAddress,
  ]);

  return <>{children}</>;
}
