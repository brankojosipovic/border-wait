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
| `horgos-roszke` | Horgoš → Röszke (RS→HU) |
| `roszke-horgos` | Röszke → Horgoš (HU→RS) |
| `kelebija-tompa` | Kelebija → Tompa (RS→HU) |
| `tompa-kelebija` | Tompa → Kelebija (HU→RS) |

Dodavanje novog prelaza: ubaci slug u listu `CROSSINGS` u `scripts/scrape.py`
i u objekat `CROSSINGS` u `index.html`. Slug = deo URL-a posle `/bottlenecks/`.

## Setup

1. Napravi repo (ili koristi `brankojosipovic/Claude`) i ubaci ove fajlove.
2. Actions → omogući workflow-e ako su isključeni.
3. Settings → Actions → General → **Workflow permissions** → "Read and write".
4. Prvo ručno pokretanje: Actions → `border-scrape` → **Run workflow**.
5. Dashboard: GitHub Pages (Settings → Pages → branch `main`, root) ili lokalno
   `python -m http.server` u root folderu.

## Sudoku

`sudoku.html` je samostalna igra (bez zavisnosti, radi offline posle prvog učitavanja) —
9×9 tabla, četiri težine, beleške, poništavanje, saveti, tajmer i automatsko čuvanje partije
u `localStorage`. Zagonetke se generišu u pregledaču i uvek imaju **tačno jedno rešenje**.
Link stoji u zaglavlju dashboarda (🎲 Sudoku).

## Solitaire

