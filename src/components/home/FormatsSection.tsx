const formats = [
  { name: "PNG", desc: "Lossless with transparency" },
  { name: "JPEG", desc: "Compressed, quality 1-100" },
  { name: "WebP", desc: "Modern, ~30% smaller" },
  { name: "PDF", desc: "A4, Letter, margins, backgrounds" },
  { name: "GIF", desc: "Animated captures" },
  { name: "TIFF", desc: "Print-quality, lossless" },
  { name: "AVIF", desc: "Next-gen compression" },
  { name: "SVG", desc: "Vector wrapper (PNG inside)" },
  { name: "HTML", desc: "Post-JS rendered source" },
];

export function FormatsSection() {
  return (
    <section className="mb-16 px-6">
      <div className="mx-auto max-w-6xl">
        <h2 className="mb-[18px] font-mono text-xs tracking-[0.08em] text-[var(--dim)] uppercase">
          9 output formats
        </h2>
        <div className="grid grid-cols-2 gap-px border border-[var(--line)] bg-[var(--line)] sm:grid-cols-3">
          {formats.map((f) => (
            <div key={f.name} className="feature-card bg-white p-[22px] dark:bg-[var(--card)]">
              <span className="mb-1 block font-mono text-[11.5px] text-[var(--accent)]">
                format: {f.name.toLowerCase()}
              </span>
              <span className="mb-1.5 block font-semibold">{f.name}</span>
              <p className="text-[13px] leading-[1.55] text-[var(--dim)]">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
