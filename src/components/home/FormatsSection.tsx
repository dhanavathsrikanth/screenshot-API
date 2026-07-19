"use client";

const formats = [
  { name: "PNG", desc: "Lossless, transparent support", icon: "🖼️" },
  { name: "JPEG", desc: "Compressed, quality 1-100", icon: "📸" },
  { name: "WebP", desc: "Modern, 30% smaller", icon: "⚡" },
  { name: "PDF", desc: "A4, Letter, margins, backgrounds", icon: "📕" },
  { name: "GIF", desc: "Animated captures", icon: "🎞️" },
  { name: "TIFF", desc: "Print-quality, lossless", icon: "🖨️" },
  { name: "AVIF", desc: "Next-gen compression", icon: "🗜️" },
  { name: "SVG", desc: "Vector wrapper (PNG inside)", icon: "📐" },
  { name: "HTML", desc: "Post-JS rendered source", icon: "📄" },
];

export function FormatsSection() {
  return (
    <section className="py-20 border-y border-[var(--border)]">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold sm:text-4xl">9 Output Formats</h2>
          <p className="mt-4 text-lg text-zinc-600 dark:text-zinc-400 max-w-2xl mx-auto">
            Every format you need — from lossless PNG to next-gen AVIF, plus PDF with full page control and HTML extraction for scraping.
          </p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {formats.map((f) => (
            <div
              key={f.name}
              className="group rounded-xl border border-[var(--border)] p-6 text-center hover:border-indigo-500/50 hover:shadow-lg hover:shadow-indigo-500/10 transition-all duration-300"
            >
              <span className="text-4xl mb-3 block group-hover:scale-110 transition-transform">{f.icon}</span>
              <h3 className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">{f.name}</h3>
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}