# Truth, native to Ads Manager: extension v2 spec

Written July 3, 2026. Quinten's call: the buyer lives in Ads Manager, so truth has to live there too, not on a separate board. This is the build spec for the UM Truth Chrome extension v2 (code on the Mac in tools/truth-extension). A clickable demo of everything below exists as the "Ads Manager Truth Demo" artifact, built from this spec.

The competitive proof: Hyros, Wicked Reports, and AdBeacon all inject their real numbers INSIDE Ads Manager, and it is their most loved feature. Buyers never leave the screen they act in. We go further because we also have verdicts.

## Principles

1. The extension displays, it never computes. The Mac 4am loop runs tools/rule-engine and publishes per-ad true metrics plus verdicts to a JSON feed the extension reads. One rule engine, one truth.
2. Meta's numbers never get hidden, they get contextualized. The buyer always sees the gap.
3. Stale truth is worse than no truth. Everything greys out past 24 hours.

## The seven native features, in build order

### 1. True columns in the table (the core)
Inject real columns into the Ads Manager grid, aligned and sortable like Meta's own: "True Results", "True CPA", "True ROAS", "Verdict". Header cells carry a small UM tint so nobody mistakes them for Meta columns. Clicking a header sorts by that column (extension sorts the DOM rows). This upgrades the current floating chips into first-class table citizens.

### 2. Verdict pill per row, with a "why" popover
Each ad row gets a pill: SCALE (green), HOLD (yellow), CUT (orange), KILL (red), TESTING (neutral). Tap it and a popover explains the verdict like a coach: the rule that fired, the numbers, the target, and the suggested move ("Raise 20 percent, once per day"). This is what makes a junior buyer safe.

### 3. Delta badge on Meta's own numbers
Meta's Results and Cost-per-result cells get a corner badge showing the true number and the gap: "Meta 1, true 2 (+100%)". Green when Meta undercounts, red when Meta overcounts. Trains distrust exactly where the lie sits, and shows CAPI progress when the gap shrinks.

### 4. Lag shield on young ads
Rows younger than the offer's maturity window (from targets.json) get a TESTING chip, and their purchase-CPA cells dim with a tooltip: "2 days old. Sales lag 14 days here. Judge cost per booked call: $38, on target." Stops the number one junior mistake, killing winners early.

### 5. Fatigue flags
A small FATIGUE chip on rows where frequency passes 3 or CTR falls 30 percent-plus from its 7-day peak (both computable from Meta's own columns, no true data needed). Motion and Triple Whale charge for this; it is two comparisons.

### 6. Guardrail on manual actions
When the buyer flips the on/off toggle or edits budget in a direction that contradicts the verdict, the extension interposes one confirm: "True data says SCALE (4.8x ROAS). You are about to turn this off. Continue?" Never blocks, always allows override, but makes every override deliberate. Every action (aligned or override) is appended to the decision log automatically with the true numbers at that moment.

### 7. Truth bar above the table
One pinned strip: freshness stamp, the offer's verdict and primary true number vs target, window chips (3D/7D/30D) that swap all injected numbers, and a master toggle to turn the whole truth layer on and off (the before/after is also the sales demo for future UM clients).

## Data plumbing (Mac side)

The 4am loop writes one JSON file per ad account, keyed by Meta ad ID: per window (3d/7d/30d) true results, true CPA/ROAS, leading metric cost, verdict object (word, rule, detail, action) straight from rule_engine.classify_ad, plus offer targets and generated_at. Publish where the extension can fetch it (the extension already reads sheet data for chips today, reuse that channel). The extension matches rows by the ad ID in each row's attributes, falling back to ad name.

## Out of scope for v2

Auto-executing budget changes with no human tap (rules engine acting alone). The guardrail flow keeps a human on every action until we trust the loop end to end.
