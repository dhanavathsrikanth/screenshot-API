import type { LanguageExample } from "./types";
import { siteConfig } from "@/lib/site";

const API = siteConfig.apiUrl;

export const curlExamples: LanguageExample = {
  id: "curl",
  label: "cURL",
  scenarios: {
    quickstart: `curl -f "${API}/api/take?url=https://example.com&format=png" \\
  -H "Authorization: Bearer sk_your_api_key" \\
  --output screenshot.png

# -f makes curl exit non-zero on HTTP errors (401/402/429)
# instead of saving an error body as your screenshot.`,
    advanced: `curl -f "${API}/api/take?url=https://example.com&format=webp&quality=90&full_page=true&dark_mode=true&viewport_width=1920&viewport_height=1080&device_scale_factor=2" \\
  -H "Authorization: Bearer sk_your_api_key" \\
  --output screenshot.webp`,
    bulk: `curl -X POST "${API}/api/take/bulk" \\
  -H "Authorization: Bearer sk_your_api_key" \\
  -H "Content-Type: application/json" \\
  -d '{
    "urls": ["https://example.com", "https://vercel.com", "https://stripe.com"],
    "format": "png",
    "full_page": true,
    "concurrency": 5,
    "max_retries": 2
  }' | jq`,
    async: `JOB=$(curl -s -X POST "${API}/api/v1/screenshots" \\
  -H "Authorization: Bearer sk_your_api_key" \\
  -H "Content-Type: application/json" \\
  -d '{"url": "https://example.com", "format": "png", "full_page": true}' \\
  | jq -r '.data.id')

while true; do
  RESP=$(curl -s "${API}/api/v1/screenshots/$JOB" \\
    -H "Authorization: Bearer sk_your_api_key")
  STATUS=$(echo "$RESP" | jq -r '.data.status')
  case "$STATUS" in
    completed) echo "$RESP" | jq -r '.data.screenshot.url'; break ;;
    failed)    echo "$RESP" | jq -r '.error.message' >&2; exit 1 ;;
  esac
  sleep 2
done`,
  },
};
