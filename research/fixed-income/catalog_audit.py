"""Read-only structural checks. Findings require review, not invented corrections."""
import argparse
from collections import Counter
from datetime import date
import json
from pathlib import Path


class CatalogObject(dict):
    def __init__(self, pairs):
        super().__init__()
        self.duplicates = []
        for key, value in pairs:
            if key in self:
                self.duplicates.append({
                    "key": key,
                    "overwritten_fields": sorted(set(self[key]) - set(value))
                    if isinstance(self[key], dict) and isinstance(value, dict) else [],
                })
            self[key] = value


def civil_date(value):
    try:
        parsed = date.fromisoformat(value)
        return parsed if parsed.isoformat() == value else None
    except (TypeError, ValueError):
        return None


def finite_nonnegative(value):
    import math
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value) and value >= 0


def audit_catalog(raw, as_of):
    """Keep duplicate keys visible, unlike a regular JSON parse."""
    if civil_date(as_of) is None:
        raise ValueError("as_of must be an ISO civil date")
    catalog = json.loads(raw, object_pairs_hook=CatalogObject)
    if not isinstance(catalog, dict):
        raise ValueError("Expected an object keyed by instrument")
    rows = []
    for ticker, item in catalog.items():
        if ticker.startswith("_"):
            continue
        issues = []
        if not isinstance(item, dict):
            rows.append({"ticker": ticker, "issues": ["invalid_record"]})
            continue
        maturity = civil_date(item.get("maturity_date"))
        if maturity is None:
            issues.append("missing_or_invalid_maturity")
        flows = item.get("cashflows", item.get("cash_flows", []))
        if not isinstance(flows, list):
            flows = []
            issues.append("invalid_schedule")
        if not flows:
            issues.append("empty_schedule")
        valid = all(isinstance(f, dict) and civil_date(f.get("date"))
                    and finite_nonnegative(f.get("amortization_pct"))
                    and finite_nonnegative(f.get("interest_pct")) for f in flows)
        principal = None
        last_payment = None
        if flows and not valid:
            issues.append("malformed_flow")
        elif flows:
            principal = sum(f["amortization_pct"] for f in flows)
            payments = [f for f in flows if f["amortization_pct"] + f["interest_pct"] > 0]
            last_payment = max((f["date"] for f in payments), default=None)
            if not payments:
                issues.append("no_positive_payments")
            if abs(principal - 100) > 0.000001:
                issues.append("principal_total_requires_review")
            if principal == 0:
                issues.append("no_principal_in_schedule")
            if maturity and last_payment and last_payment != maturity.isoformat():
                issues.append("last_payment_differs_from_maturity")
            if maturity and (last_payment is None or last_payment < as_of) and as_of < maturity.isoformat():
                issues.append("future_maturity_but_no_future_flows")
        if not any(item.get(k) for k in ["source", "sources", "provenance", "evidence", "document_url"]):
            issues.append("no_documentary_provenance")
        rows.append({"ticker": ticker, "maturity": item.get("maturity_date"),
                     "flow_count": len(flows), "scheduled_principal_per_100_original": principal,
                     "last_payment": last_payment, "issues": issues})
    counts = Counter(issue for row in rows for issue in row["issues"])
    return {
        "as_of": as_of,
        "scope": "Structural review of stored schedules; not verification against contracts or market prices.",
        "instrument_count": len(rows),
        "duplicate_top_level_keys": catalog.duplicates,
        "issue_counts": dict(sorted(counts.items())),
        "interpretation": "Partial historical schedules can have principal below 100 legitimately. Review against issue date, outstanding principal and primary documents before correcting.",
        "instruments": rows,
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--as-of", required=True, help="Explicit civil date; never host clock")
    parser.add_argument("--catalog", type=Path, default=Path(__file__).resolve().parents[2] / "src/data/bondProspectos.json")
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    report = audit_catalog(args.catalog.read_text(encoding="utf-8-sig"), args.as_of)
    holidays_path = Path(__file__).resolve().parents[2] / "src/data/holidays.json"
    holidays = json.loads(holidays_path.read_text(encoding="utf-8-sig"))
    report["calendar"] = {"last_loaded_holiday": max(holidays),
                          "coverage_past_as_of": max(holidays) >= args.as_of,
                          "note": "Last entry does not certify calendar completeness or other financial centers."}
    serialized = json.dumps(report, indent=2, ensure_ascii=False) + "\n"
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(serialized, encoding="utf-8")
    print(json.dumps({k: v for k, v in report.items() if k != "instruments"}, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
