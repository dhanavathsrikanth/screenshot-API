import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t border-[var(--border)] bg-zinc-50 dark:bg-zinc-950">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          <div>
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Product</h3>
            <ul className="mt-4 space-y-3">
              <li><Link href="/" className="text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900">Screenshot API</Link></li>
              <li><Link href="/pricing" className="text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900">Pricing</Link></li>
              <li><Link href="/docs" className="text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900">Documentation</Link></li>
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Free Tools</h3>
            <ul className="mt-4 space-y-3">
              <li><Link href="/tools" className="text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900">Website Screenshot</Link></li>
              <li><Link href="/tools/full-page" className="text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900">Full Page Screenshot</Link></li>
              <li><Link href="/tools/pdf" className="text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900">URL to PDF</Link></li>
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Resources</h3>
            <ul className="mt-4 space-y-3">
              <li><Link href="/docs" className="text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900">API Reference</Link></li>
              <li><Link href="/docs#sdks" className="text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900">SDKs</Link></li>
              <li><Link href="/docs#guides" className="text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900">Guides</Link></li>
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Company</h3>
            <ul className="mt-4 space-y-3">
              <li><a href="mailto:hello@screentool.dev" className="text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900">Contact</a></li>
              <li><a href="#" className="text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900">Privacy Policy</a></li>
              <li><a href="#" className="text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900">Terms of Service</a></li>
            </ul>
          </div>
        </div>
        <div className="mt-12 border-t border-[var(--border)] pt-8">
          <p className="text-center text-sm text-zinc-500">
            &copy; {new Date().getFullYear()} ScreenTool. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
