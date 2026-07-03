# Mac Session TODO

Written July 3, 2026 by the cloud session on branch claude/media-buyer-dashboard-ux-c0iu8i.

## Zero: repo sync problem, fix first

The GitHub copy of this repo only contains CNAME, README.md, and index.html. The cloud session could not find CLAUDE.md, skill-routing.md, tools/marketing-reports.md, or tools/truth-extension anywhere on origin/main. If the brain files live only on the Mac, commit and push them to main now. Until then, cloud sessions are working blind and cannot follow the routing docs.

## The task

Quinten asked to make the true-data system easier and more effective for a media buyer to scale with. The cloud session wrote two docs on this branch:

- docs/media-buyer-playbook.md. The buyer-facing rules: sources of truth, maturity windows, kill/hold/scale thresholds, the daily 15-minute workflow.
- docs/true-data-ux-upgrade.md. The build spec: sheet changes, new Scale Board tab, creatives tab upgrades, extension upgrades, and the build order.

## Update from the cloud session, July 3 evening

The cloud session has more reach than we thought. It confirmed live access to:

- Google Drive (read only). It read the three live report sheets directly:
  - Channel_Junkies_-_Marketing_Report: 1wf_Ow5IFhSxOa1_EqXpeJuzT-RItA352xs9iE9gWh_s
  - True_Success_Academy_-_Marketing_Report: 1PFwD4BjSxp2MjJBjJKdFkXJWzVjU_B273IUbED7Qss8
  - Elysium_Jet_Training_-_Marketing_Report: 1M5WUUwzqBtCue97W4CgK7Vs2sQmQOKf59LXFJ2Wk3nY
  Note: the Drive connector only exports the first tab of each sheet, and it cannot write cells. Sheet writes stay on the Mac.
- Meta Ads MCP (live, full account list). Channel Junkies, True Potential Unleashed (TSA), Elysium Jet Training and charter accounts are all queryable from the cloud. The old ELYSIUM JET account and two others are disabled by Meta ("unusual activity" flag), worth a look.
- What the cloud still cannot touch: GHL, EverWebinar, Elysium CRM, Stripe/Whop, and any sheet write. Those stay with your keys.

The cloud session also shipped:

- tools/rule-engine/rule_engine.py plus targets.json and tests (14 passing). This is the one rule engine from the upgrade spec. Wire the 4am loop to call it (import it if the loop is Python, or pipe JSON through `python3 rule_engine.py <offer>` if not) and write its verdicts into the Scale Board tab, the Creatives status column, and the extension data.
- A phone Truth Board artifact for Quinten built from the July 3 sheet data, with editable targets. When Quinten confirms targets, put them in targets.json and the sheets' Targets row.

Data problems the cloud spotted while reading the sheets, fix these first:

1. Channel Junkies sheet has empty SALES PIPELINE columns. No true purchase data is landing there, so the offer cannot be judged on anything but CPL. Fix the GHL purchase feed for CJ.
2. The CJ sheet that updates daily (file ID above) looks like a different layout than the Grader/Challenge reports described in the brain. Confirm which sheets are canonical, there are several old copies in Drive with similar names.

## Execute (needs your keys)

Follow the build order at the bottom of docs/true-data-ux-upgrade.md:

1. Add the freshness stamp and Targets row to each offer's daily report tab (CJ Grader, CJ Challenge, TSA Webinar, Elysium Jet). Ask Quinten for real target CPAs to replace TBD. Nothing else works until targets exist.
2. Add verdict conditional formatting and 3d/7d rolling CPA columns.
3. Implement the rule engine in the 4am loop code using playbook sections 3 and 5, then build the Scale Board tab per offer.
4. Upgrade the Creatives tabs: batch scorecards, status column, winner sort.
5. Add the Meta delta column and the Actions log column.
6. Update tools/truth-extension: verdict tint, delta badge, stale-data warning, verdict toggle. The loop should write per-ad verdicts into the data the extension reads so the extension never computes rules itself.

After each shipped step, update this file (check items off) and push, so the cloud session can pick up where you left off.

## For Quinten directly

1. Set real target CPAs per offer (playbook section 4 has the table).
2. Create the Meta system-user token so CAPI can go live. In Meta Business Settings: Users, System users, create a system user (admin), assign the ad account and the pixel/dataset with full control, then Generate token with ads_management and business_management scopes. Put it where the Mac loop's other keys live. This is the single biggest scaling lever on the list.
