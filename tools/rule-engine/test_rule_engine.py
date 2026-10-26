"""Tests for the rule engine. Run: python3 test_rule_engine.py"""

import unittest

from rule_engine import AdStats, classify_ad

CFG = {
    "display_name": "Test Offer",
    "primary_metric": "purchase",
    "target_cpa": 100.0,
    "leading_metric": "lead",
    "target_leading_cost": 20.0,
    "maturity_days": 3,
}


def ad(**kw):
    base = dict(name="test-ad", age_days=10)
    base.update(kw)
    return AdStats(**base)


class KillRules(unittest.TestCase):
    def test_kill_spend_no_purchases(self):
        v = classify_ad(ad(spend_7d=150.0, purchases_7d=0, leading_7d=10), CFG)
        self.assertEqual(v.verdict, "KILL")
        self.assertEqual(v.rule, "kill-no-purchases")

    def test_kill_cpa_past_2x_with_data(self):
        v = classify_ad(ad(spend_7d=700.0, purchases_7d=3, leading_7d=40), CFG)
        self.assertEqual(v.verdict, "KILL")
        self.assertEqual(v.rule, "kill-cpa")

    def test_no_kill_on_cpa_with_thin_data(self):
        # CPA is terrible but only 2 purchases and spend under 1.5x with purchases > 0
        v = classify_ad(ad(spend_7d=500.0, purchases_7d=2, leading_7d=30), CFG)
        self.assertNotEqual(v.verdict, "KILL")

    def test_early_kill_on_leading_metric(self):
        # Spent past 1x target CPA and leads cost over 2x leading target
        v = classify_ad(ad(age_days=1, spend_7d=120.0, leading_7d=2, purchases_7d=0), CFG)
        self.assertEqual(v.verdict, "KILL")
        self.assertEqual(v.rule, "kill-leading")


class MaturityWindow(unittest.TestCase):
    def test_young_ad_not_judged_on_purchases(self):
        v = classify_ad(ad(age_days=1, spend_7d=100.0, purchases_7d=0, leading_7d=6), CFG)
        self.assertEqual(v.verdict, "TESTING")

    def test_young_ad_with_good_leading_metric(self):
        v = classify_ad(ad(age_days=2, spend_7d=100.0, purchases_7d=0, leading_7d=10), CFG)
        self.assertEqual(v.verdict, "TESTING")
        self.assertEqual(v.rule, "young-leading-good")


class ScaleRules(unittest.TestCase):
    def test_scale_20_at_target(self):
        v = classify_ad(ad(spend_7d=300.0, purchases_7d=3, leading_7d=20), CFG)
        self.assertEqual(v.verdict, "SCALE")
        self.assertEqual(v.rule, "scale-20")

    def test_big_winner_duplicates(self):
        v = classify_ad(ad(spend_7d=300.0, purchases_7d=5, leading_7d=30), CFG)
        self.assertEqual(v.verdict, "SCALE")
        self.assertEqual(v.rule, "scale-big-winner")

    def test_good_cpa_thin_data_holds(self):
        v = classify_ad(ad(spend_7d=90.0, purchases_7d=1, leading_7d=8), CFG)
        self.assertEqual(v.verdict, "HOLD")
        self.assertEqual(v.rule, "hold-thin-winner")


class HoldAndDownscale(unittest.TestCase):
    def test_hold_band(self):
        v = classify_ad(ad(spend_7d=390.0, purchases_7d=3, leading_7d=25), CFG)
        self.assertEqual(v.verdict, "HOLD")
        self.assertEqual(v.rule, "hold-band")

    def test_downscale_scaled_winner_bad_3d(self):
        v = classify_ad(
            ad(
                is_scaling=True,
                spend_3d=200.0, purchases_3d=1,   # 3d CPA 200, past 1.5x
                spend_7d=420.0, purchases_7d=3,   # 7d CPA 140, inside 1.5x
                leading_7d=25,
            ),
            CFG,
        )
        self.assertEqual(v.verdict, "DOWNSCALE")

    def test_unscaled_ad_same_numbers_holds(self):
        v = classify_ad(
            ad(
                is_scaling=False,
                spend_3d=200.0, purchases_3d=1,
                spend_7d=420.0, purchases_7d=3,
                leading_7d=25,
            ),
            CFG,
        )
        self.assertEqual(v.verdict, "HOLD")


class Config(unittest.TestCase):
    def test_no_targets_configured(self):
        v = classify_ad(ad(spend_7d=500.0), {"maturity_days": 3})
        self.assertEqual(v.verdict, "NO_TARGET")

    def test_leading_only_offer_young(self):
        cfg = dict(CFG, target_cpa=None)
        v = classify_ad(ad(age_days=1, spend_7d=100.0, leading_7d=10), cfg)
        self.assertEqual(v.verdict, "TESTING")


if __name__ == "__main__":
    unittest.main(verbosity=2)
