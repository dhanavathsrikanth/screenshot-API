"use client";

import { useState, useCallback, useMemo } from "react";
import type { PlanId } from "@/lib/plans";
import { UpgradeButton } from "@/components/upgrade-button";

const VIDEO_FORMATS = new Set(["mp4", "webm", "gif"]);

const FORMATS_BY_PLAN: Record<PlanId, string[]> = {
  free: ["png", "jpeg", "webp"],
  starter: ["png", "jpeg", "webp", "pdf"],
  pro: ["png", "jpeg", "webp", "pdf", "gif", "mp4", "webm"],
  scale: ["png", "jpeg", "webp", "pdf", "gif", "mp4", "webm"],
};

const FORMAT_LABELS: Record<string, string> = {
  png: "Image",
  jpeg: "Photo (JPG)",
  webp: "Web Image",
  pdf: "PDF Document",
  gif: "Animated GIF",
  mp4: "Video (MP4)",
  webm: "Video (WebM)",
};

const FORMAT_HINTS: Record<string, string> = {
  png: "Best for most uses",
  jpeg: "Smaller file",
  webp: "Modern, small",
  pdf: "Save as document",
  gif: "Short animation",
  mp4: "Record the page",
  webm: "Record the page",
};

const WAIT_FRIENDLY: [string, string, string][] = [
  ["", "Auto — good for most sites", "We decide when it's ready"],
  ["domcontentloaded", "Fast — capture quickly", "Don't wait for images"],
  ["load", "Balanced — wait for images", "Recommended"],
  ["networkidle2", "Patient — wait until calm", "For slow or animated pages"],
];

const PDF_FORMATS: [string, string][] = [
  ["a4", "A4 — standard"],
  ["a3", "A3 — large"],
  ["letter", "Letter — US"],
  ["legal", "Legal — US long"],
];

const COUNTRIES: [string, string, string][] = [
  ["US", "United States", "🇺🇸"],
  ["GB", "United Kingdom", "🇬🇧"],
  ["DE", "Germany", "🇩🇪"],
  ["FR", "France", "🇫🇷"],
  ["ES", "Spain", "🇪🇸"],
  ["IT", "Italy", "🇮🇹"],
  ["NL", "Netherlands", "🇳🇱"],
  ["SE", "Sweden", "🇸🇪"],
  ["CH", "Switzerland", "🇨🇭"],
  ["PL", "Poland", "🇵🇱"],
  ["CA", "Canada", "🇨🇦"],
  ["MX", "Mexico", "🇲🇽"],
  ["BR", "Brazil", "🇧🇷"],
  ["AU", "Australia", "🇦🇺"],
  ["JP", "Japan", "🇯🇵"],
  ["KR", "South Korea", "🇰🇷"],
  ["IN", "India", "🇮🇳"],
  ["ID", "Indonesia", "🇮🇩"],
  ["SG", "Singapore", "🇸🇬"],
  ["AE", "United Arab Emirates", "🇦🇪"],
];

const SCREEN_PRESETS = [
  { label: "Phone", w: 390, h: 844, icon: "📱", hint: "iPhone size" },
  { label: "Tablet", w: 768, h: 1024, icon: "📲", hint: "iPad size" },
  { label: "Laptop", w: 1280, h: 720, icon: "💻", hint: "Most common" },
  { label: "Wide", w: 1920, h: 1080, icon: "🖥️", hint: "Full HD" },
];

function getCreditCost(format: string, videoSeconds?: number): number {
  if (VIDEO_FORMATS.has(format) && videoSeconds && videoSeconds > 0) {
    return Math.max(5, Math.ceil(videoSeconds));
  }
  if (format === "pdf") return 5;
  return 1;
}

const inputClass =
  "h-9 rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 text-[14px] focus:outline-none focus:ring-2 focus:ring-[var(--ink)] focus:border-[var(--ink)] disabled:opacity-50";
const selectClass =
  "h-9 rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 text-[14px] focus:outline-none focus:ring-2 focus:ring-[var(--ink)]";
const checkboxClass = "h-4 w-4 rounded border-[var(--border)] text-[var(--ink)] focus:ring-[var(--ink)]";

function Help({ text }: { text: string }) {
  return <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-[var(--muted)] text-[10px] text-[var(--dim)]" title={text}>?</span>;
}

function Section({
  icon,
  title,
  desc,
  children,
  defaultOpen = true,
}: {
  icon: string;
  title: string;
  desc: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)]">
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex w-full items-center justify-between px-4 py-3 text-left">
        <span className="flex items-center gap-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--muted)] text-[16px]">{icon}</span>
          <span>
            <span className="block text-[13px] font-semibold text-[var(--ink)]">{title}</span>
            <span className="block text-[11px] leading-tight text-[var(--dim)]">{desc}</span>
          </span>
        </span>
        <span className={`flex h-6 w-6 items-center justify-center rounded-full border border-[var(--border)] text-[var(--dim)] transition ${open ? "rotate-180" : ""}`}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m6 9 6 6 6-6" /></svg>
        </span>
      </button>
      {open && <div className="border-t border-[var(--border)] p-4">{children}</div>}
    </div>
  );
}

type PlaygroundMode = "sync" | "async" | "bulk";
type BulkResultItem = { url: string; success: boolean; error?: string; attempts: number; storage_url?: string | null };
const PLAYGROUND_MODES: { id: PlaygroundMode; label: string; hint: string }[] = [
  { id: "sync", label: "Single", hint: "One picture" },
  { id: "async", label: "In background", hint: "We’ll email when done" },
  { id: "bulk", label: "Many at once", hint: "Up to 100" },
];

async function pollV1Job(jobId: string): Promise<{ url: string; format: string; creditsUsed?: number }> {
  const maxAttempts = 60;
  for (let i = 0; i < maxAttempts; i++) {
    const response = await fetch(`/api/v1/screenshots/${jobId}`, { credentials: "include" });
    const payload = await response.json();
    if (!response.ok || !payload.success) throw new Error(payload.error?.message ?? "Failed to poll job status");
    const data = payload.data;
    if (data.status === "completed" && data.screenshot?.url) return { url: data.screenshot.url, format: data.screenshot.format ?? "png" };
    if (data.status === "failed") throw new Error(data.error?.message ?? "Render failed");
    await new Promise((r) => setTimeout(r, 1500));
  }
  throw new Error("Timed out waiting for the screenshot job to complete.");
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1200);
      }}
      className="inline-flex h-7 items-center gap-1.5 rounded-md border border-[var(--border)] bg-[var(--card)] px-2 text-[11px] font-medium text-[var(--dim)] hover:text-[var(--ink)] hover:border-[var(--ink)] transition-colors"
    >
      {copied ? "Copied ✓" : "Copy"}
    </button>
  );
}

