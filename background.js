// Cache tab results in memory (service worker lifetime)
const tabCache = new Map();

const ICONS = {
  active:   { 16: "icons/active.png",   48: "icons/active.png",   128: "icons/active.png" },
  inactive: { 16: "icons/inactive.png", 48: "icons/inactive.png", 128: "icons/inactive.png" },
};

async function setIcon(tabId, state) {
  try {
    await chrome.action.setIcon({ tabId, path: ICONS[state] });
  } catch (e) {
    // Tab may have been closed
  }
}

async function setBadge(tabId, state) {
  try {
    await chrome.action.setBadgeBackgroundColor({
      tabId,
      color: state === "active" ? "#F6821F" : "#9ca3af",
    });
    await chrome.action.setBadgeText({
      tabId,
      text: state === "active" ? "MD" : "",
    });
  } catch (e) {
    // Tab may have been closed
  }
}

async function checkMarkdownSupport(tabId, url) {
  // Mark as checking
  tabCache.set(tabId, { status: "checking", url });
  await setIcon(tabId, "inactive");
  await setBadge(tabId, "inactive");

  // Check domain cache in session storage
  let domainKey;
  try {
    const urlObj = new URL(url);
    domainKey = urlObj.hostname;
    const cached = await chrome.storage.session.get(domainKey);
    if (cached[domainKey]) {
      const result = cached[domainKey];
      tabCache.set(tabId, { ...result, url });
      const state = result.supported ? "active" : "inactive";
      await setIcon(tabId, state);
      await setBadge(tabId, state);
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

    const state = supported ? "active" : "inactive";
    await setIcon(tabId, state);
    await setBadge(tabId, state);
  } catch (e) {
    const result = { status: "error", url, supported: false, error: e.message };
    tabCache.set(tabId, result);
    await setIcon(tabId, "inactive");
    await setBadge(tabId, "inactive");
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
    await setIcon(tabId, "inactive");
    await setBadge(tabId, "inactive");
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
