import type { LanguageExample } from "./types";
import { siteConfig } from "@/lib/site";

const API = siteConfig.apiUrl;

export const goExamples: LanguageExample = {
  id: "go",
  label: "Go",
  scenarios: {
    quickstart: `package main

import (
	"fmt"
	"io"
	"net/http"
	"os"
)

func main() {
	req, err := http.NewRequest("GET",
		"${API}/api/take?url=https://example.com&format=png", nil)
	if err != nil {
		panic(err)
	}
	req.Header.Set("Authorization", "Bearer "+os.Getenv("SCREENSHOT_API_KEY"))

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		panic(err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		panic(fmt.Sprintf("capture failed: HTTP %d: %s", resp.StatusCode, body))
	}

	out, err := os.Create("screenshot.png")
	if err != nil {
		panic(err)
	}
	defer out.Close()

	if _, err := io.Copy(out, resp.Body); err != nil {
		panic(err)
	}
}`,
    advanced: `package main

import (
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
)

func main() {
	params := url.Values{}
	params.Set("url", "https://example.com")
	params.Set("format", "webp")
	params.Set("quality", "90")
	params.Set("full_page", "true")
	params.Set("dark_mode", "true")
	params.Set("viewport_width", "1920")
	params.Set("viewport_height", "1080")
	params.Set("device_scale_factor", "2")

	req, _ := http.NewRequest("GET", "${API}/api/take?"+params.Encode(), nil)
	req.Header.Set("Authorization", "Bearer "+os.Getenv("SCREENSHOT_API_KEY"))

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		panic(err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		panic(fmt.Sprintf("capture failed: HTTP %d", resp.StatusCode))
	}

	out, _ := os.Create("screenshot.webp")
	defer out.Close()
	io.Copy(out, resp.Body)
}`,
    bulk: `package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
)

func main() {
	payload, _ := json.Marshal(map[string]any{
		"urls":        []string{"https://example.com", "https://vercel.com", "https://stripe.com"},
		"format":      "png",
		"full_page":   true,
		"concurrency": 5,
	})

	req, _ := http.NewRequest("POST", "${API}/api/take/bulk", bytes.NewReader(payload))
	req.Header.Set("Authorization", "Bearer "+os.Getenv("SCREENSHOT_API_KEY"))
	req.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		panic(err)
	}
	defer resp.Body.Close()

	var result map[string]any
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		panic(err)
	}

	fmt.Printf("%v/%v succeeded, %v credits\\n",
		result["successful"], result["total"], result["creditsUsed"])
	for _, item := range result["results"].([]any) {
		r := item.(map[string]any)
		if r["success"].(bool) {
			fmt.Println("OK  ", r["url"])
		} else {
			fmt.Println("FAIL", r["url"], "-", r["error"])
		}
	}
}`,
    async: `package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"time"
)

func getJSON(client *http.Client, method, url string, body io.Reader, out any) {
	req, _ := http.NewRequest(method, url, body)
	req.Header.Set("Authorization", "Bearer "+os.Getenv("SCREENSHOT_API_KEY"))
	req.Header.Set("Content-Type", "application/json")

	resp, err := client.Do(req)
	if err != nil {
		panic(err)
	}
	defer resp.Body.Close()

	var envelope struct {
		Success bool            \`json:"success"\`
		Data    json.RawMessage \`json:"data"\`
		Error   *struct {
			Message string \`json:"message"\`
		} \`json:"error"\`
	}
	if err := json.NewDecoder(resp.Body).Decode(&envelope); err != nil {
		panic(err)
	}
	if !envelope.Success {
		panic("API error: " + envelope.Error.Message)
	}
	if err := json.Unmarshal(envelope.Data, out); err != nil {
		panic(err)
	}
}

func main() {
	client := &http.Client{Timeout: 60 * time.Second}
	BASE := "${API}"

	var created struct {
		ID     string \`json:"id"\`
		Status string \`json:"status"\`
	}
	body, _ := json.Marshal(map[string]any{
		"url": "https://example.com", "format": "png", "full_page": true,
	})
	getJSON(client, "POST", BASE+"/api/v1/screenshots", bytes.NewReader(body), &created)

	for created.Status == "queued" || created.Status == "processing" {
		time.Sleep(2 * time.Second)
		getJSON(client, "GET", BASE+"/api/v1/screenshots/"+created.ID, nil, &created)
	}
	if created.Status != "completed" {
		panic("job did not complete")
	}

	var done struct {
		Screenshot struct {
			URL string \`json:"url"\`
		} \`json:"screenshot"\`
	}
	getJSON(client, "GET", BASE+"/api/v1/screenshots/"+created.ID, nil, &done)

	image, err := http.Get(done.Screenshot.URL)
	if err != nil {
		panic(err)
	}
	defer image.Body.Close()

	out, _ := os.Create("screenshot.png")
	defer out.Close()
	io.Copy(out, image.Body)
	fmt.Println("saved screenshot.png")
}`,
  },
};
