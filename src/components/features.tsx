const features = [
  {
    title: "Clean Screenshots",
    command: "capture()",
    description: "Block cookie banners, ads, trackers, and chat widgets automatically. Get spotless screenshots every time.",
  },
  {
    title: "Full-Page Capture",
    command: "full_page: true · Starter+",
    description: "Capture the entire scrollable page. Lazy-loaded images are triggered automatically. Included on Starter ($9) and above.",
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
    command: "format: pdf · Starter+",
    description: "Convert any URL to PDF with control over page size, margins, and backgrounds. Starter plan and above.",
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
    title: "MCP for agents",
    command: "mcp install",
    description: "Official MCP server so Claude, Cursor, or any agent can capture a URL, an element, or Markdown without a browser farm.",
  },
  {
    title: "Pay for successful renders",
    command: "status: 200",
    description: "Cached hits are free. Failed renders are not billed. Paid plans jump the queue so production traffic is not stuck behind demos.",
  },
];

export function Features() {
  return (
    <section id="features" className="mb-16 px-6">
      <div className="mx-auto max-w-6xl">
        <h2 className="mb-[18px] font-mono text-xs tracking-[0.08em] text-[var(--dim)] uppercase">
          features
        </h2>
        <div className="grid grid-cols-1 gap-px border border-[var(--line)] bg-[var(--line)] sm:grid-cols-2 lg:grid-cols-3">
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
