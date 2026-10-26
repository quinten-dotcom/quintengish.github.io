// UM Truth v2: true per-ad data inside Meta Ads Manager.
// Data comes straight from the report sheets' Creatives tabs (CRM/EverWebinar
// attributed truth) via the user's own Google session. Ad rows are matched by
// NAME against the text on screen, so no fragile Ads Manager selectors.

(() => {
  if (window.__umTruthLoaded) return;
  window.__umTruthLoaded = true;

  // Ads Manager sometimes renders the grid in a nested frame. The script runs
  // in every frame; the frame that actually sees ad names shows the panel and
  // tells the top frame to hide its copy.
  const IS_TOP = window === window.top;
  let childNotified = false;
  const VERSION = "2.2.0";

  // Default client list. Add or remove clients from the gear menu in the
  // panel (saved in chrome.storage), no code edits needed.
  const DEFAULT_SHEETS = [
    { offer: "CJ Grader", id: "1wf_Ow5IFhSxOa1_EqXpeJuzT-RItA352xs9iE9gWh_s", tab: "Creatives - Grader", kpi: "Leads", target: 100 },
    { offer: "CJ Challenge", id: "1wf_Ow5IFhSxOa1_EqXpeJuzT-RItA352xs9iE9gWh_s", tab: "Creatives - Challenge", kpi: "Purchases", target: 200 },
    { offer: "TSA Webinar", id: "1PFwD4BjSxp2MjJBjJKdFkXJWzVjU_B273IUbED7Qss8", tab: "Creatives - Webinar", kpi: "Stay-to-end", target: 80 },
    { offer: "Elysium Jet", id: "1M5WUUwzqBtCue97W4CgK7Vs2sQmQOKf59LXFJ2Wk3nY", tab: "Creatives - Jet Academy", kpi: "Calls booked", target: 40 }
  ];
  const WINDOWS = ["3d", "7d", "14d", "30d", "mtd"];
  const WIN_ROWS = { "3 Days": "3d", "7 Days": "7d", "14 Days": "14d", "30 Days": "30d", "MTD": "mtd" };
  const ALL_COLS = [
    { key: "spend", label: "Spend" },
    { key: "kpi", label: "Result" },
    { key: "cpa", label: "True CPA" },
    { key: "vs", label: "vs Target" },
    { key: "cpa30", label: "30D CPA" },
    { key: "verdict", label: "Verdict" }
  ];
  const CACHE_TTL_MS = 30 * 60 * 1000;

  const state = {
    on: true,
    win: "7d",
    cols: { spend: true, kpi: true, cpa: true, vs: false, cpa30: true, verdict: true },
    sheets: DEFAULT_SHEETS.slice(),
    targets: {},
    collapsed: false,
    ads: null,          // Map name -> {offer, spend:{}, kpi:{}, cpa:{}}
    fetchedAt: null,
    error: null,
    matches: []
  };

  const store = {
    get: (keys) => new Promise((res) => chrome.storage.local.get(keys, res)),
    set: (obj) => new Promise((res) => chrome.storage.local.set(obj, res))
  };

  // ---------- CSV ----------
  function parseCsv(text) {
    const rows = [];
    let row = [], cell = "", inQ = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (inQ) {
        if (ch === '"') {
          if (text[i + 1] === '"') { cell += '"'; i++; } else inQ = false;
        } else cell += ch;
      } else if (ch === '"') inQ = true;
      else if (ch === ",") { row.push(cell); cell = ""; }
      else if (ch === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; }
      else if (ch !== "\r") cell += ch;
    }
    if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
    return rows;
  }

  const num = (v) => {
    if (v === null || v === undefined) return null;
    const n = parseFloat(String(v).replace(/[$,%\s]/g, "").replace(/,/g, ""));
    return isFinite(n) ? n : null;
  };

  // Creatives tab layout: row0 = ad names every 3rd column starting at col 1;
  // then a header row (col0 "Date"), then summary rows keyed "3 Days" etc.
  function parseCreatives(rows, cfg) {
    const names = [];
    for (let c = 1; c < rows[0].length; c += 3) {
      names.push((rows[0][c] || "").trim());
    }
    const winRows = {};
    for (const r of rows) {
      const w = WIN_ROWS[(r[0] || "").trim()];
      if (w) winRows[w] = r;
    }
    const ads = [];
    names.forEach((name, i) => {
      if (!name) return;
      const col = 1 + i * 3;
      const ad = { name, offer: cfg.offer, spend: {}, kpi: {}, cpa: {} };
      for (const w of WINDOWS) {
        const r = winRows[w] || [];
        ad.spend[w] = num(r[col]);
        ad.kpi[w] = num(r[col + 1]);
        ad.cpa[w] = num(r[col + 2]);
      }
      ads.push(ad);
    });
    return ads;
  }

  function csvUrl(cfg) {
    return "https://docs.google.com/spreadsheets/d/" + cfg.id +
      "/gviz/tq?tqx=out:csv&sheet=" + encodeURIComponent(cfg.tab);
  }

  function bgFetch(url) {
    return new Promise((res) => chrome.runtime.sendMessage({ type: "fetchCsv", url }, res));
  }

  async function loadData(force) {
    if (!force) {
      const c = await store.get(["umCache"]);
      if (c.umCache && Date.now() - c.umCache.fetchedAt < CACHE_TTL_MS) {
        state.ads = new Map(c.umCache.ads);
        state.fetchedAt = c.umCache.fetchedAt;
        state.error = c.umCache.error || null;
        return;
      }
    }
    const map = new Map();
    const errors = [];
    for (const cfg of state.sheets) {
      const r = await bgFetch(csvUrl(cfg));
      if (!r || !r.ok) { errors.push(cfg.offer + ": " + (r ? r.error : "no response")); continue; }
      try {
        for (const ad of parseCreatives(parseCsv(r.text), cfg)) map.set(ad.name, ad);
      } catch (e) { errors.push(cfg.offer + ": parse " + e.message); }
    }
    state.ads = map;
    state.fetchedAt = Date.now();
    state.error = errors.length ? errors.join(" | ") : null;
    await store.set({ umCache: { ads: [...map.entries()], fetchedAt: state.fetchedAt, error: state.error } });
  }

  // Forgiving name matching: strip zero-width chars, collapse whitespace,
  // ignore case. Meta's DOM decorates names in ways exact equality misses.
  const norm = (s) => String(s).replace(/[\u200b-\u200f\u2060\ufeff]/g, "").replace(/\s+/g, " ").trim().toLowerCase();
  function normIndex() {
    if (!state._normFor || state._normFor !== state.ads) {
      state._norm = new Map();
      for (const k of state.ads.keys()) state._norm.set(norm(k), k);
      state._normFor = state.ads;
    }
    return state._norm;
  }

  // ---------- verdicts ----------
  function target(ad) {
    const cfg = state.sheets.find((s) => s.offer === ad.offer);
    const t = state.targets[ad.offer];
    return (isFinite(t) && t > 0) ? t : (cfg ? cfg.target : 100);
  }
  function verdict(ad, w) {
    const t = target(ad), spend = ad.spend[w] || 0, cpa = ad.cpa[w];
    if (cpa === null || !(ad.kpi[w] > 0)) {
      if (spend >= 1.5 * t) return { cls: "kill", word: "KILL" };
      return { cls: "test", word: spend > 0 ? "TESTING" : "IDLE" };
    }
    const s = cpa / t;
    if (s <= 1) return { cls: "scale", word: "SCALE" };
    if (s <= 1.5) return { cls: "hold", word: "HOLD" };
    if (s <= 2) return { cls: "cut", word: "CUT" };
    return { cls: "kill", word: "KILL" };
  }

  function kpiLabel(ad) {
    const cfg = state.sheets.find((x) => x.offer === ad.offer);
    return cfg ? cfg.kpi : "results";
  }

  // ---------- inline strips inside Meta's own grid (the Hyros look) ----------
  const chips = new Set();
  function clearChips() {
    chips.forEach((c) => c.remove());
    chips.clear();
  }
  function injectChips() {
    const w = state.win;
    for (const m of state.matches) {
      const ad = state.ads.get(m.name);
      if (!ad || !m.el.isConnected) continue;
      let chip = m.el._umChip;
      if (!chip || !chip.isConnected) {
        chip = document.createElement("div");
        chip.className = "um-inline";
        m.el._umChip = chip;
        (m.el.parentElement || m.el).insertBefore(chip, m.el.nextSibling);
        chips.add(chip);
      }
      const v = verdict(ad, w);
      const html =
        '<span class="um-i-tag">TRUE ' + w.toUpperCase() + "</span>" +
        '<span class="um-i-val">' + fmt$(ad.spend[w]) + "</span>" +
        '<span class="um-i-val">' + (ad.kpi[w] === null ? "-" : ad.kpi[w]) + " " + esc(kpiLabel(ad)) + "</span>" +
        '<span class="um-i-val um-i-cpa">' + fmt$(ad.cpa[w]) + " CPA</span>" +
        '<span class="um-pill um-' + v.cls + '">' + v.word + "</span>";
      if (chip._umHtml !== html) { chip.innerHTML = html; chip._umHtml = html; }
    }
  }

  // ---------- self-diagnosis when nothing matches ----------
  let lastDiag = { t: 0, msg: "" };
  function diagnoseMsg() {
    if (!state.ads) return "Loading sheet data...";
    if (Date.now() - lastDiag.t < 5000) return lastDiag.msg;
    let hit = null;
    try {
      const text = norm((document.body.innerText || "").slice(0, 500000));
      for (const n of state.ads.keys()) {
        if (text.includes(norm(n))) { hit = n; break; }
      }
    } catch (e) { /* ignore */ }
    const shadows = allRoots().length - 1;
    const msg = "Diagnostic v" + VERSION + ": " + (IS_TOP ? "top frame" : "inner frame") + ", " +
      shadows + " shadow roots scanned, " + state.ads.size + " ads loaded. " +
      (hit
        ? 'The name "' + esc(hit) + '" IS in this frame\'s text but did not match an element. Screenshot this message.'
        : "None of the sheet ad names appear in this frame's text. If ads are on screen, they render somewhere this build cannot read. Screenshot this message.");
    lastDiag = { t: Date.now(), msg };
    return msg;
  }

  // ---------- name matching against the page ----------
  let rootsCache = { t: 0, roots: null };
  function allRoots() {
    if (!rootsCache.roots || Date.now() - rootsCache.t > 5000) {
      const roots = [document.body];
      // Meta may render pieces inside shadow DOM; walk into open roots.
      for (let i = 0; i < roots.length; i++) {
        for (const e of roots[i].querySelectorAll("*")) {
          if (e.shadowRoot) roots.push(e.shadowRoot);
        }
      }
      rootsCache = { t: Date.now(), roots };
    }
    return rootsCache.roots;
  }

  function findMatches() {
    if (!state.ads || !state.ads.size) return [];
    const idx = normIndex();
    const found = new Map(); // name -> element (leftmost visible)
    const consider = (name, el) => {
      const rect = el.getBoundingClientRect();
      if (rect.height < 8 || rect.width < 8) return;
      const prev = found.get(name);
      if (!prev || rect.left < prev.getBoundingClientRect().left) found.set(name, el);
    };
    const roots = allRoots();
    const visited = new WeakSet();
    for (const root of roots) {
      // Pass 1: single text nodes, climbing to close ancestors for split names.
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
        acceptNode: (n) => {
          const v = n.nodeValue;
          return v && v.length < 160 && n.parentElement && !n.parentElement.closest("#um-truth-panel") && !n.parentElement.closest(".um-inline")
            ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
        }
      });
      let node;
      while ((node = walker.nextNode())) {
        const name = idx.get(norm(node.nodeValue));
        if (name) { consider(name, node.parentElement); continue; }
        let el = node.parentElement;
        for (let d = 0; d < 3 && el && el !== root; d++, el = el.parentElement) {
          if (visited.has(el)) break;
          visited.add(el);
          const t = el.textContent;
          if (!t || t.length > 160) break;
          const nm = idx.get(norm(t));
          if (nm) { consider(nm, el); break; }
        }
      }
    }
    // Pass 2 (only if pass 1 found nothing anywhere).
    if (!found.size) {
      for (const root of roots) {
        for (const el of root.querySelectorAll("span,div,a,td")) {
          if (el.closest("#um-truth-panel") || el.closest(".um-inline")) continue;
          const t = el.textContent;
          if (!t || t.length > 160) continue;
          const name = idx.get(norm(t));
          if (name) consider(name, el);
        }
      }
    }
    // One panel row per distinct vertical position, sorted top to bottom.
    return [...found.entries()]
      .map(([name, el]) => ({ name, el, top: el.getBoundingClientRect().top }))
      .filter((m) => m.top > 40 && m.top < window.innerHeight)
      .sort((a, b) => a.top - b.top);
  }

  // ---------- rendering ----------
  const fmt$ = (v) => v === null ? "-" : "$" + (v >= 1000 ? Math.round(v).toLocaleString("en-US") : v.toFixed(2));
  const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");

  let panel, popover, lastSig = null;
  function buildPanel() {
    panel = document.createElement("div");
    panel.id = "um-truth-panel";
    document.documentElement.appendChild(panel);
    panel.addEventListener("click", onClick);
    panel.addEventListener("change", onChange);
  }

  function head() {
    const age = state.fetchedAt ? Math.round((Date.now() - state.fetchedAt) / 60000) : null;
    const stale = age !== null && age > 12 * 60;
    return '<div class="um-head">' +
      '<span class="um-logo">UM TRUTH <em>v' + VERSION + '</em></span>' +
      WINDOWS.map((w) => '<button class="um-chip' + (w === state.win ? " on" : "") + '" data-win="' + w + '">' + w.toUpperCase() + "</button>").join("") +
      '<button class="um-btn" data-act="cols" title="Edit columns">&#9707;</button>' +
      '<button class="um-btn" data-act="targets" title="Targets">&#9881;</button>' +
      '<button class="um-btn" data-act="refresh" title="Refresh from sheets">&#8635;</button>' +
      '<button class="um-btn" data-act="collapse">' + (state.collapsed ? "&#9664;" : "&#9654;") + "</button>" +
      '<span class="um-fresh' + (stale ? " stale" : "") + '">' + (age === null ? "" : (stale ? "STALE " : "") + "synced " + age + "m ago") + "</span>" +
      "</div>";
  }

  function rowHtml(ad, w) {
    const v = verdict(ad, w);
    const t = target(ad);
    const cells = [];
    if (state.cols.spend) cells.push("<td>" + fmt$(ad.spend[w]) + "</td>");
    if (state.cols.kpi) cells.push("<td>" + (ad.kpi[w] === null ? "-" : ad.kpi[w]) + "</td>");
    if (state.cols.cpa) cells.push('<td class="um-strong">' + fmt$(ad.cpa[w]) + "</td>");
    if (state.cols.vs) cells.push("<td>" + (ad.cpa[w] === null ? "-" : Math.round((ad.cpa[w] / t) * 100) + "%") + "</td>");
    if (state.cols.cpa30) cells.push("<td>" + fmt$(ad.cpa["30d"]) + "</td>");
    if (state.cols.verdict) cells.push('<td><span class="um-pill um-' + v.cls + '">' + v.word + "</span></td>");
    return cells.join("");
  }

  function render(force) {
    if (!panel) buildPanel();
    const sig = JSON.stringify([state.win, state.collapsed, popover, state.error, state.fetchedAt,
      Math.floor(Date.now() / 60000), state.matches.map((m) => m.name + ":" + Math.round(m.top / 4))]);
    if (!force && sig === lastSig) return;
    lastSig = sig;
    if (state.collapsed) {
      panel.innerHTML = '<div class="um-head"><span class="um-logo">UM</span><button class="um-btn" data-act="collapse">&#9664;</button></div>';
      panel.classList.add("collapsed");
      return;
    }
    panel.classList.remove("collapsed");
    const w = state.win;
    const ms = state.matches;
    let body;
    if (state.error && (!state.ads || !state.ads.size)) {
      body = '<div class="um-msg">Cannot read the sheets: ' + esc(state.error) +
        ". Open each report sheet once in this Chrome profile, then hit refresh.</div>";
    } else if (!ms.length) {
      body = '<div class="um-msg">No known ad names matched on screen. Ad names only exist at the ADS level of a campaign.<br><br>' + diagnoseMsg() + "</div>";
    } else {
      const headCells = ALL_COLS.filter((c) => state.cols[c.key]).map((c) => "<th>" + c.label + "</th>").join("");
      const tot = { spend: 0, kpi: 0 };
      const rows = ms.map((m) => {
        const ad = state.ads.get(m.name);
        tot.spend += ad.spend[w] || 0;
        tot.kpi += ad.kpi[w] || 0;
        return '<tr data-top="' + Math.round(m.top) + '"><td class="um-name" title="' + esc(ad.offer) + '">' + esc(m.name) + "</td>" + rowHtml(ad, w) + "</tr>";
      }).join("");
      const blended = tot.kpi > 0 ? tot.spend / tot.kpi : null;
      body = '<table class="um-tbl"><thead><tr><th class="um-name">Ad (' + ms.length + " matched)</th>" + headCells + "</tr></thead><tbody>" + rows + "</tbody></table>" +
        '<div class="um-total">' + w.toUpperCase() + " totals on screen: " + fmt$(tot.spend) + " spend, " + tot.kpi + " results, blended true CPA " + fmt$(blended) + "</div>";
    }
    panel.innerHTML = head() + body + (popover || "");
    // Rows carry viewport y-positions; shift them into the tbody's own frame
    // so each truth row sits exactly beside its Ads Manager row.
    const tb = panel.querySelector("tbody");
    if (tb) {
      const off = tb.getBoundingClientRect().top;
      tb.querySelectorAll("tr[data-top]").forEach((tr) => {
        tr.style.top = Math.max(0, parseInt(tr.dataset.top, 10) - off) + "px";
      });
    }
  }

  function colsPopover() {
    return '<div class="um-pop"><b>Edit columns</b>' + ALL_COLS.map((c) =>
      '<label><input type="checkbox" data-col="' + c.key + '"' + (state.cols[c.key] ? " checked" : "") + "> " + c.label + "</label>").join("") +
      '<button class="um-btn" data-act="closepop">Done</button></div>';
  }
  function targetsPopover() {
    return '<div class="um-pop"><b>Clients and targets</b>' + state.sheets.map((s) =>
      '<label title="' + esc(s.tab) + '">' + esc(s.offer) +
      ' <button class="um-btn um-x" data-removeclient="' + esc(s.offer) + '" title="Remove">&times;</button>' +
      ' $<input type="number" step="any" min="0" data-target="' + esc(s.offer) + '" value="' + (state.targets[s.offer] || s.target) + '"></label>').join("") +
      '<b>Add a client</b>' +
      '<input type="text" id="um-add-name" placeholder="Client / offer name">' +
      '<input type="text" id="um-add-url" placeholder="Sheet URL or ID">' +
      '<input type="text" id="um-add-tab" placeholder="Creatives tab name">' +
      '<label>Target true CPA $<input type="number" id="um-add-target" step="any" min="0" value="100"></label>' +
      '<button class="um-btn" data-act="addclient">Add client</button>' +
      '<button class="um-btn" data-act="closepop">Done</button></div>';
  }
  async function saveSheets() {
    await store.set({ umSheets: state.sheets });
    await loadData(true);
    state.matches = findMatches();
  }

  async function onClick(e) {
    const t = e.target.closest("[data-win],[data-act],[data-removeclient]");
    if (!t) return;
    if (t.dataset.win) { state.win = t.dataset.win; await store.set({ umWin: state.win }); }
    else if (t.dataset.removeclient) {
      state.sheets = state.sheets.filter((s) => s.offer !== t.dataset.removeclient);
      await saveSheets();
      popover = targetsPopover();
    }
    else if (t.dataset.act === "collapse") { state.collapsed = !state.collapsed; }
    else if (t.dataset.act === "cols") { popover = colsPopover(); }
    else if (t.dataset.act === "targets") { popover = targetsPopover(); }
    else if (t.dataset.act === "closepop") { popover = null; }
    else if (t.dataset.act === "refresh") { await loadData(true); state.matches = findMatches(); }
    else if (t.dataset.act === "addclient") {
      const val = (id) => (panel.querySelector("#" + id) || {}).value || "";
      const name = val("um-add-name").trim();
      const idMatch = val("um-add-url").match(/[-\w]{25,}/);
      const tab = val("um-add-tab").trim();
      const tgt = parseFloat(val("um-add-target"));
      if (name && idMatch && tab) {
        state.sheets.push({ offer: name, id: idMatch[0], tab, kpi: "Result", target: isFinite(tgt) && tgt > 0 ? tgt : 100 });
        await saveSheets();
        popover = targetsPopover();
      }
    }
    render(true);
  }
  async function onChange(e) {
    const t = e.target;
    if (t.dataset.col) { state.cols[t.dataset.col] = t.checked; await store.set({ umCols: state.cols }); popover = colsPopover(); render(true); }
    if (t.dataset.target) {
      const n = parseFloat(t.value);
      if (isFinite(n) && n > 0) { state.targets[t.dataset.target] = n; await store.set({ umTargets: state.targets }); popover = targetsPopover(); render(true); }
    }
  }

  // ---------- sync loop ----------
  let raf = null;
  function sync() {
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = null;
      if (!state.on || state.collapsed) return;
      state.matches = findMatches();
      if (!IS_TOP) {
        // Frames without ad names stay invisible; the frame that finds them
        // shows the panel and tells the top frame to hide its copy.
        if (!state.matches.length && !panel) return;
        if (state.matches.length && !childNotified) {
          childNotified = true;
          try { window.top.postMessage({ umChildActive: true }, "*"); } catch (e) {}
        }
      }
      injectChips();
      render();
    });
  }

  function applyOn() {
    if (panel) panel.style.display = (state.on && !(IS_TOP && state.childActive)) ? "" : "none";
    if (!state.on) clearChips();
  }

  (async function init() {
    const saved = await store.get(["umWin", "umCols", "umTargets", "umSheets", "umOn"]);
    if (saved.umWin && WINDOWS.includes(saved.umWin)) state.win = saved.umWin;
    if (saved.umCols) state.cols = Object.assign(state.cols, saved.umCols);
    if (saved.umTargets) state.targets = saved.umTargets;
    if (Array.isArray(saved.umSheets) && saved.umSheets.length) state.sheets = saved.umSheets;
    if (saved.umOn === false) state.on = false;
    if (IS_TOP) {
      buildPanel();
      render();
      applyOn();
      window.addEventListener("message", (e) => {
        if (e.data && e.data.umChildActive) { state.childActive = true; applyOn(); }
      });
    }
    // Toolbar icon toggles the whole panel on and off.
    try {
      chrome.runtime.onMessage.addListener((msg) => {
        if (msg && msg.type === "umToggle") {
          state.on = !state.on;
          store.set({ umOn: state.on });
          applyOn();
          if (state.on) sync();
        }
      });
    } catch (e) { /* harness shim without onMessage */ }
    await loadData(false);
    sync();
    window.addEventListener("scroll", sync, true);
    window.addEventListener("resize", sync);
    new MutationObserver((muts) => {
      for (const m of muts) {
        const t = m.target;
        const el = t.nodeType === 1 ? t : t.parentElement;
        if (!el) continue;
        if (el.closest && (el.closest("#um-truth-panel") || el.closest(".um-inline"))) continue;
        sync();
        return;
      }
    }).observe(document.body, { childList: true, subtree: true });
    // Auto-refresh: re-pull the sheets when the cache ages out, no clicks needed.
    setInterval(sync, 2000);
    setInterval(() => { if (state.on) loadData(false).then(sync); }, 5 * 60 * 1000);
  })();
})();
