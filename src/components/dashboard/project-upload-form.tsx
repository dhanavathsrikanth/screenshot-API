"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  saveUploadDestination,
  deleteUploadDestination,
  testSavedUploadDestination,
  type UploadDestinationPublic,
} from "@/app/actions/project-upload";
import type { UploadProvider } from "@/lib/storage/customer-upload";

export function ProjectUploadForm({
  projectId,
  allowed,
  initial,
}: {
  projectId: string;
  allowed: boolean;
  initial: UploadDestinationPublic | null;
}) {
  const [open, setOpen] = useState(false);
  const [provider, setProvider] = useState<UploadProvider>(initial?.provider ?? "s3");
  const [bucket, setBucket] = useState(initial?.bucket ?? "");
  const [region, setRegion] = useState(initial?.region ?? "us-east-1");
  const [endpoint, setEndpoint] = useState(initial?.endpoint ?? "");
  const [accessKeyId, setAccessKeyId] = useState(initial?.access_key_id ?? "");
  const [secret, setSecret] = useState("");
  const [publicUrl, setPublicUrl] = useState(initial?.public_url_prefix ?? "");
  const [pathPrefix, setPathPrefix] = useState(initial?.path_prefix ?? "screenshots");
  const [dest, setDest] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (!allowed) {
    return (
      <p className="text-xs text-[var(--dim)]">
        Copy captures into your S3, R2, or GCS bucket on{" "}
        <Link href="/dashboard/plan" className="text-orange-600 hover:underline">
          Pro or Scale
        </Link>
        .
      </p>
    );
  }

  return (
    <div className="border-t border-[var(--border)] pt-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-xs font-medium text-orange-600 dark:text-orange-400 hover:underline"
      >
        {open ? "Hide customer bucket" : dest ? "Customer bucket configured" : "Customer bucket (S3 / R2 / GCS)"}
      </button>
      {open && (
        <form
          className="mt-3 grid gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            setOk(null);
            startTransition(async () => {
              try {
                const saved = await saveUploadDestination({
                  projectId,
                  provider,
                  bucket,
                  region,
                  endpoint: endpoint || undefined,
                  accessKeyId,
                  secretAccessKey: secret,
                  publicUrlPrefix: publicUrl || undefined,
                  pathPrefix,
                });
                setDest(saved);
                setSecret("");
                setOk(secret ? "Saved and connection tested." : "Saved. Enter the secret again to re-test.");
              } catch (err) {
                setError(err instanceof Error ? err.message : "Save failed.");
              }
            });
          }}
        >
          <p className="text-xs text-[var(--dim)]">
            Each capture is stored in your bucket. History still keeps our copy for retention.
          </p>
          <select
            value={provider}
            onChange={(e) => setProvider(e.target.value as UploadProvider)}
            className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
          >
            <option value="s3">Amazon S3</option>
            <option value="r2">Cloudflare R2</option>
            <option value="gcs">Google Cloud Storage (HMAC)</option>
          </select>
          <input value={bucket} onChange={(e) => setBucket(e.target.value)} placeholder="Bucket name" className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm" />
          <input value={region} onChange={(e) => setRegion(e.target.value)} placeholder={provider === "s3" ? "Region (e.g. us-east-1)" : "Region (auto)"} className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm" />
          {(provider === "r2" || provider === "gcs") && (
            <input value={endpoint} onChange={(e) => setEndpoint(e.target.value)} placeholder={provider === "r2" ? "https://<accountid>.r2.cloudflarestorage.com" : "https://storage.googleapis.com"} className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm" />
          )}
          <input value={accessKeyId} onChange={(e) => setAccessKeyId(e.target.value)} placeholder="Access key ID" className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm" autoComplete="off" />
          <input type="password" value={secret} onChange={(e) => setSecret(e.target.value)} placeholder={dest ? "Secret (leave blank to keep)" : "Secret access key"} className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm" autoComplete="new-password" />
          <input value={publicUrl} onChange={(e) => setPublicUrl(e.target.value)} placeholder="Public URL prefix (https://cdn.example.com)" className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm" />
          <input value={pathPrefix} onChange={(e) => setPathPrefix(e.target.value)} placeholder="Path prefix" className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm" />
          {error && <p className="text-xs text-red-600">{error}</p>}
          {ok && <p className="text-xs text-green-700 dark:text-green-400">{ok}</p>}
          {dest?.last_test_ok === false && dest.last_test_error && (
            <p className="text-xs text-red-600">Last test: {dest.last_test_error}</p>
          )}
          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={isPending} className="btn-primary text-xs disabled:opacity-50">
              {isPending ? "Saving…" : "Save destination"}
            </button>
            {dest && (
              <>
                <button
                  type="button"
                  disabled={isPending}
                  className="btn-secondary text-xs"
                  onClick={() => {
                    setError(null);
                    startTransition(async () => {
                      try {
                        await testSavedUploadDestination(projectId);
                        setOk("Connection test succeeded.");
                      } catch (err) {
                        setError(err instanceof Error ? err.message : "Test failed.");
                      }
                    });
                  }}
                >
                  Test
                </button>
                <button
                  type="button"
                  disabled={isPending}
                  className="rounded-lg border border-red-200 px-2.5 py-1.5 text-xs font-medium text-red-600"
                  onClick={() => {
                    startTransition(async () => {
                      try {
                        await deleteUploadDestination(projectId);
                        setDest(null);
                        setOk("Destination removed.");
                      } catch (err) {
                        setError(err instanceof Error ? err.message : "Delete failed.");
                      }
                    });
                  }}
                >
                  Remove
                </button>
              </>
            )}
          </div>
        </form>
      )}
    </div>
  );
}
