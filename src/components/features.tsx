const features = [
  {
    title: "Clean Screenshots",
    command: "capture()",
    description: "Block cookie banners, ads, trackers, and chat widgets automatically. Get spotless screenshots every time.",
  },
  {
    title: "Full-Page Capture",
    command: "full_page: true",
    description: "Take screenshots of entire webpages. Triggers lazy-loaded images by scrolling automatically.",
  },
  {
    title: "High-Resolution",
    command: "scale: 3",
    description: "Support for Retina displays with device scale factor up to 3x. Pixel-perfect screenshots.",
  },
  {
    title: "Dark Mode",
    command: "dark_mode: true",
    description: "Render screenshots in dark mode. Perfect for documentation and marketing materials.",
  },
  {
    title: "Custom CSS & JS",
    command: "inject()",
    description: "Inject custom styles and scripts before rendering. Modify any page to your needs.",
  },
  {
    title: "Extract HTML",
    command: "format: html",
    description: "Get fully rendered page source after JavaScript execution. Perfect for scraping or LLM ingestion.",
  },
  {
    title: "PDF Generation",
    command: "format: pdf",
    description: "Convert any URL to PDF with full control over page size, margins, and backgrounds.",
  },
  {
    title: "Multiple Formats",
    command: "format: webp",
    description: "Export as PNG, JPEG, WebP, GIF, TIFF, AVIF, SVG, or PDF. Control quality and compression.",
  },
  {
    title: "Element Capture",
    command: "selector: '#main'",
    description: "Screenshot specific elements by CSS selector. Perfect for component previews.",
  },
  {
    title: "Smart Caching",
    command: "cached: true",
    description: "Edge-cached and long-term storage. Repeated renders return instantly.",
  },
  {
    title: "MCP Server",
    command: "mcp install",
    description: "Official MCP server for Claude, Cursor, or any AI agent to capture screenshots with natural language.",
  },
  {
    title: "99.9% Uptime",
    command: "status: ok",
    description: "Global edge network with redundant infrastructure. Every request is served from the nearest region.",
  },
];

export function Features() {
  return (
    <section id="features" className="mb-16 px-6">
      <div className="mx-auto max-w-3xl">
        <h2 className="mb-[18px] font-mono text-xs tracking-[0.08em] text-[var(--dim)] uppercase">
          features
        </h2>
        <div className="grid grid-cols-1 gap-px border border-[var(--line)] bg-[var(--line)] sm:grid-cols-2">
          {features.map((feature) => (
            <div key={feature.title} className="feature-card bg-white p-[22px] dark:bg-[var(--card)]">
              <span className="mb-1.5 block font-semibold">{feature.title}</span>
              <span className="feature-cmd mb-2.5 block font-mono text-[11.5px] text-[var(--accent)] transition-colors">
                {feature.command}
              </span>
              <p className="text-[13.5px] leading-[1.55] text-[var(--dim)]">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
