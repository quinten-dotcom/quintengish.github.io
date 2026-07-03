# Truth Board refresh procedure

Any Claude session (scheduled or on demand) follows this to refresh the board. Target: under 5 minutes.

## 1. Pull fresh sheet data (Google Drive connector, read only)

Read the first tab of each live report sheet:

- Channel_Junkies_-_Marketing_Report: `1wf_Ow5IFhSxOa1_EqXpeJuzT-RItA352xs9iE9gWh_s`
- True_Success_Academy_-_Marketing_Report: `1PFwD4BjSxp2MjJBjJKdFkXJWzVjU_B273IUbED7Qss8`
- Elysium_Jet_Training_-_Marketing_Report: `1M5WUUwzqBtCue97W4CgK7Vs2sQmQOKf59LXFJ2Wk3nY`

Each first tab has summary rows (3 Days, 7 Days, 14 Days, 30 Days, MTD, Total) then daily rows newest first.

## 2. Update data.json

Update in `tools/truth-board/data.json`:

- `meta.data_through`, `meta.pulled_at`, `meta.month_days`, `meta.month_day_of`
- Every `metrics.<key>.vals` array: values for [3d, 7d, 14d, 30d, mtd] in that order
- `daily`: last 30 days of the listed series per offer
- `meta.alerts`: rewrite from what the fresh numbers show (CPL jumps, show-rate slides, zero-sale streaks past maturity, disabled accounts, data-feed gaps). Keep them short and name the offer.
- Offer `read` lines: update to today's honest read.

## 3. Try the Meta ad-level pull

Use the Meta Ads MCP tool `ads_get_ad_entities`, level `ad`, sorted by spend descending, limit 25, `date_preset` last_7d, fields: id, name, effective_status, spend, impressions, ctr, frequency, results, cost_per_result. Accounts:

- Channel Junkies: 904998112494586
- True Success Academy (True Potential Unleashed): 1853993815415301
- Elysium Jet Training: 25869578952695215
- Elysium jet charter: 925821266606876

Write rows into `data.json` under `ads.<offer>` as objects: name, status, spend, results, cost_per_result, ctr, frequency. Set `meta.meta_ads_status` to "ok". If the call errors with "requires approval" or auth, leave `ads` empty, set `meta.meta_ads_status` to "blocked_approval", and tell Quinten the Meta connector needs approval in claude.ai connector settings.

## 4. Build and publish

```
python3 tools/truth-board/build.py -o <scratchpad>/um-truth-board.html
```

Publish with the Artifact tool using EXACTLY the same file path as last time (`<scratchpad>/um-truth-board.html`) and favicon 📊, so the URL stays stable. The known board URL: https://claude.ai/code/artifact/c0959b28-3530-42f6-9f21-00aefe104ec5 (pass it as `url` if publishing from a fresh session).

## 5. Send the morning brief

Push notification (PushNotification tool) with: one line per offer (verdict word plus the primary number vs target), then the top alert. Under 300 characters. Example: "Elysium SCALE 4.3x ROAS. TSA STOP+FIX $1194/call, 0 sales. CJ HOLD $132 CPL rising. Alert: CJ purchase feed still empty."

## 6. Commit

Commit the updated `data.json` (and anything else changed) to the current branch and push, so history shows every day's snapshot.

## Scheduled trigger

A daily trigger fires this procedure into the owning session each morning after the Mac's 4am loop. Manage it with the claude-code-remote trigger tools (list_triggers / update_trigger / delete_trigger). If connectors turn out to be unavailable in scheduled runs, the run should still send a push saying the refresh failed and why, and Quinten can message "refresh" to run it interactively.
