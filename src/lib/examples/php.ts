import type { LanguageExample } from "./types";
import { siteConfig } from "@/lib/site";

const API = siteConfig.apiUrl;

export const phpExamples: LanguageExample = {
  id: "php",
  label: "PHP",
  scenarios: {
    quickstart: `<?php
$base = "${API}";
$key = "Authorization: Bearer " . getenv("SCREENSHOT_API_KEY");

$ch = curl_init($base . "/api/take?url=" . urlencode("https://example.com") . "&format=png");
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER     => [$key],
    CURLOPT_TIMEOUT        => 30,
]);

$data   = curl_exec($ch);
$status = curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
$err    = curl_error($ch);
curl_close($ch);

if ($data === false) {
    throw new RuntimeException("Request failed: " . $err);
}
if ($status !== 200) {
    throw new RuntimeException("Capture failed with HTTP " . $status);
}

file_put_contents(__DIR__ . "/screenshot.png", $data);`,
    advanced: `<?php
$base = "${API}";
$key = "Authorization: Bearer " . getenv("SCREENSHOT_API_KEY");

$query = http_build_query([
    "url"                 => "https://example.com",
    "format"              => "webp",
    "quality"             => 90,
    "full_page"           => "true",
    "dark_mode"           => "true",
    "viewport_width"      => 1920,
    "viewport_height"     => 1080,
    "device_scale_factor" => 2,
]);

$ch = curl_init($base . "/api/take?" . $query);
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER     => [$key],
    CURLOPT_TIMEOUT        => 30,
]);

$data = curl_exec($ch);
$status = curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
curl_close($ch);

if ($status !== 200) {
    throw new RuntimeException("Capture failed with HTTP " . $status);
}
file_put_contents(__DIR__ . "/screenshot.webp", $data);`,
    bulk: `<?php
$base = "${API}";

$payload = json_encode([
    "urls"        => ["https://example.com", "https://vercel.com", "https://stripe.com"],
    "format"      => "png",
    "full_page"   => true,
    "concurrency" => 5,
    "max_retries" => 2,
]);

$ch = curl_init($base . "/api/take/bulk");
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_POST           => true,
    CURLOPT_POSTFIELDS     => $payload,
    CURLOPT_HTTPHEADER     => [
        "Authorization: Bearer " . getenv("SCREENSHOT_API_KEY"),
        "Content-Type: application/json",
    ],
    CURLOPT_TIMEOUT        => 120,
]);

$response = curl_exec($ch);
$status   = curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
curl_close($ch);

if ($status !== 200) {
    throw new RuntimeException("Bulk capture failed with HTTP " . $status);
}

$data = json_decode($response, true, flags: JSON_THROW_ON_ERROR);
echo $data["successful"], "/", $data["total"], " succeeded, ", $data["creditsUsed"], " credits", PHP_EOL;

foreach ($data["results"] as $result) {
    if (!$result["success"]) {
        echo "FAILED: ", $result["url"], " - ", $result["error"], PHP_EOL;
    }
}`,
    async: `<?php
$base = "${API}";
$headers = [
    "Authorization: Bearer " . getenv("SCREENSHOT_API_KEY"),
    "Content-Type: application/json",
];

function request(string $method, string $url, array $headers, ?string $body = null): array
{
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CUSTOMREQUEST  => $method,
        CURLOPT_POSTFIELDS     => $body,
        CURLOPT_HTTPHEADER     => $headers,
        CURLOPT_TIMEOUT        => 60,
    ]);
    $response = curl_exec($ch);
    $status   = curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    curl_close($ch);

    $decoded = json_decode($response, true);
    if ($status >= 400 || empty($decoded["success"])) {
        throw new RuntimeException("API error (HTTP " . $status . ")");
    }
    return $decoded["data"];
}

$job = request("POST", $base . "/api/v1/screenshots", $headers, json_encode([
    "url" => "https://example.com", "format" => "png", "full_page" => true,
]));

while (in_array($job["status"], ["queued", "processing"], true)) {
    sleep(2);
    $job = request("GET", $base . "/api/v1/screenshots/" . $job["id"], $headers);
}
if ($job["status"] !== "completed") {
    throw new RuntimeException("Job did not complete");
}

file_put_contents(__DIR__ . "/screenshot.png",
    file_get_contents($job["screenshot"]["url"]));`,
  },
};
