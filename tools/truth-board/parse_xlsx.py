"""Fill data.json from the report workbooks (xlsx exports of the Google Sheets).

Usage: python3 parse_xlsx.py --cj cj.xlsx --tsa tsa.xlsx --elysium elysium.xlsx

Reads each offer's daily tab (summary rows 3-7: 3d/7d/14d/30d/MTD) and its
Creatives tab (per-ad Spend/KPI/CPA over the same windows), then rewrites the
numeric parts of data.json in place. Prose (reads, flags, alerts, targets,
benchmarks) is left alone so a refresh never wipes judgment content: update
those by hand per REFRESH.md. Requires openpyxl.
"""

import argparse
import datetime
import json
import os

import openpyxl

HERE = os.path.dirname(os.path.abspath(__file__))
SUMMARY_ROWS = {"3d": 3, "7d": 4, "14d": 5, "30d": 6, "mtd": 7}
DAILY_START = 10

# Per offer: workbook key, tab names, and metric-key -> column header.
# Match is exact-first, then unique startswith (headers hold long suffixes).
OFFERS = {
    "challenge": {
        "book": "cj", "tab": "Challenge", "creatives": "Creatives - Challenge",
        "cols": {
            "spend": "Spend", "cpm": "CPM", "ctr": "CTR",
            "purchases": "Purchases (GHL", "cpa": "CPA (Cost/Purchase",
            "revenue": "Revenue (GHL", "roas": "ROAS",
            "calls": "Calls Booked", "cash": "Cash Collected",
            "allPurch": "All Purchases (GHL", "allRev": "All Revenue (GHL",
        },
        "pct": ["ctr"],
        "daily": {"spend": "Spend", "purchases": "Purchases (GHL"},
    },
    "grader": {
        "book": "cj", "tab": "Grader", "creatives": "Creatives - Grader",
        "cols": {
            "spend": "Spend", "cpm": "CPM", "ctr": "CTR", "cpc": "CPC",
            "leads": "Leads", "cpl": "CPL", "revMeta": "Revenue (Meta",
        },
        "pct": ["ctr"],
        "daily": {"spend": "Spend", "leads": "Leads"},
    },
    "tsa": {
        "book": "tsa", "tab": "Webinar", "creatives": "Creatives - Webinar",
        "cols": {
            "spend": "Spend", "cpm": "CPM", "ctr": "CTR",
            "leads": "Leads (EW)", "cpl": "CPL", "showRate": "Show Rate %",
            "stayed": "Watched to End (EW)", "costStay": "Cost / Stay-to-End",
            "costCall": "Cost / Call Booked", "calls": "Calls Booked (GHL)",
            "sales": "Sales (GHL)",
        },
        "pct": ["ctr", "showRate"],
        "daily": {"spend": "Spend", "leads": "Leads (EW)"},
    },
    "elysium": {
        "book": "elysium", "tab": "Jet Academy", "creatives": "Creatives - Jet Academy",
        "cols": {
            "spend": "Spend", "cpm": "CPM", "ctr": "CTR",
            "costApp": "Cost / App", "costAppt": "Cost / Appt",
            "showRate": "Show Rate %", "sales": "Sales (CRM Won)",
            "costSale": "Cost / Sale", "revenue": "Revenue (Stripe",
            "roas": "ROAS",
        },
        "pct": ["ctr", "showRate"],
        "daily": {"spend": "Spend", "revenue": "Revenue (Stripe", "sales": "Sales (CRM Won)"},
    },
}


def num(v):
    if v is None or v == "" or v == "-":
        return None
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def header_map(ws):
    out = {}
    for c in ws[2]:
        if c.value is not None:
            out.setdefault(str(c.value).strip(), c.column)
    return out


def find_col(headers, want):
    if want in headers:
        return headers[want]
    hits = [col for h, col in headers.items() if h.startswith(want)]
    if len(hits) == 1:
        return hits[0]
    raise SystemExit(f"header {want!r}: {'ambiguous' if hits else 'not found'} in {sorted(headers)[:8]}...")


