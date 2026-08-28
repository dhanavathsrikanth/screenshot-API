import type { RenderResult } from "@/lib/screenshot/types";

/**
 * AI-ready capture bundle (blueprint §5, §37–§38).
 *
 * The engine produces screenshots today but is architecturally capable of
 * producing a full web-capture artifact: HTML, visible text, accessibility
 * tree, metadata, links, images and performance. This is the internal shape —
 * the public API still only exposes the screenshot artifact.
 */

export interface ViewportInfo {
  width: number;
  height: number;
  deviceScaleFactor: number;
}

export interface PageMetadata {
  title: string | null;
  description: string | null;
  canonical: string | null;
  language: string | null;
  robots: string | null;
  ogTitle: string | null;
  ogDescription: string | null;
  ogImage: string | null;
  favicon: string | null;
}

export interface HeadingGroup {
  h1: string[];
  h2: string[];
  h3: string[];
  h4: string[];
}

export interface LinkArtifact {
  text: string;
  href: string;
  isInternal: boolean;
}

export interface ImageArtifact {
  src: string;
  alt: string | null;
  width: number | null;
  height: number | null;
  loading: string | null;
}

export interface AccessibilityNode {
  role: string | null;
  name: string;
  children?: AccessibilityNode[];
}

export interface NetworkRequestArtifact {
  url: string;
  type: string;
  status: number;
  durationMs: number;
  size: number;
}

export interface PerformanceArtifact {
  dnsMs: number;
  tcpMs: number;
  tlsMs: number;
  ttfbMs: number;
  domContentLoadedMs: number;
  loadMs: number;
  resourceCount: number;
  transferSize: number;
}

export interface DiagnosticsArtifact {
  readiness: string;
  warnings: string[];
  startedAt: string;
  completedAt: string;
}

export interface CaptureArtifacts {
  screenshot?: RenderResult;
  html?: string;
  text?: string;
  metadata?: PageMetadata;
  headings?: HeadingGroup;
  links?: LinkArtifact[];
  images?: ImageArtifact[];
  accessibility?: AccessibilityNode;
  performance?: PerformanceArtifact;
  network?: NetworkRequestArtifact[];
}

export interface CaptureResult {
  url: string;
  viewport: ViewportInfo;
  artifacts: CaptureArtifacts;
  diagnostics?: DiagnosticsArtifact;
}
