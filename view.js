let myTabId = null;
let sourceTabId = null;
let sourceUrl = "";
let mode = "text"; // "text" (raw markdown source) | "rendered" (parsed HTML)
let mdResult = null;

function visibleContentEl() {
  return mode === "rendered"
    ? document.getElementById("rendered-content")
    : document.getElementById("content");
}

// Many Markdown-for-Agents responses lead with a YAML frontmatter block
// (---\ntitle: ...\n---). That's not CommonMark, and left in place it
// confuses marked's Setext-heading detection (a paragraph immediately
// followed by a line of dashes becomes an <h2>). Pull it out before
// parsing and show title/description as a small header instead.
function splitFrontmatter(text) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(text);
  if (!match) return { meta: null, body: text };

  const meta = {};
  for (const line of match[1].split(/\r?\n/)) {
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    meta[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
  }

  return { meta, body: text.slice(match[0].length) };
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function frontmatterHtml(meta) {
  // Skip the title: the body almost always repeats it as its own heading,
  // and showing both reads as a duplicated header.
  if (!meta.description) return "";
  return `<p class="fm-description">${escapeHtml(meta.description)}</p>`;
}

function render() {
  const statusEl = document.getElementById("status");
  const contentEl = document.getElementById("content");
  const renderedEl = document.getElementById("rendered-content");
  const modeBtn = document.getElementById("mode-btn");

  modeBtn.style.display = "inline-block";
  modeBtn.textContent = mode === "rendered" ? "View as Text" : "View as MD";

  if (!mdResult) {
    statusEl.style.display = "block";
    statusEl.classList.remove("error");
    statusEl.textContent = "Loading…";
    contentEl.style.display = "none";
    renderedEl.style.display = "none";
    return;
  }

  if (!mdResult.ok) {
    statusEl.style.display = "block";
    statusEl.classList.add("error");
    statusEl.textContent = "Failed to load markdown: " + (mdResult.error || "unknown error");
    contentEl.style.display = "none";
    renderedEl.style.display = "none";
    return;
  }

  statusEl.style.display = "none";
  if (mode === "rendered") {
    contentEl.style.display = "none";
    renderedEl.style.display = "block";
    const { meta, body } = splitFrontmatter(mdResult.text);
    const bodyHtml = DOMPurify.sanitize(marked.parse(body));
    renderedEl.innerHTML = (meta ? frontmatterHtml(meta) : "") + bodyHtml;
  } else {
    renderedEl.style.display = "none";
    contentEl.style.display = "block";
    contentEl.textContent = mdResult.text;
  }
}

function toggleMode() {
  mode = mode === "rendered" ? "text" : "rendered";
  render();
}

function selectContentOnly() {
  document.addEventListener("keydown", (e) => {
    const isSelectAll = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "a";
    if (!isSelectAll) return;
    const target = visibleContentEl();
    if (target.style.display === "none") return;
    e.preventDefault();
    const range = document.createRange();
    range.selectNodeContents(target);
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
    if (!mdResult?.ok) return;
    navigator.clipboard.writeText(mdResult.text).then(() => {
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

  render();
  mdResult = await chrome.runtime.sendMessage({
    type: "GET_MARKDOWN_CONTENT",
    tabId: sourceTabId,
    url: sourceUrl,
  });
  render();
}

init();
