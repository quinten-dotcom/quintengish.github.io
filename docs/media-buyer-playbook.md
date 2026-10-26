# Media Buyer Playbook: Scaling on True Data

Created July 3, 2026. This is the doc a media buyer reads before touching budgets. It explains what our true data is, where it comes from, and exactly what action each number should trigger. The goal: anyone can open the report sheet, spend 15 minutes, and make the same scaling decisions Quinten would make.

## 1. Why true data

Meta Ads Manager under-reports and mis-attributes purchases. iOS privacy, delayed conversions, and webinar lag all make the in-platform numbers wrong. If you scale on Meta's numbers, you kill winners and feed losers.

Our system pulls the real outcomes from the systems where money actually lands:

| Offer | True north-star | True source | Meta shows instead |
|---|---|---|---|
| Channel Junkies Grader | Paid-attributed purchases | GHL | Pixel purchases (undercounted) |
| Channel Junkies Challenge | Paid-attributed purchases | GHL | Pixel purchases (undercounted) |
| TSA Webinar | Registrants, stay-to-end, purchases | EverWebinar + GHL | Registrations only |
| Elysium Jet Academy | Booked calls, sales | Elysium CRM | Leads only |

Rule number one: budget decisions come from the report sheet or the UM Truth extension chips. Never from raw Ads Manager columns.

## 2. Know your data's age

The Mac runs the ad-ops loop at 4am daily. The sheet header shows the freshness stamp (data-through date and last-updated time). Before any decision, check it.

- If the stamp is older than 24 hours, do not make kill or scale decisions. Flag it to Quinten instead.
- "Yesterday" is always a complete day. "Today" never appears in the sheet, so you never judge a partial day.

## 3. Respect the lag

True purchases arrive later than clicks. Each offer has a maturity window. Do not judge purchase CPA on spend younger than the window. Judge the leading metric instead.

| Offer | Maturity window | Leading metric to judge early | Lagging metric to judge after |
|---|---|---|---|
| CJ Grader | 3 days | Cost per grader lead | True CPA (purchases) |
| CJ Challenge | 3 days | Cost per challenge signup | True CPA (purchases) |
| TSA Webinar | 7 days | Cost per registrant, stay-to-end rate | True CPA (purchases) |
| Elysium Jet | 14 days | Cost per booked call, show rate | Cost per sale |

Example: an ad spent $300 in the last 2 days on TSA with zero purchases. That is normal. Look at cost per registrant and stay-to-end instead. Only spend older than 7 days gets judged on purchase CPA.

## 4. Targets

Every decision compares true CPA to a target. Targets live in the Targets row of each report sheet (the Mac loop keeps them there). If a target cell says TBD, ask Quinten before making decisions on that offer.

Starting placeholders to be confirmed by Quinten:

| Offer | Target true CPA | Kill line (2x) | Scale line (at or under target) |
|---|---|---|---|
| CJ Grader | TBD | TBD | TBD |
| CJ Challenge | TBD | TBD | TBD |
| TSA Webinar | TBD (also target cost per registrant) | TBD | TBD |
| Elysium Jet | TBD (target cost per booked call) | TBD | TBD |

## 5. The decision rules

These run per ad (creative) and per ad set, always on true data, always past the maturity window. The sheet computes a Verdict for you. The rules behind it:

### Kill
- Spend is at least 1.5x target CPA with zero true purchases (or zero of the leading metric for young spend). Turn it off.
- 7-day true CPA is above 2x target with 3 or more purchases counted. Turn it off. Enough data, it lost.
- Leading metric is more than 2x its target and spend passed 1x target CPA. Turn it off early, do not wait for purchases.

### Hold
- True CPA is between target and 1.5x target. Change nothing. Check again tomorrow.
- Spend is under the kill threshold and results are mixed. It is still testing. Leave it alone. Touching it resets learning.

### Scale
- 7-day true CPA at or under target with at least 3 purchases: raise budget 20 percent. Once per day, max.
- Big winner (true CPA at or under 70 percent of target with 5 or more purchases): also duplicate it into the scaling campaign at 2x budget, keep the original running.
- Never raise a budget more than once in 24 hours. Never raise more than 20 percent at a time on the original ad set. Big jumps reset learning and CPAs spike.

### Down-scale (the missing middle)
- If a previously scaling ad's 3-day true CPA rises above 1.5x target while its 7-day is still okay: cut budget 30 percent instead of killing. Winners have bad days.

## 6. The daily 15 minutes

1. Open the offer's report sheet. Check the freshness stamp.
2. Read the Scale Board section: Kill list, Scale list, Watch list. These are computed from the rules above.
3. Sanity-check each Kill and Scale item against the Creatives tab (batch context, is the whole batch dying or one ad).
4. Make the changes in Ads Manager. The UM Truth extension chips should agree with the sheet. If a chip and the sheet disagree, trust the sheet and tell Quinten.
5. Log what you did in the Actions column of today's row (what you killed, what you scaled, why).

Total time: about 15 minutes per offer. If a decision does not fit the rules, do not improvise. Write it in the Actions column as a question for Quinten.

## 7. Reading the Meta gap

The sheet and extension show a Delta: Meta-reported purchases versus true purchases. Expect Meta to show 20 to 50 percent fewer (or sometimes misplaced) purchases. Use the delta to remind yourself why raw Ads Manager sorting lies. Once CAPI is live (true purchases synced back to Meta), the delta should shrink and Meta's own optimization gets smarter. Until then the gap is normal, not a bug.

## 8. What not to do

- Do not kill anything inside its maturity window based on purchase CPA.
- Do not scale off a single good day. Minimum 3 purchases over the window.
- Do not compare CPAs across offers. Each offer has its own target.
- Do not edit a running winner's creative or targeting. Duplicate instead.
- Do not make decisions on stale data (stamp older than 24 hours).
