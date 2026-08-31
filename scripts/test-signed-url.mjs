import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { signTakeUrl as sdkSign } from "../sdks/js/index.js";

function rfc3986Encode(value) {
  return encodeURIComponent(value).replace(/[!'()*]/g, (c) =>
    `%${c.charCodeAt(0).toString(16).toUpperCase()}`
  );
}
function canonicalQuery(params) {
  return Object.keys(params)
    .filter((key) => key !== "signature" && params[key] !== undefined && params[key] !== "")
    .sort()
    .map((key) => `${rfc3986Encode(key)}=${rfc3986Encode(String(params[key]))}`)
    .join("&");
}

const params = {
  access_key: "ak_live_test",
  format: "png",
  url: "https://example.com/path?q=1",
  expires: "1700000000",
};
const secret = "ss_test_secret";
const canonical = canonicalQuery(params);
const expected = createHmac("sha256", secret).update(canonical).digest("hex");
assert.equal(rfc3986Encode("a b"), "a%20b");

const sdkUrl = await sdkSign({
  baseUrl: "https://api.screenshotapi.tech",
  accessKey: params.access_key,
  signingSecret: secret,
  params: { url: params.url, format: params.format },
  expires: 1700000000,
});
assert.ok(sdkUrl.includes(`signature=${expected}`));
assert.ok(sdkUrl.startsWith("https://api.screenshotapi.tech/api/take?"));
console.log("signed-url vectors ok");
