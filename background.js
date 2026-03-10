// Cache tab results in memory (service worker lifetime)
const tabCache = new Map();

const ICONS = {
  green: {
    16: "icons/green.png",
    48: "icons/green.png",
    128: "icons/green.png",
  },
  red: {
    16: "icons/red.png",
    48: "icons/red.png",
    128: "icons/red.png",
  },
  grey: {
    16: "icons/grey.png",
    48: "icons/grey.png",
    128: "icons/grey.png",
  },
};

async function setIcon(tabId, color) {
  try {
    await chrome.action.setIcon({ tabId, path: ICONS[color] });
  } catch (e) {
    // Tab may have been closed
  }
}

async function setBadge(tabId, color) {
  const colors = { green: "#22c55e", red: "#ef4444", grey: "#9ca3af" };
  try {
    await chrome.action.setBadgeBackgroundColor({
      tabId,
      color: colors[color],
    });
    await chrome.action.setBadgeText({
      tabId,
      text: color === "green" ? "MD" : color === "red" ? "" : "...",
    });
  } catch (e) {
    // Tab may have been closed
  }
}

async function checkMarkdownSupport(tabId, url) {
  // Mark as checking
  tabCache.set(tabId, { status: "checking", url });
  await setIcon(tabId, "grey");
  await setBadge(tabId, "grey");

  // Check domain cache in session storage
  let domainKey;
  try {
    const urlObj = new URL(url);
    domainKey = urlObj.hostname;
    const cached = await chrome.storage.session.get(domainKey);
    if (cached[domainKey]) {
      const result = cached[domainKey];
      tabCache.set(tabId, { ...result, url });
      const color = result.supported ? "green" : "red";
      await setIcon(tabId, color);
      await setBadge(tabId, color);
      return;
    }
  } catch (e) {
    // Invalid URL or storage error — continue with fresh check
  }

  try {
    const controller = new AbortController();
    const res = await fetch(url, {
      method: "GET",
      headers: { Accept: "text/markdown" },
      signal: controller.signal,
    });
    // Abort immediately — we only need the response headers, not the body
    controller.abort();

    const contentType = res.headers.get("content-type") || "";
    const supported = contentType.includes("text/markdown");
    const markdownTokens = res.headers.get("x-markdown-tokens");
    const contentSignal = res.headers.get("content-signal");

    const result = {
      status: "done",
      url,
      supported,
      contentType,
      markdownTokens,
      contentSignal,
    };

    tabCache.set(tabId, result);

    // Cache by domain
    if (domainKey) {
      await chrome.storage.session.set({ [domainKey]: result });
    }

    const color = supported ? "green" : "red";
    await setIcon(tabId, color);
    await setBadge(tabId, color);
  } catch (e) {
    const result = { status: "error", url, supported: false, error: e.message };
    tabCache.set(tabId, result);
    await setIcon(tabId, "grey");
    await setBadge(tabId, "grey");
  }
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status !== "complete") return;
  const url = tab.url || "";
  if (!url.startsWith("http://") && !url.startsWith("https://")) return;
  checkMarkdownSupport(tabId, url);
});

// Reset icon when tab navigates away
chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  const entry = tabCache.get(tabId);
  if (!entry) {
    await setIcon(tabId, "grey");
    await setBadge(tabId, "grey");
  }
});

// Respond to popup requests for tab data
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "GET_TAB_RESULT") {
    const result = tabCache.get(message.tabId) || { status: "unknown" };
    sendResponse(result);
  }
  return true; // keep channel open for async
});
