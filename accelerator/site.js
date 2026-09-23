/* ACSA tracking - Meta pixel in the browser, mirrored to our server (Conversions API).
   Served at /accelerator/site.js and loaded in <head> by /accelerator/ and /accelerator/apply/.

   ==== THE TWO VALUES TO FILL ====
   PIXEL    = the Meta pixel / dataset id.
   ENDPOINT = the deployed Supabase function. While it still says PROJECT_REF, the server mirror is switched off
              and only the browser pixel fires.                                                                  */
const ACSA = {
  PIXEL: '1093480769196794',
  ENDPOINT: 'https://twitjibcvhxarsgzksrb.supabase.co/functions/v1/acsa-capi',
};

(() => {
  const STANDARD = ['PageView', 'ViewContent', 'Lead'];
  const FT_KEY = 'acsa-first-touch';
  const FT_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'fbclid',
    'ad_id', 'adset_id', 'campaign_id', 'placement', 'site'];
  const DAY = 86400;

  /* ---- small safe helpers (nothing here is allowed to throw) ---- */
  const lsGet = (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };
  const uuid = () => {
    try { if (crypto.randomUUID) return crypto.randomUUID(); } catch (e) {}
    try {
      const b = crypto.getRandomValues(new Uint8Array(16));
      b[6] = (b[6] & 15) | 64; b[8] = (b[8] & 63) | 128;
      const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
      return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
    } catch (e) {
      return 'v' + Date.now().toString(36) + Math.random().toString(36).slice(2);
    }
  };
  const getCookie = (name) => {
    try {
      const m = document.cookie.match(new RegExp('(?:^|;\\s*)' + name + '=([^;]*)'));
      return m ? decodeURIComponent(m[1]) : '';
    } catch (e) { return ''; }
  };
  const onOurDomain = /(^|\.)quintengish\.com$/.test(location.hostname);
  const setCookie = (name, value, days, shared) => {
    try {
      let c = `${name}=${encodeURIComponent(value)}; max-age=${Math.round(days * DAY)}; path=/; SameSite=Lax`;
      if (shared && onOurDomain) c += '; domain=.quintengish.com';
      if (location.protocol === 'https:') c += '; Secure';
      document.cookie = c;
    } catch (e) {}
  };

  /* ---- first touch: current URL params win, else the saved first touch; save only if none saved yet ---- */
  const firstTouch = (() => {
    const got = {};
    let saved = {};
    try {
      const now = new URLSearchParams(location.search);
      FT_KEYS.forEach((k) => { const v = now.get(k); if (v) got[k] = v; });
    } catch (e) {}
    try { saved = JSON.parse(lsGet(FT_KEY) || '{}') || {}; } catch (e) { saved = {}; }
    if (Object.keys(got).length && !Object.keys(saved).length) lsSet(FT_KEY, JSON.stringify(got));
    return Object.keys(got).length ? got : saved;
  })();

  /* ---- visitor id: cookie, else localStorage, else new. Kept in both. ---- */
  let vid = getCookie('acsa_vid') || lsGet('acsa_vid') || '';
  if (!/^[A-Za-z0-9-]{8,64}$/.test(vid)) vid = uuid();
  setCookie('acsa_vid', vid, 400, false);
  lsSet('acsa_vid', vid);

  /* ---- _fbc and _fbp, set BEFORE the pixel loads so the pixel reuses them and browser + server match ---- */
  try {
    const fbclid = new URLSearchParams(location.search).get('fbclid');
    if (fbclid) {
      const cur = getCookie('_fbc');
      const curClid = cur ? cur.split('.').slice(3).join('.') : '';
      if (!cur || curClid !== fbclid) setCookie('_fbc', `fb.1.${Date.now()}.${fbclid}`, 90, true);
    }
  } catch (e) {}
  if (!getCookie('_fbp')) {
    const rand = String(1000000000 + Math.floor(Math.random() * 9000000000));
    setCookie('_fbp', `fb.1.${Date.now()}.${rand}`, 90, true);
  }

  /* ---- TEST MODE: open any page once with ?acsa_test=TEST12345 (the code from Events Manager > Test events).
     For the rest of that browser tab: the browser pixel stays OFF and every server event goes to Test events only,
     so a full test run (apply, book, thank-you) never touches the real numbers. ---- */
  const TEST = (() => {
    try {
      const t = new URLSearchParams(location.search).get('acsa_test');
      if (t && /^TEST\w{1,40}$/.test(t)) sessionStorage.setItem('acsa_test', t);
      return sessionStorage.getItem('acsa_test') || '';
    } catch (e) { return ''; }
  })();

  /* ---- Meta pixel base code ---- */
  if (!TEST) try {
    /* eslint-disable */
    !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
    n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
    n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
    t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
    document,'script','https://connect.facebook.net/en_US/fbevents.js');
    /* eslint-enable */
    /* A page can set window.acsaUser = { em, fn, ln, ph } BEFORE loading this file (the thank-you page does, from
       Calendly's redirect). The pixel hashes these itself; the server copy hashes them on our side. */
    const u = window.acsaUser || {};
    const am = { external_id: vid };
    if (u.em) am.em = String(u.em).trim().toLowerCase();
    if (u.fn) am.fn = String(u.fn).trim().toLowerCase();
    if (u.ln) am.ln = String(u.ln).trim().toLowerCase();
    if (u.ph) am.ph = String(u.ph).replace(/\D/g, '');
    window.fbq('init', ACSA.PIXEL, am);
  } catch (e) {}

  const ids = () => ({ vid, fbp: getCookie('_fbp'), fbc: getCookie('_fbc'), first_touch: { ...firstTouch } });
  const serverOn = !!ACSA.ENDPOINT && ACSA.ENDPOINT.indexOf('PROJECT_REF') === -1;

  /* ---- one call fires the browser pixel AND the server mirror with the same event id ---- */
  const track = (name, params = {}, opts = {}) => {
    let eventId = '';
    try {
      eventId = (opts && opts.eventId) || uuid();
      params = params && typeof params === 'object' ? params : {};
      try {
        if (window.fbq) {
          if (STANDARD.indexOf(name) >= 0) window.fbq('track', name, params, { eventID: eventId });
          else window.fbq('trackCustom', name, params, { eventID: eventId });
        }
      } catch (e) {}
      if (!serverOn) return eventId;
      const id = ids();
      const body = {
        event_name: name,
        event_id: eventId,
        event_time: Math.floor(Date.now() / 1000),
        event_source_url: location.href,
        fbp: id.fbp,
        fbc: id.fbc,
        vid: id.vid,
        custom_data: params,
        first_touch: id.first_touch,
      };
      if (window.acsaUser) body.user = window.acsaUser;
      if (TEST) body.test_code = TEST;
      const url = ACSA.ENDPOINT.replace(/\/+$/, '') + '/collect';
      const json = JSON.stringify(body);
      let sent = false;
      // text/plain keeps this a "simple" request, so the browser sends no CORS preflight
      try { sent = !!(navigator.sendBeacon && navigator.sendBeacon(url, new Blob([json], { type: 'text/plain' }))); } catch (e) {}
      if (!sent) {
        try {
          fetch(url, { method: 'POST', body: json, keepalive: true, mode: 'no-cors', headers: { 'Content-Type': 'text/plain' } })
            .catch(() => {});
        } catch (e) {}
      }
    } catch (e) {}
    return eventId;
  };

  window.acsaTrack = track;
  window.acsaIds = ids;

  track('PageView');
})();
