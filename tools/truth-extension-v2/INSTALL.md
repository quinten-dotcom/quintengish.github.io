# UM Truth v2: install and use

A Chrome extension that shows TRUE per-ad data (from the report sheets' Creatives tabs) in a Hyros-style panel inside Meta Ads Manager. No server, no API keys: it reads the Google Sheets through your own logged-in Chrome session.

## Install (2 minutes)

1. Get this folder onto the machine: clone the repo (branch `claude/media-buyer-dashboard-ux-c0iu8i`) or download it.
2. Chrome: go to `chrome://extensions`, turn on Developer mode (top right).
3. Click "Load unpacked" and pick the `tools/truth-extension-v2` folder.
4. Make sure this Chrome profile is signed into the Google account that can view the report sheets (quinten@quintengish.com). Open one of the sheets once if you never have in this profile.
5. Open Ads Manager and go to the ADS tab of any campaign. The dark truth panel appears on the right.

## What it does

- Matches the ad names on screen against every ad in the four Creatives tabs (Grader, Challenge, Webinar, Jet Academy) and shows each one's TRUE Spend, Result, CPA, and a verdict, aligned next to the Meta rows.
- Window chips: 3D, 7D, 14D, 30D, MTD. Same windows as the sheets.
- Edit columns (the grid button): toggle Spend, Result, True CPA, vs Target, 30D CPA, Verdict, exactly like the Hyros column picker.
- Targets (the gear): set target true CPA per offer. Verdicts recolor instantly. SCALE at or under target, HOLD to 1.5x, CUT to 2x, KILL past 2x or real spend with zero results.
- Totals bar: spend, results, and blended true CPA for the matched ads on screen.
- Refresh button re-pulls the sheets. Data auto-caches for 30 minutes. If the sync stamp shows STALE, hit refresh.
- Collapse with the arrow if you want it out of the way.

## Verdict logic

Same bands as tools/rule-engine and the Truth Board, judged on each offer's leading metric: Grader leads, Challenge purchases, Webinar stay-to-end, Elysium booked calls. An ad with real spend and zero results past 1.5x target shows KILL. Low spend shows TESTING, do not touch those.

## Troubleshooting

- Panel says it cannot read the sheets: open each report sheet in a tab of this same Chrome profile, then hit the refresh button on the panel.
- Panel says no known ad names on screen: you are on the Campaigns or Ad sets tab. Ad names only exist at the ADS level. If you are on the ads tab and still nothing, the ad names in Meta do not match the names in the Creatives tabs; fix the naming in the 4am loop.
- New offer or renamed tab: edit the SHEETS list at the top of content.js, then hit the reload icon on chrome://extensions.

## Relation to v1

This is a separate extension from the original tools/truth-extension on the Mac. Run both, or port v1's extras into this one. This version's data path (Sheets via user session, name matching, no selectors) is the one to build on: it does not break when Meta changes their DOM.
