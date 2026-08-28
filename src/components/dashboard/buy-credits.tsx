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

export function BuyCredits() {
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleBuy(productId: string, packId: string) {
    if (!productId) {
      setError("Credit packs are not configured yet. Add top-up product IDs to the environment.");
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
        setError(data.error || "Failed to start checkout");
        setLoading(null);
        return;
      }
      if (data.checkout_url) {
        window.location.assign(data.checkout_url);
      }
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(null);
    }
  }

  return (
    <div>
      {error && (
        <div className="rounded-lg bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 p-4 mb-4">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {creditPacks.map((pack) => (
          <div
            key={pack.id}
            className={`rounded-xl border p-5 flex flex-col ${
              pack.popular
                ? "border-orange-500/50 bg-orange-50/50 dark:bg-orange-950/30"
                : "border-[var(--border)]"
            }`}
          >
            {pack.popular && (
              <span className="self-start mb-2 inline-flex items-center rounded-full bg-orange-600 px-2 py-0.5 text-[10px] font-bold uppercase text-white">
                Popular
              </span>
            )}
            <p className="text-lg font-semibold">{pack.name}</p>
            <p className="text-sm text-[var(--dim)] mb-4">{pack.price}</p>
            <button
              onClick={() => handleBuy(pack.productId, pack.id)}
              disabled={loading !== null}
              className={`mt-auto ${pack.popular ? "btn-primary" : "btn-secondary"} disabled:opacity-50`}
            >
              {loading === pack.id ? "Redirecting..." : "Buy credits"}
            </button>
          </div>
        ))}
      </div>
      <p className="text-xs text-[var(--dim)] mt-3">
        Credits are added instantly after payment and never expire for 12 months.
      </p>
    </div>
  );
}
