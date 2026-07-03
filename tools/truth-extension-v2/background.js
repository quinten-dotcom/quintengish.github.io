// Fetch proxy. Content scripts on facebook.com cannot fetch docs.google.com
// (page CORS applies), but the service worker can, using the browser's own
// Google session cookies. The user must have view access to the sheets in
// this Chrome profile.

// Toolbar icon = master on/off switch for the panel on the current tab.
chrome.action.onClicked.addListener((tab) => {
  if (tab.id) chrome.tabs.sendMessage(tab.id, { type: "umToggle" }).catch(() => {});
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && msg.type === "fetchCsv") {
    fetch(msg.url, { credentials: "include" })
      .then(async (r) => {
        const text = await r.text();
        // A private sheet without access returns Google's HTML sign-in page.
        if (!r.ok || text.slice(0, 200).toLowerCase().includes("<!doctype html")) {
          sendResponse({ ok: false, error: "no-access", status: r.status });
        } else {
          sendResponse({ ok: true, text });
        }
      })
      .catch((e) => sendResponse({ ok: false, error: String(e) }));
    return true; // async response
  }
});
