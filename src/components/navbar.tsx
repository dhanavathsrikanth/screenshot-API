"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth, SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";
import { ThemeToggle } from "@/components/theme-toggle";

const navLinks = [
  { label: "Docs", href: "/docs" },
  { label: "Pricing", href: "/pricing" },
  { label: "Tools", href: "/tools" },
  { label: "API Reference", href: "/docs#endpoints" },
  { label: "Contact", href: "/contact" },
];

function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2">
      <span className="flex h-6 w-6 items-center justify-center rounded bg-[var(--ink)]">
        <svg className="h-3.5 w-3.5 text-[var(--background)]" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0Z" />
        </svg>
      </span>
      <span className="text-base font-semibold">ScreenshotAPI</span>
    </Link>
  );
}

export function Navbar() {
  const { isSignedIn } = useAuth();
  const [open, setOpen] = useState(false);

  return (
    <header className="border-b border-[var(--line)]">
      <nav className="mx-auto flex h-14 max-w-3xl items-center justify-between px-6">
        <div className="flex items-center gap-8">
          <Logo />
          <div className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded px-3 py-1.5 text-sm text-[var(--dim)] transition-colors hover:text-[var(--ink)]"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>

        <div className="hidden md:flex items-center gap-3">
          <ThemeToggle />
          {isSignedIn ? (
            <>
              <Link
                href="/dashboard"
                className="rounded border border-[var(--line)] px-3 py-1.5 text-sm font-medium text-[var(--ink)] transition-colors hover:bg-[var(--muted)]"
              >
                Dashboard
              </Link>
              <UserButton
                appearance={{
                  elements: {
                    avatarBox: "h-7 w-7 rounded-full",
                  },
                }}
              />
            </>
          ) : (
            <>
              <SignInButton mode="modal" forceRedirectUrl="/dashboard">
                <button className="px-3 py-1.5 text-sm text-[var(--dim)] transition-colors hover:text-[var(--ink)]">
                  Sign in
                </button>
              </SignInButton>
              <SignUpButton mode="modal" forceRedirectUrl="/dashboard">
                <button className="rounded bg-[var(--ink)] px-4 py-1.5 text-sm font-medium text-[var(--background)] transition-colors">
                  Get Started
                </button>
              </SignUpButton>
            </>
          )}
        </div>

        <div className="flex items-center gap-3 md:hidden">
          <ThemeToggle />
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="p-1.5 text-[var(--dim)] transition-colors hover:text-[var(--ink)]"
            aria-label="Toggle menu"
            aria-expanded={open}
          >
            {open ? (
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
              </svg>
            )}
          </button>
        </div>
      </nav>

      {open && (
        <div className="md:hidden border-t border-[var(--line)] px-6 py-4">
          <div className="flex flex-col gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="rounded px-3 py-2 text-sm text-[var(--dim)] transition-colors hover:text-[var(--ink)]"
              >
                {link.label}
              </Link>
            ))}
          </div>
          <div className="mt-4 flex flex-col gap-2 border-t border-[var(--line)] pt-4">
            {isSignedIn ? (
              <div className="flex items-center justify-between px-3">
                <Link
                  href="/dashboard"
                  onClick={() => setOpen(false)}
                  className="rounded border border-[var(--line)] px-4 py-2 text-sm font-medium text-[var(--ink)]"
                >
                  Dashboard
                </Link>
                <UserButton />
              </div>
            ) : (
              <>
                <SignInButton mode="modal" forceRedirectUrl="/dashboard">
                  <button
                    onClick={() => setOpen(false)}
                    className="w-full rounded border border-[var(--line)] px-4 py-2 text-sm font-medium text-[var(--ink)]"
                  >
                    Sign in
                  </button>
                </SignInButton>
                <SignUpButton mode="modal" forceRedirectUrl="/dashboard">
                  <button
                    onClick={() => setOpen(false)}
                    className="w-full rounded bg-[var(--ink)] px-4 py-2 text-sm font-medium text-[var(--background)]"
                  >
                    Get Started
                  </button>
                </SignUpButton>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
