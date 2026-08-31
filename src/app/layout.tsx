import type { Metadata } from "next";
import Script from "next/script";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ClerkProvider } from "@clerk/nextjs";
import { ConsentManager } from "@/components/consent-manager";
import { PostHogProvider } from "@/components/providers/posthog-provider";
import { PostHogPageView } from "@/components/providers/posthog-page-view";
import { JsonLd } from "@/components/json-ld";
import { siteConfig } from "@/lib/site";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: "ScreenshotAPI - Clean website screenshots via API",
  description:
    "Screenshot API for products that ship captures. Cookie banners and ads blocked by default. 100 free renders, then $9 for full-page, PDF, and production volume.",
  openGraph: {
    type: "website",
    siteName: siteConfig.name,
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <head>
        <JsonLd />
        <Script
          id="theme-init"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("theme");var d=t?t==="dark":window.matchMedia("(prefers-color-scheme: dark)").matches;if(d)document.documentElement.classList.add("dark");}catch(e){}})();`,
          }}
        />
        <Script
          id="posthog-init"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `!function(t,e){var o,n,p,r;e.__SV||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split(".");2==o.length&&(t=t[o[0]],e=o[1]),t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}(p=t.createElement("script")).type="text/javascript",p.async=!0,p.src=s.api_host+"/static/array.js",(r=t.getElementsByTagName("script")[0]).parentNode.insertBefore(p,r);var u=e;for(void 0!==a?u=e[a]=[]:a="posthog",u.people=u.people||[],u.toString=function(t){var e="posthog";return"posthog"!==a&&(e+="."+a),t||(e+=" (stub)"),e},u.people.toString=function(){return u.toString(1)+".people (stub)"},o="capture identify alias people.set people.set_once set_config register register_once unregister opt_out_capturing has_opted_out_capturing opt_in_capturing reset isFeatureEnabled onFeatureFlags getFeatureFlag getFeatureFlagPayload reloadFeatureFlags group updateEarlyAccessFeatureEnrollment getEarlyAccessFeatures getActiveMatchingSurveys getSurveys onSessionId".split(" "),n=0;n<o.length;n++)g(u,o[n]);e._i.push([i,s,a])},e.__SV=1)}(document,window.posthog||[]);window.posthog.init('${process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN || ""}',{api_host:'${process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com"}',person_profiles:'identified_only'});`,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col font-sans" suppressHydrationWarning>
        <ClerkProvider>
            <PostHogProvider>
              {children}
              <PostHogPageView />
              <ConsentManager />
            </PostHogProvider>
          </ClerkProvider>
        </body>
      </html>
  );
}
