"""United Motion ad rule engine.

Turns true-data numbers for one ad into a verdict a media buyer can act on.
Implements the rules in docs/media-buyer-playbook.md sections 3 and 5.
Standard library only. The 4am loop feeds it per-ad numbers built from the
true sources (GHL, EverWebinar, Elysium CRM) and writes the verdicts into
the Scale Board tab, the Creatives tab status column, and the data the
UM Truth extension reads. One engine, one truth.

Usage:
    from rule_engine import classify_ad, load_targets
    cfg = load_targets()["elysium_jet"]
    result = classify_ad(ad_stats, cfg)
    # result.verdict in {"KILL", "SCALE", "HOLD", "DOWNSCALE", "TESTING", "NO_TARGET"}
"""

import json
import os
from dataclasses import dataclass, field
from typing import Optional


@dataclass
class AdStats:
    """True-data numbers for one ad. Windows are trailing calendar days
    ending on the last complete day. purchases means the offer's primary
    conversion (purchase, sale). leading means the offer's leading metric
    (lead, booked call). age_days is days since the ad first spent."""

    name: str
    age_days: int
    spend_3d: float = 0.0
    spend_7d: float = 0.0
    purchases_3d: int = 0
    purchases_7d: int = 0
    leading_3d: int = 0
    leading_7d: int = 0
    is_scaling: bool = False  # buyer previously scaled this ad


@dataclass
class Verdict:
    verdict: str
    rule: str
    action: str
    detail: str = ""


def _cpa(spend: float, conversions: int) -> Optional[float]:
    if conversions <= 0:
        return None
    return spend / conversions


def load_targets(path: Optional[str] = None) -> dict:
    if path is None:
        path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "targets.json")
    with open(path) as f:
        cfg = json.load(f)
    cfg.pop("_comment", None)
    return cfg


