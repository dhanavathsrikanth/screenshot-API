const claims = [
  "No SDK required",
  "Ads & banners blocked by default",
  "100 free captures / month",
  "Starter $9: full-page + PDF",
];

export function StackStrip() {
  return (
    <section className="mb-16 border-y border-[var(--line)] py-6 px-6">
      <div className="mx-auto max-w-6xl">
        <ul className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
          {claims.map((claim) => (
            <li key={claim} className="flex items-center gap-2 text-[13px] text-[var(--dim)]">
              <svg className="h-3.5 w-3.5 text-green-500" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
              </svg>
              {claim}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
