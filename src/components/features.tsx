const features = [
  {
    title: "Clean Screenshots",
    description: "Block cookie banners, ads, trackers, and chat widgets automatically. Get spotless screenshots every time.",
    icon: "🧹",
  },
  {
    title: "Full-Page Capture",
    description: "Take screenshots of entire webpages. Triggers lazy-loaded images by scrolling automatically.",
    icon: "📄",
  },
  {
    title: "High-Resolution",
    description: "Support for Retina displays with device scale factor up to 3x. Pixel-perfect screenshots.",
    icon: "🔍",
  },
  {
    title: "Dark Mode",
    description: "Render screenshots in dark mode. Perfect for documentation and marketing materials.",
    icon: "🌙",
  },
  {
    title: "Custom CSS & JS",
    description: "Inject custom styles and scripts before rendering. Modify any page to your needs.",
    icon: "🎨",
  },
  {
    title: "Extract HTML",
    description: "Get fully rendered page source after JavaScript execution. Perfect for scraping, SEO, or LLM ingestion.",
    icon: "📄",
  },
  {
    title: "PDF Generation",
    description: "Convert any URL or HTML to PDF with full control over page size (A4, Letter, etc.), margins, and backgrounds.",
    icon: "📕",
  },
  {
    title: "Multiple Formats",
    description: "Export as PNG, JPEG, WebP, GIF, TIFF, AVIF, SVG, or PDF. Control quality and compression.",
    icon: "📦",
  },
  {
    title: "Element Capture",
    description: "Screenshot specific elements by CSS selector. Perfect for component previews.",
    icon: "🎯",
  },
  {
    title: "Smart Caching",
    description: "Edge-cached and long-term storage. Repeated renders return instantly.",
    icon: "⚡",
  },
  {
    title: "Developer SDKs",
    description: "Native SDKs for Node.js, Python, Go, Java, Ruby, and PHP. OpenAPI specification included.",
    icon: "🔧",
  },
];

export function Features() {
  return (
    <section className="border-b border-[var(--border)] py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold">Render precisely as you need</h2>
          <p className="mt-4 text-lg text-zinc-600 dark:text-zinc-400">
            Every option you need for website screenshot automation
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature) => (
            <article
              key={feature.title}
              className="rounded-xl border border-[var(--border)] p-6 hover:border-indigo-500/50 transition-colors"
            >
              <span className="text-2xl" aria-hidden="true">{feature.icon}</span>
              <h3 className="mt-4 font-semibold">{feature.title}</h3>
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                {feature.description}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
