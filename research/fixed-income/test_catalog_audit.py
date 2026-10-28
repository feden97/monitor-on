import json
import unittest

from catalog_audit import audit_catalog


class AuditTests(unittest.TestCase):
    def test_duplicate_keys_are_reported_before_json_overwrites_them(self):
        raw = '{"B":{"source":"document","cashflows":[]},"B":{"cashflows":[]}}'
        result = audit_catalog(raw, "2026-10-27")
        self.assertEqual(result["instrument_count"], 1)
        self.assertEqual(result["duplicate_top_level_keys"], [{"key": "B", "overwritten_fields": ["source"]}])

    def test_missing_cashflows_do_not_prove_maturity(self):
        result = audit_catalog(json.dumps({"B": {"maturity_date": "2028-01-17", "cashflows": [
            {"date": "2026-01-17", "interest_pct": 4, "amortization_pct": 0}
        ]}}), "2026-10-27")
        issues = result["instruments"][0]["issues"]
        self.assertIn("future_maturity_but_no_future_flows", issues)
        self.assertIn("no_principal_in_schedule", issues)

    def test_full_bullet_has_no_structural_schedule_findings(self):
        result = audit_catalog(json.dumps({"B": {"maturity_date": "2028-01-17", "source": "contract", "cashflows": [
            {"date": "2028-01-17", "interest_pct": 4, "amortization_pct": 100}
        ]}}), "2026-10-27")
        self.assertEqual(result["instruments"][0]["issues"], [])

    def test_future_zero_marker_cannot_hide_exhausted_real_payments(self):
        result = audit_catalog(json.dumps({"B": {"maturity_date": "2028-01-17", "cashflows": [
            {"date": "2026-01-17", "interest_pct": 4, "amortization_pct": 0},
            {"date": "2028-01-17", "interest_pct": 0, "amortization_pct": 0}
        ]}}), "2026-10-27")
        row = result["instruments"][0]
        self.assertEqual(row["last_payment"], "2026-01-17")
        self.assertIn("future_maturity_but_no_future_flows", row["issues"])

    def test_malformed_dates_and_amounts_require_review(self):
        for flow in [{"date": "2026-02-30", "interest_pct": 4, "amortization_pct": 100},
                     {"date": "2028-01-17", "interest_pct": "4", "amortization_pct": 100}]:
            result = audit_catalog(json.dumps({"B": {"maturity_date": "2028-01-17", "cashflows": [flow]}}), "2026-10-27")
            self.assertIn("malformed_flow", result["instruments"][0]["issues"])
        with self.assertRaises(ValueError):
            audit_catalog("{}", "2026-02-30")


if __name__ == "__main__":
    unittest.main()
