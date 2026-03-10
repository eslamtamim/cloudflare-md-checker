async function getCurrentTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

function buildCurlCommand(url) {
  return `curl -sI -H 'Accept: text/markdown' '${url}'`;
}

function render(result, url) {
  const labelEl = document.getElementById("status-label");
  const emojiEl = document.getElementById("status-emoji");
  const subEl = document.getElementById("status-sub");
  const detailsEl = document.getElementById("details");
  const curlSection = document.getElementById("curl-section");
  const errorMsg = document.getElementById("error-msg");

  // Reset
  labelEl.className = "status-label";
  errorMsg.style.display = "none";

  if (result.status === "checking") {
    emojiEl.textContent = "⏳";
    labelEl.classList.add("checking");
    labelEl.textContent = "Checking…";
    subEl.textContent = "";
    detailsEl.style.display = "none";
    curlSection.style.display = "none";
    return;
  }

  if (result.status === "error") {
    emojiEl.textContent = "⚠️";
    labelEl.classList.add("error");
    labelEl.textContent = "Check failed";
    subEl.textContent = "Could not reach the page";
    errorMsg.style.display = "block";
    errorMsg.textContent = result.error || "Unknown error";
    detailsEl.style.display = "none";
    curlSection.style.display = "none";
    return;
  }

  if (result.status === "unknown") {
    emojiEl.textContent = "❓";
    labelEl.classList.add("checking");
    labelEl.textContent = "No result yet";
    subEl.textContent = "Navigate to a page to check";
    detailsEl.style.display = "none";
    curlSection.style.display = "none";
    return;
  }

  // status === "done"
  if (result.supported) {
    emojiEl.textContent = "✅";
    labelEl.classList.add("supported");
    labelEl.textContent = "Markdown supported";
    subEl.textContent = "This page serves text/markdown";
  } else {
    emojiEl.textContent = "❌";
    labelEl.classList.add("not-supported");
    labelEl.textContent = "Not supported";
    subEl.textContent = "No text/markdown content-type detected";
  }

  // Details
  detailsEl.style.display = "block";

  const ctEl = document.getElementById("val-ct");
  ctEl.textContent = result.contentType || "—";

  const rowTokens = document.getElementById("row-tokens");
  const valTokens = document.getElementById("val-tokens");
  if (result.markdownTokens) {
    rowTokens.style.display = "flex";
    valTokens.textContent = result.markdownTokens;
  } else {
    rowTokens.style.display = "none";
  }

  const rowSignal = document.getElementById("row-signal");
  const valSignal = document.getElementById("val-signal");
  if (result.contentSignal) {
    rowSignal.style.display = "flex";
    valSignal.textContent = result.contentSignal;
  } else {
    rowSignal.style.display = "none";
  }

  // Curl command
  const targetUrl = result.url || url || "";
  if (targetUrl) {
    curlSection.style.display = "block";
    document.getElementById("curl-code").textContent = buildCurlCommand(targetUrl);
  }
}

async function init() {
  const tab = await getCurrentTab();
  if (!tab) return;

  // Request result from background
  const result = await chrome.runtime.sendMessage({
    type: "GET_TAB_RESULT",
    tabId: tab.id,
  });

  render(result, tab.url);

  // Copy button
  document.getElementById("copy-btn").addEventListener("click", () => {
    const text = document.getElementById("curl-code").textContent;
    navigator.clipboard.writeText(text).then(() => {
      const btn = document.getElementById("copy-btn");
      btn.textContent = "Copied!";
      btn.classList.add("copied");
      setTimeout(() => {
        btn.textContent = "Copy";
        btn.classList.remove("copied");
      }, 1500);
    });
  });

  // Re-check button
  document.getElementById("recheck-btn").addEventListener("click", async () => {
    const currentTab = await getCurrentTab();
    if (!currentTab?.url) return;

    // Clear domain cache
    try {
      const urlObj = new URL(currentTab.url);
      await chrome.storage.session.remove(urlObj.hostname);
    } catch (e) {
      // ignore
    }

    // Trigger re-check by reloading (simplest approach that guarantees onUpdated fires)
    chrome.tabs.reload(currentTab.id);
    window.close();
  });
}

init();
