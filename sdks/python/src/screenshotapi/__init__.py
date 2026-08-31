"""Official ScreenshotAPI Python client."""

from __future__ import annotations

import hashlib
import hmac
import json
import time
import urllib.error
import urllib.parse
import urllib.request
from typing import Any, Mapping


def rfc3986_encode(value: str) -> str:
    return urllib.parse.quote(str(value), safe="-._~")


def canonical_query(params: Mapping[str, str]) -> str:
    items = [
        (k, v)
        for k, v in params.items()
        if k != "signature" and v is not None and v != ""
    ]
    items.sort(key=lambda kv: kv[0])
    return "&".join(f"{rfc3986_encode(k)}={rfc3986_encode(v)}" for k, v in items)


def sign_take_url(
    *,
    base_url: str,
    access_key: str,
    signing_secret: str,
    params: Mapping[str, Any] | None = None,
    expires: int | None = None,
) -> str:
    query: dict[str, str] = {}
    for key, value in (params or {}).items():
        if value is None or value == "" or key in {"signature", "access_key"}:
            continue
        query[key] = str(value)
    query["access_key"] = access_key
    if expires is not None:
        query["expires"] = str(expires)
    canonical = canonical_query(query)
    signature = hmac.new(
        signing_secret.encode("utf-8"),
        canonical.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()
    base = base_url.rstrip("/")
    path = base if base.endswith("/api/take") else f"{base}/api/take"
    return f"{path}?{canonical}&signature={signature}"


class ScreenshotAPIError(Exception):
    def __init__(self, status: int, code: str, message: str, details: Any = None):
        super().__init__(message)
        self.status = status
        self.code = code
        self.details = details


class ScreenshotAPI:
    def __init__(self, api_key: str, base_url: str = "https://api.screenshotapi.tech"):
        if not api_key:
            raise ValueError("api_key is required")
        self.api_key = api_key
        self.base_url = base_url.rstrip("/")

    def _request(
        self,
        path: str,
        *,
        method: str = "GET",
        query: Mapping[str, Any] | None = None,
        body: Any = None,
        raw: bool = False,
    ) -> Any:
        url = f"{self.base_url}{path}"
        if query:
            qs = urllib.parse.urlencode(
                {k: v for k, v in query.items() if v is not None and v != ""},
                quote_via=urllib.parse.quote,
            )
            url = f"{url}?{qs}"
        headers = {"Authorization": f"Bearer {self.api_key}"}
        data = None
        if body is not None:
            headers["Content-Type"] = "application/json"
            data = json.dumps(body).encode("utf-8")
        req = urllib.request.Request(url, data=data, headers=headers, method=method)
        try:
            with urllib.request.urlopen(req, timeout=120) as res:
                payload = res.read()
                if raw:
                    return payload
                parsed = json.loads(payload.decode("utf-8"))
                return parsed.get("data", parsed)
        except urllib.error.HTTPError as exc:
            err_body = exc.read().decode("utf-8", errors="replace")
            code = "http_error"
            message = f"HTTP {exc.code}"
            details = None
            try:
                parsed = json.loads(err_body)
                err = parsed.get("error") or {}
                code = err.get("code", code)
                message = err.get("message", message)
                details = err.get("details")
            except json.JSONDecodeError:
                message = err_body or message
            raise ScreenshotAPIError(exc.code, code, message, details) from exc

    def take(self, **params: Any) -> bytes:
        return self._request("/api/take", query=params, raw=True)

    def take_json(self, **params: Any) -> dict[str, Any]:
        return self._request("/api/take", method="POST", body=params)

    def bulk(self, **body: Any) -> dict[str, Any]:
        return self._request("/api/take/bulk", method="POST", body=body)

    def create_job(self, **body: Any) -> dict[str, Any]:
        return self._request("/api/v1/screenshots", method="POST", body=body)

    def get_job(self, job_id: str) -> dict[str, Any]:
        return self._request(f"/api/v1/screenshots/{job_id}")

    def wait_for_job(self, job_id: str, *, interval: float = 2.0, timeout: float = 90.0) -> dict[str, Any]:
        deadline = time.monotonic() + timeout
        while time.monotonic() < deadline:
            job = self.get_job(job_id)
            status = job.get("status")
            if status in {"completed", "failed"}:
                return job
            time.sleep(interval)
        raise ScreenshotAPIError(408, "timeout", "Timed out waiting for screenshot job.")