def classify_ad(ad: AdStats, cfg: dict) -> Verdict:
    """Apply the playbook rules to one ad. Order matters: kill rules first,
    then scale, then downscale, then hold. Anything left is still testing."""

    target = cfg.get("target_cpa")
    lead_target = cfg.get("target_leading_cost")
    maturity = cfg.get("maturity_days", 7)
    mature = ad.age_days >= maturity

    cpa_7d = _cpa(ad.spend_7d, ad.purchases_7d)
    cpa_3d = _cpa(ad.spend_3d, ad.purchases_3d)
    lead_cost_7d = _cpa(ad.spend_7d, ad.leading_7d)

    if target is None and lead_target is None:
        return Verdict(
            "NO_TARGET", "config",
            "Set targets in targets.json before judging this offer.",
        )

    # Early kill on the leading metric, before maturity. Playbook 5, kill rule 3.
    if lead_target is not None and target is not None and ad.spend_7d >= target:
        if lead_cost_7d is None or lead_cost_7d > 2 * lead_target:
            shown = "no results" if lead_cost_7d is None else f"${lead_cost_7d:.2f} per {cfg.get('leading_metric', 'lead')}"
            return Verdict(
                "KILL", "kill-leading",
                "Turn it off.",
                f"Spent ${ad.spend_7d:.2f} with {shown}, leading target is ${lead_target:.2f}.",
            )

    if not mature:
        # Inside the maturity window, purchase CPA is not judged.
        # Judge only the leading metric; otherwise it is still testing.
        if lead_target is not None and lead_cost_7d is not None and lead_cost_7d <= lead_target:
            return Verdict(
                "TESTING", "young-leading-good",
                "Leave it alone, leading metric is on target.",
                f"{ad.age_days} days old, maturity is {maturity}. ${lead_cost_7d:.2f} per {cfg.get('leading_metric', 'lead')}.",
            )
        return Verdict(
            "TESTING", "young",
            "Leave it alone, too young to judge on purchases.",
            f"{ad.age_days} days old, maturity is {maturity} days.",
        )

    if target is not None:
        # Kill rule 1: real spend, zero purchases.
        if ad.spend_7d >= 1.5 * target and ad.purchases_7d == 0:
            return Verdict(
                "KILL", "kill-no-purchases",
                "Turn it off.",
                f"${ad.spend_7d:.2f} spent in 7 days, 1.5x target (${1.5 * target:.2f}) passed with zero purchases.",
            )
        # Kill rule 2: enough purchases to know, CPA past 2x.
        if cpa_7d is not None and ad.purchases_7d >= 3 and cpa_7d > 2 * target:
            return Verdict(
                "KILL", "kill-cpa",
                "Turn it off.",
                f"7d CPA ${cpa_7d:.2f} is over 2x target (${target:.2f}) with {ad.purchases_7d} purchases.",
            )
        # Scale rules.
        if cpa_7d is not None and cpa_7d <= target:
            if cpa_7d <= 0.7 * target and ad.purchases_7d >= 5:
                return Verdict(
                    "SCALE", "scale-big-winner",
                    "Duplicate into the scaling campaign at 2x budget, keep the original.",
                    f"7d CPA ${cpa_7d:.2f} is under 70% of target with {ad.purchases_7d} purchases.",
                )
            if ad.purchases_7d >= 3:
                return Verdict(
                    "SCALE", "scale-20",
                    "Raise budget 20 percent. Once per day, max.",
                    f"7d CPA ${cpa_7d:.2f} at or under target ${target:.2f} with {ad.purchases_7d} purchases.",
                )
            return Verdict(
                "HOLD", "hold-thin-winner",
                "Looks good but under 3 purchases. Check again tomorrow.",
                f"7d CPA ${cpa_7d:.2f} on only {ad.purchases_7d} purchases.",
            )
        # Downscale: a scaled winner having a bad 3-day stretch. Playbook 5.
        if (
            ad.is_scaling
            and cpa_3d is not None
            and cpa_3d > 1.5 * target
            and cpa_7d is not None
            and cpa_7d <= 1.5 * target
        ):
            return Verdict(
                "DOWNSCALE", "downscale-30",
                "Cut budget 30 percent, do not kill.",
                f"3d CPA ${cpa_3d:.2f} past 1.5x target but 7d CPA ${cpa_7d:.2f} still okay.",
            )
        # Hold band: over target but under 1.5x.
        if cpa_7d is not None and cpa_7d <= 1.5 * target:
            return Verdict(
                "HOLD", "hold-band",
                "Change nothing. Check again tomorrow.",
                f"7d CPA ${cpa_7d:.2f} is between target ${target:.2f} and 1.5x.",
            )
        # Over 1.5x but not killable yet (under 3 purchases or spend under threshold).
        if cpa_7d is not None:
            return Verdict(
                "HOLD", "hold-weak",
                "Weak but not enough data to kill. Watch closely.",
                f"7d CPA ${cpa_7d:.2f} past 1.5x target on {ad.purchases_7d} purchases.",
            )

    # Mature, no purchase target set, or no purchases and spend below kill line.
    return Verdict(
        "TESTING", "insufficient",
        "Not enough spend or data to judge. Leave it alone.",
        f"${ad.spend_7d:.2f} spent in 7 days, {ad.purchases_7d} purchases.",
    )


if __name__ == "__main__":
    import sys

    # Reads a JSON array of AdStats dicts on stdin plus an offer key argument,
    # prints one verdict per line. Lets the Mac loop shell out if it is not Python.
    offer = sys.argv[1] if len(sys.argv) > 1 else None
    cfg_all = load_targets()
    if offer not in cfg_all:
        sys.exit(f"usage: rule_engine.py <offer>  (one of: {', '.join(cfg_all)})  < ads.json")
    ads = json.load(sys.stdin)
    for a in ads:
        v = classify_ad(AdStats(**a), cfg_all[offer])
        print(json.dumps({"name": a["name"], **v.__dict__}))