export function DashboardPlayground({ plan = "free", showUpsell: _showUpsell = false }: { plan?: PlanId; showUpsell?: boolean }) {
  void _showUpsell;
  const allowedFormats = FORMATS_BY_PLAN[plan] ?? FORMATS_BY_PLAN.free;
  const elementaryFormats = allowedFormats.filter((f) => !VIDEO_FORMATS.has(f));
  const videoFormats = allowedFormats.filter((f) => VIDEO_FORMATS.has(f));
  const ALL_VIDEO_FORMATS: string[] = ["gif", "mp4", "webm"];
  const lockedVideoFormats = ALL_VIDEO_FORMATS.filter((f) => !allowedFormats.includes(f));
  const canTryVideo = videoFormats.length > 0;
  const geoAllowed = plan === "pro" || plan === "scale";

  const [url, setUrl] = useState("https://example.com");
  const [bulkUrls, setBulkUrls] = useState("https://example.com\nhttps://example.org");
  const [mode, setMode] = useState<PlaygroundMode>("sync");
  const [jobStatus, setJobStatus] = useState<string | null>(null);
  const [bulkResults, setBulkResults] = useState<{ total: number; successful: number; failed: number; creditsUsed: number; results: BulkResultItem[] } | null>(null);
  const [format, setFormat] = useState<string>("png");
  const [fullPage, setFullPage] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [width, setWidth] = useState(1280);
  const [videoSeconds, setVideoSeconds] = useState(5);
  const [result, setResult] = useState<string | null>(null);
  const [storageUrl, setStorageUrl] = useState<string | null>(null);
  const [resultType, setResultType] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [upgradeRequired, setUpgradeRequired] = useState(false);
  const [_creditsUsed, setCreditsUsed] = useState<number | null>(null);
  void _creditsUsed;
  const [responseTab, setResponseTab] = useState<"preview" | "code">("preview");
  const [codeLang, setCodeLang] = useState<"curl" | "js" | "py">("curl");

  const [quality, setQuality] = useState(80);
  const [viewportHeight, setViewportHeight] = useState(720);
  const [deviceScaleFactor, setDeviceScaleFactor] = useState(1);
  const [omitBackground, setOmitBackground] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [selector, setSelector] = useState("");
  const [waitUntil, setWaitUntil] = useState("");
  const [waitForSelector, setWaitForSelector] = useState("");
  const [waitForText, setWaitForText] = useState("");
  const [waitForUrl, setWaitForUrl] = useState("");
  const [delay, setDelay] = useState(0);
  const [blockAds, setBlockAds] = useState(true);
  const [blockCookieBanners, setBlockCookieBanners] = useState(true);
  const [blockChats, setBlockChats] = useState(true);
  const [blockTrackers, setBlockTrackers] = useState(true);
  const [blockPopups, setBlockPopups] = useState(true);
  const [blockImages, setBlockImages] = useState(false);
  const [userAgent, setUserAgent] = useState("");
  const [isMobile, setIsMobile] = useState(false);
  const [hasTouch, setHasTouch] = useState(false);
  const [country, setCountry] = useState("");
  const [pdfFormat, setPdfFormat] = useState("");
  const [pdfPrintBackground, setPdfPrintBackground] = useState(true);
  const [authUsername, setAuthUsername] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [loginUrl, setLoginUrl] = useState("");
  const [usernameSelector, setUsernameSelector] = useState("");
  const [passwordSelector, setPasswordSelector] = useState("");
  const [submitSelector, setSubmitSelector] = useState("");
  const [videoSpeed, setVideoSpeed] = useState(1);
  const [chatInput, setChatInput] = useState("");
  const [debugAnnotate, setDebugAnnotate] = useState(false);
  const [a11yCheck, setA11yCheck] = useState(true);

  const ALL_KNOWN_FORMATS = ["png", "jpeg", "webp", "pdf", "gif", "mp4", "webm"];
  const effectiveFormat = ALL_KNOWN_FORMATS.includes(format) ? format : "png";
  const isVideoFormat = effectiveFormat === "mp4" || effectiveFormat === "webm";
  const isAnimatedGif = effectiveFormat === "gif";
  const isVideoMode = isVideoFormat || isAnimatedGif;
  const isRealVideo = isVideoFormat;
  const showPdfOptions = effectiveFormat === "pdf";
  const isVideoLocked = !allowedFormats.includes(effectiveFormat) && VIDEO_FORMATS.has(effectiveFormat);

  const qualityLabel = quality <= 40 ? "Draft" : quality <= 80 ? "Good" : "Best";
  const qualityHint = quality <= 40 ? "Small file, ok quality" : quality <= 80 ? "Balanced — recommended" : "Sharpest, larger file (JPG/WebP)";

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setUpgradeRequired(false);
    setResult(null);
    setStorageUrl(null);
    setResultType(null);
    setCreditsUsed(null);
    setJobStatus(null);
    setBulkResults(null);
    const f = ALL_KNOWN_FORMATS.includes(format) ? format : "png";
    if (plan === "free" && fullPage) { setError("Full-page captures need a paid plan — you can try a normal screenshot for free."); setUpgradeRequired(true); setLoading(false); return; }
    if (plan === "free" && f === "pdf") { setError("PDF needs a paid plan — try PNG for free."); setUpgradeRequired(true); setLoading(false); return; }
    if (VIDEO_FORMATS.has(f) && !allowedFormats.includes(f)) {
      // Video/GIF require Pro — allow localhost preview for dev testing, otherwise gate with upsell
      if (typeof window !== "undefined" && window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1") {
        setError("Video & animated GIF need the Pro plan — select a Pro format to try. You can preview the options here and upgrade to capture."); setUpgradeRequired(true); setLoading(false); return;
      }
    }
    if ((plan === "free" || plan === "starter") && country.trim()) { setError("Viewing from another country needs Pro."); setUpgradeRequired(true); setLoading(false); return; }
    if (mode === "bulk" && isVideoMode) { setError("Bulk works with images and PDFs only."); setLoading(false); return; }

    const buildTakeBody = (targetUrl: string): Record<string, unknown> => {
      const needsCustomReadiness = Boolean(waitForSelector.trim() || waitForText.trim() || waitForUrl.trim() || delay > 0);
      const readiness = needsCustomReadiness ? "custom" : waitUntil === "networkidle0" || waitUntil === "networkidle2" ? "complete" : "fast";
      const body: Record<string, unknown> = {
        url: targetUrl, format: f, viewport_width: width, viewport_height: viewportHeight, device_scale_factor: deviceScaleFactor,
        full_page: fullPage, dark_mode: darkMode, timeout: 30000,
        readiness,
        quality, omit_background: omitBackground, reduced_motion: reducedMotion,
        block_ads: blockAds, block_cookie_banners: blockCookieBanners, block_chats: blockChats, block_trackers: blockTrackers, block_popups: blockPopups, block_images: blockImages,
        is_mobile: isMobile, has_touch: hasTouch, pdf_print_background: pdfPrintBackground,
      };
      if (isVideoMode) { body.video_seconds = videoSeconds; body.video_speed = videoSpeed; body.video_fps = 5; }
      if (selector.trim()) body.selector = selector.trim();
      if (waitUntil) body.wait_until = waitUntil;
      if (waitForSelector.trim()) body.wait_for_selector = waitForSelector.trim();
      if (waitForText.trim()) body.wait_for_text = waitForText.trim();
      if (waitForUrl.trim()) body.wait_for_url = waitForUrl.trim();
      if (delay > 0) body.delay = delay;
      if (userAgent.trim()) body.user_agent = userAgent.trim();
      if (country.trim() && geoAllowed) body.country = country.trim().toUpperCase();
      if (pdfFormat) body.pdf_format = pdfFormat;
      if (authUsername.trim()) { body.auth_username = authUsername.trim(); if (authPassword) body.auth_password = authPassword; }
      if (loginUrl.trim()) body.login_url = loginUrl.trim();
      if (usernameSelector.trim()) body.username_selector = usernameSelector.trim();
      if (passwordSelector.trim()) body.password_selector = passwordSelector.trim();
      if (submitSelector.trim()) body.submit_selector = submitSelector.trim();
      if (debugAnnotate) body.debug_annotate = true;
      if (chatInput.trim()) body.chat_input = chatInput.trim();
      return body;
    };
    const buildV1Body = (targetUrl: string): Record<string, unknown> => {
      const needsCustomReadiness = Boolean(waitForSelector.trim() || waitForText.trim() || waitForUrl.trim() || delay > 0);
      const readiness = needsCustomReadiness ? "custom" : waitUntil === "networkidle0" || waitUntil === "networkidle2" ? "complete" : "fast";
      const body: Record<string, unknown> = {
        url: targetUrl, format: f, width, height: viewportHeight, device_scale_factor: deviceScaleFactor,
        full_page: fullPage, dark_mode: darkMode, timeout: 30000,
        readiness,
        quality, block_ads: blockAds, block_cookie_banners: blockCookieBanners, block_chats: blockChats, block_trackers: blockTrackers, block_images: blockImages,
        is_mobile: isMobile, has_touch: hasTouch, omit_background: omitBackground, reduced_motion: reducedMotion,
        pdf_format: pdfFormat || undefined, pdf_print_background: pdfPrintBackground,
      };
      if (isVideoMode) { body.video_seconds = videoSeconds; body.video_speed = videoSpeed; }
      if (selector.trim()) body.selector = selector.trim();
      if (waitUntil) body.wait_for = waitUntil;
      if (waitForSelector.trim()) body.wait_for_selector = waitForSelector.trim();
      if (waitForText.trim()) body.wait_for_text = waitForText.trim();
      if (waitForUrl.trim()) body.wait_for_url = waitForUrl.trim();
      if (delay > 0) body.delay = delay;
      if (userAgent.trim()) body.user_agent = userAgent.trim();
      if (country.trim() && geoAllowed) body.country = country.trim().toUpperCase();
      if (authUsername.trim()) { body.auth_username = authUsername.trim(); if (authPassword) body.auth_password = authPassword; }
      if (loginUrl.trim()) body.login_url = loginUrl.trim();
      if (usernameSelector.trim()) body.username_selector = usernameSelector.trim();
      if (passwordSelector.trim()) body.password_selector = passwordSelector.trim();
      if (submitSelector.trim()) body.submit_selector = submitSelector.trim();
      if (debugAnnotate) body.debug_annotate = true;
      if (chatInput.trim()) body.chat_input = chatInput.trim();
      return body;
    };

    try {
      if (mode === "bulk") {
        const urls = bulkUrls.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
        if (urls.length === 0) throw new Error("Please add at least one website link (one per line).");
        if (urls.length > 100) throw new Error("You can capture up to 100 links at once.");
        const { url: _singleUrl, ...renderOptions } = buildTakeBody(urls[0]);
        const response = await fetch("/api/take/bulk", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ urls, ...renderOptions }) });
        if (!response.ok) { let message = "Could not capture — please try again"; let needsUpgrade = false; try { const err = await response.json(); message = typeof err.error === "string" ? err.error : err.error?.message ?? message; needsUpgrade = err.error?.code === "plan_feature" || response.status === 403; } catch { message = `Something went wrong (${response.status})`; } setUpgradeRequired(needsUpgrade); throw new Error(message); }
        const data = await response.json();
        const headerCost = response.headers.get("X-Credits-Used");
        setCreditsUsed(headerCost != null ? Number(headerCost) : data.creditsUsed ?? null);
        setBulkResults({ total: data.total, successful: data.successful, failed: data.failed, creditsUsed: data.creditsUsed, results: data.results ?? [] });
        setResponseTab("preview");
        return;
      }
      if (mode === "async") {
        setJobStatus("Creating your picture…");
        const createResponse = await fetch("/api/v1/screenshots", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(buildV1Body(url)) });
        const createPayload = await createResponse.json();
        if (!createResponse.ok || !createPayload.success) { const needsUpgrade = createPayload.error?.code === "plan_feature" || createResponse.status === 403; setUpgradeRequired(needsUpgrade); throw new Error(createPayload.error?.message ?? "Could not start capture"); }
        const job = createPayload.data;
        if (job.status === "completed" && job.screenshot?.url) { setStorageUrl(job.screenshot.url); setResult(job.screenshot.url); setResultType(isRealVideo ? "video" : isAnimatedGif ? "image" : f === "pdf" ? "pdf" : "image"); setCreditsUsed(job.cached ? 0 : getCreditCost(f, isVideoMode ? videoSeconds : undefined)); setResponseTab("preview"); return; }
        setJobStatus(`Working… job ${job.id} is in queue`);
        const completed = await pollV1Job(job.id);
        setStorageUrl(completed.url); setResult(completed.url); setResultType(isRealVideo ? "video" : isAnimatedGif ? "image" : f === "pdf" ? "pdf" : "image"); setCreditsUsed(getCreditCost(f, isVideoMode ? videoSeconds : undefined)); setJobStatus(null); setResponseTab("preview"); return;
      }
      const response = await fetch("/api/take", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(buildTakeBody(url)) });
      if (!response.ok) { let message = "Could not capture — please try again"; let needsUpgrade = false; try { const err = await response.json(); message = typeof err.error === "string" ? err.error : err.error?.message ?? message; needsUpgrade = err.error?.code === "plan_feature" || response.status === 403; } catch { message = `Something went wrong (${response.status})`; } setUpgradeRequired(needsUpgrade); throw new Error(message); }
      const data = await response.json();
      const headerCost = response.headers.get("X-Credits-Used");
      setCreditsUsed(headerCost != null ? Number(headerCost) : getCreditCost(f, isVideoMode ? videoSeconds : undefined));
      if (data.url) { setStorageUrl(data.url); setResult(data.url); setResultType(isRealVideo ? "video" : isAnimatedGif ? "image" : f === "pdf" ? "pdf" : "image"); }
      else { const blob = await response.blob(); const objectUrl = URL.createObjectURL(blob); setResult(objectUrl); setResultType(isRealVideo ? "video" : isAnimatedGif ? "image" : f === "pdf" ? "pdf" : "image"); }
      setResponseTab("preview");
    } catch (err) { setError(err instanceof Error ? err.message : "Something went wrong"); setJobStatus(null); } finally { setLoading(false); }
  }, [url, bulkUrls, mode, format, allowedFormats, fullPage, plan, darkMode, width, videoSeconds, videoSpeed, isVideoMode, isRealVideo, isAnimatedGif, quality, viewportHeight, deviceScaleFactor, omitBackground, reducedMotion, selector, waitUntil, waitForSelector, waitForText, waitForUrl, delay, blockAds, blockCookieBanners, blockChats, blockTrackers, blockPopups, blockImages, userAgent, isMobile, hasTouch, country, geoAllowed, pdfFormat, pdfPrintBackground, authUsername, authPassword, loginUrl, usernameSelector, passwordSelector, submitSelector, chatInput, debugAnnotate, a11yCheck]);

  const handleDownload = useCallback(() => {
    const href = storageUrl ?? result; if (!href) return;
    const a = document.createElement("a"); a.href = href; const ext = effectiveFormat === "jpeg" ? "jpg" : effectiveFormat; a.download = `screenshot.${ext}`; document.body.appendChild(a); a.click(); document.body.removeChild(a);
  }, [result, storageUrl, effectiveFormat]);

  const submitLabel = mode === "bulk" ? (loading ? "Capturing…" : "Capture all") : mode === "async" ? (loading ? jobStatus ?? "Working…" : "Capture") : loading ? (isVideoMode ? "Recording…" : "Capturing…") : "Capture";

  const endpoint = mode === "bulk" ? "/api/take/bulk" : mode === "async" ? "/api/v1/screenshots" : "/api/take";

  const requestPreview = useMemo(() => {
    const target = mode === "bulk" ? bulkUrls.split("\n").map((s) => s.trim()).filter(Boolean).slice(0, 2) : [url];
    const body: Record<string, unknown> = {
      url: mode === "bulk" ? target : url,
      format: effectiveFormat,
      viewport_width: width,
      viewport_height: viewportHeight,
      full_page: fullPage,
      dark_mode: darkMode,
    };
    if (isVideoMode) Object.assign(body, { video_seconds: videoSeconds, video_speed: videoSpeed, video_fps: 5 });
    if (selector) body.selector = selector;
    if (waitUntil) body.wait_until = waitUntil;
    return JSON.stringify(body, null, 2);
  }, [mode, bulkUrls, url, effectiveFormat, width, viewportHeight, fullPage, darkMode, isVideoMode, videoSeconds, selector, waitUntil]);

  const snippet = useMemo(() => {
    const body = requestPreview;
    if (codeLang === "curl") {
      return `curl -X POST https://api.screenshotapi.tech${endpoint} \\\n  -H "Authorization: Bearer $API_KEY" \\\n  -H "Content-Type: application/json" \\\n  -d '${body.replaceAll("'", "'\\''")}'`;
    }
    if (codeLang === "js") {
      return `const res = await fetch("https://api.screenshotapi.tech${endpoint}", {\n  method: "POST",\n  headers: {\n    "Authorization": \`Bearer \${process.env.SCREENSHOT_API_KEY}\`,\n    "Content-Type": "application/json"\n  },\n  body: JSON.stringify(${body}, null, 2)\n});\nconst data = await res.json();`;
    }
    return `import requests\n\nres = requests.post(\n    "https://api.screenshotapi.tech${endpoint}",\n    headers={"Authorization": f"Bearer {chr(36)}API_KEY"},\n    json=${body}\n)\nprint(res.json())`;
  }, [codeLang, endpoint, requestPreview]);

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[440px_1fr] xl:items-start">
      <div className="space-y-4">
        <div className="rounded-xl border border-indigo-200 bg-gradient-to-br from-indigo-50 to-violet-50 p-4 dark:border-indigo-900 dark:from-indigo-950/40 dark:to-violet-950/20">
          <p className="text-[13px] font-semibold text-indigo-900 dark:text-indigo-100">✨ Just paste a link — no code needed</p>
          <p className="mt-1 text-[12px] leading-relaxed text-indigo-700/80 dark:text-indigo-300/80">Try any website. All options below are optional — the defaults already give a clean screenshot.</p>
        </div>

        <div className="flex items-center gap-2 text-[11px] text-[var(--dim)]">
          <span>Mode:</span>
          <div className="inline-flex rounded-full border border-[var(--border)] bg-[var(--muted)] p-1">
            {PLAYGROUND_MODES.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => { setMode(m.id); setError(null); setResult(null); setBulkResults(null); setJobStatus(null); }}
                className={`rounded-full px-3 py-1 text-xs font-medium transition ${mode === m.id ? "bg-[var(--card)] text-[var(--ink)] shadow-sm border border-[var(--border)]" : "text-[var(--dim)] hover:text-[var(--ink)]"}`}
                title={m.hint}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="card overflow-hidden">
            <div className="p-4">
              <label className="block text-[12px] font-medium text-[var(--ink)]">Website link <span className="text-red-500">*</span></label>
              {mode === "bulk" ? (
                <div className="mt-2 space-y-2">
                  <textarea value={bulkUrls} onChange={(e) => setBulkUrls(e.target.value)} rows={4} placeholder={"https://example.com\nhttps://example.org"} className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-3 text-[14px] focus:outline-none focus:ring-2 focus:ring-indigo-500" required />
                  <p className="text-[11px] text-[var(--dim)]">One link per line — up to 100 at once.</p>
                </div>
              ) : (
                <div className="relative mt-2">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--dim)]">🔗</span>
                  <input type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com" className="h-11 w-full rounded-xl border-2 border-[var(--border)] bg-[var(--background)] pl-9 pr-3 text-[14px] font-medium placeholder:text-[var(--dim)] focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20" required />
                </div>
              )}
              <p className="mt-2 text-[11px] text-[var(--dim)]">Example: try your homepage, a product page, or a blog post.</p>
            </div>

            <div className="border-t border-[var(--border)] bg-[var(--muted)]/30 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--dim)]">What kind of file?</p>
              <div className="mt-3 grid grid-cols-3 gap-2">
                {elementaryFormats.map((f) => (
                  <button key={f} type="button" onClick={() => setFormat(f)} className={`rounded-xl border p-3 text-left transition ${effectiveFormat === f ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-950/30" : "border-[var(--border)] bg-[var(--card)] hover:border-[var(--ink)]/20"}`}>
                    <span className="block text-[13px] font-semibold text-[var(--ink)]">{FORMAT_LABELS[f]}</span>
                    <span className="block text-[11px] text-[var(--dim)]">{FORMAT_HINTS[f]}</span>
                  </button>
                ))}
              </div>
              {videoFormats.length > 0 && (
                <div className="mt-3">
                  <p className="text-[11px] text-[var(--dim)]">Need motion? (Pro+)</p>
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    {videoFormats.map((f) => (
                      <button key={f} type="button" onClick={() => setFormat(f)} className={`rounded-xl border p-3 text-left transition ${effectiveFormat === f ? "border-violet-500 bg-violet-50 dark:bg-violet-950/30" : "border-[var(--border)] bg-[var(--card)] hover:border-[var(--ink)]/20"}`}>
                        <span className="block text-[13px] font-semibold text-[var(--ink)]">{FORMAT_LABELS[f]}</span>
                        <span className="block text-[11px] text-[var(--dim)]">{FORMAT_HINTS[f]}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {lockedVideoFormats.length > 0 && (
                <div className="mt-3">
                  <p className="text-[11px] font-medium text-amber-700 dark:text-amber-300">🔒 Try motion — upgrade to Pro to capture</p>
                  <p className="text-[11px] text-[var(--dim)]">You can select these to preview options — capture will prompt upgrade (or run on localhost for dev).</p>
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    {lockedVideoFormats.map((f) => (
                      <button key={f} type="button" onClick={() => setFormat(f)} className={`relative rounded-xl border p-3 text-left transition ${effectiveFormat === f ? "border-amber-500 bg-amber-50 dark:bg-amber-950/30" : "border-amber-200 bg-amber-50/50 dark:border-amber-900 dark:bg-amber-950/20 hover:border-amber-300"}`}>
                        <span className="absolute right-2 top-2 rounded-full bg-amber-600 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest text-white">Pro</span>
                        <span className="block text-[13px] font-semibold text-[var(--ink)]">{FORMAT_LABELS[f]} 🔒</span>
                        <span className="block text-[11px] text-[var(--dim)]">{FORMAT_HINTS[f]}</span>
                      </button>
                    ))}
                  </div>
                  <div className="mt-2">
                    <a href="/dashboard/plan" className="inline-flex text-[11px] font-semibold text-amber-700 underline hover:text-amber-900 dark:text-amber-300">View Pro plan →</a>
                  </div>
                </div>
              )}
            </div>

            {isVideoMode && (
              <div className="border-t border-[var(--border)] p-4">
                {isVideoLocked && (
                  <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] leading-relaxed text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
                    🔒 <b>{FORMAT_LABELS[effectiveFormat]} is a Pro+ format.</b> You can preview the duration/speed controls here. Hit Capture to see the upgrade prompt — or run on <code className="rounded bg-white px-1 py-0.5">localhost</code> to test the pipeline without a plan check. <a href="/dashboard/plan" className="font-semibold underline">Upgrade to Pro →</a>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-4">
                  <label className="space-y-2">
                    <span className="flex items-center gap-2 text-[12px] font-medium text-[var(--ink)]">🎬 How long? <Help text="How many seconds to record" /></span>
                    <div className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--muted)]/30 px-3 py-2">
                      <input type="range" min={1} max={30} value={videoSeconds} onChange={(e) => setVideoSeconds(Number(e.target.value))} className="flex-1 accent-violet-600" />
                      <span className="min-w-[3ch] rounded-full bg-[var(--card)] border border-[var(--border)] px-2 py-1 text-center font-mono text-xs font-semibold">{videoSeconds}s</span>
                    </div>
                    <span className="text-[11px] text-[var(--dim)]">1–30 seconds · via <code className="rounded bg-white px-1 py-0.5">agent-browser record start/stop</code></span>
                  </label>
                  <label className="space-y-2">
                    <span className="flex items-center gap-2 text-[12px] font-medium text-[var(--ink)]">⚡ How fast? <Help text="1× is normal speed. 2×–4× squeezes more movement into the same time." /></span>
                    <select value={videoSpeed} onChange={(e) => setVideoSpeed(Number(e.target.value))} className={`${selectClass} w-full`}>
                      <option value={1}>1× — normal</option><option value={2}>2× — twice as fast</option><option value={3}>3× — super fast</option><option value={4}>4× — fastest</option>
                    </select>
                    <span className="text-[11px] text-[var(--dim)]">Right next to duration — makes long animations fit</span>
                  </label>
                </div>
                {isVideoLocked && <p className="mt-2 text-[11px] text-[var(--dim)]">Cost preview: ~{getCreditCost(effectiveFormat, videoSeconds)} credits for {videoSeconds}s (charged only on Pro+).</p>}
              </div>
            )}
          </div>

          <Section icon="🖼️" title="How it should look" desc="Size, sharpness & style — all optional">
            <div className="space-y-5">
              <div>
                <p className="text-[12px] font-medium text-[var(--ink)]">Screen size <Help text="How big the browser window is. Phone = tall & narrow, Desktop = wide" /></p>
                <div className="mt-2 grid grid-cols-4 gap-2">
                  {SCREEN_PRESETS.map((p) => (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => { setWidth(p.w); setViewportHeight(p.h); }}
                      className={`rounded-xl border px-2 py-3 text-center transition ${width === p.w && viewportHeight === p.h ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-950/30" : "border-[var(--border)] bg-[var(--card)] hover:bg-[var(--muted)]"}`}
                    >
                      <span className="block text-[16px]">{p.icon}</span>
                      <span className="block text-[12px] font-semibold text-[var(--ink)]">{p.label}</span>
                      <span className="block text-[10px] text-[var(--dim)]">{p.w}×{p.h}</span>
                    </button>
                  ))}
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  <label className="space-y-1 text-xs text-[var(--dim)]">Width <input type="number" value={width} onChange={(e) => setWidth(Number(e.target.value))} className={`${inputClass} w-full`} /></label>
                  <label className="space-y-1 text-xs text-[var(--dim)]">Height <input type="number" value={viewportHeight} onChange={(e) => setViewportHeight(Number(e.target.value))} className={`${inputClass} w-full`} /></label>
                  <label className="space-y-1 text-xs text-[var(--dim)]">Sharpness <select value={deviceScaleFactor} onChange={(e) => setDeviceScaleFactor(Number(e.target.value))} className={`${selectClass} w-full`}><option value={1}>Normal</option><option value={2}>Sharp 2×</option><option value={3}>Ultra 3×</option></select></label>
                </div>
                <p className="mt-2 text-[11px] text-[var(--dim)]">Tip: Phone + Tablet presets are great to check mobile design.</p>
              </div>

              <div className="rounded-xl bg-[var(--muted)]/50 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-[12px] font-medium text-[var(--ink)]">Image quality — {qualityLabel} <Help text="Only matters for JPG/WebP. PNG is always best quality." /></span>
                  <span className="rounded-full bg-[var(--card)] border border-[var(--border)] px-2 py-0.5 font-mono text-[11px]">{quality}</span>
                </div>
                <input type="range" min={1} max={100} value={quality} onChange={(e) => setQuality(Number(e.target.value))} className="mt-2 w-full accent-indigo-600" />
                <p className="text-[11px] text-[var(--dim)]">{qualityHint}</p>
              </div>

              <div className="flex flex-wrap gap-2">
                {[
                  { k: "fullPage", v: fullPage, s: setFullPage, label: "📄 Full page", hint: "Scroll and capture everything, not just top" },
                  { k: "darkMode", v: darkMode, s: setDarkMode, label: "🌙 Dark mode", hint: "Capture as if user prefers dark" },
                  { k: "omitBg", v: omitBackground, s: setOmitBackground, label: "✨ Transparent", hint: "No white background — good for logos" },
                  { k: "reduced", v: reducedMotion, s: setReducedMotion, label: "⏸️ Freeze motion", hint: "Pause animations for a clean shot" },
                ].map((t) => (
                  <button key={t.k} type="button" onClick={() => (t.s as (v: boolean) => void)(!t.v)} className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition ${t.v ? "border-indigo-500 bg-indigo-600 text-white" : "border-[var(--border)] bg-[var(--card)] text-[var(--ink)] hover:bg-[var(--muted)]"}`} title={t.hint}>
                    <span className={`h-4 w-4 rounded-full border flex items-center justify-center text-[10px] ${t.v ? "bg-white text-indigo-600 border-white" : "bg-[var(--card)] border-[var(--border)]"}`}>{t.v ? "✓" : ""}</span>
                    {t.label}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-[var(--dim)]">Tap to turn on/off. Transparent only works for PNG/WebP.</p>
            </div>
          </Section>

          <Section icon="🎯" title="Capture a specific part" desc="Whole page or just one section — your choice">
            <div className="space-y-4">
              <div>
                <label className="text-[12px] font-medium text-[var(--ink)]">Only capture this part (optional) <Help text="Use #pricing for an id, .hero for a class, or just type the words you see, like pricing" /></label>
                <input type="text" value={selector} onChange={(e) => setSelector(e.target.value)} placeholder='Try: #pricing  or  .product-card  or  pricing' className={`${inputClass} mt-2 w-full`} />
                <p className="mt-2 rounded-lg bg-blue-50 px-3 py-2 text-[11px] leading-relaxed text-blue-800 dark:bg-blue-950/30 dark:text-blue-300">💡 <b>Easy mode:</b> just type what you see — e.g. <code className="rounded bg-white px-1 py-0.5">pricing</code> finds the pricing section automatically. For exact control use <code className="rounded bg-white px-1 py-0.5">#pricing</code> (id) or <code className="rounded bg-white px-1 py-0.5">.pricing</code> (class).</p>
                {selector.trim().replace(/^["']|["']$/g, "") && /^[a-zA-Z][\w-]*$/.test(selector.trim().replace(/^["']|["']$/g, "")) && (
                  <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] leading-relaxed text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
                    Will try <code className="font-mono bg-white px-1 rounded">#{selector.trim().replace(/^["']|["']$/g, "")}</code>, <code className="font-mono bg-white px-1 rounded">.{selector.trim().replace(/^["']|["']$/g, "")}</code> and text “{selector.trim().replace(/^["']|["']$/g, "")}”.{" "}
                    <button type="button" onClick={() => setSelector(`#${selector.trim().replace(/^["']|["']$/g, "")}`)} className="font-semibold underline">Use #{selector.trim().replace(/^["']|["']$/g, "")}</button> ·{" "}
                    <button type="button" onClick={() => setSelector(`.${selector.trim().replace(/^["']|["']$/g, "")}`)} className="font-semibold underline">Use .{selector.trim().replace(/^["']|["']$/g, "")}</button>
                  </div>
                )}
              </div>
              <div className="rounded-xl border border-violet-200 bg-violet-50/50 p-3 dark:border-violet-900 dark:bg-violet-950/20">
                <label className="flex items-center gap-2 text-[12px] font-semibold text-violet-900 dark:text-violet-100">💬 Or just tell us in plain English (NEW — agent-browser chat) <Help text="Type like 'take screenshot of pricing table' and we auto-find it, even if it's on another page" /></label>
                <input type="text" value={chatInput} onChange={(e) => { setChatInput(e.target.value); if (e.target.value.trim()) setSelector(e.target.value); }} placeholder='Try: take screenshot of pricing table' className={`${inputClass} mt-2 w-full border-violet-200`} />
                <p className="mt-2 text-[11px] text-violet-700 dark:text-violet-300">Mirrors <code className="rounded bg-white px-1 py-0.5">agent-browser chat "take screenshot of pricing table"</code> — auto-navigates if pricing is a link to <code className="rounded bg-white px-1 py-0.5">/pricing</code>.</p>
              </div>
              <label className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--muted)]/30 px-3 py-2 cursor-pointer">
                <input type="checkbox" checked={debugAnnotate} onChange={(e) => setDebugAnnotate(e.target.checked)} className={checkboxClass} />
                <span className="flex-1">
                  <span className="block text-[12px] font-medium text-[var(--ink)]">🔍 Debug: highlight the part <Help text="Like agent-browser screenshot --annotate + highlight @e1 — shows [1] labels and orange outline in the capture for debugging" /></span>
                  <span className="block text-[11px] text-[var(--dim)]">Adds <code className="rounded bg-white px-1 py-0.5">[1] @e1</code> labels — turn on to see what we found</span>
                </span>
              </label>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="space-y-1 text-xs">
                  <span className="flex items-center gap-1 font-medium text-[var(--ink)]">When to snap? <Help text="Fast = quicker but might miss images. Patient = wait until everything is calm" /></span>
                  <select value={waitUntil} onChange={(e) => setWaitUntil(e.target.value)} className={`${selectClass} w-full`}>
                    {WAIT_FRIENDLY.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
                  </select>
                </label>
                <label className="space-y-1 text-xs">
                  <span className="flex items-center gap-1 font-medium text-[var(--ink)]">Extra pause <Help text="Add a little extra wait after page is ready — useful for animations" /></span>
                  <div className="flex items-center gap-2">
                    <input type="range" min={0} max={1000} step={100} value={delay} onChange={(e) => setDelay(Number(e.target.value))} className="flex-1 accent-indigo-600" />
                    <span className="min-w-[5ch] rounded-lg border border-[var(--border)] bg-[var(--card)] px-2 py-1 text-center font-mono text-xs">{delay} ms</span>
                  </div>
                </label>
              </div>
              <label className="block space-y-1 text-xs">
                <span className="flex items-center gap-1 font-medium text-[var(--ink)]">Wait for something to appear (optional) <Help text="Don’t capture until this appears. Example: .app-loaded or #main-content — like agent-browser wait <selector>" /></span>
                <input type="text" value={waitForSelector} onChange={(e) => setWaitForSelector(e.target.value)} placeholder="e.g. .loaded  or  #app-ready" className={`${inputClass} w-full font-mono`} />
                <span className="text-[11px] text-[var(--dim)]">Perfect for pages that load content with JavaScript. Mirrors <code className="rounded bg-white px-1 py-0.5">agent-browser wait &lt;selector&gt;</code></span>
              </label>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="block space-y-1 text-xs">
                  <span className="flex items-center gap-1 font-medium text-[var(--ink)]">Wait for text (NEW) <Help text="Wait until these words appear anywhere — like agent-browser wait --text 'Welcome'" /></span>
                  <input type="text" value={waitForText} onChange={(e) => setWaitForText(e.target.value)} placeholder='e.g. Welcome  or  Pricing' className={`${inputClass} w-full`} />
                  <span className="text-[11px] text-[var(--dim)]"><code className="rounded bg-white px-1 py-0.5">wait --text</code> — great for "Loaded" messages</span>
                </label>
                <label className="block space-y-1 text-xs">
                  <span className="flex items-center gap-1 font-medium text-[var(--ink)]">Wait for page change (NEW) <Help text="Wait until URL matches — like agent-browser wait --url **/dashboard. Use ** as wildcard" /></span>
                  <input type="text" value={waitForUrl} onChange={(e) => setWaitForUrl(e.target.value)} placeholder='e.g. **/dashboard  or  **/pricing' className={`${inputClass} w-full font-mono`} />
                  <span className="text-[11px] text-[var(--dim)]"><code className="rounded bg-white px-1 py-0.5">wait --url</code> — for after clicks/redirects</span>
                </label>
              </div>
            </div>
          </Section>

          <Section icon="🧹" title="Make it clean" desc="Hide annoying stuff before capturing">
            <div className="grid grid-cols-1 gap-3">
              {[
                ["Remove ads", "Hides ad slots — cleaner picture", blockAds, setBlockAds],
                ["Hide cookie popups", "Removes 'Accept cookies' banners", blockCookieBanners, setBlockCookieBanners],
                ["Hide chat bubbles", "Removes Intercom, Crisp, Zendesk widgets", blockChats, setBlockChats],
                ["Block trackers", "Stops analytics for faster capture", blockTrackers, setBlockTrackers],
                ["Hide scroll popups", "Closes newsletter/dialog that appears on scroll (NEW)", blockPopups, setBlockPopups],
                ["Hide images", "Show layout without pictures (wireframe)", blockImages, setBlockImages],
              ].map(([label, hint, val, setter]) => (
                <label key={label as string} className="flex items-start gap-3 rounded-xl border border-[var(--border)] bg-[var(--muted)]/30 px-3 py-3 hover:bg-[var(--muted)]/50 transition cursor-pointer">
                  <input type="checkbox" checked={val as boolean} onChange={(e) => (setter as (v: boolean) => void)(e.target.checked)} className={`${checkboxClass} mt-0.5`} />
                  <span className="flex-1">
                    <span className="block text-[13px] font-medium text-[var(--ink)]">{label as string}</span>
                    <span className="block text-[11px] text-[var(--dim)]">{hint as string}</span>
                  </span>
                  <span className={`mt-1 h-5 w-9 rounded-full p-0.5 transition ${val ? "bg-indigo-600" : "bg-[var(--border)]"}`}><span className={`block h-4 w-4 rounded-full bg-white transition ${val ? "translate-x-4" : ""}`} /></span>
                </label>
              ))}
              <label className="flex items-start gap-3 rounded-xl border border-violet-200 bg-violet-50/50 px-3 py-3 hover:bg-violet-50 transition cursor-pointer dark:border-violet-900 dark:bg-violet-950/20">
                <input type="checkbox" checked={a11yCheck} onChange={(e) => setA11yCheck(e.target.checked)} className={`${checkboxClass} mt-0.5`} />
                <span className="flex-1">
                  <span className="block text-[13px] font-medium text-violet-900 dark:text-violet-100">♿ Check accessibility (NEW) <Help text="Runs like agent-browser a11y — warns if images missing alt or low contrast before return" /></span>
                  <span className="block text-[11px] text-violet-700 dark:text-violet-300">Warns <code className="rounded bg-white px-1 py-0.5">image-alt</code> / <code className="rounded bg-white px-1 py-0.5">color-contrast</code> — mirrors <code className="rounded bg-white px-1 py-0.5">agent-browser a11y</code></span>
                </span>
                <span className={`mt-1 h-5 w-9 rounded-full p-0.5 transition ${a11yCheck ? "bg-violet-600" : "bg-[var(--border)]"}`}><span className={`block h-4 w-4 rounded-full bg-white transition ${a11yCheck ? "translate-x-4" : ""}`} /></span>
              </label>
            </div>
          </Section>

          <Section icon="📱" title="Phone & browser" desc="See how it looks on mobile">
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <button type="button" onClick={() => { setIsMobile(!isMobile); if (!isMobile) setHasTouch(true); }} className={`rounded-xl border p-4 text-left transition ${isMobile ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-950/30" : "border-[var(--border)] bg-[var(--card)]"}`}>
                  <span className="text-[18px]">📱</span>
                  <span className="block text-[13px] font-semibold text-[var(--ink)]">Mobile view</span>
                  <span className="block text-[11px] text-[var(--dim)]">Narrow screen, phone layout</span>
                  <span className={`mt-2 inline-block rounded-full px-2 py-0.5 text-[11px] ${isMobile ? "bg-indigo-600 text-white" : "bg-[var(--muted)] text-[var(--dim)]"}`}>{isMobile ? "On ✓" : "Off"}</span>
                </button>
                <button type="button" onClick={() => setHasTouch(!hasTouch)} className={`rounded-xl border p-4 text-left transition ${hasTouch ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-950/30" : "border-[var(--border)] bg-[var(--card)]"}`}>
                  <span className="text-[18px]">👆</span>
                  <span className="block text-[13px] font-semibold text-[var(--ink)]">Touch screen</span>
                  <span className="block text-[11px] text-[var(--dim)]">Pretend it’s a touchscreen</span>
                  <span className={`mt-2 inline-block rounded-full px-2 py-0.5 text-[11px] ${hasTouch ? "bg-indigo-600 text-white" : "bg-[var(--muted)] text-[var(--dim)]"}`}>{hasTouch ? "On ✓" : "Off"}</span>
                </button>
              </div>
              <label className="block space-y-1 text-xs">
                <span className="flex items-center gap-1 font-medium text-[var(--ink)]">Browser name (optional) <Help text="Advanced: pretend to be a different browser. Leave empty for default." /></span>
                <input type="text" value={userAgent} onChange={(e) => setUserAgent(e.target.value)} placeholder="Leave empty — we use a normal Chrome" className={`${inputClass} w-full font-mono text-[12px]`} />
                <span className="text-[11px] text-[var(--dim)]">Only change if a site blocks screenshots.</span>
              </label>
            </div>
          </Section>

          <Section icon="🌍" title="Location & access" desc="View from another country or log into a site">
            <div className="space-y-4">
              <div>
                <label className="text-[12px] font-medium text-[var(--ink)]">🌐 See site from another country <Help text="We open the site through that country — useful to check local prices or languages" /></label>
                <select value={country} onChange={(e) => setCountry(e.target.value)} disabled={!geoAllowed} className={`${selectClass} mt-2 w-full`}>
                  <option value="">🌎 No — use my location (default)</option>
                  {COUNTRIES.map(([code, name, flag]) => <option key={code} value={code}>{flag} {name} — {code}</option>)}
                </select>
                <datalist id="playground-countries">{COUNTRIES.map(([code, name]) => <option key={code} value={code}>{name}</option>)}</datalist>
                {!geoAllowed ? (
                  <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] leading-relaxed text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">🔒 Needs Pro plan — 20 countries included (US, UK, Germany, Japan…). Your current plan can’t use this yet.</p>
                ) : (
                  <p className="mt-2 text-[11px] text-[var(--dim)]">Pick a country to see localized content. Leave empty for normal.</p>
                )}
              </div>

              {showPdfOptions ? (
                <div className="rounded-xl border border-violet-200 bg-violet-50 p-3 dark:border-violet-900 dark:bg-violet-950/30">
                  <p className="text-[12px] font-semibold text-violet-900 dark:text-violet-100">📄 PDF options (because you chose PDF)</p>
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <label className="space-y-1 text-xs text-violet-900/80 dark:text-violet-200">
                      Paper size
                      <select value={pdfFormat} onChange={(e) => setPdfFormat(e.target.value)} className={`${selectClass} w-full border-violet-200`}>
                        <option value="">A4 — default</option>{PDF_FORMATS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                      </select>
                    </label>
                    <label className="flex items-center gap-2 pt-6 text-xs font-medium text-violet-900 dark:text-violet-100">
                      <input type="checkbox" checked={pdfPrintBackground} onChange={(e) => setPdfPrintBackground(e.target.checked)} className={checkboxClass} />
                      Keep background colors
                    </label>
                  </div>
                  <p className="mt-2 text-[11px] text-violet-700 dark:text-violet-300">Uncheck to save ink — white background in PDF.</p>
                </div>
              ) : (
                <p className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--muted)]/30 px-3 py-3 text-center text-[11px] text-[var(--dim)]">Choose <b>PDF</b> above to unlock paper size & background options.</p>
              )}

              <div className="rounded-xl border border-[var(--border)] bg-[var(--muted)]/30 p-3">
                <p className="text-[12px] font-medium text-[var(--ink)]">🔐 Need to log in? <span className="font-normal text-[var(--dim)]">(for private pages)</span></p>
                <p className="text-[11px] text-[var(--dim)]">For sites that need a login — we handle pop-up login (basic auth) and form login like <code className="rounded bg-white px-1 py-0.5">agent-browser auth login</code>.</p>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <label className="space-y-1 text-xs text-[var(--dim)]">Username <input type="text" value={authUsername} onChange={(e) => setAuthUsername(e.target.value)} placeholder="your username" className={`${inputClass} w-full`} /></label>
                  <label className="space-y-1 text-xs text-[var(--dim)]">Password <input type="password" value={authPassword} onChange={(e) => setAuthPassword(e.target.value)} placeholder="••••••••" className={`${inputClass} w-full`} /></label>
                </div>
                <div className="mt-3 rounded-lg border border-indigo-100 bg-white p-3 dark:border-indigo-900 dark:bg-slate-900">
                  <p className="text-[11px] font-semibold text-indigo-900 dark:text-indigo-100">📝 Form login (NEW — like <code className="rounded bg-indigo-50 px-1">agent-browser auth login</code>)</p>
                  <p className="text-[11px] text-[var(--dim)]">If the site shows a login <b>form</b> (not a browser pop-up), fill this too. Leave empty for pop-up login.</p>
                  <label className="mt-2 block space-y-1 text-xs text-[var(--dim)]">Login page URL <input type="url" value={loginUrl} onChange={(e) => setLoginUrl(e.target.value)} placeholder="https://example.com/login" className={`${inputClass} w-full`} /></label>
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    <label className="space-y-1 text-xs text-[var(--dim)]">User field <input type="text" value={usernameSelector} onChange={(e) => setUsernameSelector(e.target.value)} placeholder='#email' className={`${inputClass} w-full font-mono text-[11px]`} /></label>
                    <label className="space-y-1 text-xs text-[var(--dim)]">Pass field <input type="text" value={passwordSelector} onChange={(e) => setPasswordSelector(e.target.value)} placeholder='#password' className={`${inputClass} w-full font-mono text-[11px]`} /></label>
                    <label className="space-y-1 text-xs text-[var(--dim)]">Submit btn <input type="text" value={submitSelector} onChange={(e) => setSubmitSelector(e.target.value)} placeholder='button[type="submit"]' className={`${inputClass} w-full font-mono text-[11px]`} /></label>
                  </div>
                  <p className="mt-2 text-[10px] text-[var(--dim)]">Defaults: <code className="rounded bg-zinc-100 px-1">input[type="email"]</code> / <code className="rounded bg-zinc-100 px-1">input[type="password"]</code> / <code className="rounded bg-zinc-100 px-1">button[type="submit"]</code> — mirrors <code className="rounded bg-zinc-100 px-1">agent-browser auth login --username-selector</code></p>
                </div>
              </div>
            </div>
          </Section>

          <div className="flex items-center gap-3 rounded-xl bg-[var(--ink)] p-4 text-white">
            <button type="submit" disabled={loading} className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-white px-6 text-[14px] font-bold text-[var(--ink)] hover:bg-zinc-100 disabled:opacity-50 transition">
              {loading && <span className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-300 border-t-[var(--ink)]" />}
              {loading ? "Creating your image…" : `✨ ${submitLabel} — it's free to try`}
            </button>
          </div>
          <p className="text-center text-[11px] text-[var(--dim)]">Press <kbd className="rounded border border-[var(--border)] bg-[var(--card)] px-1 py-0.5 font-mono">⌘</kbd> + <kbd className="rounded border border-[var(--border)] bg-[var(--card)] px-1 py-0.5 font-mono">↵</kbd> to capture</p>
        </form>

        {error && (
          <div className={`rounded-xl border p-4 text-sm ${upgradeRequired ? "border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30 text-amber-900 dark:text-amber-200" : "border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30 text-red-700 dark:text-red-300"}`}>
            <p className="text-[13px] leading-relaxed">{error}</p>
            {upgradeRequired && <div className="mt-3"><UpgradeButton /></div>}
          </div>
        )}
      </div>

      <div className="card flex h-[calc(100vh-140px)] min-h-[520px] min-h-0 xl:sticky xl:top-6 flex-col overflow-hidden">
        <div className="flex items-center justify-between border-b border-[var(--border)] bg-[var(--muted)]/40 px-3 py-2">
          <div className="inline-flex rounded-full border border-[var(--border)] bg-[var(--card)] p-1">
            {(["preview", "code"] as const).map((t) => (
              <button key={t} type="button" onClick={() => setResponseTab(t)} className={`rounded-full px-3 py-1.5 text-xs font-medium capitalize transition ${responseTab === t ? "bg-[var(--ink)] text-white shadow" : "text-[var(--dim)] hover:text-[var(--ink)]"}`}>{t === "preview" ? "👁️ Preview" : "💻 Code"}</button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            {result && responseTab === "preview" && (
              <>
                {storageUrl && <a href={storageUrl} target="_blank" rel="noopener noreferrer" className="text-xs font-medium text-[var(--dim)] hover:text-[var(--ink)]">Open ↗</a>}
                <button onClick={handleDownload} className="rounded-full bg-[var(--ink)] px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90">Download ⬇️</button>
              </>
            )}
            {responseTab === "code" && (
              <div className="inline-flex rounded-full border border-[var(--border)] bg-[var(--card)] p-1">
                {(["curl", "js", "py"] as const).map((l) => (
                  <button key={l} onClick={() => setCodeLang(l)} className={`rounded-full px-2 py-1 font-mono text-[11px] ${codeLang === l ? "bg-[var(--ink)] text-white" : "text-[var(--dim)]"}`}>{l}</button>
                ))}
              </div>
            )}
          </div>
        </div>

        {responseTab === "code" ? (
          <div className="flex flex-1 flex-col">
            <div className="flex items-center justify-between border-b border-[var(--border)] bg-amber-50 px-3 py-2 dark:bg-amber-950/20">
              <span className="text-[11px] text-amber-900 dark:text-amber-200">For developers — copy & paste into your app</span>
              <CopyButton text={snippet} />
            </div>
            <pre className="flex-1 overflow-auto bg-[#0a0a0a] p-4 font-mono text-[12.5px] leading-6 text-zinc-100"><code>{snippet}</code></pre>
            <div className="border-t border-[var(--border)] bg-[var(--muted)]/30 px-3 py-2 text-[11px] text-[var(--dim)]">Need an API key? <a href="/dashboard/api-keys" className="font-medium text-indigo-600 underline">Get one here</a> · <a href="/docs" className="underline">Docs</a></div>
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col bg-[var(--muted)]/20">
            {!result && !bulkResults && !loading && !error && (
              <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-white border border-[var(--border)] shadow-sm text-[28px]">🖼️</div>
                <p className="text-[15px] font-semibold text-[var(--ink)]">Your screenshot will appear here</p>
                <p className="mt-2 max-w-[32ch] text-[13px] leading-relaxed text-[var(--dim)]">Paste a link on the left, pick how you want it to look, and hit <b>Capture</b>. Try the presets — no code needed!</p>
                <p className="mt-4 inline-flex rounded-full bg-white border border-[var(--border)] px-3 py-1 font-mono text-[11px] text-[var(--dim)]">POST {endpoint}</p>
              </div>
            )}
            {loading && !result && !bulkResults && (
              <div className="flex flex-1 items-center justify-center p-10">
                <div className="text-center">
                  <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-[var(--border)] border-t-indigo-600" />
                  <p className="mt-3 text-sm font-medium text-[var(--ink)]">{jobStatus ?? "Making your picture…"}</p>
                  <p className="mt-1 text-xs text-[var(--dim)]">This usually takes 3–8 seconds</p>
                </div>
              </div>
            )}
            {result && (
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden bg-[#0f0f0f] overscroll-contain [scrollbar-gutter:stable] [scrollbar-width:thin]">
                  {resultType === "video" ? (
                    <video src={result ?? undefined} controls autoPlay className="block w-full h-auto min-h-0" />
                  ) : resultType === "image" && isAnimatedGif ? (
                    <img src={result ?? undefined} alt="Your capture" className="block w-full h-auto" />
                  ) : resultType === "pdf" ? (
                    <div className="flex flex-col items-center gap-3 py-12 text-zinc-400">
                      <span className="text-[40px]">📄</span>
                      <p className="text-sm">PDF ready — hit Download</p>
                    </div>
                  ) : fullPage ? (
                    <img src={result} alt="Full page capture" className="block w-full h-auto" />
                  ) : (
                    <img src={result} alt="Screenshot" className="block w-full h-auto" />
                  )}
                </div>
                {storageUrl && <div className="border-t border-[var(--border)] bg-[var(--card)] px-3 py-2 font-mono text-[11px] text-[var(--dim)] truncate">Saved: {storageUrl}</div>}
              </div>
            )}
            {bulkResults && (
              <div className="flex flex-1 flex-col overflow-hidden">
                <div className="border-b border-[var(--border)] bg-[var(--card)] px-3 py-2 text-xs text-[var(--dim)]">{bulkResults.successful} of {bulkResults.total} worked ✓</div>
                <div className="flex-1 overflow-auto divide-y divide-[var(--border)] bg-[var(--card)]">
                  {bulkResults.results.map((item) => (
                    <div key={item.url} className="flex items-center justify-between gap-3 px-3 py-2 text-xs">
                      <span className="truncate font-mono text-[var(--ink)]">{item.url}</span>
                      <span className="shrink-0 flex items-center gap-2">
                        {item.success && item.storage_url && <a href={item.storage_url} target="_blank" rel="noopener noreferrer" className="font-medium text-indigo-600 underline">Open</a>}
                        <span className={`font-medium ${item.success ? "text-emerald-600" : "text-red-600"}`}>{item.success ? "✓ Done" : item.error ?? "Failed"}</span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
