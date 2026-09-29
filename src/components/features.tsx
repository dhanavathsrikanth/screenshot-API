const features = [
  {
    title: "Clean Screenshots",
    command: "capture()",
    description: "Block cookie banners, ads, trackers, and chat widgets automatically. Get spotless screenshots every time.",
  },
  {
    title: "Full-Page Capture",
    command: "full_page: true · Free",
    description: "Capture the entire scrollable page. Lazy-loaded images are triggered automatically, within your monthly credits.",
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
    command: "styles · scripts · click",
    description: "Apply custom styles or scripts and click a CSS selector before capturing through the v1 API.",
  },
  {
    title: "PDF Generation",
    command: "format: pdf · Free",
    description: "Convert URLs to PDF with page size, margins, and background controls, within your monthly credits.",
  },
  {
    title: "Multiple Formats",
    command: "format: webp",
    description: "Export as PNG, JPEG, WebP, or PDF on Free and Starter. Pro and Scale also include GIF, MP4, and WebM.",
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
    description: "Successful cache hits count toward your credits. Failed renders are refunded. Paid plans jump the queue.",
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
