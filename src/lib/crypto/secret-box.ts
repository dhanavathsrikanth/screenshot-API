import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const VERSION = "v1";

function keyMaterial(): Buffer {
  const raw =
    process.env.CREDENTIALS_ENCRYPTION_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!raw) {
    throw new Error("CREDENTIALS_ENCRYPTION_KEY (or SUPABASE_SERVICE_ROLE_KEY) is required to store secrets.");
  }
  return createHash("sha256").update(raw).digest();
}

/**
 * AES-256-GCM with associated data so a ciphertext cannot be copied onto
 * another row. Stored as `v1.<iv_b64>.<tag_b64>.<ct_b64>`.
 */
export function encryptSecret(plaintext: string, aad: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", keyMaterial(), iv);
  cipher.setAAD(Buffer.from(aad, "utf8"));
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString("base64url"), tag.toString("base64url"), ciphertext.toString("base64url")].join(".");
}

export function decryptSecret(packed: string, aad: string): string {
  const parts = packed.split(".");
  if (parts.length !== 4 || parts[0] !== VERSION) {
    throw new Error("Unrecognized secret encoding.");
  }
  const [, ivB64, tagB64, ctB64] = parts;
  const decipher = createDecipheriv("aes-256-gcm", keyMaterial(), Buffer.from(ivB64, "base64url"));
  decipher.setAAD(Buffer.from(aad, "utf8"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(ctB64, "base64url")), decipher.final()]).toString("utf8");
}