`solitaire.html` — klasični Klondike, takođe samostalan i offline. Vuci 1 ili 3, neograničeno
vrtenje špila, poništavanje poteza, savet („Potez"), auto-završetak kad su sve karte okrenute,
ponovno deljenje istog špila (deljenja su seed-ovana) i čuvanje partije u `localStorage`.
Igra se tapkanjem: tapni kartu pa odredište, a drugi tap na istu kartu je šalje sam gde može.

## Kolona

`kolona.html` — originalna igra rođena u ovom repou: strategija biranja trake pred rampom.
Svaki tap je 1 minut; rampe obrađuju kolone (🚗 1′ · 🚐 2′ · 🚌 3′ · 🚚 4′, 🔍 pregled +3′),
a u susednu traku možeš da pređeš — ali staješ na njen kraj. I NPC vozila love kraću traku.
Svet je deterministički po seed-u i ne zavisi od igračevih poteza, pa igra na kraju izračuna
(dinamičkim programiranjem) i savršenu liniju i „da si samo stajao" — i kaže ti koliko si
minuta istrgovao. Dnevna kolona: isti seed za sve, rezultat može da se podeli.

## Aparat

`aparat.html` — dva aparata u jednom, sa zajedničkim virtuelnim kreditima (bez pravog novca;
kad potrošiš, „kuća časti" nove): **Poker** (Jacks or Better — deli, zadrži, menjaj; isplate
1×–250×) i **Voćkice** (3×3, 5 linija, RTP ~90% izmeren na 400.000 simuliranih vrtnji).
Svaki dobitak može u „Dupliraj" (crveno/crno, do 5 puta).

## Švercer

`svercer.html` — push-your-luck: natovari gepek (8 mesta — kafa, farmerke, gorivo, cigarete,
zlato; vrednija roba = veći rizik), pa kroz tri punkta sa stvarnim imenima prelaza. Na punktu
vidiš raspoloženje carinika i još možeš da baciš robu kroz prozor; posle svakog prođenog
punkta biraš: prodaj (×1,5 pa ×2) ili teraj do pijace (×3). Pad na pregledu nosi sve.
Pet tura po sezoni, dnevna sezona sa istim seed-om za sve, a na kraju te igra uporedi sa
„savršenim švercerom" (sveznajućim oraklom).

## Igre — zajednička traka i zvuk

`igre.html` je poseban ulaz za sve igre (kartice + statistika iz `localStorage`: partija u toku,
današnji rezultat, stanje kredita). `igre.js` je zajednički za svih pet igara i daje:

- **donju traku** sa izborom igre (aktivna je označena) — fiksirana, sa svojom visinom merenom
  u JS-u i upisanom u `--navh`, pa se rasporedi igara same skupe za tačno toliko;
- **zvuk** sintetizovan preko WebAudio (bez ijednog audio fajla, pa sve i dalje radi offline) —
  prekidač 🔊/🔇 stoji u traci, važi za sve igre i pamti se (`igre.sound`).

## Tetris i Avioni

`tetris.html` — klasika sa pravim **SRS** rotacijama i wall-kickovima, 7-bag izvlačenjem komada,
ghost prikazom, čuvanjem komada (hold), redom sledećih, nivoima i rekordom. Veličina table se
binarnom pretragom podešava na najveću koja staje u ekran; poseban raspored za položen telefon.

`avioni.html` — vertikalna pucačina na canvas-u: prevlačiš prstom, top puca sam. Oružje ide od
1 do 6 cevi (kupljena pojačanja pune krila), pratioci uz krila, štit i životi; četiri talasa pa
**bos** sa trakom života i dve faze pucanja, pa sledeći nivo. Izdržljivost bosa raste kvadratno
sa nivoom da prati rast oružja — borba traje 7–11 s kroz sve nivoe.

## Rad bez interneta (PWA)

`sw.js` je service worker koji pri prvom otvaranju sačuva sve igre na telefon i posle ih
servira iz keša (keš prvo, a nova verzija se povlači u pozadini za sledeće pokretanje).
`manifest.webmanifest` + ikone u `icons/` daju pravu prečicu na početnom ekranu — otvara se
preko celog ekrana, bez adresne trake, i radi kad nema signala. Svaka igra ima svoju ikonu.

Strategija: **mreža prvo** (uz rok od 2,5 s) za stranice, skripte i manifest — tako nova verzija
stiže čim ima signala; **keš prvo** za ikone, koje se ne menjaju. Bez signala sve pada na keš.

Osvežavanje: stranica pita za novu verziju pri svakom pokretanju, povratku u prvi plan i na
svakih pola sata. Kada novi service worker preuzme, **javi porukom svim otvorenim stranicama**
da se osveže (uz zaštitu od petlje kroz `sessionStorage`) — pouzdanije od `controllerchange`.
Hub pokazuje „✓ spremno", broj sačuvanih fajlova, verziju keša i dugme **🔄 Proveri novu verziju**.
Nova verzija se objavljuje dizanjem `VERSION` u `sw.js`; stari keš se tada briše sam.

## Cigle i Stvorenja

`cigle.html` — breakout: palica, loptica i 16 imenovanih nivoa sa oblicima (srce, piramida, tvrđava,
osmeh, strela…). Na startu se bira nivo iz mreže minijatura, uz rekord po nivou i najdalje
dostignut nivo. Palica stoji 62 px iznad dna da je prst ne pokriva, sa senkom-pokazivačem ispod. Zelena cigla puca iz prve,
žuta traži dva, crvena tri udarca, a čelična se ne razbija — samo odbija. Bonusi padaju
(šira palica, tri loptice, sporija loptica, život). Ugao odbijanja zavisi od mesta udara u
palicu, a loptica se pomera u sitnim koracima da ne proleti kroz ciglu pri velikoj brzini.

`stvorenja.html` — sakupljanje i borba na poteze sa **originalnim bićima** (Pokémon likovi i
ime su tuđa svojina, pa se ne koriste). Šetnja po mapi, susreti u travi, tipovi
(🔥 > 🌿 > 💧 > 🔥) sa dvostrukom štetom u prednosti, hvatanje loptom (šansa zavisi od
preostalog zdravlja), tim do šest, iskustvo i nivoi, evolucija, tri arene sa po tri protivnika
i vidar koji leči. Partija se čuva u `localStorage`.

## Tablić i Jamb (igra u dvoje)

`tablic.html` — kartaška klasika: kupi se ista vrednost (7 kupi 7) ili zbir (7 kupi 3+4).
Vrednosti su A = 1, dama = 13, kralj = 14 — i figure kupe zbir (dama uzme 7+4+2), ali se u zbir
sabiraju samo karte A–10, ne i figure sa stola. Žandar kupi sve sa stola ali njime nema table, tabla nosi +1, na kraju +3 onome ko ima više karata,
a poeni su asovi, desetke (10♦ vredi 2) i 2♣. Protiv računara, u dvoje na jednom telefonu ili preko
interneta. Kad izabereš kartu, igra ponudi sve moguće ulove i označi karte koje bi otišle.

`jamb.html` — listić sa četiri kolone (↓ redom odozgo, ↑ odozdo, ⇅ slobodno, N uz najavu dugim
pritiskom posle prvog bacanja), tri bacanja po potezu, bonus +30 na gornji deo, (maks−min)×jedinice,
kenta 66/56/46, triling +20, ful +30, poker +40, jamb +50.

`mreza.js` — igra u dvoje preko interneta bez sopstvenog servera: jedan napravi sobu i dobije
petoznakovni kod, drugi ga ukuca, pa telefoni razgovaraju **direktno** (WebRTC). Javni PeerJS
server služi samo da se nađu. Biblioteka se skida tek kad se izabere mrežna igra, pa offline rad
ostaje netaknut. U tabliću je domaćin autoritet (deli karte i drži stanje), u jambu svaki igrač
šalje svoj potez. Modul ima i lokalni kanal (`BroadcastChannel`) kojim se protokol testira između
dva prozora bez interneta.

## Ograničenja podataka

Prijave su anonimne i neravnomerne (rupe po satima, vrednosti skaču). Korisno za grubi
obrazac "kad je gužva", **ne** za precizno predviđanje. Heatmap postaje pouzdan tek posle
2–3 nedelje skupljanja. Nije zvaničan izvor.
