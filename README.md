# Border Wait — istorijska serija čekanja na granici

Skuplja prijavljena vremena čekanja sa **borderalarm.com** (korisničke prijave),
gradi istorijsku vremensku seriju po prelazu i prikazuje je kao heatmap dan×sat +
rang najboljih termina za prelazak.

## Kako radi

- `scripts/scrape.py` povuče stranicu svakog prelaza, parsira sekciju "Lastly reported"
  (vrednost + tačan timestamp prijave), normalizuje u minute i upiše u `data/<prelaz>.csv`.
- Deduplikacija ide po `(reported_at, value_min, reporter)` — ponovno pokretanje ne pravi duplikate.
- GitHub Actions (`.github/workflows/scrape.yml`) pokreće scraper **na svakih 30 min** i
  commituje izmenjene CSV-ove nazad u repo.
- `index.html` čita CSV-ove i prikazuje analizu (dual light/dark tema).

> 30 min je dovoljno: parsiramo prijave po njihovom timestampu, ne po vremenu skupljanja,
> pa i ako Actions cron zakasni, sve nove prijave od prošlog prolaza budu pokupljene.

## Praćeni prelazi

| slug | smer |
|---|---|
| `evzoni-bogorodica` | Evzoni → Bogorodica (GR→MK) |
| `bogorodica-evzoni` | Bogorodica → Evzoni (MK→GR) |
| `bajakovo-batrovci` | Bajakovo → Batrovci (HR→RS) |
| `batrovci-bajakovo` | Batrovci → Bajakovo (RS→HR) |

Dodavanje novog prelaza: ubaci slug u listu `CROSSINGS` u `scripts/scrape.py`
i u objekat `CROSSINGS` u `index.html`. Slug = deo URL-a posle `/bottlenecks/`.

## Setup

1. Napravi repo (ili koristi `brankojosipovic/Claude`) i ubaci ove fajlove.
2. Actions → omogući workflow-e ako su isključeni.
3. Settings → Actions → General → **Workflow permissions** → "Read and write".
4. Prvo ručno pokretanje: Actions → `border-scrape` → **Run workflow**.
5. Dashboard: GitHub Pages (Settings → Pages → branch `main`, root) ili lokalno
   `python -m http.server` u root folderu.

## Ograničenja podataka

Prijave su anonimne i neravnomerne (rupe po satima, vrednosti skaču). Korisno za grubi
obrazac "kad je gužva", **ne** za precizno predviđanje. Heatmap postaje pouzdan tek posle
2–3 nedelje skupljanja. Nije zvaničan izvor.
