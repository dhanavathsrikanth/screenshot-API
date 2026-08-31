export type ComparisonRow = {
  factor: string;
  us: string;
  them: string;
};

export type Comparison = {
  slug: string;
  competitor: string;
  domain: string;
  positioning: string;
  metaTitle: string;
  metaDescription: string;
  intro: string[];
  bestForThem: string[];
  rows: ComparisonRow[];
  faqs: Array<{ q: string; a: string }>;
};

export const comparisons: Comparison[] = [
  {
    slug: "urlbox",
    competitor: "Urlbox",
    domain: "urlbox.com",
    positioning:
      "Urlbox is an established screenshot and render API aimed at enterprises, with screenshot, PDF, and video rendering options.",
    metaTitle: "ScreenshotAPI vs Urlbox - Which Screenshot API Is Right for You?",
    metaDescription:
      "Compare ScreenshotAPI and Urlbox on pricing, free plans, ad blocking, output formats, and developer experience. See which screenshot API fits your stack.",
    intro: [
      "Urlbox has been around for years and is known for polished enterprise features — screenshots, PDFs, and even video rendering — with pricing that reflects that premium position.",
      "ScreenshotAPI takes a different approach: the same core job (pixel-perfect URL-to-image rendering in real Chromium) with a permanently free plan to start, transparent $9/$49 paid tiers, and defaults tuned for clean captures out of the box.",
    ],
    bestForThem: [
      "Teams that need video/GIF-style rendering of pages as part of a larger enterprise contract.",
      "Organizations that want a long-established vendor with enterprise sales and invoicing.",
    ],
    rows: [
      { factor: "Starting price", us: "$0 free plan", them: "Paid plans (see urlbox.com)" },
      { factor: "Permanent free tier", us: "Yes — monthly credits, no credit card", them: "Trial-based; check current terms" },
      { factor: "Ads & cookie banners blocked by default", us: "Yes", them: "Check vendor documentation" },
      { factor: "Output formats", us: "PNG, JPEG, WebP, PDF, GIF, TIFF, AVIF, SVG, HTML", them: "Screenshots, PDF, video" },
      { factor: "Full-page capture", us: "Yes", them: "Yes" },
      { factor: "Dark mode emulation", us: "Yes", them: "Yes" },
      { factor: "Bulk rendering endpoint", us: "Yes — POST /api/take/bulk (all plans, credits apply)", them: "Check vendor documentation" },
      { factor: "First request setup", us: "One authenticated GET request", them: "SDK or authenticated request" },
    ],
    faqs: [
      {
        q: "Is ScreenshotAPI a good Urlbox alternative?",
        a: "If your goal is turning URLs into pixel-perfect images or PDFs from code, ScreenshotAPI covers the same core workflow with a free starting plan and simple per-request pricing. Teams needing niche enterprise extras should compare both against their requirements.",
      },
      {
        q: "How is ScreenshotAPI priced compared to Urlbox?",
        a: "ScreenshotAPI starts free, with Starter at $9/month and Pro at $49/month plus credit packs. Urlbox does not publish a permanent free tier — check their site for current pricing.",
      },
      {
        q: "Can I try ScreenshotAPI without paying?",
        a: "Yes. The Free plan includes monthly render credits and every core feature, and you can also test rendering right on the homepage without creating an account.",
      },
    ],
  },
  {
    slug: "screenshotone",
    competitor: "ScreenshotOne",
    domain: "screenshotone.com",
    positioning:
      "ScreenshotOne is a popular indie-built screenshot API with SDKs and a generous developer following among indie hackers.",
    metaTitle: "ScreenshotAPI vs ScreenshotOne - Screenshot API Comparison",
    metaDescription:
      "ScreenshotOne alternative: compare free plans, default ad blocking, output formats, bulk endpoints, and pricing between ScreenshotAPI and ScreenshotOne.",
    intro: [
      "ScreenshotOne proved there is strong demand for simple, developer-friendly screenshot APIs — it is well documented, has official SDKs, and is widely used by indie makers. It also ships an official MCP server for AI agents.",
      "ScreenshotAPI competes on the same simplicity but pushes three things harder: aggressive capture cleanup by default (ads, cookie banners, and chat widgets are blocked before the shutter fires), nine output formats including AVIF and TIFF, and a free plan designed to stay useful beyond a trial window. Our MCP server exposes 5 tools (vs ScreenshotOne's 1) including element capture and Markdown extraction.",
    ],
    bestForThem: [
      "Developers already invested in its SDKs and examples.",
      "Projects that value a solo-founder product and community-driven roadmap.",
    ],
    rows: [
      { factor: "Starting price", us: "$0 free plan", them: "Free trial credits, then paid" },
      { factor: "Permanent free tier", us: "Yes — monthly credits, no credit card", them: "Limited trial; check current terms" },
      { factor: "Ads & cookie banners blocked by default", us: "Yes, on by default", them: "Optional flag" },
      { factor: "Output formats", us: "9 incl. PNG, WebP, AVIF, PDF", them: "Common image formats + PDF" },
      { factor: "Full-page capture", us: "Yes", them: "Yes" },
      { factor: "Dark mode emulation", us: "Yes", them: "Yes" },
      { factor: "Bulk rendering endpoint", us: "Yes — POST /api/take/bulk", them: "Available on higher tiers" },
      { factor: "MCP Server for AI agents", us: "5 tools: screenshot, element capture, Markdown, usage, job retrieval", them: "1 tool: render-website-screenshot" },
      { factor: "Element capture via MCP", us: "Yes — capture any CSS selector", them: "No" },
      { factor: "Free interactive demo", us: "On the homepage, no signup", them: "Sandbox with signup" },
    ],
    faqs: [
      {
        q: "Why choose ScreenshotAPI over ScreenshotOne?",
        a: "Both are solid choices. ScreenshotAPI differentiates on always-on ad/cookie-banner blocking (fewer surprises in production captures), broader format support including modern formats like AVIF, and a permanent free plan rather than trial-only credits.",
      },
      {
        q: "Does ScreenshotAPI have official SDKs like ScreenshotOne?",
        a: "The API is deliberately plain HTTP — one GET request returns the image — so it works with any language's standard library. We publish copy-paste guides for cURL, Python, Node.js, Go, PHP, Ruby, Java, C#, and Rust.",
      },
      {
        q: "Is migration difficult?",
        a: "Usually not. Most teams swap the endpoint URL, add the Authorization header, and map their existing parameters to ours. The parameter reference in the docs lists direct equivalents for common options like full page, viewport size, and format.",
      },
    ],
  },
  {
    slug: "apiflash",
    competitor: "ApiFlash",
    domain: "apiflash.com",
    positioning:
      "ApiFlash is a lightweight screenshot API built on AWS Lambda, offering a simple parameter set and a small free tier.",
    metaTitle: "ScreenshotAPI vs ApiFlash - Which Screenshot API Wins in 2026?",
    metaDescription:
      "Compare ApiFlash with ScreenshotAPI: free tier limits, ad and cookie-banner blocking, dark mode, output formats, and pricing. Find the better fit for your app.",
    intro: [
      "ApiFlash keeps things minimal: a handful of query parameters over HTTPS, backed by serverless infrastructure, with a modest free allocation each month.",
      "ScreenshotAPI matches that simplicity — one GET request, no SDK required — while adding deeper capture quality controls that matter once screenshots become user-facing: automatic removal of ads and cookie banners, dark-mode emulation, custom viewports up to 4K, device scale factors, and nine output formats.",
    ],
    bestForThem: [
      "Very simple use cases where a tiny parameter surface is enough.",
      "AWS-centric teams that prefer Lambda-backed services.",
    ],
    rows: [
      { factor: "Starting price", us: "$0 free plan", them: "Free tier available" },
      { factor: "Monthly free renders", us: "Recurring monthly credits on Free plan", them: "Fixed small allocation (~100/mo)" },
      { factor: "Ads & cookie banners blocked by default", us: "Yes", them: "Not advertised as default" },
      { factor: "Output formats", us: "9 incl. PNG, JPEG, WebP, AVIF, PDF", them: "JPEG/PNG (+PDF on higher tiers)" },
      { factor: "Dark mode emulation", us: "Yes", them: "Check vendor documentation" },
      { factor: "Viewport flexibility", us: "320–3840px wide, custom scale factor", them: "Basic width/height controls" },
      { factor: "Bulk rendering endpoint", us: "Yes — POST /api/take/bulk", them: "Not advertised" },
      { factor: "Interactive live demo", us: "Homepage, no account needed", them: "Requires access key" },
    ],
    faqs: [
      {
        q: "Which is cheaper: ApiFlash or ScreenshotAPI?",
        a: "Both have entry-level options, but ScreenshotAPI's free plan renews monthly credits indefinitely instead of a one-off trial, and paid tiers are published transparently at $9 and $49 per month. Compare current ApiFlash pricing directly on their site before deciding.",
      },
      {
        q: "Does ScreenshotAPI block cookie banners like ApiFlash?",
        a: "Cookie-banner, ad, and chat-widget blocking is enabled by default on every ScreenshotAPI request, so captures come back clean without extra flags or post-processing.",
      },
      {
        q: "Can I render PDFs with either service?",
        a: "Yes. Both can produce PDFs. ScreenshotAPI includes PDF output across plans with A4/A3/Letter/Legal page sizes and print-background control.",
      },
    ],
  },
  {
    slug: "htmlcsstoimage",
    competitor: "HTML/CSS to Image",
    domain: "htmlcsstoimage.com",
    positioning:
      "HTML/CSS to Image generates images from HTML/CSS snippets you supply — ideal for OG images and dynamic badges — rather than photographing live public webpages.",
    metaTitle: "ScreenshotAPI vs HTML/CSS to Image - Which API Do You Need?",
    metaDescription:
      "HTML/CSS-to-image APIs and screenshot APIs solve different problems. Compare HTML/CSS to Image with ScreenshotAPI and pick the right tool for your project.",
    intro: [
      "These two products overlap less than they appear to. HTML/CSS to Image renders markup you write into an image — perfect for Open Graph cards, receipts, and social badges where you control the template.",
      "ScreenshotAPI photographs real webpages: any public URL, rendered fully in Chromium with JavaScript executed, ads stripped, and the entire scrollable page captured if you ask for it. If your input is a URL, this is the tool for the job — and if your input is a template, an HTML-rendering API remains the better fit.",
    ],
    bestForThem: [
      "Generating images from templates you author (OG images, certificates, badges).",
      "Workflows where pixel-exact control of the markup matters more than capturing reality.",
    ],
    rows: [
      { factor: "Input type", us: "Any public URL", them: "Your own HTML/CSS" },
      { factor: "Renders JavaScript sites", us: "Yes — real Chromium", them: "Only what you include" },
      { factor: "Full-page website capture", us: "Yes", them: "N/A" },
      { factor: "Ad & cookie-banner blocking", us: "Yes, by default", them: "N/A" },
      { factor: "PDF export of live pages", us: "Yes", them: "N/A" },
      { factor: "Template-based OG images", us: "Possible via your hosted page", them: "Core feature" },
      { factor: "Starting price", us: "$0 free plan", them: "Free tier available" },
      { factor: "Output formats", us: "9 incl. PNG, JPEG, WebP, PDF", them: "PNG/JPEG" },
    ],
    faqs: [
      {
        q: "Should I use a screenshot API or an HTML-to-image API?",
        a: "Ask what your input is. If you have a URL, use a screenshot API — it executes JavaScript, blocks clutter, and captures exactly what users see. If you have a template, an HTML-to-image service gives tighter control over typography and layout.",
      },
      {
        q: "Can ScreenshotAPI generate OG images?",
        a: "Yes, if you host (or generate) a page for each image. Many teams combine both approaches: templates via an HTML renderer for card text, and ScreenshotAPI for anything involving real webpages.",
      },
      {
        q: "Can I use both together?",
        a: "Absolutely — they complement each other. A common pattern renders dynamic badges with an HTML-to-image API and uses ScreenshotAPI for link previews, archiving, QA, and reporting.",
      },
    ],
  },
];

export function getComparison(slug: string): Comparison | undefined {
  return comparisons.find((c) => c.slug === slug);
}

export function otherComparisons(currentSlug: string): Comparison[] {
  return comparisons.filter((c) => c.slug !== currentSlug);
}