def parse_daily_tab(ws, cfg, windows):
    headers = header_map(ws)
    metrics = {}
    for key, want in cfg["cols"].items():
        col = find_col(headers, want)
        vals = []
        for w in windows:
            v = num(ws.cell(row=SUMMARY_ROWS[w], column=col).value)
            if v is not None and key in cfg["pct"] and v <= 1.5:
                v *= 100
            vals.append(v)
        metrics[key] = vals

    dates, series = [], {k: [] for k in cfg["daily"]}
    daily_cols = {k: find_col(headers, want) for k, want in cfg["daily"].items()}
    r = DAILY_START
    while r <= ws.max_row and isinstance(ws.cell(row=r, column=1).value, datetime.datetime):
        d = ws.cell(row=r, column=1).value
        dates.append(f"{d.month}/{d.day}")
        for k, col in daily_cols.items():
            series[k].append(num(ws.cell(row=r, column=col).value) or 0)
        r += 1
    # Sheet is newest-first; board wants oldest-first, capped at 30 days.
    dates.reverse()
    for k in series:
        series[k].reverse()
    cut = max(0, len(dates) - 30)
    return metrics, dates[cut:], {k: v[cut:] for k, v in series.items()}, (
        ws.cell(row=DAILY_START, column=1).value if isinstance(ws.cell(row=DAILY_START, column=1).value, datetime.datetime) else None
    )


def parse_creatives(ws):
    ads = []
    col = 2
    while col <= ws.max_column:
        name = ws.cell(row=1, column=col).value
        if name:
            def win(row, c=col):
                return (num(ws.cell(row=row, column=c).value),
                        num(ws.cell(row=row, column=c + 1).value),
                        num(ws.cell(row=row, column=c + 2).value))
            s3, k3, c3 = win(SUMMARY_ROWS["3d"])
            s7, k7, c7 = win(SUMMARY_ROWS["7d"])
            s30, k30, c30 = win(SUMMARY_ROWS["30d"])
            ads.append({
                "name": str(name).strip(),
                "active": bool(s3),
                "spend": {"3d": s3, "7d": s7, "30d": s30},
                "kpi": {"3d": k3, "7d": k7, "30d": k30},
                "cpa": {"3d": c3, "7d": c7, "30d": c30},
            })
        col += 3
    ads.sort(key=lambda a: (not a["active"], -(a["spend"]["7d"] or 0)))
    return ads


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--cj", required=True)
    ap.add_argument("--tsa", required=True)
    ap.add_argument("--elysium", required=True)
    args = ap.parse_args()

    path = os.path.join(HERE, "data.json")
    with open(path) as f:
        data = json.load(f)
    windows = data["windows"]
    books = {k: openpyxl.load_workbook(getattr(args, k), data_only=True) for k in ("cj", "tsa", "elysium")}

    newest = None
    data.setdefault("ads", {})
    for offer in data["offers"]:
        cfg = OFFERS[offer["id"]]
        wb = books[cfg["book"]]
        metrics, dates, series, top_date = parse_daily_tab(wb[cfg["tab"]], cfg, windows)
        for key, vals in metrics.items():
            if key not in offer["metrics"]:
                raise SystemExit(f"{offer['id']}: metric {key!r} parsed but not defined in data.json")
            offer["metrics"][key]["vals"] = vals
        data["daily"].setdefault(offer["id"], {})
        data["daily"][offer["id"]] = dict(series, dates=dates)
        data["ads"][offer["id"]] = parse_creatives(wb[cfg["creatives"]])
        if top_date and (newest is None or top_date > newest):
            newest = top_date

    # Per-offer daily dates now live under daily.<offer>.dates; keep the shared
    # dates key pointing at the longest series for backward compatibility.
    longest = max(data["daily"].values(), key=lambda d: len(d["dates"]) if isinstance(d, dict) and "dates" in d else 0)
    data["daily"]["dates"] = longest["dates"]

    if newest:
        data["meta"]["data_through"] = newest.date().isoformat()
        data["meta"]["month_day_of"] = newest.day
        month = newest.month
        data["meta"]["month_days"] = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1]
        data["window_days"]["mtd"] = newest.day
    data["meta"]["pulled_at"] = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    data["meta"]["ads_source"] = "creatives_tabs_true"

    with open(path, "w") as f:
        json.dump(data, f, indent=2)
    counts = {k: len(v) for k, v in data["ads"].items()}
    print(f"data.json updated. Data through {data['meta']['data_through']}. Ads parsed: {counts}")


if __name__ == "__main__":
    main()
