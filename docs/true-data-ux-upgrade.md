# True Data UX Upgrade Spec

Created July 3, 2026 by the cloud session. This is the build spec for making the report sheets and the UM Truth extension something a media buyer can scale from without thinking. The Mac session executes the sheet parts (it has the Google Sheets service account). The extension parts are code changes in tools/truth-extension.

Design principle: the current sheets show true numbers. The upgrade makes them show true decisions. Every screen should answer "what do I do right now" in one glance, with color only where a decision lives.

## Part A: Daily report tab upgrades (per offer)

The daily tabs already have newest day at top and north-star metrics from true sources. Add:

### A1. Freshness stamp
One cell at the very top, above the header row. Format: "Data through Jul 2. Updated Jul 3, 4:12am." The 4am loop writes it on every run. If a run fails, the stamp goes stale and the buyer knows not to trust the sheet. Conditional format: red text if the update time is more than 24 hours old (formula compares against NOW()).

### A2. Targets row
A pinned row right under the column headers holding target values for each decision metric (target true CPA, target cost per registrant, target cost per call, etc). Label it "TARGET". Quinten owns these values. Every conditional format below references this row, so changing a target re-colors the whole sheet instantly. Use TBD until Quinten sets each one.

### A3. Verdict coloring on decision cells only
Color only the true CPA / cost-per-lead cells, nothing else, so color means decision:
- Green: at or under target
- Yellow: over target but at or under 1.5x target
- Red: over 1.5x target
Everything else stays uncolored. Delete any existing decorative coloring.

### A4. Rolling columns
Next to each daily true CPA, add "3d CPA" and "7d CPA" columns (rolling true spend divided by rolling true purchases). Single days are noisy. The rules in the playbook run on the rolling numbers. Also add a trend arrow column: compare 3d vs 7d, show "rising" or "falling" (text is fine, or up/down triangles via CHAR).

### A5. Meta delta column
One column: "Meta says" (pixel-reported purchases for the day) next to true purchases, and a "Gap" percent. This trains the buyer to distrust Ads Manager and shows when CAPI starts closing the gap.

### A6. Actions log column
Rightmost column on each daily row: free text. The buyer writes what they did and why ("killed B3-hook2, 7d CPA 2.4x target", "scaled B5-ugc1 +20%"). This becomes the decision history the 4am loop and Quinten can read.

## Part B: Scale Board (new tab per offer sheet)

A new tab named "Scale Board". The 4am loop rebuilds it fully each run. It is the buyer's first screen. Three sections, top to bottom:

1. KILL. Ads that hit a kill rule. Columns: ad name (Drive-linked), batch, spend in window, true purchases, true CPA, rule that fired ("7d CPA 2.1x target"), one-click context (link to the Creatives tab cell).
2. SCALE. Ads that hit a scale rule. Same columns plus "suggested move" ("raise 20%" or "duplicate at 2x, keep original").
3. WATCH. Ads inside 1x to 1.5x target, or still inside their maturity window with a leading metric drifting the wrong way.

Rules and maturity windows are defined in docs/media-buyer-playbook.md sections 3 and 5. Implement them exactly, in the loop code, not as sheet formulas (formulas get fragile). Anything not matching a rule does not appear on the board. Empty sections print "Nothing today."

At the top of the tab, repeat the freshness stamp.

## Part C: Creatives tab upgrades (per offer)

Keep the current layout (batch columns with Spend/KPI/CPA, Drive-linked names, off ads greyed to the right). Add:

### C1. Batch scorecard row
At the top of each batch column group: total batch spend, blended true CPA, wins count (ads that ever hit scale), win rate percent. Lets the buyer and Quinten see which creative direction is working per batch, not just per ad.

### C2. Status column per ad
Explicit status text next to each live ad: TESTING, SCALING, HOLD, or KILL-PENDING, computed by the same rule engine as the Scale Board. Greyed-right stays as the graveyard for ads already off. Color the status cell only (green SCALING, yellow HOLD, red KILL-PENDING, no color for TESTING).

### C3. Winner sort
Within each batch, live ads sort by 7d true CPA ascending, so winners sit at the top of the column. The loop re-sorts on each run.

## Part D: UM Truth extension upgrades (tools/truth-extension)

The chips already show true Spend/CPA/Revenue/ROAS/ROI over 3D/7D/30D inside Ads Manager. Add:

### D1. Verdict tint on chips
Tint the CPA chip by the same green/yellow/red bands as the sheet, using the same targets. Get targets from the Targets row of the report sheet (the extension already reads sheet data for the chips, so read the target too). Never hardcode targets in the extension.

### D2. Delta badge
Small secondary text on the purchases/CPA chip: "Meta 12 / true 8". Makes the attribution gap visible exactly where the buyer would otherwise trust Meta.

### D3. Stale-data warning
If the chip data's source timestamp is older than 24 hours, show the chips in grey with a "stale" marker instead of colors. Bad old data displayed confidently is worse than no data.

### D4. Verdict text
Optional toggle like the existing metric toggles: show the computed verdict word (SCALE, HOLD, KILL) on the chip. This must match the Scale Board, same rule engine thresholds. Simplest path: the 4am loop writes a per-ad verdict into the data the extension reads, so the extension displays and never computes rules itself. One rule engine, one truth.

## Part E: CAPI (biggest scaling lever, still blocked)

The CAPI uploader is built and waiting on a Meta system-user token from Quinten. Once true purchases flow back to Meta, Meta's delivery optimizes toward real buyers and everything above gets easier. Token steps for Quinten are in MAC-SESSION-TODO.md.

## Build order for the Mac session

1. A1 freshness stamp and A2 targets row (small, unblocks everything else)
2. A3 verdict colors and A4 rolling columns
3. Rule engine in the loop code (playbook sections 3 and 5), then Part B Scale Board
4. Part C creatives upgrades (reuse the rule engine)
5. A5 Meta delta and A6 actions column
6. Part D extension changes last (depends on targets and verdicts existing in the sheet data)

Each step is independently shippable. Ship in this order so the buyer gets value from day one.
