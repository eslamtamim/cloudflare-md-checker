function getQueryParams() {
  const params = new URLSearchParams(window.location.search);
  return {
    tabId: Number(params.get("tabId")),
    url: params.get("url") || "",
  };
}

async function init() {
  const { tabId, url } = getQueryParams();
  document.getElementById("header-url").textContent = url;

  const statusEl = document.getElementById("status");
  const contentEl = document.getElementById("content");
  const copyBtn = document.getElementById("copy-btn");

  const response = await chrome.runtime.sendMessage({
    type: "GET_MARKDOWN_CONTENT",
    tabId,
    url,
  });

  if (response?.ok) {
    statusEl.style.display = "none";
    contentEl.style.display = "block";
    contentEl.textContent = response.text;
    copyBtn.style.display = "inline-block";
    copyBtn.addEventListener("click", () => {
      navigator.clipboard.writeText(response.text).then(() => {
        copyBtn.textContent = "Copied";
        copyBtn.classList.add("copied");
        setTimeout(() => {
          copyBtn.textContent = "Copy";
          copyBtn.classList.remove("copied");
        }, 1500);
      });
    });
  } else {
    statusEl.classList.add("error");
    statusEl.textContent = "Failed to load markdown: " + (response?.error || "unknown error");
  }
}

init();
