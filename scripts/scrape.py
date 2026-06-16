#!/usr/bin/env python3
"""
BorderAlarm scraper — skuplja prijavljena vremena cekanja i upisuje u CSV po prelazu.

Izvor: borderalarm.com (crowdsourced prijave).
Parsira sekciju "Lastly reported" — svaka stavka ima vrednost cekanja + tacan timestamp prijave.
Deduplikacija ide po (crossing_slug, reported_at, value_min, source) tako da ponovno
pokretanje ne pravi duplikate, bez obzira na to koliko cesto se job izvrsava.

CSV se commituje nazad u repo (GitHub Actions) i sluzi kao istorijska vremenska serija.
"""

import csv
import re
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.error import URLError, HTTPError

# --- Konfiguracija prelaza ---------------------------------------------------
# slug = deo URL-a posle /bottlenecks/
CROSSINGS = [
    "evzoni-bogorodica",
    "bogorodica-evzoni",
    "bajakovo-batrovci",
    "batrovci-bajakovo",
]

BASE_URL = "https://borderalarm.com/bottlenecks/{slug}/"
DATA_DIR = Path(__file__).resolve().parent.parent / "data"
USER_AGENT = "Mozilla/5.0 (compatible; BorderAlarmLogger/1.0)"
REQUEST_TIMEOUT = 30
RETRIES = 3
RETRY_BACKOFF_SEC = 5

CSV_HEADER = [
    "crossing",        # slug prelaza
    "reported_at",     # timestamp same prijave (lokalno vreme sajta), ISO
    "value_min",       # vreme cekanja u minutima (normalizovano)
    "value_raw",       # original tekst sa sajta ("45 min", "1.5 h", ...)
    "reporter",        # "anonymous" / "anonymous_" itd.
    "scraped_at_utc",  # kada je skripta pokupila podatak (UTC ISO)
]

# --- Parsiranje --------------------------------------------------------------

# Stavke iz "Lastly reported": "45 min 16.06.2026 19:56 by anonymous"
# i "1.5 h 16.06.2026 20:57 by anonymous_". Hvata vrednost, jedinicu, datum, vreme, reporter.
REPORT_RE = re.compile(
    r"(?P<val>\d+(?:\.\d+)?)\s*(?P<unit>min|h)\s+"
    r"(?P<date>\d{2}\.\d{2}\.\d{4})\s+(?P<time>\d{2}:\d{2})\s+"
    r"by\s+(?P<reporter>[A-Za-z_]+)",
    re.IGNORECASE,
)


def to_minutes(val: str, unit: str) -> int:
    """Normalizuje vrednost u cele minute. '1.5 h' -> 90, '45 min' -> 45."""
    num = float(val)
    if unit.lower() == "h":
        num *= 60
    return int(round(num))


def parse_reports(html: str):
    """
    Izdvaja sve prijave iz 'Lastly reported' bloka.
    Vraca listu dict-ova. Granica bloka je sekcija 'Lastly reported' do 'Report waiting time'.
    """
    start = html.lower().find("lastly reported")
    end = html.lower().find("report waiting time")
    block = html[start:end] if start != -1 and end != -1 else html
    # Sajt obavija svako polje u zaseban <span> tag; zamenjujemo tagove razmakom
    # da REPORT_RE (koji ocekuje polja razdvojena razmakom) hvata prijave.
    block = re.sub(r"<[^>]+>", " ", block)

    rows = []
    for m in REPORT_RE.finditer(block):
        date_s = m.group("date")  # dd.mm.yyyy
        time_s = m.group("time")  # HH:MM
        try:
            dt = datetime.strptime(f"{date_s} {time_s}", "%d.%m.%Y %H:%M")
        except ValueError:
            continue
        rows.append({
            "reported_at": dt.isoformat(timespec="minutes"),
            "value_min": to_minutes(m.group("val"), m.group("unit")),
            "value_raw": f"{m.group('val')} {m.group('unit')}".strip(),
            "reporter": m.group("reporter"),
        })
    return rows


# --- Mrezni sloj -------------------------------------------------------------

def fetch(url: str) -> str:
    last_err = None
    for attempt in range(1, RETRIES + 1):
        try:
            req = Request(url, headers={"User-Agent": USER_AGENT})
            with urlopen(req, timeout=REQUEST_TIMEOUT) as resp:
                charset = resp.headers.get_content_charset() or "utf-8"
                return resp.read().decode(charset, errors="replace")
        except (URLError, HTTPError) as e:
            last_err = e
            if attempt < RETRIES:
                time.sleep(RETRY_BACKOFF_SEC * attempt)
    raise RuntimeError(f"Fetch neuspeo za {url}: {last_err}")


# --- CSV sloj (dedup) --------------------------------------------------------

def load_existing_keys(path: Path) -> set:
    """Ucitava postojece kljuceve za dedup: (reported_at, value_min, reporter)."""
    keys = set()
    if not path.exists():
        return keys
    with path.open("r", newline="", encoding="utf-8") as f:
        for r in csv.DictReader(f):
            keys.add((r["reported_at"], r["value_min"], r["reporter"]))
    return keys


def append_rows(slug: str, rows: list, scraped_at: str) -> int:
    path = DATA_DIR / f"{slug}.csv"
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    existing = load_existing_keys(path)
    is_new_file = not path.exists()

    added = 0
    with path.open("a", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        if is_new_file:
            w.writerow(CSV_HEADER)
        for r in rows:
            key = (r["reported_at"], str(r["value_min"]), r["reporter"])
            if key in existing:
                continue
            w.writerow([
                slug, r["reported_at"], r["value_min"],
                r["value_raw"], r["reporter"], scraped_at,
            ])
            existing.add(key)
            added += 1
    return added


# --- Main --------------------------------------------------------------------

def main() -> int:
    scraped_at = datetime.now(timezone.utc).isoformat(timespec="seconds")
    total_added = 0
    failures = []

    for slug in CROSSINGS:
        url = BASE_URL.format(slug=slug)
        try:
            html = fetch(url)
            rows = parse_reports(html)
            added = append_rows(slug, rows, scraped_at)
            total_added += added
            print(f"[{slug}] parsirano={len(rows)} novo={added}")
        except Exception as e:  # noqa: BLE001 — zelimo da ostali prelazi prodju
            failures.append((slug, str(e)))
            print(f"[{slug}] GRESKA: {e}", file=sys.stderr)

    print(f"Ukupno novih redova: {total_added}")
    # Ne obaramo job ako bar jedan prelaz prodje; padamo samo ako svi padnu.
    if failures and len(failures) == len(CROSSINGS):
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
