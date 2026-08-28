import { createHash, randomBytes } from "crypto";
import { nanoid } from "nanoid";

export const KEY_ENVIRONMENTS = ["production", "test"] as const;
export type ApiKeyEnvironment = (typeof KEY_ENVIRONMENTS)[number];

export const KEY_PREFIXES: Record<ApiKeyEnvironment, string> = {
  production: "sk_live_",
  test: "sk_test_",
};

/** Salted SHA-256 of the raw key. Stored, never the key itself. */
export function hashApiKey(key: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = createHash("sha256").update(salt + key).digest("hex");
  return `${salt}:${hash}`;
}

export function newApiKeyPair(environment: ApiKeyEnvironment): {
  rawKey: string;
  prefix: string;
  keyHash: string;
} {
  const rawKey = `${KEY_PREFIXES[environment]}${nanoid(48)}`;
  return {
    rawKey,
    prefix: rawKey.slice(0, 8),
    keyHash: hashApiKey(rawKey),
  };
}
