# Truth Board refresh procedure

Any Claude session (scheduled or on demand) follows this to refresh the board. Target: under 5 minutes. The Google Drive connector is the only external access needed.

## 1. Export the workbooks (Drive connector)

Use `download_file_content` with exportMimeType `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` for each live report sheet, base64-decode to xlsx files in the scratchpad:

- Channel_Junkies_-_Marketing_Report (tabs: Grader, Challenge, Creatives - Grader, Creatives - Challenge): `1wf_Ow5IFhSxOa1_EqXpeJuzT-RItA352xs9iE9gWh_s` -> cj.xlsx
- True_Success_Academy_-_Marketing_Report (Webinar, Creatives - Webinar): `1PFwD4BjSxp2MjJBjJKdFkXJWzVjU_B273IUbED7Qss8` -> tsa.xlsx
- Elysium_Jet_Training_-_Marketing_Report (Jet Academy, Creatives - Jet Academy): `1M5WUUwzqBtCue97W4CgK7Vs2sQmQOKf59LXFJ2Wk3nY` -> elysium.xlsx

Do NOT use `read_file_content` for this: it only returns the first tab. The xlsx export carries every tab including the Creatives tabs with true per-ad data.

## 2. Run the parser

```
pip install openpyxl -q   # if missing
python3 tools/truth-board/parse_xlsx.py --cj cj.xlsx --tsa tsa.xlsx --elysium elysium.xlsx
```

This rewrites the numeric parts of data.json: all window values, 30 days of dailies, per-ad rows from the Creatives tabs, and the freshness stamps. It never touches prose. If it errors on a header, the sheet layout changed: fix the OFFERS map in parse_xlsx.py.

## 3. Update the judgment content by hand

In data.json: rewrite `meta.alerts` and each offer's `read` (and `flag` if changed) from what the fresh numbers show. Keep them short, name the offer, no drama. Confirm targets still match what Quinten set.

## 4. Build and publish

```
python3 tools/truth-board/build.py -o <scratchpad>/um-truth-board.html
```

Publish with the Artifact tool using EXACTLY the same file path (`<scratchpad>/um-truth-board.html`) and favicon so the URL stays stable. Known board URL: https://claude.ai/code/artifact/c0959b28-3530-42f6-9f21-00aefe104ec5 (pass as `url` from a fresh session).

## 5. Send the morning brief

Push notification with one line per offer (verdict word plus the primary number vs target) then the top alert. Under 300 characters.

## 6. Commit

Commit the updated data.json to the branch and push, so history keeps every day's snapshot.

## Meta ad enrichment (optional, currently blocked)

Status, frequency, and CTR-trend per ad can come from the Meta Ads MCP (`ads_get_ad_entities`, level ad, accounts 904998112494586 / 1853993815415301 / 25869578952695215 / 925821266606876). This connector currently returns "requires approval" from cloud sessions. The board works fully without it since all per-ad truth comes from the Creatives tabs.

## Scheduling status

The claude-code-remote trigger tool also returns "requires approval" from this session, so the daily auto-refresh is not armed yet. Until connector permissions are fixed in claude.ai settings, refresh on demand: Quinten messages "refresh" and the session runs steps 1-6.
