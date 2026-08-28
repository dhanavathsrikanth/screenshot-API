"use client";

import { useState, useCallback } from "react";
import type { PlanId } from "@/lib/plans";

const VIDEO_FORMATS = new Set(["mp4", "webm", "gif"]);

const FORMATS_BY_PLAN: Record<PlanId, string[]> = {
  free: ["png", "jpeg", "webp"],
  starter: ["png", "jpeg", "webp", "pdf"],
  pro: ["png", "jpeg", "webp", "pdf"],
  scale: ["png", "jpeg", "webp", "pdf", "gif", "mp4", "webm"],
};

const FORMAT_LABELS: Record<string, string> = {
  png: "PNG",
  jpeg: "JPEG",
  webp: "WebP",
  pdf: "PDF",
  gif: "GIF (animated)",
  mp4: "MP4 (video)",
  webm: "WebM (video)",
};

const WAIT_UNTIL_OPTIONS = ["load", "domcontentloaded", "networkidle0", "networkidle2"];

const PDF_FORMATS = ["a4", "a3", "a2", "a1", "a0", "legal", "letter", "tabloid"];

const COUNTRIES: [string, string][] = [
  ["US", "United States"],
  ["GB", "United Kingdom"],
  ["DE", "Germany"],
  ["FR", "France"],
  ["ES", "Spain"],
  ["IT", "Italy"],
  ["NL", "Netherlands"],
  ["SE", "Sweden"],
  ["CH", "Switzerland"],
  ["PL", "Poland"],
  ["CA", "Canada"],
  ["MX", "Mexico"],
  ["BR", "Brazil"],
  ["AU", "Australia"],
  ["JP", "Japan"],
  ["KR", "South Korea"],
  ["IN", "India"],
  ["ID", "Indonesia"],
  ["SG", "Singapore"],
  ["AE", "United Arab Emirates"],
];

function getCreditCost(format: string, videoSeconds?: number): number {
  if (VIDEO_FORMATS.has(format) && videoSeconds && videoSeconds > 0) {
    return Math.max(5, Math.ceil(videoSeconds));
  }
  if (format === "pdf") return 5;
  return 1;
}

const inputClass =
  "rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:opacity-50 disabled:cursor-not-allowed";

const checkboxClass = "rounded border-[var(--border)] text-orange-600 focus:ring-orange-500 disabled:opacity-50";

function SectionLabel({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--dim)]">
      {children}
      {hint && <span className="ml-1.5 normal-case tracking-normal opacity-70 font-normal">{hint}</span>}
    </p>
  );
}

