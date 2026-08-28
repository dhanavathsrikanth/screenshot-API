import { ImageResponse } from "next/og";
import { getGuide } from "@/lib/screenshot-guides";
import { siteConfig } from "@/lib/site";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export const alt = "ScreenshotAPI developer guide";

export default async function Image({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const guide = getGuide(slug);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 80,
          background: "linear-gradient(135deg, #0f172a 0%, #1e1b4b 60%, #312e81 100%)",
          color: "#ffffff",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 14,
              background: "#4f46e5",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 30,
              fontWeight: 700,
            }}
          >
            S
          </div>
          <div style={{ fontSize: 36, fontWeight: 700, letterSpacing: "-0.02em" }}>
            {siteConfig.name}
          </div>
          <div
            style={{
              display: "flex",
              marginLeft: 12,
              padding: "8px 22px",
              borderRadius: 9999,
              border: "1px solid #6366f1",
              background: "rgba(99, 102, 241, 0.2)",
              fontSize: 26,
              color: "#c7d2fe",
            }}
          >
            Developer guide
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div
            style={{
              fontSize: guide ? 68 : 60,
              fontWeight: 700,
              lineHeight: 1.12,
              letterSpacing: "-0.03em",
              maxWidth: 980,
            }}
          >
            {guide?.metaTitle ?? "Website screenshots in one API call"}
          </div>
          <div style={{ fontSize: 30, color: "#a5b4fc" }}>
            One authenticated request · No headless browser required
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 26, color: "#94a3b8" }}>
          <div
            style={{
              display: "flex",
              padding: "10px 24px",
              borderRadius: 9999,
              border: "1px solid #334155",
              background: "rgba(15, 23, 42, 0.6)",
              fontFamily: "monospace",
            }}
          >
            GET /api/take?url=...
          </div>
          <div>{siteConfig.url.replace("https://", "")}</div>
        </div>
      </div>
    ),
    { ...size }
  );
}
