import type { LanguageExample } from "./types";
import { siteConfig } from "@/lib/site";

const API = siteConfig.apiUrl;

export const javaExamples: LanguageExample = {
  id: "java",
  label: "Java",
  scenarios: {
    quickstart: `import java.io.InputStream;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.nio.file.Files;
import java.nio.file.Path;

public class Capture {
    public static void main(String[] args) throws Exception {
        HttpRequest request = HttpRequest.newBuilder()
            .uri(URI.create("${API}/api/take?url=https://example.com&format=png"))
            .header("Authorization", "Bearer " + System.getenv("SCREENSHOT_API_KEY"))
            .GET()
            .build();

        HttpClient client = HttpClient.newHttpClient();
        var response = client.send(request, HttpResponse.BodyHandlers.ofInputStream());

        if (response.statusCode() != 200) {
            throw new IllegalStateException("Capture failed with HTTP " + response.statusCode());
        }
        try (InputStream in = response.body()) {
            Files.copy(in, Path.of("screenshot.png"));
        }
    }
}`,
    advanced: `import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.LinkedHashMap;
import java.util.Map;

public class CaptureAdvanced {
    public static void main(String[] args) throws Exception {
        Map<String, String> params = new LinkedHashMap<>();
        params.put("url", "https://example.com");
        params.put("format", "webp");
        params.put("quality", "90");
        params.put("full_page", "true");
        params.put("dark_mode", "true");
        params.put("viewport_width", "1920");
        params.put("viewport_height", "1080");
        params.put("device_scale_factor", "2");

        StringBuilder query = new StringBuilder();
        params.forEach((k, v) -> query.append(query.isEmpty() ? "?" : "&")
            .append(URLEncoder.encode(k, StandardCharsets.UTF_8))
            .append("=")
            .append(URLEncoder.encode(v, StandardCharsets.UTF_8)));

        HttpRequest request = HttpRequest.newBuilder()
            .uri(URI.create("${API}/api/take" + query))
            .header("Authorization", "Bearer " + System.getenv("SCREENSHOT_API_KEY"))
            .GET()
            .build();

        var response = HttpClient.newHttpClient()
            .send(request, HttpResponse.BodyHandlers.ofInputStream());

        if (response.statusCode() != 200) {
            throw new IllegalStateException("Capture failed with HTTP " + response.statusCode());
        }
        try (var in = response.body()) {
            Files.copy(in, Path.of("screenshot.webp"));
        }
    }
}`,
    bulk: `// Uses Jackson for JSON (com.fasterxml.jackson.core:jackson-databind)
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;

public class BulkCapture {
    public static void main(String[] args) throws Exception {
        String payload = """
            {
              "urls": ["https://example.com", "https://vercel.com", "https://stripe.com"],
              "format": "png",
              "full_page": true,
              "concurrency": 5,
              "max_retries": 2
            }""";

        HttpRequest request = HttpRequest.newBuilder()
            .uri(URI.create("${API}/api/take/bulk"))
            .header("Authorization", "Bearer " + System.getenv("SCREENSHOT_API_KEY"))
            .header("Content-Type", "application/json")
            .POST(HttpRequest.BodyPublishers.ofString(payload))
            .build();

        HttpResponse<String> response =
            HttpClient.newHttpClient().send(request, HttpResponse.BodyHandlers.ofString());

        JsonNode body = new ObjectMapper().readTree(response.body());
        System.out.printf("%s/%s succeeded, %s credits%n",
            body.get("successful").asInt(), body.get("total").asInt(), body.get("creditsUsed").asInt());

        for (JsonNode result : body.withArray("results")) {
            if (!result.path("success").asBoolean()) {
                System.out.println("FAIL " + result.path("url").asText()
                    + " - " + result.path("error").asText(""));
            }
        }
    }
}`,
    async: `// Uses Jackson for JSON (com.fasterxml.jackson.core:jackson-databind)
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;

public class AsyncCapture {
    static final String BASE = "${API}";
    static final HttpClient CLIENT = HttpClient.newHttpClient();

    static JsonNode api(String method, String path, String jsonBody) throws Exception {
        var builder = HttpRequest.newBuilder()
            .uri(URI.create(BASE + path))
            .header("Authorization", "Bearer " + System.getenv("SCREENSHOT_API_KEY"));

        if (jsonBody != null) {
            builder.header("Content-Type", "application/json");
            builder.POST(HttpRequest.BodyPublishers.ofString(jsonBody));
        } else {
            builder.GET();
        }

        HttpResponse<String> response = CLIENT.send(builder.build(),
            HttpResponse.BodyHandlers.ofString());
        JsonNode root = new ObjectMapper().readTree(response.body());
        if (!root.path("success").asBoolean()) {
            throw new IllegalStateException(root.path("error").path("message").asText("API error"));
        }
        return root.get("data");
    }

    public static void main(String[] args) throws Exception {
        JsonNode job = api("POST", "/api/v1/screenshots",
            "{\\"url\\": \\"https://example.com\\", \\"format\\": \\"png\\", \\"full_page\\": true}");

        while (job.get("status").asText().equals("queued")
            || job.get("status").asText().equals("processing")) {
            Thread.sleep(2000);
            job = api("GET", "/api/v1/screenshots/" + job.get("id").asText(), null);
        }
        if (!job.get("status").asText().equals("completed")) {
            throw new IllegalStateException("Job did not complete");
        }

        String imageUrl = job.path("screenshot").path("url").asText();
        byte[] image = HttpClient.newHttpClient()
            .send(HttpRequest.newBuilder(URI.create(imageUrl)).GET().build(),
                HttpResponse.BodyHandlers.ofByteArray())
            .body();
        java.nio.file.Files.write(java.nio.file.Path.of("screenshot.png"), image);
    }
}`,
  },
};
