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
import json
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
CAMERAS_FILE = DATA_DIR / "cameras.json"
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


# Kamere: borderalarm live stream (Ant Media, sme da se ugradi - bez X-Frame-Options/CSP)
# i AMSS iframe (NE sme da se ugradi - CSP frame-ancestors; cuvamo samo kao spoljni link).
CAM_STREAM_RE = re.compile(r'src="(https://camerastream\.borderalarm\.com[^"]+)"', re.I)
CAM_AMSS_RE = re.compile(r'src="(https://kamere\.amss\.org\.rs/iframe/[^"]+)"', re.I)


def parse_cameras(html: str) -> dict:
    """Vadi info o kamerama za prelaz: status + ugradivi stream(ovi) + AMSS linkovi."""
    available = "Check Cameras" in html
    streams = list(dict.fromkeys(CAM_STREAM_RE.findall(html)))  # borderalarm iframe stream
    amss = list(dict.fromkeys(CAM_AMSS_RE.findall(html)))       # samo link (ne sme iframe)
    return {
        "status": "available" if (available or streams or amss) else "none",
        "streams": streams,
        "hls": [],       # HLS .m3u8 (pusta se preko hls.js / nativno na Safari)
        "amss": amss,
        "source": None,  # spoljni link na izvor kamere (atribucija/fallback)
    }


# Dopunski izvori kamera za prelaze koje borderalarm ne pokriva (npr. GR-MK).
# Bogorodica-Evzoni: HLS sa neotel.net.mk (preko alltrafficcams.com); ACAO:* pa radi preko hls.js.
EXTRA_CAMERAS = {
    "bogorodica-evzoni": {
        "hls": ["https://streaming1.neotel.net.mk/stream/bogorodica.m3u8"],
        "source": "https://alltrafficcams.com/live/border-crossings/north-macedonia/greece/bogorodica-evzonoi/",
    },
    "evzoni-bogorodica": {
        "hls": ["https://streaming1.neotel.net.mk/stream/bogorodica.m3u8"],
        "source": "https://alltrafficcams.com/live/border-crossings/north-macedonia/greece/bogorodica-evzonoi/",
    },
}


# --- Mrezni sloj -------------------------------------------------------------

def fetch(url: str) -> str:
    last_err = None
    for attempt in range(1, RETRIES + 1):
        try:
            # Cache-buster: WP Rocket/CDN servira kesiranu stranicu (narocito GitHub
            # runner-u u drugom regionu), pa propusta najnovije prijave. Jedinstven query
            # param po pozivu + nowprocket=1 (WP Rocket bypass) + no-cache zaglavlja.
            sep = "&" if "?" in url else "?"
            bust_url = f"{url}{sep}nowprocket=1&_cb={int(time.time() * 1000)}"
            req = Request(bust_url, headers={
                "User-Agent": USER_AGENT,
                "Cache-Control": "no-cache, no-store, max-age=0",
                "Pragma": "no-cache",
            })
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
    cameras = {}

    for slug in CROSSINGS:
        url = BASE_URL.format(slug=slug)
        try:
            html = fetch(url)
            rows = parse_reports(html)
            added = append_rows(slug, rows, scraped_at)
            total_added += added
            cam = parse_cameras(html)
            extra = EXTRA_CAMERAS.get(slug)
            if extra:
                cam["hls"] = extra.get("hls", [])
                cam["source"] = extra.get("source")
                if cam["hls"]:
                    cam["status"] = "available"
            cameras[slug] = cam
            print(f"[{slug}] parsirano={len(rows)} novo={added} kamera={cam['status']}")
        except Exception as e:  # noqa: BLE001 — zelimo da ostali prelazi prodju
            failures.append((slug, str(e)))
            print(f"[{slug}] GRESKA: {e}", file=sys.stderr)

    # cameras.json se prepisuje svaki run iz svezih podataka (stream id zna da rotira).
    # Pisemo samo ako je bar jedan prelaz uspesno parsiran, da ne obrisemo info pri totalnom padu.
    if cameras:
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        with CAMERAS_FILE.open("w", encoding="utf-8") as f:
            json.dump(cameras, f, ensure_ascii=False, indent=2, sort_keys=True)

    print(f"Ukupno novih redova: {total_added}")
    # Ne obaramo job ako bar jedan prelaz prodje; padamo samo ako svi padnu.
    if failures and len(failures) == len(CROSSINGS):
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
