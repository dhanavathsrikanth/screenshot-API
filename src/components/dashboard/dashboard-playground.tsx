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
  png: "PNG",
  jpeg: "JPEG",
  webp: "WebP",
  pdf: "PDF",
  gif: "GIF",
  mp4: "MP4",
  webm: "WebM",
};

const FORMAT_HINTS: Record<string, string> = {
  png: "Best for most uses",
  jpeg: "Smaller file",
  webp: "Modern, small",
  pdf: "Document",
  gif: "Animation",
  mp4: "Video",
  webm: "Video",
};

const WAIT_FRIENDLY: [string, string][] = [
  ["", "Auto (default)"],
  ["domcontentloaded", "Fast"],
  ["load", "Balanced"],
  ["networkidle2", "Patient"],
];

const PDF_FORMATS: [string, string][] = [
  ["a4", "A4"],
  ["a3", "A3"],
  ["letter", "Letter"],
  ["legal", "Legal"],
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
  { label: "Phone", w: 390, h: 844, icon: "phone" as const },
  { label: "Tablet", w: 768, h: 1024, icon: "tablet" as const },
  { label: "Desktop", w: 1280, h: 720, icon: "desktop" as const },
  { label: "Wide", w: 1920, h: 1080, icon: "wide" as const },
];

function getCreditCost(format: string, videoSeconds?: number): number {
  if (VIDEO_FORMATS.has(format) && videoSeconds && videoSeconds > 0) {
    return Math.max(5, Math.ceil(videoSeconds));
  }
  if (format === "pdf") return 5;
  return 1;
}

function SvgIcon({ name, className = "w-4 h-4" }: { name: string; className?: string }) {
  const icons: Record<string, React.ReactNode> = {
    phone: <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="7" y="2" width="10" height="20" rx="2" /><line x1="12" y1="18" x2="12" y2="18.01" strokeLinecap="round" /></svg>,
    tablet: <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="4" y="2" width="16" height="20" rx="2" /><line x1="12" y1="18" x2="12" y2="18.01" strokeLinecap="round" /></svg>,
    desktop: <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="3" width="20" height="14" rx="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" /></svg>,
    wide: <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="4" width="20" height="12" rx="2" /><line x1="6" y1="20" x2="18" y2="20" /><line x1="12" y1="16" x2="12" y2="20" /></svg>,
    chevron: <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 9 6 6 6-6" /></svg>,
    link: <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></svg>,
    download: <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>,
    external: <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" /></svg>,
    settings: <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>,
    eye: <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>,
    code: <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" /></svg>,
    copy: <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>,
    check: <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12" /></svg>,
    shield: <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>,
    globe: <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></svg>,
    target: <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" /></svg>,
    sparkles: <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" /><path d="M5 3v4" /><path d="M19 17v4" /><path d="M3 5h4" /><path d="M17 19h4" /></svg>,
  };
  return icons[name] ?? null;
}

type PlaygroundMode = "sync" | "async" | "bulk";
type BulkResultItem = { url: string; success: boolean; error?: string; attempts: number; storage_url?: string | null };

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
      {copied ? <><SvgIcon name="check" className="w-3 h-3" /> Copied</> : <><SvgIcon name="copy" className="w-3 h-3" /> Copy</>}
    </button>
  );
}

function Section({
  title,
  icon,
  children,
  defaultOpen = false,
  badge,
}: {
  title: string;
  icon: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  badge?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-[var(--muted)]/50 transition-colors"
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--muted)] text-[var(--ink)]">
          <SvgIcon name={icon} className="w-4 h-4" />
        </span>
        <span className="flex-1 text-[13px] font-semibold text-[var(--ink)]">{title}</span>
        {badge && (
          <span className="rounded-full bg-[var(--accent)]/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[var(--accent)]">{badge}</span>
        )}
        <span className={`flex h-6 w-6 items-center justify-center rounded-full text-[var(--dim)] transition-transform duration-200 ${open ? "rotate-180" : ""}`}>
          <SvgIcon name="chevron" className="w-3.5 h-3.5" />
        </span>
      </button>
      {open && (
        <div className="border-t border-[var(--border)] bg-[var(--muted)]/20 px-4 py-4">
          {children}
        </div>
      )}
    </div>
  );
}

