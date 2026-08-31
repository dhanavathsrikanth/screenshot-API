import Link from "next/link";
import { CookieSettingsButton } from "@/components/cookie-settings-button";

const columns = [
  {
    title: "Product",
    links: [
      { label: "Screenshot API", href: "/" },
      { label: "Pricing", href: "/pricing" },
      { label: "Documentation", href: "/docs" },
      { label: "Free Tools", href: "/tools" },
      { label: "Status", href: "/status" },
    ],
  },
  {
    title: "Tools",
    links: [
      { label: "Website Screenshot", href: "/tools" },
      { label: "Full Page Screenshot", href: "/tools/full-page" },
      { label: "URL to PDF", href: "/tools/pdf" },
    ],
  },
  {
    title: "Resources",
    links: [
      { label: "SDKs", href: "/docs/sdks" },
      { label: "Signed URLs", href: "/docs/signed-urls" },
      { label: "Customer upload", href: "/docs/customer-upload" },
      { label: "Clean captures", href: "/docs/clean-captures" },
      { label: "Migrate from ScreenshotOne", href: "/docs/migrate/screenshotone" },
      { label: "Migrate from Urlbox", href: "/docs/migrate/urlbox" },
      { label: "Guides", href: "/docs#guides" },
      { label: "Status", href: "/status" },
      { label: "vs Urlbox", href: "/vs/urlbox" },
      { label: "vs ScreenshotOne", href: "/vs/screenshotone" },
      { label: "vs ApiFlash", href: "/vs/apiflash" },
    ],
  },
  {
    title: "Language Guides",
    links: [
      { label: "cURL", href: "/screenshot-api/curl" },
      { label: "Python", href: "/screenshot-api/python" },
      { label: "Node.js", href: "/screenshot-api/nodejs" },
      { label: "Go", href: "/screenshot-api/go" },
      { label: "PHP", href: "/screenshot-api/php" },
      { label: "Ruby", href: "/screenshot-api/ruby" },
      { label: "Java", href: "/screenshot-api/java" },
      { label: "C#", href: "/screenshot-api/csharp" },
      { label: "Rust", href: "/screenshot-api/rust" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "Contact", href: "/contact" },
      { label: "Privacy Policy", href: "/privacy" },
      { label: "Terms of Service", href: "/terms" },
      { label: "Cookie Policy", href: "/cookies" },
      { label: "Refund Policy", href: "/refunds" },
      { label: "Acceptable Use", href: "/aup" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="border-t border-[var(--line)]">
      <div className="mx-auto max-w-6xl px-6 py-8">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-3 lg:grid-cols-7">
          <div className="col-span-2">
            <Link href="/" className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded bg-[var(--ink)]">
                <svg className="h-3.5 w-3.5 text-[var(--background)]" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0Z" />
                </svg>
              </span>
              <span className="text-base font-semibold">ScreenshotAPI</span>
            </Link>
            <p className="mt-3 max-w-xs text-[13px] leading-[1.6] text-[var(--dim)]">
              The screenshot API for developers. Pixel-perfect captures of any website — clean, fast, and
              reliable.
            </p>
            <Link
              href="/status"
              className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-[var(--line)] bg-white px-2.5 py-1 text-[11px] text-[var(--dim)] hover:text-[var(--ink)] dark:bg-[var(--card)]"
            >
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-green-500" />
              </span>
              All systems operational
            </Link>
          </div>

          {columns.map((col) => (
            <div key={col.title}>
              <h3 className="text-[12px] font-semibold">{col.title}</h3>
              <ul className="mt-3 space-y-2">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-[13px] text-[var(--dim)] transition-colors hover:text-[var(--ink)]"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
                {col.title === "Company" && (
                  <li>
                    <CookieSettingsButton />
                  </li>
                )}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-8 flex flex-col items-center justify-between gap-4 border-t border-[var(--line)] pt-6 sm:flex-row">
          <p className="text-[12px] text-[var(--dim)]">
            &copy; {new Date().getFullYear()} ScreenshotAPI. All rights reserved.
          </p>
          <p className="text-[12px] text-[var(--dim)]">
            Built for developers, rendered on the edge.
          </p>
        </div>
      </div>
    </footer>
  );
}