export function DashboardPlayground({ plan = "free" }: { plan?: PlanId }) {
  const allowedFormats = FORMATS_BY_PLAN[plan] ?? FORMATS_BY_PLAN.free;
  const elementaryFormats = allowedFormats.filter((f) => !VIDEO_FORMATS.has(f));
  const videoFormats = allowedFormats.filter((f) => VIDEO_FORMATS.has(f));
  const geoAllowed = plan === "pro" || plan === "scale";
  const fullPageAllowed = plan !== "free";

  const [url, setUrl] = useState("https://example.com");
  const [format, setFormat] = useState<string>("png");
  const [fullPage, setFullPage] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [width, setWidth] = useState(1280);
  const [videoSeconds, setVideoSeconds] = useState(5);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [storageUrl, setStorageUrl] = useState<string | null>(null);
  const [resultType, setResultType] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creditsUsed, setCreditsUsed] = useState<number | null>(null);

  // Advanced options (subset of the full ScreenshotOptionsSchema).
  const [quality, setQuality] = useState(80);
  const [viewportHeight, setViewportHeight] = useState(720);
  const [deviceScaleFactor, setDeviceScaleFactor] = useState(1);
  const [omitBackground, setOmitBackground] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [selector, setSelector] = useState("");
  const [waitUntil, setWaitUntil] = useState("");
  const [waitForSelector, setWaitForSelector] = useState("");
  const [delay, setDelay] = useState(0);
  const [blockAds, setBlockAds] = useState(true);
  const [blockCookieBanners, setBlockCookieBanners] = useState(true);
  const [blockChats, setBlockChats] = useState(true);
  const [blockTrackers, setBlockTrackers] = useState(true);
  const [blockImages, setBlockImages] = useState(false);
  const [userAgent, setUserAgent] = useState("");
  const [isMobile, setIsMobile] = useState(false);
  const [hasTouch, setHasTouch] = useState(false);
  const [country, setCountry] = useState("");
  const [pdfFormat, setPdfFormat] = useState("");
  const [pdfPrintBackground, setPdfPrintBackground] = useState(true);
  const [authUsername, setAuthUsername] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [videoSpeed, setVideoSpeed] = useState(1);

  const effectiveFormat = allowedFormats.includes(format) ? format : "png";
  const isVideoFormat = effectiveFormat === "mp4" || effectiveFormat === "webm";
  const isAnimatedGif = effectiveFormat === "gif";
  const isVideoMode = isVideoFormat || isAnimatedGif;
  // GIF is delivered as image/gif and plays in an <img>; only mp4/webm are
  // real video streams rendered in a <video> element.
  const isRealVideo = isVideoFormat;
  const showPdfOptions = effectiveFormat === "pdf";

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    setStorageUrl(null);
    setResultType(null);
    setCreditsUsed(null);

    const f = allowedFormats.includes(format) ? format : "png";

    try {
      const body: Record<string, unknown> = {
        url,
        format: f,
        viewport_width: width,
        viewport_height: viewportHeight,
        device_scale_factor: deviceScaleFactor,
        full_page: fullPage && fullPageAllowed,
        dark_mode: darkMode,
        timeout: 20000,
        quality,
        omit_background: omitBackground,
        reduced_motion: reducedMotion,
        block_ads: blockAds,
        block_cookie_banners: blockCookieBanners,
        block_chats: blockChats,
        block_trackers: blockTrackers,
        block_images: blockImages,
        is_mobile: isMobile,
        has_touch: hasTouch,
        pdf_print_background: pdfPrintBackground,
      };
      if (isVideoMode) {
        body.video_seconds = videoSeconds;
        body.video_speed = videoSpeed;
      }
      if (selector.trim()) body.selector = selector.trim();
      if (waitUntil) body.wait_until = waitUntil;
      if (waitForSelector.trim()) body.wait_for_selector = waitForSelector.trim();
      if (delay > 0) body.delay = delay;
      if (userAgent.trim()) body.user_agent = userAgent.trim();
      if (country.trim() && geoAllowed) body.country = country.trim().toUpperCase();
      if (pdfFormat) body.pdf_format = pdfFormat;
      if (authUsername.trim()) {
        body.auth_username = authUsername.trim();
        if (authPassword) body.auth_password = authPassword;
      }

      const response = await fetch("/api/take", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        let message = "Failed to render";
        try {
          const err = await response.json();
          message = typeof err.error === "string" ? err.error : err.error?.message ?? message;
        } catch {
          message = `Server error (${response.status})`;
        }
        throw new Error(message);
      }

      const data = await response.json();
      const headerCost = response.headers.get("X-Credits-Used");
      setCreditsUsed(headerCost != null ? Number(headerCost) : getCreditCost(f, isVideoMode ? videoSeconds : undefined));

      if (data.url) {
        setStorageUrl(data.url);
        setResult(data.url);
        setResultType(isRealVideo ? "video" : isAnimatedGif ? "image" : f === "pdf" ? "pdf" : "image");
      } else {
        const blob = await response.blob();
        const objectUrl = URL.createObjectURL(blob);
        setResult(objectUrl);
        setResultType(isRealVideo ? "video" : isAnimatedGif ? "image" : f === "pdf" ? "pdf" : "image");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }, [url, format, allowedFormats, fullPage, fullPageAllowed, darkMode, width, videoSeconds, videoSpeed, isVideoMode, isRealVideo, isAnimatedGif, quality, viewportHeight, deviceScaleFactor, omitBackground, reducedMotion, selector, waitUntil, waitForSelector, delay, blockAds, blockCookieBanners, blockChats, blockTrackers, blockImages, userAgent, isMobile, hasTouch, country, geoAllowed, pdfFormat, pdfPrintBackground, authUsername, authPassword]);

  const handleDownload = useCallback(() => {
    const href = storageUrl ?? result;
    if (!href) return;
    const a = document.createElement("a");
    a.href = href;
    const ext = effectiveFormat === "jpeg" ? "jpg" : effectiveFormat;
    a.download = `screenshot.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, [result, storageUrl, effectiveFormat]);

  const creditCost = getCreditCost(effectiveFormat, isVideoMode ? videoSeconds : undefined);

  return (
    <div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex gap-3">
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com"
            className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--background)] px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
            required
          />
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-orange-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-orange-700 disabled:opacity-50 transition-colors whitespace-nowrap"
          >
            {loading ? (isVideoMode ? "Recording..." : "Capturing...") : (isVideoMode ? "Record Video" : "Take Screenshot")}
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="text-xs text-[var(--dim)]">Format</label>
            <select
              value={effectiveFormat}
              onChange={(e) => setFormat(e.target.value)}
              className={inputClass}
            >
              <optgroup label="Raster / document">
                {elementaryFormats.map((f) => (
                  <option key={f} value={f}>{FORMAT_LABELS[f] ?? f.toUpperCase()}</option>
                ))}
              </optgroup>
              {videoFormats.length > 0 && (
                <optgroup label="Video / Animated (Scale)">
                  {videoFormats.map((f) => (
                    <option key={f} value={f}>{FORMAT_LABELS[f]}</option>
                  ))}
                </optgroup>
              )}
            </select>
          </div>

          {isVideoMode && (
            <div className="flex items-center gap-2">
              <label className="text-xs text-[var(--dim)]">Duration</label>
              <input
                type="range"
                min={1}
                max={30}
                value={videoSeconds}
                onChange={(e) => setVideoSeconds(Number(e.target.value))}
                className="w-24 accent-orange-600"
              />
              <span className="text-xs font-mono text-[var(--dim)] w-8">{videoSeconds}s</span>
            </div>
          )}
          {isVideoMode && (
            <div className="flex items-center gap-2">
              <label className="text-xs text-[var(--dim)]">Speed</label>
              <select value={videoSpeed} onChange={(e) => setVideoSpeed(Number(e.target.value))} className={inputClass + " px-2 py-1.5"}>
                <option value={1}>1x</option>
                <option value={2}>2x</option>
                <option value={3}>3x</option>
                <option value={4}>4x</option>
              </select>
            </div>
          )}

          <div className="flex items-center gap-2">
            <label className="text-xs text-[var(--dim)]">Width</label>
            <input
              type="number"
              value={width}
              onChange={(e) => setWidth(Number(e.target.value))}
              min={320}
              max={5000}
              className="w-20 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>
          <label className="flex items-center gap-1.5 text-sm cursor-pointer" title={fullPageAllowed ? undefined : "Full-page captures require the Starter plan or above."}>
            <input
              type="checkbox"
              checked={fullPage && fullPageAllowed}
              disabled={!fullPageAllowed}
              onChange={(e) => setFullPage(e.target.checked)}
              className={checkboxClass}
            />
            <span className="text-xs text-[var(--dim)]">Full page{!fullPageAllowed && <span className="ml-1 text-amber-600 dark:text-amber-400">(Starter+)</span>}</span>
          </label>
          <label className="flex items-center gap-1.5 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={darkMode}
              onChange={(e) => setDarkMode(e.target.checked)}
              className={checkboxClass}
            />
            <span className="text-xs text-[var(--dim)]">Dark mode</span>
          </label>
          <span className="text-xs text-[var(--dim)] ml-auto">
            Cost: <span className="font-semibold text-amber-600 dark:text-amber-400">{creditCost} credit{creditCost !== 1 ? "s" : ""}</span>
          </span>
        </div>

        <button
          type="button"
          onClick={() => setAdvancedOpen((v) => !v)}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-orange-600 dark:text-orange-400 hover:text-orange-700 dark:hover:text-orange-300"
        >
          <svg className={`h-3.5 w-3.5 transition-transform ${advancedOpen ? "rotate-90" : ""}`} fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
          </svg>
          Advanced options
        </button>

        {advancedOpen && (
          <div className="rounded-xl border border-[var(--border)] p-4 space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-x-6 gap-y-5">
              <div className="space-y-2">
                <SectionLabel>Capture</SectionLabel>
                <label className="block text-xs text-[var(--dim)]">
                  Quality ({quality})
                  <input
                    type="range"
                    min={1}
                    max={100}
                    value={quality}
                    onChange={(e) => setQuality(Number(e.target.value))}
                    className="mt-1 w-full accent-orange-600"
                  />
                </label>
                <label className="block text-xs text-[var(--dim)]">
                  Viewport height
                  <input
                    type="number"
                    value={viewportHeight}
                    onChange={(e) => setViewportHeight(Number(e.target.value))}
                    min={200}
                    max={5000}
                    className={`${inputClass} mt-1 w-full`}
                  />
                </label>
                <label className="block text-xs text-[var(--dim)]">
                  Device scale factor
                  <select value={deviceScaleFactor} onChange={(e) => setDeviceScaleFactor(Number(e.target.value))} className={`${inputClass} mt-1 w-full`}>
                    <option value={1}>1x</option>
                    <option value={2}>2x</option>
                    <option value={3}>3x</option>
                  </select>
                </label>
                <label className="flex items-center gap-1.5 text-xs text-[var(--dim)] cursor-pointer">
                  <input type="checkbox" checked={omitBackground} onChange={(e) => setOmitBackground(e.target.checked)} className={checkboxClass} />
                  Omit background
                </label>
                <label className="flex items-center gap-1.5 text-xs text-[var(--dim)] cursor-pointer">
                  <input type="checkbox" checked={reducedMotion} onChange={(e) => setReducedMotion(e.target.checked)} className={checkboxClass} />
                  Reduced motion
                </label>
              </div>

              <div className="space-y-2">
                <SectionLabel>Element &amp; wait</SectionLabel>
                <label className="block text-xs text-[var(--dim)]">
                  Element selector
                  <input
                    type="text"
                    value={selector}
                    onChange={(e) => setSelector(e.target.value)}
                    placeholder="e.g. #pricing"
                    className={`${inputClass} mt-1 w-full`}
                  />
                </label>
                <label className="block text-xs text-[var(--dim)]">
                  Wait until
                  <select value={waitUntil} onChange={(e) => setWaitUntil(e.target.value)} className={`${inputClass} mt-1 w-full`}>
                    <option value="">Default</option>
                    {WAIT_UNTIL_OPTIONS.map((w) => (
                      <option key={w} value={w}>{w}</option>
                    ))}
                  </select>
                </label>
                <label className="block text-xs text-[var(--dim)]">
                  Wait for selector
                  <input
                    type="text"
                    value={waitForSelector}
                    onChange={(e) => setWaitForSelector(e.target.value)}
                    placeholder="e.g. .app-loaded"
                    className={`${inputClass} mt-1 w-full`}
                  />
                </label>
                <label className="block text-xs text-[var(--dim)]">
                  Delay (ms)
                  <input
                    type="number"
                    value={delay}
                    onChange={(e) => setDelay(Number(e.target.value))}
                    min={0}
                    max={1000}
                    className={`${inputClass} mt-1 w-full`}
                  />
                </label>
              </div>

              <div className="space-y-2">
                <SectionLabel>Blocking</SectionLabel>
                <label className="flex items-center gap-1.5 text-xs text-[var(--dim)] cursor-pointer">
                  <input type="checkbox" checked={blockAds} onChange={(e) => setBlockAds(e.target.checked)} className={checkboxClass} />
                  Ads
                </label>
                <label className="flex items-center gap-1.5 text-xs text-[var(--dim)] cursor-pointer">
                  <input type="checkbox" checked={blockCookieBanners} onChange={(e) => setBlockCookieBanners(e.target.checked)} className={checkboxClass} />
                  Cookie banners
                </label>
                <label className="flex items-center gap-1.5 text-xs text-[var(--dim)] cursor-pointer">
                  <input type="checkbox" checked={blockChats} onChange={(e) => setBlockChats(e.target.checked)} className={checkboxClass} />
                  Live chat widgets
                </label>
                <label className="flex items-center gap-1.5 text-xs text-[var(--dim)] cursor-pointer">
                  <input type="checkbox" checked={blockTrackers} onChange={(e) => setBlockTrackers(e.target.checked)} className={checkboxClass} />
                  Trackers
                </label>
                <label className="flex items-center gap-1.5 text-xs text-[var(--dim)] cursor-pointer">
                  <input type="checkbox" checked={blockImages} onChange={(e) => setBlockImages(e.target.checked)} className={checkboxClass} />
                  Images
                </label>

                <div className="pt-2 space-y-2">
                  <SectionLabel>Device emulation</SectionLabel>
                  <label className="block text-xs text-[var(--dim)]">
                    User agent
                    <input
                      type="text"
                      value={userAgent}
                      onChange={(e) => setUserAgent(e.target.value)}
                      placeholder="Custom UA string"
                      className={`${inputClass} mt-1 w-full`}
                    />
                  </label>
                  <label className="flex items-center gap-1.5 text-xs text-[var(--dim)] cursor-pointer">
                    <input type="checkbox" checked={isMobile} onChange={(e) => setIsMobile(e.target.checked)} className={checkboxClass} />
                    Mobile viewport
                  </label>
                  <label className="flex items-center gap-1.5 text-xs text-[var(--dim)] cursor-pointer">
                    <input type="checkbox" checked={hasTouch} onChange={(e) => setHasTouch(e.target.checked)} className={checkboxClass} />
                    Touch input
                  </label>
                </div>
              </div>

              <div className="space-y-2">
                <SectionLabel>Geo-targeting <span className={geoAllowed ? "" : "text-amber-600 dark:text-amber-400 font-semibold"}>Pro+</span></SectionLabel>
                <label className="block text-xs text-[var(--dim)]">
                  Country (ISO 3166-1 alpha-2)
                  <input
                    type="text"
                    value={country}
                    onChange={(e) => setCountry(e.target.value.replace(/[^a-zA-Z]/g, "").toUpperCase().slice(0, 2))}
                    placeholder="e.g. US, DE, JP"
                    disabled={!geoAllowed}
                    list="playground-countries"
                    className={`${inputClass} mt-1 w-full`}
                  />
                </label>
                <datalist id="playground-countries">
                  {COUNTRIES.map(([code, name]) => (
                    <option key={code} value={code}>{name}</option>
                  ))}
                </datalist>
                <p className="text-[10px] leading-relaxed text-[var(--dim)]">
                  Renders the page through a residential exit IP in the chosen country.
                  {!geoAllowed && " Available on the Pro plan and above."}
                </p>

                {showPdfOptions && (
                  <div className="pt-2 space-y-2">
                    <SectionLabel>PDF export</SectionLabel>
                    <label className="block text-xs text-[var(--dim)]">
                      Page format
                      <select value={pdfFormat} onChange={(e) => setPdfFormat(e.target.value)} className={`${inputClass} mt-1 w-full`}>
                        <option value="">Default (A4)</option>
                        {PDF_FORMATS.map((f) => (
                          <option key={f} value={f}>{f.toUpperCase()}</option>
                        ))}
                      </select>
                    </label>
                    <label className="flex items-center gap-1.5 text-xs text-[var(--dim)] cursor-pointer">
                      <input type="checkbox" checked={pdfPrintBackground} onChange={(e) => setPdfPrintBackground(e.target.checked)} className={checkboxClass} />
                      Print background
                    </label>
                  </div>
                )}

                <div className="pt-2 space-y-2">
                  <SectionLabel>HTTP auth (optional)</SectionLabel>
                  <label className="block text-xs text-[var(--dim)]">
                    Username
                    <input
                      type="text"
                      value={authUsername}
                      onChange={(e) => setAuthUsername(e.target.value)}
                      autoComplete="off"
                      className={`${inputClass} mt-1 w-full`}
                    />
                  </label>
                  <label className="block text-xs text-[var(--dim)]">
                    Password
                    <input
                      type="password"
                      value={authPassword}
                      onChange={(e) => setAuthPassword(e.target.value)}
                      autoComplete="off"
                      className={`${inputClass} mt-1 w-full`}
                    />
                  </label>
                </div>
              </div>
            </div>
          </div>
        )}
      </form>

      {error && (
        <div className="rounded-lg bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 p-4 mt-4">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {result && (
        <div className="mt-4 rounded-lg border border-[var(--border)] overflow-hidden">
          <div className="bg-[var(--muted)] dark:bg-[var(--card)] px-4 py-2 border-b border-[var(--border)] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-xs text-[var(--dim)]">Preview</span>
              {creditsUsed != null && (
                <span className="inline-flex items-center rounded-md bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-950/50 dark:text-amber-400 ring-1 ring-inset ring-amber-600/20">
                  {creditsUsed} credit{creditsUsed !== 1 ? "s" : ""} used
                </span>
              )}
              {storageUrl && (
                <a href={storageUrl} target="_blank" rel="noopener noreferrer" className="text-[10px] text-orange-500 hover:underline">
                  View saved
                </a>
              )}
            </div>
            <button
              onClick={handleDownload}
              className="text-xs text-orange-600 dark:text-orange-400 hover:underline"
            >
              Download
            </button>
          </div>
          {resultType === "video" ? (
            <div className="bg-[#111] flex items-center justify-center">
              <video
                src={result ?? undefined}
                controls
                autoPlay
                className="w-full max-h-[500px] object-contain"
              />
            </div>
          ) : resultType === "image" && isAnimatedGif ? (
            <div className="bg-[#111] flex items-center justify-center">
              {/* Animated GIF plays in an <img>, not a <video> element. */}
              <img
                src={result ?? undefined}
                alt="Animated GIF preview"
                className="w-full max-h-[500px] object-contain"
              />
            </div>
          ) : resultType === "pdf" ? (
            <div className="p-8 text-center bg-[var(--muted)] dark:bg-[var(--card)]">
              <svg className="mx-auto h-12 w-12 text-[var(--dim)] mb-3" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
              </svg>
              <p className="text-sm text-[var(--dim)]">PDF ready for download</p>
            </div>
          ) : (
            <img
              src={result}
              alt="Screenshot preview"
              className="w-full max-h-[500px] object-contain bg-[var(--muted)] dark:bg-[var(--card)]"
            />
          )}
        </div>
      )}

      {!result && !error && !loading && (
        <div className="mt-4 rounded-xl border border-dashed border-[var(--border)] p-8 text-center">
          <p className="text-sm text-[var(--dim)]">Enter a URL and click Take Screenshot to see the result here.</p>
        </div>
      )}
    </div>
  );
}