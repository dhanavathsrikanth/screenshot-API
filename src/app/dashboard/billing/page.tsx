import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import DodoPayments from "dodopayments";
import { getDodoConfig } from "@/lib/env";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type PaymentListRow = {
  payment_id: string;
  created_at: string;
  currency: string;
  total_amount: number;
  status?: string | null;
  payment_method?: string | null;
  payment_method_type?: string | null;
  invoice_id?: string | null;
  invoice_url?: string | null;
};

const ZERO_DEC = new Set(["JPY", "KRW"]);
const THREE_DEC = new Set(["BHD", "JOD", "KWD", "OMR", "TND"]);

function formatAmount(minorUnits: number, currency: string) {
  let divisor = 100;
  if (ZERO_DEC.has(currency)) divisor = 1;
  else if (THREE_DEC.has(currency)) divisor = 1000;
  const value = minorUnits / divisor;
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(value);
  } catch {
    return `${value.toFixed(divisor === 1000 ? 3 : divisor === 1 ? 0 : 2)} ${currency}`;
  }
}

export default async function BillingPage() {
  const { userId } = await auth();
  if (!userId) redirect("/");

  const supabase = await createClient();
  const { data: userRow } = await supabase
    .from("users")
    .select("dodo_customer_id, email, first_name, last_name")
    .eq("id", userId)
    .maybeSingle();

  const customerId = userRow?.dodo_customer_id ?? null;
  const cfg = getDodoConfig();

  let payments: PaymentListRow[] = [];
  if (customerId) {
    const client = new DodoPayments({
      bearerToken: cfg.apiKey,
      environment: cfg.environment as "test_mode" | "live_mode",
    });

    const query = { customer_id: customerId, status: "succeeded", limit: 20, page: 1 } as any;
    for await (const p of client.payments.list(query)) {
      payments.push({
        payment_id: p.payment_id,
        created_at: p.created_at,
        currency: p.currency,
        total_amount: p.total_amount,
        status: p.status ?? null,
        payment_method: p.payment_method ?? null,
        payment_method_type: p.payment_method_type ?? null,
        invoice_id: p.invoice_id ?? null,
        invoice_url: p.invoice_url ?? null,
      });
    }
  }

  const displayName = [userRow?.first_name, userRow?.last_name].filter(Boolean).join(" ") || userRow?.email || "Customer";

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Billing & Invoices</h1>
        <p className="text-sm text-zinc-500 mt-1">View your payments and download invoices</p>
      </div>

      <div className="flex items-center gap-3">
        <a
          href={customerId ? `/customer-portal?customer_id=${encodeURIComponent(customerId)}` : "#"}
          className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium ${
            customerId
              ? "bg-indigo-600 text-white hover:bg-indigo-700"
              : "bg-zinc-200 text-zinc-500 cursor-not-allowed"
          }`}
          aria-disabled={!customerId}
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m-9 8.25h9A2.25 2.25 0 0 0 18.75 18V6A2.25 2.25 0 0 0 16.5 3.75h-9A2.25 2.25 0 0 0 5.25 6v12A2.25 2.25 0 0 0 7.5 20.25z" />
          </svg>
          Open Customer Portal
        </a>
        {!customerId && (
          <span className="text-xs text-zinc-500">
            No billing profile found for {displayName}. Complete a checkout to create one.
          </span>
        )}
      </div>

      <div className="rounded-xl border border-[var(--border)] overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] bg-zinc-50 dark:bg-zinc-900/30">
              <th className="text-left py-3 px-4">Date</th>
              <th className="text-left py-3 px-4">Amount</th>
              <th className="text-left py-3 px-4">Status</th>
              <th className="text-left py-3 px-4">Method</th>
              <th className="text-left py-3 px-4">Invoice</th>
              <th className="text-left py-3 px-4">Action</th>
            </tr>
          </thead>
          <tbody>
            {payments.length === 0 ? (
              <tr>
                <td className="py-6 px-4 text-zinc-500" colSpan={6}>
                  {customerId
                    ? "No payments found."
                    : "Billing history will appear here after your first purchase."}
                </td>
              </tr>
            ) : (
              payments.map((p) => {
                const date = new Date(p.created_at).toLocaleString();
                const amount = formatAmount(p.total_amount, p.currency);
                const method = [p.payment_method_type, p.payment_method]
                  .filter(Boolean)
                  .map((s) => String(s)).join(" · ").toUpperCase();
                return (
                  <tr key={p.payment_id} className="border-b border-[var(--border)] last:border-0">
                    <td className="py-3 px-4">{date}</td>
                    <td className="py-3 px-4">{amount}</td>
                    <td className="py-3 px-4">{(p.status ?? "succeeded").toString()}</td>
                    <td className="py-3 px-4">{method || "-"}</td>
                    <td className="py-3 px-4">{p.invoice_id ?? "-"}</td>
                    <td className="py-3 px-4">
                      {p.invoice_url ? (
                        <a
                          href={p.invoice_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-indigo-600 dark:text-indigo-400 hover:underline"
                        >
                          Download
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M7.5 12 12 16.5 16.5 12M12 3v13.5" />
                          </svg>
                        </a>
                      ) : (
                        <span className="text-zinc-400">N/A</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}