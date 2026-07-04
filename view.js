let myTabId = null;
let sourceTabId = null;
let sourceUrl = "";
let mode = "md"; // "md" | "text"
let mdResult = null;
let textResult = null;

function currentResult() {
  return mode === "md" ? mdResult : textResult;
}

function render() {
  const statusEl = document.getElementById("status");
  const contentEl = document.getElementById("content");
  const modeBtn = document.getElementById("mode-btn");

  modeBtn.style.display = "inline-block";
  modeBtn.textContent = mode === "md" ? "View as Text" : "View as MD";

  const result = currentResult();
  if (!result) {
    statusEl.style.display = "block";
    statusEl.classList.remove("error");
    statusEl.textContent = "Loading…";
    contentEl.style.display = "none";
    return;
  }

  if (result.ok) {
    statusEl.style.display = "none";
    contentEl.style.display = "block";
    contentEl.textContent = result.text;
  } else {
    statusEl.style.display = "block";
    statusEl.classList.add("error");
    statusEl.textContent =
      "Failed to load " + (mode === "md" ? "markdown" : "text") + ": " + (result.error || "unknown error");
    contentEl.style.display = "none";
  }
}

async function ensureLoaded() {
  if (mode === "md" && !mdResult) {
    mdResult = await chrome.runtime.sendMessage({
      type: "GET_MARKDOWN_CONTENT",
      tabId: sourceTabId,
      url: sourceUrl,
    });
  }
  if (mode === "text" && !textResult) {
    textResult = await chrome.runtime.sendMessage({
      type: "GET_RAW_TEXT_CONTENT",
      tabId: sourceTabId,
      url: sourceUrl,
    });
  }
  render();
}

async function toggleMode() {
  mode = mode === "md" ? "text" : "md";
  render();
  await ensureLoaded();
}

function selectContentOnly() {
  document.addEventListener("keydown", (e) => {
    const isSelectAll = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "a";
    if (!isSelectAll) return;
    const contentEl = document.getElementById("content");
    if (contentEl.style.display === "none") return;
    e.preventDefault();
    const range = document.createRange();
    range.selectNodeContents(contentEl);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
  });
}

async function init() {
  const params = new URLSearchParams(window.location.search);
  sourceTabId = Number(params.get("tabId"));
  sourceUrl = params.get("url") || "";
  document.getElementById("header-url").textContent = sourceUrl;

  const myTab = await chrome.tabs.getCurrent();
  myTabId = myTab?.id ?? null;

  const copyBtn = document.getElementById("copy-btn");
  copyBtn.style.display = "inline-block";
  copyBtn.addEventListener("click", () => {
    const result = currentResult();
    if (!result?.ok) return;
    navigator.clipboard.writeText(result.text).then(() => {
      copyBtn.textContent = "Copied";
      copyBtn.classList.add("copied");
      setTimeout(() => {
        copyBtn.textContent = "Copy";
        copyBtn.classList.remove("copied");
      }, 1500);
    });
  });

  document.getElementById("mode-btn").addEventListener("click", toggleMode);

  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === "TOGGLE_VIEW_MODE" && message.viewerTabId === myTabId) {
      toggleMode();
    }
  });

  selectContentOnly();
  await ensureLoaded();
}

init();
