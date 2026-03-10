async function getCurrentTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

function buildCurlCommand(url) {
  return `curl -s -o /dev/null -D - \\\n  -H 'Accept: text/markdown' \\\n  '${url}'`;
}

function setDot(state) {
  const dot = document.getElementById("header-dot");
  dot.className = "header-dot";
  if (state === "active") dot.classList.add("active");
  if (state === "pulse") dot.classList.add("pulse");
}

function render(result, url) {
  const block = document.getElementById("status-block");
  const labelEl = document.getElementById("status-label");
  const textEl = document.getElementById("status-text");
  const subEl = document.getElementById("status-sub");
  const detailsEl = document.getElementById("details");
  const curlSection = document.getElementById("curl-section");
  const errorBlock = document.getElementById("error-block");

  // Reset
  block.className = "status-block";
  labelEl.className = "status-label";
  errorBlock.style.display = "none";
  detailsEl.style.display = "none";
  curlSection.style.display = "none";

  if (result.status === "checking") {
    setDot("pulse");
    textEl.textContent = "Checking";
    subEl.textContent = "";
    return;
  }

  if (result.status === "unknown") {
    setDot("");
    textEl.textContent = "No result";
    subEl.textContent = "navigate to a page to check";
    return;
  }

  if (result.status === "error") {
    setDot("");
    block.classList.add("error");
    textEl.textContent = "Check failed";
    subEl.textContent = "could not reach the page";
    errorBlock.style.display = "block";
    errorBlock.textContent = result.error || "unknown error";
    return;
  }

  // status === "done"
  if (result.supported) {
    setDot("active");
    block.classList.add("supported");
    labelEl.classList.add("supported");
    textEl.textContent = "Supported";
    subEl.textContent = "text/markdown served on this page";
  } else {
    setDot("");
    block.classList.add("not-supported");
    labelEl.classList.add("not-supported");
    textEl.textContent = "Not supported";
    subEl.textContent = "no text/markdown content-type detected";
  }

  // Details
  detailsEl.style.display = "block";
  document.getElementById("val-ct").textContent = result.contentType || "—";

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

  const result = await chrome.runtime.sendMessage({
    type: "GET_TAB_RESULT",
    tabId: tab.id,
  });

  render(result, tab.url);

  document.getElementById("copy-btn").addEventListener("click", () => {
    const text = document.getElementById("curl-code").textContent;
    navigator.clipboard.writeText(text).then(() => {
      const btn = document.getElementById("copy-btn");
      btn.textContent = "Copied";
      btn.classList.add("copied");
      setTimeout(() => {
        btn.textContent = "Copy";
        btn.classList.remove("copied");
      }, 1500);
    });
  });

  document.getElementById("recheck-btn").addEventListener("click", async () => {
    const currentTab = await getCurrentTab();
    if (!currentTab?.url) return;
    try {
      const urlObj = new URL(currentTab.url);
      await chrome.storage.session.remove(urlObj.hostname);
    } catch (e) {
      // ignore
    }
    chrome.tabs.reload(currentTab.id);
    window.close();
  });
}

init();
