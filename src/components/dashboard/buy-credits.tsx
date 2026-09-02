"use client";

import { useState } from "react";

const creditPacks = [
  {
    id: "topup500",
    name: "500 credits",
    price: "$4.99",
    priceCents: 499,
    productId: process.env.NEXT_PUBLIC_DODO_PRODUCT_TOPUP_500_ID || "",
    popular: false,
  },
  {
    id: "topup2500",
    name: "2,500 credits",
    price: "$19.99",
    priceCents: 1999,
    productId: process.env.NEXT_PUBLIC_DODO_PRODUCT_TOPUP_2500_ID || "",
    popular: true,
  },
  {
    id: "topup10000",
    name: "10,000 credits",
    price: "$69.99",
    priceCents: 6999,
    productId: process.env.NEXT_PUBLIC_DODO_PRODUCT_TOPUP_10000_ID || "",
    popular: false,
  },
];

export function BuyCredits({ compact = false }: { compact?: boolean }) {
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleBuy(productId: string, packId: string) {
    if (!productId) {
      setError("Not configured");
      return;
    }
    setLoading(packId);
    setError(null);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product_id: productId,
          quantity: 1,
          return_url: `${window.location.origin}/dashboard/plan?credits=1`,
          metadata: { kind: "topup" },
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Checkout failed");
        setLoading(null);
        return;
      }
      if (data.checkout_url) {
        window.location.assign(data.checkout_url);
        return;
      }
      setError("No payment URL");
      setLoading(null);
    } catch {
      setError("Something went wrong");
      setLoading(null);
    }
  }

  if (compact) {
    return (
      <div>
        {error && <p className="mb-2 text-xs text-red-600 dark:text-red-400">{error}</p>}
        <div className="grid grid-cols-3 gap-2">
          {creditPacks.map((pack) => (
            <button
              key={pack.id}
              onClick={() => handleBuy(pack.productId, pack.id)}
              disabled={loading !== null}
              className={`rounded-lg border px-2 py-3 text-center transition-colors disabled:opacity-50 ${
                pack.popular
                  ? "border-orange-500/40 bg-orange-50 dark:bg-orange-950/20 hover:bg-orange-100 dark:hover:bg-orange-900/30"
                  : "border-[var(--border)] bg-[var(--card)] hover:bg-[var(--muted)]"
              }`}
            >
              <p className="text-xs font-semibold tabular-nums">{pack.name.replace(" credits", "")}</p>
              <p className="text-[11px] text-[var(--dim)]">{pack.price}</p>
              <span className="mt-1.5 inline-flex text-[11px] font-medium text-[var(--ink)]">
                {loading === pack.id ? "..." : "Buy →"}
              </span>
            </button>
          ))}
        </div>
        <p className="mt-2 text-[11px] text-[var(--dim)]">
          Instant · 12 months · <a href="/docs#pricing" className="underline hover:text-[var(--ink)]">Docs</a>
        </p>
      </div>
    );
  }

  return (
    <div>
      {error && (
        <div className="rounded-lg bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 p-3 mb-3">
          <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {creditPacks.map((pack) => (
          <div
            key={pack.id}
            className={`rounded-xl border p-4 flex flex-col ${
              pack.popular ? "border-orange-500/40 bg-orange-50/50 dark:bg-orange-950/20" : "border-[var(--border)]"
            }`}
          >
            {pack.popular && (
              <span className="self-start mb-1.5 inline-flex rounded-full bg-orange-600 px-2 py-0.5 text-[10px] font-bold uppercase text-white">Popular</span>
            )}
            <p className="text-sm font-semibold">{pack.name}</p>
            <p className="text-xs text-[var(--dim)] mb-3">{pack.price}</p>
            <button
              onClick={() => handleBuy(pack.productId, pack.id)}
              disabled={loading !== null}
              className={`mt-auto ${pack.popular ? "btn-primary text-xs py-2" : "btn-secondary text-xs py-2"} disabled:opacity-50`}
            >
              {loading === pack.id ? "..." : "Buy"}
            </button>
          </div>
        ))}
      </div>
      <p className="text-[11px] text-[var(--dim)] mt-2">
        Instant · 12 months · <a href="/docs#pricing" className="underline hover:text-[var(--ink)]">Docs</a>
      </p>
    </div>
  );
}
