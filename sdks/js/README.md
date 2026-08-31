# screenshotapi (Node.js)

```bash
npm install screenshotapi
```

```js
import { ScreenshotAPI, signTakeUrl } from "screenshotapi";

const client = new ScreenshotAPI({
  apiKey: process.env.SCREENSHOT_API_KEY,
  baseUrl: "https://api.screenshotapi.tech",
});

const bytes = await client.take({ url: "https://example.com", format: "png" });
const meta = await client.takeJson({ url: "https://example.com", full_page: true });
const bulk = await client.bulk({ urls: ["https://example.com"], format: "png" });

const og = await signTakeUrl({
  baseUrl: "https://api.screenshotapi.tech",
  accessKey: process.env.SCREENSHOT_ACCESS_KEY,
  signingSecret: process.env.SCREENSHOT_SIGNING_SECRET,
  params: { url: "https://example.com", format: "png" },
  expires: Math.floor(Date.now() / 1000) + 3600,
});
```

Until the package is on npm, copy `sdks/js` from this repo.
