#!/usr/bin/env python3
"""Jednokratni backfill istorije sa borderalarm REST API-ja (mc_reports) u data/<slug>.csv.

Nema filtera po prelazu na serveru, pa prelistavamo period DAN-PO-DAN (plitka paginacija)
i lokalno izdvajamo nasa 4 prelaza po mc_bottleneck_id. Upisuje u iste CSV-ove uz dedup
(reported_at, value_min, reporter), pa je bezbedno i za ponovno pokretanje.

Prozor: AFTER .. BEFORE (podrazumevano poslednjih ~90 dana, do pocetka naseg skupljanja).
"""
import csv
import sys
import time
import urllib.request
import ssl
import json
from datetime import datetime, date, timedelta
from pathlib import Path

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
API = "https://borderalarm.com/wp-json/wp/v2/mc_reports"
CTX = ssl.create_default_context()
UA = "Mozilla/5.0 (compatible; BorderWaitBackfill/1.0)"

# mc_bottleneck_id -> slug (id-jevi iz wp_localize na stranicama prelaza)
ID2SLUG = {
    "478446": "evzoni-bogorodica",
    "478445": "bogorodica-evzoni",
    "561": "bajakovo-batrovci",
    "562": "batrovci-bajakovo",
}

AFTER = date(2026, 3, 19)   # ~90 dana unazad
BEFORE = date(2026, 6, 16)  # pocetak naseg skupljanja (da nema duplikata)

CSV_HEADER = ["crossing", "reported_at", "value_min", "value_raw", "reporter", "scraped_at_utc"]


def fetch(url, tries=4):
    last = None
    for i in range(tries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            r = urllib.request.urlopen(req, timeout=30, context=CTX)
            return json.loads(r.read().decode("utf-8", "replace"))
        except Exception as e:  # noqa: BLE001
            last = e
            time.sleep(1.5 * (i + 1))
    print(f"  ! fetch fail {url}: {last}", file=sys.stderr)
    return None


def load_keys(path):
    keys = set()
    if path.exists():
        with path.open("r", newline="", encoding="utf-8") as f:
            for r in csv.DictReader(f):
                keys.add((r["reported_at"], r["value_min"], r["reporter"]))
    return keys


def main():
    rows_by_slug = {s: [] for s in ID2SLUG.values()}
    keys_by_slug = {s: load_keys(DATA_DIR / f"{s}.csv") for s in ID2SLUG.values()}
    seen_new = {s: set() for s in ID2SLUG.values()}

    total_days = (BEFORE - AFTER).days
    d = AFTER
    day_i = 0
    while d < BEFORE:
        day_i += 1
        a = f"{d.isoformat()}T00:00:00"
        b = f"{d.isoformat()}T23:59:59"
        page = 1
        day_hits = 0
        while True:
            url = (f"{API}?after={a}&before={b}&per_page=100&page={page}"
                   f"&orderby=date&order=asc&_fields=date_gmt,custom_fields")
            data = fetch(url)
            if not data:
                break
            for rec in data:
                cf = rec.get("custom_fields") or {}
                bid = cf.get("mc_bottleneck_id")
                slug = ID2SLUG.get(bid)
                if not slug:
                    continue
                try:
                    val = int(cf.get("mc_waitting_time"))
                except (TypeError, ValueError):
                    continue
                dt_raw = cf.get("mc_date_time", "")  # "DD.MM.YYYY HH:MM"
                try:
                    dt = datetime.strptime(dt_raw, "%d.%m.%Y %H:%M")
                except ValueError:
                    continue
                reported_at = dt.isoformat(timespec="minutes")
                reporter = f"user{cf.get('mc_user_id', '?')}"
                key = (reported_at, str(val), reporter)
                if key in keys_by_slug[slug] or key in seen_new[slug]:
                    continue
                seen_new[slug].add(key)
                scraped = (rec.get("date_gmt") or "") + "+00:00"
                rows_by_slug[slug].append(
                    [slug, reported_at, val, f"{val} min", reporter, scraped]
                )
                day_hits += 1
            if len(data) < 100:
                break
            page += 1
            time.sleep(0.05)
        print(f"[{day_i}/{total_days}] {d} -> +{day_hits} (stranica {page})", flush=True)
        d += timedelta(days=1)

    # upis: append u postojece CSV-ove, sortirano po vremenu
    for slug, rows in rows_by_slug.items():
        if not rows:
            print(f"{slug}: 0 novih")
            continue
        rows.sort(key=lambda r: r[1])
        path = DATA_DIR / f"{slug}.csv"
        new_file = not path.exists()
        with path.open("a", newline="", encoding="utf-8") as f:
            w = csv.writer(f)
            if new_file:
                w.writerow(CSV_HEADER)
            w.writerows(rows)
        print(f"{slug}: +{len(rows)} redova -> {path.name}")


if __name__ == "__main__":
    main()
