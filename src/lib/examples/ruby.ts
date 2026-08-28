import type { LanguageExample } from "./types";
import { siteConfig } from "@/lib/site";

const API = siteConfig.apiUrl;

export const rubyExamples: LanguageExample = {
  id: "ruby",
  label: "Ruby",
  scenarios: {
    quickstart: `require "net/http"
require "uri"

uri = URI("${API}/api/take?url=https://example.com&format=png")

Net::HTTP.start(uri.host, uri.port, use_ssl: true, read_timeout: 30) do |http|
  request = Net::HTTP::Get.new(uri)
  request["Authorization"] = "Bearer " + ENV.fetch("SCREENSHOT_API_KEY")

  response = http.request(request)
  raise "Capture failed with HTTP " + response.code unless response.is_a?(Net::HTTPSuccess)

  File.binwrite("screenshot.png", response.body)
end`,
    advanced: `require "net/http"
require "uri"

params = {
  url: "https://example.com",
  format: "webp",
  quality: 90,
  full_page: "true",
  dark_mode: "true",
  viewport_width: 1920,
  viewport_height: 1080,
  device_scale_factor: 2,
}

uri = URI("${API}/api/take?" + URI.encode_www_form(params.map { |k, v| [k.to_s, v.to_s] }))

Net::HTTP.start(uri.host, uri.port, use_ssl: true, read_timeout: 30) do |http|
  request = Net::HTTP::Get.new(uri)
  request["Authorization"] = "Bearer " + ENV.fetch("SCREENSHOT_API_KEY")

  response = http.request(request)
  raise "Capture failed with HTTP " + response.code unless response.is_a?(Net::HTTPSuccess)

  File.binwrite("screenshot.webp", response.body)
end`,
    bulk: `require "json"
require "net/http"
require "uri"

uri = URI("${API}/api/take/bulk")
payload = {
  urls: ["https://example.com", "https://vercel.com", "https://stripe.com"],
  format: "png",
  full_page: true,
  concurrency: 5,
  max_retries: 2,
}

Net::HTTP.start(uri.host, uri.port, use_ssl: true, read_timeout: 120) do |http|
  request = Net::HTTP::Post.new(uri)
  request["Authorization"] = "Bearer " + ENV.fetch("SCREENSHOT_API_KEY")
  request["Content-Type"] = "application/json"
  request.body = payload.to_json

  response = http.request(request)
  raise "Bulk capture failed with HTTP " + response.code unless response.is_a?(Net::HTTPSuccess)

  data = JSON.parse(response.body)
  puts "#{data['successful']}/#{data['total']} succeeded, #{data['creditsUsed']} credits"
  data["results"].each do |result|
    puts("FAIL #{result['url']} - #{result['error']}") unless result["success"]
  end
end`,
    async: `require "json"
require "net/http"
require "uri"

BASE = URI("${API}")
KEY = "Bearer " + ENV.fetch("SCREENSHOT_API_KEY")

def api_request(method, path, body: nil)
  uri = URI.join(BASE.to_s, path)
  request = Net::HTTP.const_get(method).new(uri)
  request["Authorization"] = KEY
  request["Content-Type"] = "application/json"
  request.body = JSON.generate(body) if body

  response = Net::HTTP.start(uri.host, uri.port, use_ssl: true, read_timeout: 60) do |http|
    http.request(request)
  end
  raise "API error HTTP #{response.code}: #{response.body}" unless response.is_a?(Net::HTTPSuccess)

  JSON.parse(response.body)["data"]
end

job = api_request("Post", "/api/v1/screenshots",
  body: { url: "https://example.com", format: "png", full_page: true })

while %w[queued processing].include?(job["status"])
  sleep 2
  job = api_request("Get", "/api/v1/screenshots/" + job["id"])
end
raise "Job did not complete" unless job["status"] == "completed"

image_uri = URI(job["screenshot"]["url"])
File.binwrite("screenshot.png", Net::HTTP.get(image_uri))`,
  },
};
