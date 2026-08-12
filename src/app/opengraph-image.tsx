import { ImageResponse } from "next/og";

export const alt = "ScreenshotAPI - The Screenshot API for Developers";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "0 96px",
          background: "linear-gradient(135deg, #0a0a0a 0%, #1e1b4b 60%, #312e81 100%)",
          color: "#ffffff",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "20px",
          }}
        >
          <div
            style={{
              width: "72px",
              height: "72px",
              borderRadius: "18px",
              background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div
              style={{
                fontSize: "40px",
                fontWeight: 800,
                color: "#ffffff",
              }}
            >
              S
            </div>
          </div>
          <div
            style={{
              fontSize: "52px",
              fontWeight: 800,
              letterSpacing: "-1px",
            }}
          >
            ScreenshotAPI
          </div>
        </div>
        <div
          style={{
            fontSize: "40px",
            fontWeight: 600,
            letterSpacing: "-0.5px",
            color: "#c7d2fe",
            marginTop: "32px",
            maxWidth: "900px",
          }}
        >
          The Screenshot API for Developers
        </div>
        <div
          style={{
            fontSize: "24px",
            color: "#94a3b8",
            marginTop: "18px",
            maxWidth: "920px",
          }}
        >
          Render full-page, high-resolution screenshots in one API call, with
          cookie-banner, ad, and tracker blocking built in.
        </div>
      </div>
    ),
    { ...size }
  );
}
