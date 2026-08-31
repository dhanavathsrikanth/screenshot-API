# screenshotapi (Python)

```bash
pip install screenshotapi
```

```python
from screenshotapi import ScreenshotAPI, sign_take_url
import time

client = ScreenshotAPI(api_key="sk_live_...")
png = client.take(url="https://example.com", format="png")
meta = client.take_json(url="https://example.com", full_page=True)

og = sign_take_url(
    base_url="https://api.screenshotapi.tech",
    access_key="ak_live_...",
    signing_secret="ss_...",
    params={"url": "https://example.com", "format": "png"},
    expires=int(time.time()) + 3600,
)
```

Until the package is on PyPI, install from this repo: `pip install ./sdks/python`.
