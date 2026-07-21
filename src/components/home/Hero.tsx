"use client";

import { useState } from "react";
import Image from "next/image";

export function Hero() {
  const [url, setUrl] = useState("https://example.com");
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const captureScreenshot = async () => {
    if (!url) return;
    setLoading(true);
    try {
      const proxyUrl = `/api/take?url=${encodeURIComponent(url)}&format=png`;
      setScreenshot(proxyUrl);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="relative overflow-hidden border-b border-[var(--border)] bg-gradient-to-b from-indigo-50/50 via-transparent to-transparent dark:from-indigo-950/20 dark:via-transparent pt-20 lg:pt-28 pb-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-12">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 rounded-full bg-indigo-50/80 dark:bg-indigo-950/30 px-4 py-1.5 text-sm font-medium text-indigo-700 dark:text-indigo-300 mb-6">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75 animate-ping" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500" />
            </span>
            <span>9 output formats • Ad blocking • PDF generation</span>
          </div>
          
          {/* Headline - More concise */}
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight">
            Beautiful screenshots
            <br />
            <span className="gradient-text">in seconds</span>
          </h1>
          
          {/* Subheadline - Shorter */}
          <p className="mt-6 text-lg text-zinc-600 dark:text-zinc-400 max-w-xl mx-auto">
            One API to capture any webpage. Block ads, cookie banners, and chat widgets automatically.
          </p>
          
          {/* Quick Demo Input */}
          <div className="mt-8 flex flex-col sm:flex-row gap-3 max-w-lg mx-auto">
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com"
              className="flex-1 rounded-lg border border-[var(--border)] bg-white dark:bg-zinc-900 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button
              onClick={captureScreenshot}
              disabled={loading}
              className="rounded-lg bg-indigo-600 px-6 py-3 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {loading ? "Capturing..." : "Capture"}
            </button>
          </div>
          
          {/* Trust indicators - More concise */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-6 text-sm text-zinc-500">
            <span className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-green-500" />
              100 free / month
            </span>
            <span className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-green-500" />
              No credit card
            </span>
          </div>
        </div>
        
        {/* Screenshot Preview */}
        <div className="max-w-4xl mx-auto">
          <div className="rounded-xl border border-[var(--border)] overflow-hidden shadow-2xl bg-[var(--background)]">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-[var(--border)] bg-zinc-50 dark:bg-zinc-900">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <div className="w-3 h-3 rounded-full bg-yellow-500" />
                <div className="w-3 h-3 rounded-full bg-green-500" />
              </div>
              <div className="flex-1 text-center text-xs text-zinc-500 font-mono">
                {url}
              </div>
            </div>
            <div className="p-1 bg-zinc-100 dark:bg-zinc-800 min-h-[300px] flex items-center justify-center">
              {screenshot ? (
                <img 
                  src={screenshot} 
                  alt="Screenshot preview" 
                  className="w-full h-auto rounded"
                />
              ) : (
                <div className="text-center text-zinc-400 py-16">
                  <svg className="w-12 h-12 mx-auto mb-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.25 15.75l5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0 0 22.5 18.75V5.25A2.25 2.25 0 0 0 20.25 3H3.75A2.25 2.25 0 0 0 1.5 5.25v13.5A2.25 2.25 0 0 0 3.75 21Z" />
                  </svg>
                  <p className="text-sm">Enter a URL above to capture</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}