#!/usr/bin/env python3
"""
Mesecni sezonski sazetak iz raw prijava.

Cita sve data/<prelaz>.csv (raw append-only istorija prijava) i racuna agregate
po (prelaz, mesec): broj prijava, prosek, medijana, p90, max, min cekanja.
Pise u data/summary_monthly.csv — REGENERISE se ceo svaki run iz pune istorije,
tako da raw CSV ostaje jedini izvor istine, a sazetak se uvek moze ponovo izvesti.

Bez timestamp kolone: fajl se menja samo kad se promene stvarni agregati, pa
GitHub Actions ne pravi prazan commit kad nema novih prijava.
"""

import csv
import statistics
from pathlib import Path

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
SUMMARY = DATA_DIR / "summary_monthly.csv"

SUMMARY_HEADER = [
    "crossing",     # slug prelaza
    "month",        # YYYY-MM
    "n_reports",    # broj prijava u mesecu
    "avg_min",      # prosek (1 decimala)
    "median_min",   # medijana
    "p90_min",      # 90. percentil
    "max_min",      # maksimum
    "min_min",      # minimum
]


def percentile(sorted_vals, p):
    """Linearna interpolacija; sorted_vals je sortirana lista, p u [0,1]."""
    if not sorted_vals:
        return 0
    if len(sorted_vals) == 1:
        return sorted_vals[0]
    k = (len(sorted_vals) - 1) * p
    lo = int(k)
    hi = min(lo + 1, len(sorted_vals) - 1)
    frac = k - lo
    return sorted_vals[lo] + (sorted_vals[hi] - sorted_vals[lo]) * frac


def main() -> int:
    # (crossing, month) -> list[value_min]
    buckets: dict[tuple, list] = {}

    for csv_path in sorted(DATA_DIR.glob("*.csv")):
        if csv_path.name == SUMMARY.name:
            continue
        with csv_path.open("r", newline="", encoding="utf-8") as f:
            for r in csv.DictReader(f):
                try:
                    val = int(r["value_min"])
                except (KeyError, ValueError, TypeError):
                    continue
                month = (r.get("reported_at") or "")[:7]  # YYYY-MM
                if len(month) != 7:
                    continue
                buckets.setdefault((r["crossing"], month), []).append(val)

    rows = []
    for (crossing, month), vals in buckets.items():
        sv = sorted(vals)
        rows.append([
            crossing,
            month,
            len(sv),
            round(statistics.mean(sv), 1),
            round(statistics.median(sv), 1),
            round(percentile(sv, 0.90), 1),
            max(sv),
            min(sv),
        ])

    rows.sort(key=lambda x: (x[0], x[1]))

    DATA_DIR.mkdir(parents=True, exist_ok=True)
    with SUMMARY.open("w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(SUMMARY_HEADER)
        w.writerows(rows)

    print(f"summary_monthly.csv: {len(rows)} (prelaz x mesec) redova")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
