import type { LanguageExample } from "./types";
import { siteConfig } from "@/lib/site";

const API = siteConfig.apiUrl;

export const csharpExamples: LanguageExample = {
  id: "csharp",
  label: "C#",
  scenarios: {
    quickstart: `using System.Net.Http;

using var client = new HttpClient { Timeout = TimeSpan.FromSeconds(30) };
client.DefaultRequestHeaders.Add("Authorization",
    "Bearer " + Environment.GetEnvironmentVariable("SCREENSHOT_API_KEY"));

var bytes = await client.GetByteArrayAsync(
    "${API}/api/take?url=https://example.com&format=png");

await File.WriteAllBytesAsync("screenshot.png", bytes);`,
    advanced: `using System.Net.Http;
using System.Net.Http.Json;

var query = new Dictionary<string, string>
{
    ["url"] = "https://example.com",
    ["format"] = "webp",
    ["quality"] = "90",
    ["full_page"] = "true",
    ["dark_mode"] = "true",
    ["viewport_width"] = "1920",
    ["viewport_height"] = "1080",
    ["device_scale_factor"] = "2",
};

using var client = new HttpClient { Timeout = TimeSpan.FromSeconds(30) };
client.DefaultRequestHeaders.Add("Authorization",
    "Bearer " + Environment.GetEnvironmentVariable("SCREENSHOT_API_KEY"));

var response = await client.GetAsync(
    "${API}/api/take?" + string.Join("&", query.Select(kv =>
        Uri.EscapeDataString(kv.Key) + "=" + Uri.EscapeDataString(kv.Value))));
response.EnsureSuccessStatusCode();

await using var stream = await response.Content.ReadAsStreamAsync();
await using var output = File.Create("screenshot.webp");
await stream.CopyToAsync(output);`,
    bulk: `using System.Net.Http;
using System.Net.Http.Json;
using System.Text.Json;

var payload = new
{
    urls = new[] { "https://example.com", "https://vercel.com", "https://stripe.com" },
    format = "png",
    full_page = true,
    concurrency = 5,
    max_retries = 2,
};

using var client = new HttpClient { Timeout = TimeSpan.FromSeconds(120) };
client.DefaultRequestHeaders.Add("Authorization",
    "Bearer " + Environment.GetEnvironmentVariable("SCREENSHOT_API_KEY"));

var response = await client.PostAsJsonAsync("${API}/api/take/bulk", payload);
response.EnsureSuccessStatusCode();

var body = await response.Content.ReadFromJsonAsync<JsonElement>();
Console.WriteLine(body.GetProperty("successful").GetInt32() + "/"
    + body.GetProperty("total").GetInt32() + " succeeded, "
    + body.GetProperty("creditsUsed").GetInt32() + " credits");

foreach (var result in body.GetProperty("results").EnumerateArray())
{
    if (!result.GetProperty("success").GetBoolean())
        Console.WriteLine("FAIL " + result.GetProperty("url").GetString()
            + " - " + result.GetProperty("error").GetString());
}`,
    async: `using System.Net.Http;
using System.Net.Http.Json;
using System.Text.Json;

const string BaseUrl = "${API}";

using var client = new HttpClient { Timeout = TimeSpan.FromSeconds(60) };
client.DefaultRequestHeaders.Add("Authorization",
    "Bearer " + Environment.GetEnvironmentVariable("SCREENSHOT_API_KEY"));

async Task<JsonElement> ApiAsync(string method, string path, object? jsonBody = null)
{
    HttpResponseMessage response = jsonBody switch
    {
        null => await client.GetAsync(BaseUrl + path),
        _ => await client.PostAsJsonAsync(BaseUrl + path, jsonBody),
    };

    var root = await response.Content.ReadFromJsonAsync<JsonElement>();
    if (!root.GetProperty("success").GetBoolean())
        throw new Exception(root.GetProperty("error").GetProperty("message").GetString());
    return root.GetProperty("data");
}

var job = await ApiAsync("POST", "/api/v1/screenshots",
    new { url = "https://example.com", format = "png", full_page = true });

while (job.GetProperty("status").GetString() is "queued" or "processing")
{
    await Task.Delay(2000);
    job = await ApiAsync("GET", "/api/v1/screenshots/" + job.GetProperty("id").GetString());
}
if (job.GetProperty("status").GetString() != "completed")
    throw new Exception("Job did not complete");

var imageUrl = job.GetProperty("screenshot").GetProperty("url").GetString()!;
byte[] image = await client.GetByteArrayAsync(imageUrl);
await File.WriteAllBytesAsync("screenshot.png", image);`,
  },
};
