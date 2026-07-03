# Mac Session TODO

Written July 3, 2026 by the cloud session on branch claude/media-buyer-dashboard-ux-c0iu8i.

## Zero: repo sync problem, fix first

The GitHub copy of this repo only contains CNAME, README.md, and index.html. The cloud session could not find CLAUDE.md, skill-routing.md, tools/marketing-reports.md, or tools/truth-extension anywhere on origin/main. If the brain files live only on the Mac, commit and push them to main now. Until then, cloud sessions are working blind and cannot follow the routing docs.

## The task

Quinten asked to make the true-data system easier and more effective for a media buyer to scale with. The cloud session wrote two docs on this branch:

- docs/media-buyer-playbook.md. The buyer-facing rules: sources of truth, maturity windows, kill/hold/scale thresholds, the daily 15-minute workflow.
- docs/true-data-ux-upgrade.md. The build spec: sheet changes, new Scale Board tab, creatives tab upgrades, extension upgrades, and the build order.

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
