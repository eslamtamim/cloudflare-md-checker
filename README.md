# Markdown for Agents Detector

A Chrome extension that detects whether a page supports [Cloudflare's Markdown for Agents](https://developers.cloudflare.com/markdown-for-agents/) — i.e. whether the server returns `Content-Type: text/markdown` when requested with `Accept: text/markdown`.

When supported, the extension badge shows **MD** in orange. Click the icon to see response headers like `x-markdown-tokens` and `content-signal`, and get a ready-to-copy `curl` command to test it yourself.

## Installation

1. Clone or download this repo
2. Open Chrome and go to `chrome://extensions`
3. Enable **Developer mode** (top-right toggle)
4. Click **Load unpacked** and select the repo folder
5. The extension icon will appear in your toolbar

## How it works

On every page load the extension sends a `GET` request with `Accept: text/markdown` and checks if the response `Content-Type` is `text/markdown`. Results are cached per domain for the session so subsequent visits are instant.

You can also manually re-check any page using the **Re-check this page** button in the popup.

## Verify manually with curl

```sh
curl -s -o /dev/null -D - -H 'Accept: text/markdown' 'https://example.com'
```

Look for `content-type: text/markdown` in the response headers.