export function DashboardPlayground({ plan = "free", showUpsell: _showUpsell = false }: { plan?: PlanId; showUpsell?: boolean }) {
  void _showUpsell;
  const allowedFormats = FORMATS_BY_PLAN[plan] ?? FORMATS_BY_PLAN.free;
  const elementaryFormats = allowedFormats.filter((f) => !VIDEO_FORMATS.has(f));
  const videoFormats = allowedFormats.filter((f) => VIDEO_FORMATS.has(f));
  const ALL_VIDEO_FORMATS: string[] = ["gif", "mp4", "webm"];
  const lockedVideoFormats = ALL_VIDEO_FORMATS.filter((f) => !allowedFormats.includes(f));
  const geoAllowed = plan === "pro" || plan === "scale";

  const [url, setUrl] = useState("https://example.com");
  const [bulkUrls, setBulkUrls] = useState("https://example.com\nhttps://example.org");
  const [mode, setMode] = useState<PlaygroundMode>("sync");
  const [jobStatus, setJobStatus] = useState<string | null>(null);
  const [bulkResults, setBulkResults] = useState<{ total: number; successful: number; failed: number; creditsUsed: number; results: BulkResultItem[] } | null>(null);
  const [format, setFormat] = useState<string>("png");
  const isVideoMode = VIDEO_FORMATS.has(format);
  const isVideoLocked = !allowedFormats.includes(format) && VIDEO_FORMATS.has(format);
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
  const isRealVideo = effectiveFormat === "mp4" || effectiveFormat === "webm";
  const isAnimatedGif = effectiveFormat === "gif";
  const showPdfOptions = effectiveFormat === "pdf";

  const qualityLabel = quality <= 40 ? "Draft" : quality <= 80 ? "Good" : "Best";

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
    if (plan === "free" && fullPage) { setError("Full-page captures need a paid plan. Try a normal screenshot for free."); setUpgradeRequired(true); setLoading(false); return; }
    if (plan === "free" && f === "pdf") { setError("PDF needs a paid plan. Try PNG for free."); setUpgradeRequired(true); setLoading(false); return; }
    if (VIDEO_FORMATS.has(f) && !allowedFormats.includes(f)) {
      if (typeof window !== "undefined" && window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1") {
        setError("Video & GIF need the Pro plan. You can preview options here, but capture requires an upgrade."); setUpgradeRequired(true); setLoading(false); return;
      }
    }
    if ((plan === "free" || plan === "starter") && country.trim()) { setError("Geo-location needs Pro."); setUpgradeRequired(true); setLoading(false); return; }
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
        if (urls.length === 0) throw new Error("Please add at least one URL (one per line).");
        if (urls.length > 100) throw new Error("Maximum 100 URLs at once.");
        const { url: _singleUrl, ...renderOptions } = buildTakeBody(urls[0]);
        const response = await fetch("/api/take/bulk", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ urls, ...renderOptions }) });
        if (!response.ok) { let message = "Capture failed — please try again"; let needsUpgrade = false; try { const err = await response.json(); message = typeof err.error === "string" ? err.error : err.error?.message ?? message; needsUpgrade = err.error?.code === "plan_feature" || response.status === 403; } catch { message = `Something went wrong (${response.status})`; } setUpgradeRequired(needsUpgrade); throw new Error(message); }
        const data = await response.json();
        const headerCost = response.headers.get("X-Credits-Used");
        setCreditsUsed(headerCost != null ? Number(headerCost) : data.creditsUsed ?? null);
        setBulkResults({ total: data.total, successful: data.successful, failed: data.failed, creditsUsed: data.creditsUsed, results: data.results ?? [] });
        setResponseTab("preview");
        return;
      }
      if (mode === "async") {
        setJobStatus("Queuing capture...");
        const createResponse = await fetch("/api/v1/screenshots", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(buildV1Body(url)) });
        const createPayload = await createResponse.json();
        if (!createResponse.ok || !createPayload.success) { const needsUpgrade = createPayload.error?.code === "plan_feature" || createResponse.status === 403; setUpgradeRequired(needsUpgrade); throw new Error(createPayload.error?.message ?? "Could not start capture"); }
        const job = createPayload.data;
        if (job.status === "completed" && job.screenshot?.url) { setStorageUrl(job.screenshot.url); setResult(job.screenshot.url); setResultType(isRealVideo ? "video" : isAnimatedGif ? "image" : f === "pdf" ? "pdf" : "image"); setCreditsUsed(job.cached ? 0 : getCreditCost(f, isVideoMode ? videoSeconds : undefined)); setResponseTab("preview"); return; }
        setJobStatus(`Working... job ${job.id}`);
        const completed = await pollV1Job(job.id);
        setStorageUrl(completed.url); setResult(completed.url); setResultType(isRealVideo ? "video" : isAnimatedGif ? "image" : f === "pdf" ? "pdf" : "image"); setCreditsUsed(getCreditCost(f, isVideoMode ? videoSeconds : undefined)); setJobStatus(null); setResponseTab("preview"); return;
      }
      const response = await fetch("/api/take", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(buildTakeBody(url)) });
      if (!response.ok) { let message = "Capture failed — please try again"; let needsUpgrade = false; try { const err = await response.json(); message = typeof err.error === "string" ? err.error : err.error?.message ?? message; needsUpgrade = err.error?.code === "plan_feature" || response.status === 403; } catch { message = `Something went wrong (${response.status})`; } setUpgradeRequired(needsUpgrade); throw new Error(message); }
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

  const endpoint = mode === "bulk" ? "/api/take/bulk" : mode === "async" ? "/api/v1/screenshots" : "/api/take";

  const requestPreview = useMemo(() => {
    const body: Record<string, unknown> = {
      url: mode === "bulk" ? bulkUrls.split("\n").map((s) => s.trim()).filter(Boolean).slice(0, 2) : url,
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
  }, [mode, bulkUrls, url, effectiveFormat, width, viewportHeight, fullPage, darkMode, isVideoMode, videoSeconds, videoSpeed, selector, waitUntil]);

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

  const submitLabel = mode === "bulk" ? (loading ? "Capturing..." : "Capture All") : loading ? (isVideoMode ? "Recording..." : "Capturing...") : "Capture";

  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-[420px_1fr] xl:items-start">
      {/* ── Left: Controls ───────────────────────────────────── */}
      <div className="space-y-3 xl:sticky xl:top-6 xl:max-h-[calc(100vh-24px)] xl:overflow-y-auto xl:pr-1 xl:pb-6 [scrollbar-width:thin]">
        <form onSubmit={handleSubmit} className="space-y-3">

          {/* Mode selector — simple pills */}
          <div className="flex items-center gap-1.5 rounded-lg bg-[var(--muted)] p-1">
            {([
              { id: "sync" as PlaygroundMode, label: "Single" },
              { id: "async" as PlaygroundMode, label: "Background" },
              { id: "bulk" as PlaygroundMode, label: "Bulk" },
            ]).map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => { setMode(m.id); setError(null); setResult(null); setBulkResults(null); setJobStatus(null); }}
                className={`flex-1 rounded-md px-3 py-1.5 text-[12px] font-semibold transition-all duration-150 ${
                  mode === m.id
                    ? "bg-[var(--card)] text-[var(--ink)] shadow-sm"
                    : "text-[var(--dim)] hover:text-[var(--ink)]"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>

          {/* URL input — the hero */}
          <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-3 shadow-sm">
            {mode === "bulk" ? (
              <div className="space-y-2">
                <textarea
                  value={bulkUrls}
                  onChange={(e) => setBulkUrls(e.target.value)}
                  rows={4}
                  placeholder={"https://example.com\nhttps://example.org"}
                  className="w-full resize-none rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2.5 text-[13px] placeholder:text-[var(--dim)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 focus:border-[var(--accent)]"
                  required
                />
                <p className="text-[11px] text-[var(--dim)]">One URL per line, up to 100.</p>
              </div>
            ) : (
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--dim)]">
                  <SvgIcon name="link" className="w-4 h-4" />
                </span>
                <input
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://example.com"
                  className="h-11 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] pl-9 pr-3 text-[14px] font-medium placeholder:text-[var(--dim)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 focus:border-[var(--accent)]"
                  required
                />
              </div>
            )}
          </div>

          {/* Format chips */}
          <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-3 shadow-sm">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--dim)]">Format</p>
            <div className="flex flex-wrap gap-1.5">
              {elementaryFormats.map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFormat(f)}
                  className={`rounded-lg px-3 py-1.5 text-[12px] font-semibold transition-all duration-150 ${
                    effectiveFormat === f
                      ? "bg-[var(--accent)] text-white shadow-sm"
                      : "bg-[var(--muted)] text-[var(--dim)] hover:text-[var(--ink)] hover:bg-[var(--border)]"
                  }`}
                  title={FORMAT_HINTS[f]}
                >
                  {FORMAT_LABELS[f]}
                </button>
              ))}
              {videoFormats.map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFormat(f)}
                  className={`rounded-lg px-3 py-1.5 text-[12px] font-semibold transition-all duration-150 ${
                    effectiveFormat === f
                      ? "bg-[var(--accent)] text-white shadow-sm"
                      : "bg-[var(--muted)] text-[var(--dim)] hover:text-[var(--ink)] hover:bg-[var(--border)]"
                  }`}
                  title={FORMAT_HINTS[f]}
                >
                  {FORMAT_LABELS[f]}
                </button>
              ))}
              {lockedVideoFormats.map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFormat(f)}
                  className="relative rounded-lg bg-[var(--muted)] px-3 py-1.5 text-[12px] font-semibold text-[var(--dim)] opacity-60 cursor-not-allowed"
                  title={`${FORMAT_LABELS[f]} — Pro plan required`}
                >
                  {FORMAT_LABELS[f]}
                  <span className="ml-1 text-[9px] font-bold uppercase">Pro</span>
                </button>
              ))}
            </div>
            {lockedVideoFormats.length > 0 && (
              <a href="/dashboard/plan" className="mt-2 inline-block text-[11px] font-medium text-[var(--accent)] hover:underline">
                Upgrade for video & GIF
              </a>
            )}
          </div>

          {/* Viewport presets */}
          <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-3 shadow-sm">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--dim)]">Viewport</p>
            <div className="grid grid-cols-4 gap-1.5">
              {SCREEN_PRESETS.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => { setWidth(p.w); setViewportHeight(p.h); }}
                  className={`flex flex-col items-center gap-1 rounded-lg px-2 py-2.5 text-center transition-all duration-150 ${
                    width === p.w && viewportHeight === p.h
                      ? "bg-[var(--accent)]/10 text-[var(--accent)] ring-1 ring-[var(--accent)]/30"
                      : "bg-[var(--muted)] text-[var(--dim)] hover:text-[var(--ink)] hover:bg-[var(--border)]"
                  }`}
                >
                  <SvgIcon name={p.icon} className="w-5 h-5" />
                  <span className="text-[11px] font-semibold">{p.label}</span>
                  <span className="text-[9px] opacity-60">{p.w}x{p.h}</span>
                </button>
              ))}
            </div>
            <div className="mt-2 grid grid-cols-3 gap-1.5">
              <label className="space-y-0.5">
                <span className="text-[10px] font-medium text-[var(--dim)]">Width</span>
                <input type="number" value={width} onChange={(e) => setWidth(Number(e.target.value))} className="h-8 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 text-[12px] font-medium focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30" />
              </label>
              <label className="space-y-0.5">
                <span className="text-[10px] font-medium text-[var(--dim)]">Height</span>
                <input type="number" value={viewportHeight} onChange={(e) => setViewportHeight(Number(e.target.value))} className="h-8 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 text-[12px] font-medium focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30" />
              </label>
              <label className="space-y-0.5">
                <span className="text-[10px] font-medium text-[var(--dim)]">DPI</span>
                <select value={deviceScaleFactor} onChange={(e) => setDeviceScaleFactor(Number(e.target.value))} className="h-8 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 text-[12px] font-medium focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30">
                  <option value={1}>1x</option>
                  <option value={2}>2x</option>
                  <option value={3}>3x</option>
                </select>
              </label>
            </div>
          </div>

          {/* Quick toggles */}
          <div className="flex flex-wrap gap-1.5">
            {[
              { v: fullPage, s: setFullPage, label: "Full page" },
              { v: darkMode, s: setDarkMode, label: "Dark mode" },
              { v: omitBackground, s: setOmitBackground, label: "Transparent" },
              { v: reducedMotion, s: setReducedMotion, label: "Freeze motion" },
            ].map((t, i) => (
              <button
                key={i}
                type="button"
                onClick={() => (t.s as (v: boolean) => void)(!t.v)}
                className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition-all duration-150 ${
                  t.v
                    ? "bg-[var(--accent)]/10 text-[var(--accent)] ring-1 ring-[var(--accent)]/30"
                    : "bg-[var(--muted)] text-[var(--dim)] hover:text-[var(--ink)]"
                }`}
              >
                <span className={`flex h-3.5 w-3.5 items-center justify-center rounded border transition ${t.v ? "border-[var(--accent)] bg-[var(--accent)] text-white" : "border-[var(--border)] bg-[var(--card)]"}`}>
                  {t.v && <SvgIcon name="check" className="w-2.5 h-2.5" />}
                </span>
                {t.label}
              </button>
            ))}
          </div>

          {/* Video controls — only when video format selected */}
          {isVideoMode && (
            <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-3 shadow-sm">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--dim)]">Video Settings</p>
              <div className="grid grid-cols-2 gap-3">
                <label className="space-y-1">
                  <span className="text-[11px] font-medium text-[var(--ink)]">Duration</span>
                  <div className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 py-1.5">
                    <input type="range" min={1} max={30} value={videoSeconds} onChange={(e) => setVideoSeconds(Number(e.target.value))} className="flex-1 accent-[var(--accent)]" />
                    <span className="min-w-[3ch] rounded bg-[var(--muted)] px-1.5 py-0.5 text-center font-mono text-[11px] font-semibold text-[var(--ink)]">{videoSeconds}s</span>
                  </div>
                </label>
                <label className="space-y-1">
                  <span className="text-[11px] font-medium text-[var(--ink)]">Speed</span>
                  <select value={videoSpeed} onChange={(e) => setVideoSpeed(Number(e.target.value))} className="h-9 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 text-[12px] font-medium focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30">
                    <option value={1}>1x normal</option>
                    <option value={2}>2x fast</option>
                    <option value={3}>3x faster</option>
                    <option value={4}>4x fastest</option>
                  </select>
                </label>
              </div>
              {isVideoLocked && (
                <p className="mt-2 text-[11px] text-[var(--dim)]">
                  ~{getCreditCost(effectiveFormat, videoSeconds)} credits for {videoSeconds}s (Pro+ only)
                </p>
              )}
            </div>
          )}

          {/* Advanced sections */}
          <Section title="Element targeting" icon="target" defaultOpen={Boolean(selector || chatInput)}>
            <div className="space-y-3">
              <label className="block space-y-1">
                <span className="text-[12px] font-medium text-[var(--ink)]">Capture specific element</span>
                <input
                  type="text"
                  value={selector}
                  onChange={(e) => setSelector(e.target.value)}
                  placeholder="#pricing  or  .hero  or  just type what you see"
                  className="h-9 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-[12px] font-medium placeholder:text-[var(--dim)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30"
                />
                <span className="text-[11px] text-[var(--dim)]">CSS selector or text to find on page</span>
              </label>
              <label className="block space-y-1">
                <span className="text-[12px] font-medium text-[var(--ink)]">Natural language command</span>
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => { setChatInput(e.target.value); if (e.target.value.trim()) setSelector(e.target.value); }}
                  placeholder='e.g. take screenshot of pricing table'
                  className="h-9 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-[12px] font-medium placeholder:text-[var(--dim)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30"
                />
                <span className="text-[11px] text-[var(--dim)]">Tell us in plain English — we auto-find it</span>
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label className="space-y-1">
                  <span className="text-[11px] font-medium text-[var(--ink)]">Wait for element</span>
                  <input type="text" value={waitForSelector} onChange={(e) => setWaitForSelector(e.target.value)} placeholder=".loaded or #ready" className="h-8 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 text-[11px] font-mono placeholder:text-[var(--dim)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30" />
                </label>
                <label className="space-y-1">
                  <span className="text-[11px] font-medium text-[var(--ink)]">Wait for text</span>
                  <input type="text" value={waitForText} onChange={(e) => setWaitForText(e.target.value)} placeholder='e.g. Welcome' className="h-8 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 text-[11px] font-mono placeholder:text-[var(--dim)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30" />
                </label>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <label className="space-y-1">
                  <span className="text-[11px] font-medium text-[var(--ink)]">Wait for URL</span>
                  <input type="text" value={waitForUrl} onChange={(e) => setWaitForUrl(e.target.value)} placeholder="**/dashboard" className="h-8 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 text-[11px] font-mono placeholder:text-[var(--dim)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30" />
                </label>
                <label className="space-y-1">
                  <span className="text-[11px] font-medium text-[var(--ink)]">Extra delay (ms)</span>
                  <input type="number" value={delay} onChange={(e) => setDelay(Number(e.target.value))} min={0} max={1000} step={100} className="h-8 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 text-[11px] font-mono focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30" />
                </label>
              </div>
              <label className="space-y-1">
                <span className="text-[11px] font-medium text-[var(--ink)]">Capture timing</span>
                <select value={waitUntil} onChange={(e) => setWaitUntil(e.target.value)} className="h-8 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 text-[11px] font-medium focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30">
                  {WAIT_FRIENDLY.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
                </select>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={debugAnnotate} onChange={(e) => setDebugAnnotate(e.target.checked)} className="h-3.5 w-3.5 rounded border-[var(--border)] text-[var(--accent)] focus:ring-[var(--accent)]" />
                <span className="text-[11px] font-medium text-[var(--dim)]">Debug: highlight captured element</span>
              </label>
            </div>
          </Section>

          <Section title="Block clutter" icon="shield">
            <div className="grid grid-cols-1 gap-1.5">
              {[
                ["Remove ads", blockAds, setBlockAds],
                ["Hide cookie popups", blockCookieBanners, setBlockCookieBanners],
                ["Hide chat widgets", blockChats, setBlockChats],
                ["Block trackers", blockTrackers, setBlockTrackers],
                ["Hide scroll popups", blockPopups, setBlockPopups],
                ["Hide images", blockImages, setBlockImages],
              ].map(([label, val, setter]) => (
                <label key={label as string} className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 hover:bg-[var(--muted)]/50 transition cursor-pointer">
                  <input
                    type="checkbox"
                    checked={val as boolean}
                    onChange={(e) => (setter as (v: boolean) => void)(e.target.checked)}
                    className="h-3.5 w-3.5 rounded border-[var(--border)] text-[var(--accent)] focus:ring-[var(--accent)]"
                  />
                  <span className="text-[12px] font-medium text-[var(--ink)]">{label as string}</span>
                </label>
              ))}
              <label className="flex items-center gap-2.5 rounded-lg border border-[var(--accent)]/20 bg-[var(--accent)]/5 px-2.5 py-2 cursor-pointer">
                <input type="checkbox" checked={a11yCheck} onChange={(e) => setA11yCheck(e.target.checked)} className="h-3.5 w-3.5 rounded border-[var(--border)] text-[var(--accent)] focus:ring-[var(--accent)]" />
                <span className="text-[12px] font-medium text-[var(--ink)]">Accessibility check</span>
              </label>
            </div>
          </Section>

          <Section title="Mobile & browser" icon="phone">
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => { setIsMobile(!isMobile); if (!isMobile) setHasTouch(true); }}
                  className={`flex flex-col items-center gap-1 rounded-lg p-3 text-center transition-all ${
                    isMobile ? "bg-[var(--accent)]/10 text-[var(--accent)] ring-1 ring-[var(--accent)]/30" : "bg-[var(--muted)] text-[var(--dim)] hover:text-[var(--ink)]"
                  }`}
                >
                  <SvgIcon name="phone" className="w-5 h-5" />
                  <span className="text-[11px] font-semibold">{isMobile ? "Mobile On" : "Mobile Off"}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setHasTouch(!hasTouch)}
                  className={`flex flex-col items-center gap-1 rounded-lg p-3 text-center transition-all ${
                    hasTouch ? "bg-[var(--accent)]/10 text-[var(--accent)] ring-1 ring-[var(--accent)]/30" : "bg-[var(--muted)] text-[var(--dim)] hover:text-[var(--ink)]"
                  }`}
                >
                  <span className="text-[16px]">👆</span>
                  <span className="text-[11px] font-semibold">{hasTouch ? "Touch On" : "Touch Off"}</span>
                </button>
              </div>
              <label className="block space-y-1">
                <span className="text-[11px] font-medium text-[var(--ink)]">Custom user agent</span>
                <input type="text" value={userAgent} onChange={(e) => setUserAgent(e.target.value)} placeholder="Leave empty for default" className="h-8 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 text-[11px] font-mono placeholder:text-[var(--dim)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30" />
              </label>
            </div>
          </Section>

          <Section title="Location & auth" icon="globe">
            <div className="space-y-3">
              <label className="block space-y-1">
                <span className="text-[11px] font-medium text-[var(--ink)]">Country</span>
                <select value={country} onChange={(e) => setCountry(e.target.value)} disabled={!geoAllowed} className="h-9 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 text-[12px] font-medium focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 disabled:opacity-50">
                  <option value="">Same as my location</option>
                  {COUNTRIES.map(([code, name, flag]) => <option key={code} value={code}>{flag} {name}</option>)}
                </select>
                {!geoAllowed && <p className="text-[11px] text-amber-600">Pro plan required</p>}
              </label>

              {showPdfOptions && (
                <div className="rounded-lg border border-[var(--border)] bg-[var(--muted)]/30 p-2.5">
                  <p className="text-[11px] font-semibold text-[var(--ink)] mb-2">PDF Options</p>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="space-y-0.5">
                      <span className="text-[10px] text-[var(--dim)]">Paper size</span>
                      <select value={pdfFormat} onChange={(e) => setPdfFormat(e.target.value)} className="h-8 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 text-[11px] font-medium focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30">
                        <option value="">A4</option>
                        {PDF_FORMATS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                      </select>
                    </label>
                    <label className="flex items-center gap-1.5 pt-4 text-[11px] font-medium text-[var(--ink)]">
                      <input type="checkbox" checked={pdfPrintBackground} onChange={(e) => setPdfPrintBackground(e.target.checked)} className="h-3.5 w-3.5 rounded border-[var(--border)] text-[var(--accent)]" />
                      Keep backgrounds
                    </label>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <p className="text-[11px] font-semibold text-[var(--ink)]">Login credentials</p>
                <div className="grid grid-cols-2 gap-2">
                  <label className="space-y-0.5">
                    <span className="text-[10px] text-[var(--dim)]">Username</span>
                    <input type="text" value={authUsername} onChange={(e) => setAuthUsername(e.target.value)} placeholder="username" className="h-8 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 text-[11px] placeholder:text-[var(--dim)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30" />
                  </label>
                  <label className="space-y-0.5">
                    <span className="text-[10px] text-[var(--dim)]">Password</span>
                    <input type="password" value={authPassword} onChange={(e) => setAuthPassword(e.target.value)} placeholder="password" className="h-8 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 text-[11px] placeholder:text-[var(--dim)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30" />
                  </label>
                </div>
                <label className="block space-y-0.5">
                  <span className="text-[10px] text-[var(--dim)]">Login page URL</span>
                  <input type="url" value={loginUrl} onChange={(e) => setLoginUrl(e.target.value)} placeholder="https://example.com/login" className="h-8 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 text-[11px] placeholder:text-[var(--dim)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30" />
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  <label className="space-y-0.5">
                    <span className="text-[10px] text-[var(--dim)]">User field</span>
                    <input type="text" value={usernameSelector} onChange={(e) => setUsernameSelector(e.target.value)} placeholder="#email" className="h-8 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-1.5 text-[10px] font-mono placeholder:text-[var(--dim)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30" />
                  </label>
                  <label className="space-y-0.5">
                    <span className="text-[10px] text-[var(--dim)]">Pass field</span>
                    <input type="text" value={passwordSelector} onChange={(e) => setPasswordSelector(e.target.value)} placeholder="#password" className="h-8 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-1.5 text-[10px] font-mono placeholder:text-[var(--dim)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30" />
                  </label>
                  <label className="space-y-0.5">
                    <span className="text-[10px] text-[var(--dim)]">Submit btn</span>
                    <input type="text" value={submitSelector} onChange={(e) => setSubmitSelector(e.target.value)} placeholder='button[type="submit"]' className="h-8 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-1.5 text-[10px] font-mono placeholder:text-[var(--dim)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30" />
                  </label>
                </div>
              </div>
            </div>
          </Section>

          <Section title="Quality & appearance" icon="settings" defaultOpen={Boolean(quality !== 80)}>
            <div className="space-y-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-medium text-[var(--ink)]">Quality: {qualityLabel}</span>
                  <span className="rounded bg-[var(--muted)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--dim)]">{quality}</span>
                </div>
                <input type="range" min={1} max={100} value={quality} onChange={(e) => setQuality(Number(e.target.value))} className="w-full accent-[var(--accent)]" />
                <p className="text-[10px] text-[var(--dim)]">Only affects JPEG and WebP</p>
              </div>
            </div>
          </Section>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="btn-primary h-11 w-full rounded-xl text-[14px] font-bold shadow-lg shadow-[var(--accent)]/20 disabled:opacity-50 active:scale-[0.98]"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                {isVideoMode ? "Recording..." : "Capturing..."}
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <SvgIcon name="sparkles" className="w-4 h-4" />
                {submitLabel}
              </span>
            )}
          </button>
          <p className="text-center text-[11px] text-[var(--dim)]">
            {getCreditCost(effectiveFormat, isVideoMode ? videoSeconds : undefined)} credit{getCreditCost(effectiveFormat, isVideoMode ? videoSeconds : undefined) !== 1 ? "s" : ""} per capture
          </p>
        </form>

        {error && (
          <div className={`rounded-xl border p-3 text-[12px] leading-relaxed ${
            upgradeRequired
              ? "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200"
              : "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300"
          }`}>
            {error}
            {upgradeRequired && <div className="mt-2"><UpgradeButton /></div>}
          </div>
        )}
      </div>

      {/* ── Right: Result Panel ─────────────────────────────── */}
      <div className="flex h-[calc(100vh-120px)] min-h-[480px] min-h-0 xl:sticky xl:top-6 flex-col overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-lg dark:bg-[var(--card)]">
        {/* Tabs */}
        <div className="flex items-center justify-between border-b border-[var(--border)] px-3 py-2">
          <div className="inline-flex rounded-lg bg-[var(--muted)] p-0.5">
            <button
              type="button"
              onClick={() => setResponseTab("preview")}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12px] font-semibold transition-all ${
                responseTab === "preview" ? "bg-[var(--card)] text-[var(--ink)] shadow-sm" : "text-[var(--dim)] hover:text-[var(--ink)]"
              }`}
            >
              <SvgIcon name="eye" className="w-3.5 h-3.5" />
              Preview
            </button>
            <button
              type="button"
              onClick={() => setResponseTab("code")}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12px] font-semibold transition-all ${
                responseTab === "code" ? "bg-[var(--card)] text-[var(--ink)] shadow-sm" : "text-[var(--dim)] hover:text-[var(--ink)]"
              }`}
            >
              <SvgIcon name="code" className="w-3.5 h-3.5" />
              Code
            </button>
          </div>

          <div className="flex items-center gap-1.5">
            {result && responseTab === "preview" && (
              <>
                {storageUrl && (
                  <a href={storageUrl} target="_blank" rel="noopener noreferrer" className="btn-secondary h-7 gap-1 px-2 text-[11px]">
                    <SvgIcon name="external" className="w-3 h-3" />
                    Open
                  </a>
                )}
                <button onClick={handleDownload} className="btn-primary h-7 gap-1 px-2 text-[11px]">
                  <SvgIcon name="download" className="w-3 h-3" />
                  Download
                </button>
              </>
            )}
            {responseTab === "code" && (
              <div className="inline-flex rounded-lg bg-[var(--muted)] p-0.5">
                {(["curl", "js", "py"] as const).map((l) => (
                  <button
                    key={l}
                    onClick={() => setCodeLang(l)}
                    className={`rounded-md px-2 py-1 font-mono text-[11px] font-semibold transition-all ${
                      codeLang === l ? "bg-[var(--card)] text-[var(--ink)] shadow-sm" : "text-[var(--dim)]"
                    }`}
                  >
                    {l}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Content */}
        {responseTab === "code" ? (
          <div className="flex flex-1 flex-col">
            <div className="flex items-center justify-between border-b border-[var(--border)] bg-[var(--muted)]/50 px-3 py-1.5">
              <span className="text-[11px] text-[var(--dim)]">Copy & paste into your app</span>
              <CopyButton text={snippet} />
            </div>
            <pre className="flex-1 overflow-auto bg-[#0a0a0a] p-4 font-mono text-[12px] leading-[1.7] text-zinc-300">
              <code>{snippet}</code>
            </pre>
            <div className="border-t border-[var(--border)] bg-[var(--muted)]/30 px-3 py-1.5 text-[11px] text-[var(--dim)]">
              Need an API key? <a href="/dashboard/api-keys" className="font-medium text-[var(--accent)] hover:underline">Get one</a>
              {" "}&middot;{" "}
              <a href="/docs" className="hover:underline">Docs</a>
            </div>
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col">
            {/* Empty state */}
            {!result && !bulkResults && !loading && !error && (
              <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
                <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--muted)] text-[var(--accent)]">
                  <SvgIcon name="eye" className="w-7 h-7" />
                </div>
                <p className="text-[14px] font-semibold text-[var(--ink)]">Screenshot preview</p>
                <p className="mt-1.5 max-w-[28ch] text-[12px] leading-relaxed text-[var(--dim)]">
                  Paste a URL, pick your options, and hit Capture.
                </p>
                <div className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-[var(--muted)] px-3 py-1.5 font-mono text-[11px] text-[var(--dim)]">
                  <span className="text-[var(--accent)]">POST</span> {endpoint}
                </div>
              </div>
            )}

            {/* Loading */}
            {loading && !result && !bulkResults && (
              <div className="flex flex-1 items-center justify-center p-8">
                <div className="text-center">
                  <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-[var(--border)] border-t-[var(--accent)]" />
                  <p className="mt-3 text-[13px] font-medium text-[var(--ink)]">{jobStatus ?? "Capturing..."}</p>
                  <p className="mt-1 text-[11px] text-[var(--dim)]">Usually takes 3-8 seconds</p>
                </div>
              </div>
            )}

            {/* Result */}
            {result && (
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden bg-[#0f0f0f] overscroll-contain [scrollbar-gutter:stable] [scrollbar-width:thin]">
                  {resultType === "video" ? (
                    <video src={result ?? undefined} controls autoPlay className="block w-full h-auto min-h-0" />
                  ) : resultType === "image" && isAnimatedGif ? (
                    <img src={result ?? undefined} alt="Capture" className="block w-full h-auto" />
                  ) : resultType === "pdf" ? (
                    <div className="flex flex-col items-center gap-3 py-16 text-zinc-400">
                      <span className="text-[36px]">📄</span>
                      <p className="text-[13px]">PDF ready — click Download</p>
                    </div>
                  ) : (
                    <img src={result} alt="Screenshot" className="block w-full h-auto" />
                  )}
                </div>
                {storageUrl && (
                  <div className="border-t border-[var(--border)] bg-[var(--muted)]/30 px-3 py-1.5 font-mono text-[10px] text-[var(--dim)] truncate">
                    {storageUrl}
                  </div>
                )}
              </div>
            )}

            {/* Bulk results */}
            {bulkResults && (
              <div className="flex flex-1 flex-col overflow-hidden">
                <div className="border-b border-[var(--border)] bg-[var(--muted)]/50 px-3 py-2 text-[12px] font-medium text-[var(--dim)]">
                  {bulkResults.successful} of {bulkResults.total} succeeded
                </div>
                <div className="flex-1 overflow-auto divide-y divide-[var(--border)]">
                  {bulkResults.results.map((item) => (
                    <div key={item.url} className="flex items-center justify-between gap-3 px-3 py-2 text-[11px]">
                      <span className="truncate font-mono text-[var(--ink)]">{item.url}</span>
                      <span className="shrink-0 flex items-center gap-2">
                        {item.success && item.storage_url && (
                          <a href={item.storage_url} target="_blank" rel="noopener noreferrer" className="font-medium text-[var(--accent)] hover:underline">Open</a>
                        )}
                        <span className={`font-medium ${item.success ? "text-emerald-600" : "text-red-600"}`}>
                          {item.success ? "Done" : item.error ?? "Failed"}
                        </span>
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
