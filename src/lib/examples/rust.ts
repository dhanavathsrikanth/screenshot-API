import type { LanguageExample } from "./types";
import { siteConfig } from "@/lib/site";

const API = siteConfig.apiUrl;

export const rustExamples: LanguageExample = {
  id: "rust",
  label: "Rust",
  scenarios: {
    quickstart: `// Cargo.toml: reqwest = { version = "0.12", features = ["blocking"] }
use std::error::Error;

fn main() -> Result<(), Box<dyn Error>> {
    let key = format!("Bearer {}", std::env::var("SCREENSHOT_API_KEY")?);
    let response = reqwest::blocking::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()?
        .get("${API}/api/take?url=https://example.com&format=png")
        .header("Authorization", key)
        .send()?
        .error_for_status()?;

    std::fs::write("screenshot.png", response.bytes()?)?;
    Ok(())
}`,
    advanced: `// Cargo.toml: reqwest = { version = "0.12", features = ["blocking"] }
use std::collections::HashMap;
use std::error::Error;

fn main() -> Result<(), Box<dyn Error>> {
    let params = HashMap::from([
        ("url", "https://example.com"),
        ("format", "webp"),
        ("quality", "90"),
        ("full_page", "true"),
        ("dark_mode", "true"),
        ("viewport_width", "1920"),
        ("viewport_height", "1080"),
        ("device_scale_factor", "2"),
    ]);

    let response = reqwest::blocking::Client::new()
        .get("${API}/api/take")
        .query(&params)
        .header("Authorization", format!("Bearer {}", std::env::var("SCREENSHOT_API_KEY")?))
        .timeout(std::time::Duration::from_secs(30))
        .send()?
        .error_for_status()?;

    std::fs::write("screenshot.webp", response.bytes()?)?;
    Ok(())
}`,
    bulk: `// Cargo.toml: reqwest = { version = "0.12", features = ["blocking", "json"] }, serde_json = "1"
use serde_json::{json, Value};
use std::error::Error;

fn main() -> Result<(), Box<dyn Error>> {
    let payload = json!({
        "urls": [
            "https://example.com",
            "https://vercel.com",
            "https://stripe.com"
        ],
        "format": "png",
        "full_page": true,
        "concurrency": 5,
        "max_retries": 2
    });

    let body: Value = reqwest::blocking::Client::new()
        .post("${API}/api/take/bulk")
        .json(&payload)
        .header("Authorization", format!("Bearer {}", std::env::var("SCREENSHOT_API_KEY")?))
        .timeout(std::time::Duration::from_secs(120))
        .send()?
        .error_for_status()?
        .json()?;

    println!(
        "{}/{} succeeded, {} credits",
        body["successful"], body["total"], body["creditsUsed"]
    );
    for result in body["results"].as_array().unwrap_or(&vec![]) {
        if !result["success"].as_bool().unwrap_or(false) {
            println!("FAIL {} - {}", result["url"], result["error"]);
        }
    }
    Ok(())
}`,
    async: `// Cargo.toml: reqwest = { version = "0.12", features = ["blocking", "json"] }, serde_json = "1"
use serde_json::{json, Value};
use std::error::Error;
use std::time::Duration;

fn api_request(
    client: &reqwest::blocking::Client,
    method: reqwest::Method,
    path: &str,
    json_body: Option<Value>,
) -> Result<Value, Box<dyn Error>> {
    let mut request = client
        .request(method, format!("${API}{}", path))
        .header(
            "Authorization",
            format!("Bearer {}", std::env::var("SCREENSHOT_API_KEY")?),
        )
        .timeout(Duration::from_secs(60));

    request = match json_body {
        Some(body) => request.json(&body),
        None => request,
    };

    let root: Value = request.send()?.error_for_status()?.json()?;
    if !root["success"].as_bool().unwrap_or(false) {
        return Err(root["error"]["message"].as_str().unwrap_or("API error").into());
    }
    Ok(root["data"].clone())
}

fn main() -> Result<(), Box<dyn Error>> {
    let client = reqwest::blocking::Client::new();

    let mut job = api_request(
        &client,
        reqwest::Method::POST,
        "/api/v1/screenshots",
        Some(json!({
            "url": "https://example.com",
            "format": "png",
            "full_page": true
        })),
    )?;

    while matches!(job["status"].as_str(), Some("queued") | Some("processing")) {
        std::thread::sleep(Duration::from_secs(2));
        job = api_request(
            &client,
            reqwest::Method::GET,
            &format!("/api/v1/screenshots/{}", job["id"].as_str().unwrap()),
            None,
        )?;
    }
    if job["status"] != "completed" {
        return Err("Job did not complete".into());
    }

    let image = reqwest::blocking::get(job["screenshot"]["url"].as_str().unwrap())?;
    std::fs::write("screenshot.png", image.bytes()?)?;
    Ok(())
}`,
  },
};
