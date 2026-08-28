import { siteConfig } from "@/lib/site";

export type GuideFaq = {
  q: string;
  a: string;
};

export type ScreenshotGuide = {
  slug: string;
  language: string;
  title: string;
  metaTitle: string;
  metaDescription: string;
  intro: string[];
  codeLabel: string;
  code: string;
  highlights: Array<{ title: string; desc: string }>;
  faqs: GuideFaq[];
};

const API = siteConfig.apiUrl;

export const screenshotGuides: ScreenshotGuide[] = [
  {
    slug: "curl",
    language: "cURL",
    title: "Website Screenshot API with cURL",
    metaTitle: "cURL Screenshot API - Capture Any URL from the Command Line",
    metaDescription:
      "Take pixel-perfect website screenshots with a single cURL command. Block ads and cookie banners, capture full pages, and download PNG, JPEG, WebP, or PDF.",
    intro: [
      "ScreenshotAPI lets you turn any URL into an image with nothing more than cURL. One authenticated GET request returns a rendered screenshot of the page — no headless browser to install, no Puppeteer scripts to maintain, no infrastructure to scale.",
      "The API renders pages in a real Chromium browser, so JavaScript-heavy sites, SPAs, and lazy-loaded content all come out exactly as they look in a real browser. Cookie banners, ads, and chat widgets are blocked automatically before the shot is taken.",
    ],
    codeLabel: "Capture a screenshot and save it as PNG",
    code: `curl "${API}/api/take?url=https://example.com&format=png" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -o screenshot.png`,
    highlights: [
      { title: "One request", desc: "A single GET call returns the finished image — no polling, no webhooks required." },
      { title: "9 output formats", desc: "PNG, JPEG, WebP, PDF, GIF, TIFF, AVIF, SVG, and HTML." },
      { title: "Clean captures", desc: "Ads, cookie banners, and trackers are stripped before rendering by default." },
      { title: "Full-page support", desc: "Add full_page=true to capture everything below the fold in one image." },
    ],
    faqs: [
      {
        q: "Do I need to install anything besides cURL?",
        a: "No. cURL ships with every modern operating system, and the API is plain HTTP — there is no SDK or client library to install. You only need a free API key.",
      },
      {
        q: "How do I take a full-page screenshot with cURL?",
        a: "Append &full_page=true to the request URL. The renderer scrolls through the entire page and stitches it into a single tall image, including content below the fold.",
      },
      {
        q: "Can I pass extra options like dark mode or a custom viewport?",
        a: "Yes. Query parameters such as dark_mode=true, viewport_width, viewport_height, and block_ads are supported. See the documentation for the full parameter list.",
      },
      {
        q: "Is there a free plan?",
        a: "Yes. The Free plan includes monthly screenshot credits with all core features, no credit card required. Paid plans start at $9/month when you need more volume.",
      },
    ],
  },
  {
    slug: "python",
    language: "Python",
    title: "Screenshot API for Python",
    metaTitle: "Python Screenshot API - Website Screenshots in One Request",
    metaDescription:
      "Capture website screenshots from Python with requests or httpx. Full-page captures, ad blocking, dark mode, and PNG/JPEG/WebP/PDF output — no Selenium or Playwright needed.",
    intro: [
      "Adding website screenshots to a Python app usually means wrestling with Selenium, Playwright, or a self-managed Chromium farm. ScreenshotAPI replaces all of that with one HTTP GET request that works with requests, httpx, aiohttp, or any HTTP client you already use.",
      "Because the rendering happens on our infrastructure, your Python code stays simple and fast: send the URL, receive the image bytes, and write them wherever you need them — local disk, S3, a Django FileField, or straight into an email.",
    ],
    codeLabel: "Capture a screenshot and save it as PNG",
    code: `import requests

response = requests.get(
    "${API}/api/take",
    params={"url": "https://example.com", "format": "png"},
    headers={"Authorization": "Bearer YOUR_API_KEY"},
)
response.raise_for_status()

with open("screenshot.png", "wb") as f:
    f.write(response.content)`,
    highlights: [
      { title: "No browser dependencies", desc: "Skip Selenium, Playwright, and Chromium installs entirely — plain HTTP only." },
      { title: "Sync or async", desc: "Works with requests today and drops into httpx/aiohttp async pipelines without changes." },
      { title: "Django & Flask ready", desc: "Perfect for generating report images, link previews, and PDF exports in web apps." },
      { title: "Full-page captures", desc: "Set full_page=true to render the entire scrollable page in one image." },
    ],
    faqs: [
      {
        q: "Is there an official Python SDK?",
        a: "No SDK is required — the API returns raw image bytes over HTTP, so the standard requests library is all you need. The same pattern works with httpx and aiohttp for async code.",
      },
      {
        q: "How do I handle timeouts for slow websites?",
        a: "Set your client's read timeout to around 30 seconds to cover slow-loading pages. The renderer waits for network idle before capturing, so you get complete screenshots even for JS-heavy sites.",
      },
      {
        q: "Can I generate PDFs instead of images from Python?",
        a: "Yes. Pass format=pdf and the response is a print-ready PDF of the page — ideal for invoice generation, archiving, and report pipelines.",
      },
      {
        q: "How much does it cost?",
        a: "There is a free plan with monthly credits and no credit card required. The Starter plan at $9/month adds full-page captures and higher limits; Pro at $49/month unlocks bulk endpoints and priority rendering.",
      },
    ],
  },
  {
    slug: "nodejs",
    language: "Node.js",
    title: "Screenshot API for Node.js",
    metaTitle: "Node.js Screenshot API - Replace Puppeteer with One HTTP Call",
    metaDescription:
      "Take website screenshots in Node.js with the built-in fetch API. Full-page captures, ad blocking, and 9 output formats — no Puppeteer, no headless Chrome, no Lambda layers.",
    intro: [
      "Node 18+ ships with fetch built in, which means taking a website screenshot is now a three-line operation — no puppeteer, no chromium binaries bloating your Docker image, and no debugging flaky browser processes on your server or Lambda function.",
      "The API streams the finished image straight back in the response body, so you can pipe it to disk, upload it to S3 with the AWS SDK, return it from an Express route, or store it in Supabase Storage with minimal glue code.",
    ],
    codeLabel: "Capture a screenshot and save it as PNG",
    code: `import fs from "node:fs";

const response = await fetch(
  "${API}/api/take?url=https://example.com&format=png",
  { headers: { Authorization: "Bearer YOUR_API_KEY" } }
);

if (!response.ok) throw new Error(\`Request failed: \${response.status}\`);

fs.writeFileSync("screenshot.png", Buffer.from(await response.arrayBuffer()));`,
    highlights: [
      { title: "Native fetch", desc: "Uses Node's built-in fetch — zero npm dependencies added to your project." },
      { title: "Drop the Chromium binary", desc: "Shave hundreds of MB off your container images by removing headless Chrome." },
      { title: "Serverless friendly", desc: "Works great in Vercel Functions, Cloudflare Workers, and Lambda — no browser sandbox needed." },
      { title: "Bulk endpoint", desc: "Queue thousands of URLs through the bulk API on Pro plans." },
    ],
    faqs: [
      {
        q: "Why use an API instead of Puppeteer?",
        a: "Puppeteer requires a Chromium binary, careful memory tuning, and constant maintenance across OS updates. The API offloads rendering to dedicated infrastructure so your Node process stays small and stateless.",
      },
      {
        q: "Does this work in serverless environments?",
        a: "Yes. Because it is a single HTTPS request returning image bytes, it fits easily inside Vercel Functions, AWS Lambda, and Netlify Functions without custom layers or /tmp size concerns.",
      },
      {
        q: "How do I capture dynamic JavaScript sites?",
        a: "You don't need to do anything special. Pages render in a real Chromium instance with network-idle waiting, so React, Next.js, and other SPA frameworks appear fully hydrated in the screenshot.",
      },
      {
        q: "Can I take screenshots in TypeScript?",
        a: "Absolutely — the example works unchanged in TypeScript. The API returns binary data, so typing is limited to your own file-handling code.",
      },
    ],
  },
  {
    slug: "go",
    language: "Go",
    title: "Screenshot API for Go",
    metaTitle: "Go Screenshot API - Capture Websites with net/http",
    metaDescription:
      "Render website screenshots from Go using the standard net/http package. Full-page capture, ad blocking, and PNG/WebP/PDF output — no chromedp orRod required.",
    intro: [
      "Go's standard library has everything needed to call ScreenshotAPI: build the request, add the Authorization header, and copy the response body to a file. No chromedp, no Rod, no CGO Chromium bindings to compile into your binary.",
      "This makes it a natural fit for Go services and CLI tools — cron jobs that archive pages, microservices that generate link previews, or worker queues that snapshot thousands of URLs concurrently with goroutines.",
    ],
    codeLabel: "Capture a screenshot and save it as PNG",
    code: `package main

import (
	"io"
	"net/http"
	"os"
)

func main() {
	req, _ := http.NewRequest("GET",
		"${API}/api/take?url=https://example.com&format=png", nil)
	req.Header.Set("Authorization", "Bearer YOUR_API_KEY")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		panic(err)
	}
	defer resp.Body.Close()

	out, _ := os.Create("screenshot.png")
	defer out.Close()
	io.Copy(out, resp.Body)
}`,
    highlights: [
      { title: "Standard library only", desc: "net/http + io.Copy — no third-party browser automation packages." },
      { title: "Goroutine friendly", desc: "Fan out concurrent captures across goroutines; the API scales with you." },
      { title: "Single static binary", desc: "Keep shipping tiny statically-linked binaries with no embedded Chromium." },
      { title: "Streaming responses", desc: "Pipe the image straight to disk or object storage without buffering in memory." },
    ],
    faqs: [
      {
        q: "Should I use chromedp or an API?",
        a: "chromedp is great when you need full browser control locally, but it ties your service to an installed Chrome instance. For straightforward capture jobs, the API removes that operational burden completely.",
      },
      {
        q: "How do I set a timeout in Go?",
        a: "Use a custom http.Client with Timeout set to roughly 30 seconds. Slow pages are handled server-side, but the timeout protects your workers from pathological cases.",
      },
      {
        q: "Can I capture many URLs concurrently?",
        a: "Yes — launch one goroutine per URL with a semaphore to limit concurrency, and each request renders independently. The Starter plan supports parallel requests, and Pro adds a bulk endpoint for large batches.",
      },
    ],
  },
  {
    slug: "php",
    language: "PHP",
    title: "Screenshot API for PHP",
    metaTitle: "PHP Screenshot API - Website Screenshots Without Headless Chrome",
    metaDescription:
      "Generate website screenshots from PHP with file_get_contents or Guzzle. Full-page capture, ad blocking, and instant PNG output — no wkhtmltoimage or headless Chrome on your server.",
    intro: [
      "Traditional PHP screenshot tricks — wkhtmltoimage, xvfb-run hacks, or a headless Chrome sidecar — are painful to keep running on shared hosting and containers alike. ScreenshotAPI needs nothing but PHP's standard stream functions or any HTTP client like Guzzle.",
      "The example below works on any PHP 8 setup with allow_url_fopen enabled, and the identical pattern slots into Laravel, Symfony, and WordPress plugins where you need automated page captures.",
    ],
    codeLabel: "Capture a screenshot and save it as PNG",
    code: `<?php
$context = stream_context_create([
    "http" => [
        "method" => "GET",
        "header" => "Authorization: Bearer YOUR_API_KEY\\r\\n",
        "timeout" => 30,
    ],
]);

$data = file_get_contents(
    "${API}/api/take?url=" . urlencode("https://example.com") . "&format=png",
    false,
    $context
);

file_put_contents(__DIR__ . "/screenshot.png", $data);`,
    highlights: [
      { title: "No server extensions", desc: "No Chrome, no xvfb, no wkhtmltoimage binaries to babysit on your host." },
      { title: "Shared-hosting safe", desc: "Works anywhere PHP can make an outbound HTTPS request." },
      { title: "Laravel & WordPress ready", desc: "Drop it into controllers, artisan commands, or plugin code as-is." },
      { title: "PDF output built in", desc: "Switch format=pdf for print-ready documents generated from live pages." },
    ],
    faqs: [
      {
        q: "Do I need Guzzle or can I use plain PHP?",
        a: "Plain PHP works — the example uses file_get_contents with a stream context. If you already have Guzzle installed, the equivalent GET request with an Authorization header produces identical results.",
      },
      {
        q: "How do I display the screenshot directly in a browser?",
        a: "Send the right Content-Type header (image/png) and echo the response body instead of writing it to disk. Remember to keep your API key server-side — never expose it in frontend code.",
      },
      {
        q: "Will this work on WordPress or Laravel Forge servers?",
        a: "Yes. As long as outbound HTTPS is allowed — true for virtually all managed hosts — the API call behaves exactly like any other wp_remote_get or Http facade request.",
      },
    ],
  },
  {
    slug: "ruby",
    language: "Ruby",
    title: "Screenshot API for Ruby",
    metaTitle: "Ruby Screenshot API - Capture Webpages with Net::HTTP",
    metaDescription:
      "Take website screenshots from Ruby using Net::HTTP or Faraday. Full-page renders, automatic ad blocking, and PNG/PDF output — no Watir or Capybara browser management.",
    intro: [
      "Ruby developers no longer need Watir, Capybara, or a Selenium grid just to grab a picture of a webpage. ScreenshotAPI is a plain HTTPS endpoint, so Ruby's built-in Net::HTTP — or whatever HTTP wrapper your project already uses — is enough.",
      "It pairs naturally with Rails background jobs: enqueue a Sidekiq or Solid Queue job, call the API, and attach the resulting image with Active Storage in a few lines.",
    ],
    codeLabel: "Capture a screenshot and save it as PNG",
    code: `require "net/http"
require "uri"

uri = URI("${API}/api/take?url=https://example.com&format=png")

Net::HTTP.start(uri.host, uri.port, use_ssl: true) do |http|
  request = Net::HTTP::Get.new(uri)
  request["Authorization"] = "Bearer YOUR_API_KEY"

  response = http.request(request)
  File.binwrite("screenshot.png", response.body)
end`,
    highlights: [
      { title: "Zero gems required", desc: "Net::HTTP ships with Ruby — no browser drivers or Selenium grid." },
      { title: "Rails job friendly", desc: "Call it from ActiveJob/Sidekiq workers and store results with Active Storage." },
      { title: "Real Chromium rendering", desc: "SPAs and lazy-loaded content render fully before capture." },
      { title: "Full-page option", desc: "full_page=true captures the whole scrollable height in one image." },
    ],
    faqs: [
      {
        q: "Caprybara or an API — which should I use?",
        a: "Use Capybara when you are driving a browser for tests. For production features that just need an image of a page — previews, reports, archives — the API is far simpler to run and scale.",
      },
      {
        q: "How do I avoid blocking my Rails request thread?",
        a: "Wrap the call in a background job. A typical setup enqueues a job from the controller, performs the API call, then attaches the image via Active Storage and notifies the user.",
      },
      {
        q: "What Ruby versions are supported?",
        a: "Any version whose Net::HTTP supports TLS 1.2+, which covers all currently maintained Ruby releases. Faraday, HTTParty, and http.rb work equally well.",
      },
    ],
  },
  {
    slug: "java",
    language: "Java",
    title: "Screenshot API for Java",
    metaTitle: "Java Screenshot API - Website Screenshots with HttpClient",
    metaDescription:
      "Render website screenshots from Java 11+ with the built-in HttpClient. Full-page capture, ad blocking, and PDF output — no Selenium WebDriver or Chrome DevTools protocol.",
    intro: [
      "Since Java 11, the JDK includes a modern HttpClient that handles this entire integration without a single external dependency. No Selenium WebDriver lifecycle, no ChromeDriver version matching, no headless Chrome memory footprint inside your JVM service.",
      "That simplicity matters for Spring Boot services and Android apps alike: make the request, read the byte array, persist it wherever your stack stores files.",
    ],
    codeLabel: "Capture a screenshot and save it as PNG",
    code: `import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.nio.file.Files;
import java.nio.file.Path;

public class Capture {
    public static void main(String[] args) throws Exception {
        HttpRequest request = HttpRequest.newBuilder()
            .uri(URI.create("${API}/api/take?url=https://example.com&format=png"))
            .header("Authorization", "Bearer YOUR_API_KEY")
            .GET()
            .build();

        var response = HttpClient.newHttpClient()
            .send(request, java.net.http.HttpResponse.BodyHandlers.ofByteArray());

        Files.write(Path.of("screenshot.png"), response.body());
    }
}`,
    highlights: [
      { title: "JDK-only", desc: "Uses java.net.http.HttpClient — no WebDriver, no CDP libraries." },
      { title: "Spring Boot ready", desc: "Wrap it in a @Service and inject it anywhere in your Spring application." },
      { title: "Byte-array handling", desc: "BodyHandlers.ofByteArray gives you the image ready for storage or streaming." },
      { title: "Predictable scaling", desc: "Rendering happens remotely, so JVM heap stays flat regardless of page complexity." },
    ],
    faqs: [
      {
        q: "Which Java versions work?",
        a: "Java 11 or newer, since the example relies on the standard HttpClient. Older stacks can use any HTTP client library — OkHttp and Apache HttpClient both work with the same headers.",
      },
      {
        q: "How long should my timeouts be?",
        a: "Allow up to 30 seconds for complex pages. The renderer waits for network idle, which trades a little latency for guaranteed-complete captures of slow, script-heavy sites.",
      },
      {
        q: "Can Java apps generate PDFs of webpages?",
        a: "Yes — set format=pdf and the same request returns a paginated PDF document, handy for invoicing systems and compliance archiving in enterprise Java stacks.",
      },
    ],
  },
  {
    slug: "csharp",
    language: "C#",
    title: "Screenshot API for C# / .NET",
    metaTitle: "C# Screenshot API - Capture Webpages with HttpClient (.NET)",
    metaDescription:
      "Take website screenshots in C# and .NET with HttpClient. Full-page captures, ad blocking, dark mode, and PNG/PDF output — no Playwright for .NET or headless Chrome required.",
    intro: [
      ".NET's HttpClient plus ScreenshotAPI is all it takes to convert URLs into images from C#. There is no Playwright for .NET to install, no msedge driver, and no Chromium container to deploy alongside your ASP.NET Core app.",
      "The response body is the image itself, so you can write it to disk, return it from a controller, or push it to Azure Blob Storage with a couple of lines.",
    ],
    codeLabel: "Capture a screenshot and save it as PNG",
    code: `using System.Net.Http;

using var client = new HttpClient();
client.DefaultRequestHeaders.Add("Authorization", "Bearer YOUR_API_KEY");

var url = "${API}/api/take?url=https://example.com&format=png";
var bytes = await client.GetByteArrayAsync(url);

await File.WriteAllBytesAsync("screenshot.png", bytes);`,
    highlights: [
      { title: "Native HttpClient", desc: "No Playwright, WebDriver, or headless-Chromium deployment for .NET." },
      { title: "Async first", desc: "Fully asynchronous — safe to call from ASP.NET Core controllers without thread starvation." },
      { title: "Azure-friendly", desc: "Stream results directly into Azure Blob Storage or return from minimal APIs." },
      { title: "All output formats", desc: "PNG, JPEG, WebP, AVIF, PDF and more via a single query parameter." },
    ],
    faqs: [
      {
        q: "Playwright for .NET or an API?",
        a: "Choose Playwright when tests must drive a real browser. When the goal is simply producing an image of a page in production, a hosted API avoids the browser runtime, its memory cost, and its update cycle.",
      },
      {
        q: "Where should I keep my API key in ASP.NET Core?",
        a: "Store it in configuration (appsettings, environment variables, or Azure Key Vault) and read it via IConfiguration or the options pattern. Never place it in client-side code or public repositories.",
      },
      {
        q: "Can I capture multiple pages concurrently?",
        a: "Yes — issue parallel requests with Task.WhenAll and a bounded degree of concurrency. Each render runs independently on our infrastructure.",
      },
    ],
  },
  {
    slug: "rust",
    language: "Rust",
    title: "Screenshot API for Rust",
    metaTitle: "Rust Screenshot API - Website Captures with reqwest",
    metaDescription:
      "Capture website screenshots from Rust with reqwest. Full-page renders, automatic ad blocking, and PNG/WebP/PDF output — no headlesschrome or wasm-bound browser crates.",
    intro: [
      "Browser-automation options in Rust are thin on the ground, and embedding headless Chrome next to a Rust binary is nobody's idea of fun. ScreenshotAPI sidesteps all of it: one HTTPS GET with reqwest returns the rendered page as bytes.",
      "The blocking client keeps the example short for CLI tools and batch jobs; switch to tokio and reqwest's async client when you integrate it into an axum or actix-web service.",
    ],
    codeLabel: "Capture a screenshot and save it as PNG",
    code: `use std::error::Error;

fn main() -> Result<(), Box<dyn Error>> {
    let response = reqwest::blocking::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()?
        .get("${API}/api/take?url=https://example.com&format=png")
        .header("Authorization", "Bearer YOUR_API_KEY")
        .send()?;

    let bytes = response.bytes()?;
    std::fs::write("screenshot.png", bytes)?;
    Ok(())
}`,
    highlights: [
      { title: "Tiny dependency tree", desc: "Just reqwest — no headless-chrome crates or CDP bindings." },
      { title: "Blocking or async", desc: "Use the blocking client in scripts or reqwest async under tokio in services." },
      { title: "Binary-safe", desc: "response.bytes() hands you the image ready to write, hash, or embed." },
      { title: "Batch workflows", desc: "Ideal for Rust crawlers and archival pipelines processing URL lists." },
    ],
    faqs: [
      {
        q: "Which reqwest features do I need?",
        a: "Enable the blocking feature for synchronous code, and json if you later move to signed request flows. TLS support is included by default via rustls or native-tls.",
      },
      {
        q: "How do I capture full pages from Rust?",
        a: "Add &full_page=true to the query string. The renderer scrolls the entire document and returns one continuous image, perfect for archival snapshots.",
      },
      {
        q: "Is there a rate limit?",
        a: "Each plan defines a monthly credit allowance plus a per-second request rate. Back off on HTTP 429 responses; the headers tell you how long to wait.",
      },
    ],
  },
];

export function getGuide(slug: string): ScreenshotGuide | undefined {
  return screenshotGuides.find((g) => g.slug === slug);
}

export function otherGuides(currentSlug: string): ScreenshotGuide[] {
  return screenshotGuides.filter((g) => g.slug !== currentSlug);
}
