import type { LanguageExample } from "./types";
import { siteConfig } from "@/lib/site";

const API = siteConfig.apiUrl;

export const pythonExamples: LanguageExample = {
  id: "python",
  label: "Python",
  scenarios: {
    quickstart: `import os
import requests

response = requests.get(
    "${API}/api/take",
    params={"url": "https://example.com", "format": "png"},
    headers={"Authorization": "Bearer " + os.environ["SCREENSHOT_API_KEY"]},
    timeout=30,
)
response.raise_for_status()

with open("screenshot.png", "wb") as f:
    f.write(response.content)`,
    advanced: `import os
import requests

response = requests.get(
    "${API}/api/take",
    params={
        "url": "https://example.com",
        "format": "webp",
        "quality": 90,
        "full_page": "true",
        "dark_mode": "true",
        "viewport_width": 1920,
        "viewport_height": 1080,
        "device_scale_factor": 2,
    },
    headers={"Authorization": "Bearer " + os.environ["SCREENSHOT_API_KEY"]},
    timeout=30,
)
response.raise_for_status()

with open("screenshot.webp", "wb") as f:
    f.write(response.content)`,
    bulk: `import os
import requests

response = requests.post(
    "${API}/api/take/bulk",
    json={
        "urls": ["https://example.com", "https://vercel.com", "https://stripe.com"],
        "format": "png",
        "full_page": True,
        "concurrency": 5,
        "max_retries": 2,
    },
    headers={"Authorization": "Bearer " + os.environ["SCREENSHOT_API_KEY"]},
    timeout=120,
)
response.raise_for_status()
data = response.json()

print(data["successful"], "/", data["total"], "succeeded,", data["creditsUsed"], "credits")
for result in data["results"]:
    if not result["success"]:
        print("FAILED:", result["url"], "-", result["error"])`,
    async: `import os
import time
import requests

KEY = {"Authorization": "Bearer " + os.environ["SCREENSHOT_API_KEY"]}
BASE = "${API}"

created = requests.post(
    BASE + "/api/v1/screenshots",
    json={"url": "https://example.com", "format": "png", "full_page": True},
    headers={**KEY, "Content-Type": "application/json"},
    timeout=30,
)
created.raise_for_status()
job_id = created.json()["data"]["id"]

while True:
    status = requests.get(BASE + "/api/v1/screenshots/" + job_id, headers=KEY, timeout=30)
    status.raise_for_status()
    data = status.json()["data"]
    if data["status"] == "completed":
        break
    if data["status"] == "failed":
        raise RuntimeError(data.get("error", {}).get("message", "Job failed"))
    time.sleep(2)

image = requests.get(data["screenshot"]["url"], timeout=30)
with open("screenshot.png", "wb") as f:
    f.write(image.content)`,
  },
};
