// UM Truth v2: true per-ad data inside Meta Ads Manager.
// Data comes straight from the report sheets' Creatives tabs (CRM/EverWebinar
// attributed truth) via the user's own Google session. Ad rows are matched by
// NAME against the text on screen, so no fragile Ads Manager selectors.

(() => {
  if (window.__umTruthLoaded) return;
  window.__umTruthLoaded = true;

  const SHEETS = [
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
    win: "7d",
    cols: { spend: true, kpi: true, cpa: true, vs: false, cpa30: true, verdict: true },
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
    for (const cfg of SHEETS) {
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

  // ---------- verdicts ----------
  function target(ad) {
    const cfg = SHEETS.find((s) => s.offer === ad.offer);
    const t = state.targets[ad.offer];
    return (isFinite(t) && t > 0) ? t : cfg.target;
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

  // ---------- name matching against the page ----------
  function findMatches() {
    if (!state.ads || !state.ads.size) return [];
    const found = new Map(); // name -> element (leftmost visible)
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode: (n) => {
        const t = n.nodeValue && n.nodeValue.trim();
        return t && t.length < 120 && state.ads.has(t) && !n.parentElement.closest("#um-truth-panel")
          ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      }
    });
    let node;
    while ((node = walker.nextNode())) {
      const el = node.parentElement;
      const rect = el.getBoundingClientRect();
      if (rect.height < 8 || rect.width < 8) continue;
      const name = node.nodeValue.trim();
      const prev = found.get(name);
      if (!prev || rect.left < prev.getBoundingClientRect().left) found.set(name, el);
    }
    // One panel row per distinct vertical position, sorted top to bottom.
    return [...found.entries()]
      .map(([name, el]) => ({ name, el, top: el.getBoundingClientRect().top }))
      .filter((m) => m.top > 80 && m.top < window.innerHeight)
      .sort((a, b) => a.top - b.top);
  }

  // ---------- rendering ----------
  const fmt$ = (v) => v === null ? "-" : "$" + (v >= 1000 ? Math.round(v).toLocaleString("en-US") : v.toFixed(2));
  const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");

  let panel, popover;
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
      '<span class="um-logo">UM TRUTH</span>' +
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

  function render() {
    if (!panel) buildPanel();
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
      body = '<div class="um-msg">No known ad names on screen. Open the ADS tab of a campaign (' +
        (state.ads ? state.ads.size : 0) + " ads loaded from the sheets).</div>";
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
    return '<div class="um-pop"><b>Target true CPA per offer</b>' + SHEETS.map((s) =>
      '<label>' + s.offer + ' $<input type="number" step="any" min="0" data-target="' + s.offer + '" value="' + (state.targets[s.offer] || s.target) + '"></label>').join("") +
      '<button class="um-btn" data-act="closepop">Done</button></div>';
  }

  async function onClick(e) {
    const t = e.target.closest("[data-win],[data-act]");
    if (!t) return;
    if (t.dataset.win) { state.win = t.dataset.win; await store.set({ umWin: state.win }); }
    else if (t.dataset.act === "collapse") { state.collapsed = !state.collapsed; }
    else if (t.dataset.act === "cols") { popover = colsPopover(); }
    else if (t.dataset.act === "targets") { popover = targetsPopover(); }
    else if (t.dataset.act === "closepop") { popover = null; }
    else if (t.dataset.act === "refresh") { await loadData(true); state.matches = findMatches(); }
    render();
  }
  async function onChange(e) {
    const t = e.target;
    if (t.dataset.col) { state.cols[t.dataset.col] = t.checked; await store.set({ umCols: state.cols }); popover = colsPopover(); render(); }
    if (t.dataset.target) {
      const n = parseFloat(t.value);
      if (isFinite(n) && n > 0) { state.targets[t.dataset.target] = n; await store.set({ umTargets: state.targets }); popover = targetsPopover(); render(); }
    }
  }

  // ---------- sync loop ----------
  let raf = null;
  function sync() {
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = null;
      if (!state.collapsed) {
        state.matches = findMatches();
        render();
      }
    });
  }

  (async function init() {
    const saved = await store.get(["umWin", "umCols", "umTargets"]);
    if (saved.umWin && WINDOWS.includes(saved.umWin)) state.win = saved.umWin;
    if (saved.umCols) state.cols = Object.assign(state.cols, saved.umCols);
    if (saved.umTargets) state.targets = saved.umTargets;
    buildPanel();
    render();
    await loadData(false);
    sync();
    window.addEventListener("scroll", sync, true);
    window.addEventListener("resize", sync);
    new MutationObserver(() => sync()).observe(document.body, { childList: true, subtree: true });
    setInterval(sync, 2000);
  })();
})();
