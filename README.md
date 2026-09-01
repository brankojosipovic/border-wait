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

## Teren

`teren.html` — zauzimanje table u stilu paper.io. **Kretanje je slobodno, u bilo kom pravcu:**
glava ima položaj u realnim brojevima i ugao koji se okreće ograničenom brzinom (`OKRET`), pa se
ide i ukoso i u luku, bez cik-cak koraka po poljima. Mreža služi samo za teren i za trag: put od
kadra do kadra se „prevuče“ preko ćelija (uz dodavanje ćoška na dijagonali, da trag ostane
neprekidan i da plavljenje ne procuri), a trag se **crta kao glatka linija** kroz stvarne tačke
puta, ne kao niz kvadratića.

Tabla je zato mnogo sitnija i veća: **280×380 ćelija (106 400 polja)**, oko 115 ćelija preko
ekrana. Ekran je prozor koji meko prati glavu, a cela tabla, svi igrači i trenutni prozor se vide
na **mapici** u desnom uglu. Vlasništvo i tragovi stoje u `Uint8Array`-ima, po jedan bajt na ćeliju.

**Zauzeta oblast se ne crta po ćelijama** — inače bi joj ivica bila stepenasta. Kad se nešto
zauzme, iz mreže se izvuče granica (potezi između svog i tuđeg polja, usmereni tako da je svoj
teren uvek s iste strane), potezi se spoje u zatvorene petlje, tačke na istoj pravoj se izbace,
stepenasta kosa ivica se izravna u prave (Ramer–Douglas–Peucker, prag 1,15 polja), a preostali
uglovi se zaoble kvadratnim krivama kroz sredine stranica. Dobije se `Path2D` po igraču koji se
onda samo popunjava — u prozoru i, umanjen, na mapici; rupe u terenu rešava `evenodd`. Zato je i
crtanje jeftinije nego po ćelijama: 60 fps i pri `devicePixelRatio` 3.

Kad se krug zatvori, plavljenje nađe šta je ostalo zatvoreno i sve to postaje tvoje — i to samo
unutar **okvira sopstvenog terena** (`bb`, održava se pri svakom zauzimanju i prebrojavanju), jer
ništa van tog okvira ionako ne može biti zatvoreno; na 106 000 polja to je razlika između par
milisekundi i primetnog zastoja.

Upravljanje je palica: ugao od tačke gde je prst spušten do mesta gde je sada (sa mrtvom zonom i
„povocem“ od 46 px), pa se dobija bilo koji pravac. Četiri tipke ispod daju strane sveta, a dve
pritisnute zajedno — dijagonalu. Uz ivicu table se klizi (položaj se prosto ograniči), ne gine.

Protivnici idu po tačkama: iz svog terena naprave pravougaoni izlet napolje i vrate se kući. Pred
sobom **odigraju svoju putanju unapred** (sa istim ograničenjem okretanja) da ne zaseku sopstveni
trag, a uz ivicu skreću paralelno umesto naglo — bez toga su ginuli sami od sebe.

Trag je jedina slaba tačka: ko ga pregazi, vlasnik gine (i sam sebi). Ivica table ne ubija — na njoj
se staje dok ne skreneš. Protivnici prvih šest sekundi ostaju kod kuće, ne udaljavaju se previše od
svog terena, a na težim nivoima love tuđe tragove (sa pauzom posle lova, da ne budu nemilosrdni).
Kad neko priđe tvom tragu, trag počne da trepće crveno. Poginuli protivnik oslobodi sav svoj teren
i vrati se na novo mesto (protivnici za tri minuta stignu do 5–6% table, pa cilj znači da si
ubedljivo prvi).

**Skriveni dragulji** padaju u okolinu igrača (38–84 polja od nekog), a vide se tek kad im priđeš na
46 polja — i pokupe se prolaskom pored (3×3). Četiri vrste: 🛡 štit (deset sekundi te ništa ne obara,
ni presečen trag ni sudar), ⚡ brzina, ❄ led (protivnici uspore) i 💎 parče terena odmah.

**Cilj se bira** — 20, 30, 40, 50 ili 60% table; izbor i težina se pamte, a najbrže vreme se čuva za svaki
par (težina, cilj).

**🌐 Igra u sobi — do četiri igrača na istoj tabli.** Domaćin je jedini sudija: on vodi ceo svet
(i preostale protivnike iz igre) i na svakih 110 ms šalje kratak snimak — položaj i ugao svake glave, ko ima
štit, gde su dragulji. Gosti crtaju taj snimak, ali **svoju glavu vode i sami** (tipke rade odmah,
bez čekanja na mrežu) i poravnaju se sa domaćinom tek ako odlutaju više od tri polja. Zauzimanje,
smrt, oživljavanje i pokupljen dragulj stižu kao poruke od domaćina i primenjuju se kod svih isto,
pa tabla ostaje ista na svim telefonima bez slanja cele mreže. U sobi se ne ispada: ko izgubi teren,
vraća se na novo prazno mesto, a partija traje dok neko ne stigne do cilja. Ako neko izgubi vezu,
njegovu boju preuzme računar.

## Mapa

`mapa.html` — pitanje kaže koju državu ili grad tražimo („Gde je Portugal?“), igrač dodirne mesto na
karti sveta i potvrdi; poeni idu po udaljenosti (1000 na tačnom mestu, pa opada eksponencijalno —
kod država je pun pogodak dodir bilo gde **unutar** zemlje, što se proverava pravim testom tačke u
poligonu). Rastojanje je haversinsko, po Zemlji, a ne po ekranu.

Karta nije slika nego **vektorski svet u `svet.js`**: 169 država sa granicama, tačkom za natpis i
kontinentom, i 148 gradova sa koordinatama i srpskim nazivima. Napravljeno je iz **Natural Earth
50m** (javno vlasništvo) skriptom `scripts/napravi_svet.py`: prstenovi se uproste
(Ramer–Douglas–Peucker, sa posebnim postupkom za zatvorene prstenove), zaokruže na stotinku stepena
i zapišu Google „polyline“ kodom — cela karta staje u **~100 KB**, pa radi i offline.

Prikaz je Merkatorova projekcija sa pogledom ograničenim na pojas u kome ima kopna (84°S do 58°J);
karta se pomera prevlačenjem, zumira sa dva prsta (ili dugmićima ＋ − 🌍) do šezdeset puta, a posle
odgovora se sama namesti tako da se vide i pribadanje i tačno mesto, sa crtom između njih i
osvetljenom državom. Bira se oblast (ceo svet, Evropa, naš kraj — od Beča do Soluna), šta se pita
(države, gradovi, mešano) i težina; sve se pamti za sledeći put, kao i najbolji rezultat.

**⏱ Vreme** po pitanju se bira: bez žurbe, 10 ili 20 sekundi. Sat stoji tamo gde posle ide odgovor
i pocrveni na poslednje tri sekunde; kad istekne, važi ono što je pribodeno, a ako nema ničega —
pitanje nosi nulu i karta samo pokaže gde je tačno mesto. Rekordi se vode odvojeno po vremenu.

**🌐 Igra u sobi** — do četiri igrača dobiju **ista pitanja** (domaćin šalje samo nazive, jer svi
imaju iste podatke). Svako odgovara svojim tempom; čim potvrdiš, ostalima stiže koliko si bio
blizu i gde si dodirnuo, pa se tuđa pribadanja vide na karti posle odgovora, a u traci stoji ko
koliko ima.

## Čoveče, ne ljuti se

`covece.html` — klasična tabla 11×11: staza od 40 polja u krug, četiri kuće po uglovima i po četiri
ciljna polja ka sredini. Svaki igrač ima svoj put: 40 polja staze počev od svog starta, pa svoja
četiri u cilju, tako da je cela logika jedan indeks 0–43 po figuri (`-1` = u kući). Odatle su
pravila kratka: šestica izvodi iz kuće i donosi novo bacanje, u cilj se ulazi tačnim brojem, svoje
polje blokira a tuđa figura se vraća kući; kad su sve četiri u kući, ide se tri puta.

Kad ima više različitih poteza, igrač dodirne figuru; kad su svi izbori isti (npr. četiri figure u
kući na šesticu) igra odigra sama. Svako bacanje važi za tačno jedan potez (`iskoriscena`), pa
šestica donosi **novo bacanje**, a ne još jedan potez istim brojem. Računar bira po jednostavnoj oceni: jelo protivnika, izlazak iz
kuće, ulazak u cilj, pa bežanje sa polja na kojem ga neko može pojesti (`ugrozenost` gleda ko je u
dometu od šest polja iza).

Igra se protiv računara (1–3), na jednom telefonu (2–4) ili **🌐 u sobi** do četiri igrača — tada
prazna mesta vodi domaćin kao računarske igrače. Mrežom ide malo: bacanje (da se vidi kockica) i
celo stanje posle poteza — šesnaest brojeva, pa nema šanse da se telefoni raziđu.

## Riziko

`riziko.html` — osvajanje sveta na pravoj karti. Granice dolaze iz istog `svet.js` koji koristi
Mapa, a `riziko.js` (pravi ga `scripts/napravi_riziko.js`) grupiše 169 država u **41 oblast** i šest
kontinenata, računa gde stoji broj vojske i ko je s kim u komšiluku. Susedstvo se dobija iz samih
granica — najmanje rastojanje između tačaka dva obrisa, sa ispravkom po geografskoj širini — pa se
ručno dopune prelazi preko mora (Brazil — Zapadna Afrika, Grenland — Skandinavija, Aljaska —
Rusija…). Skripta na kraju proveri da je karta povezana i da nijedna oblast nije ostala bez suseda,
a prekomorski delovi država koji bi pravili lažne veze (Francuska Gvajana, Reunion) se izbacuju.

Potez ima tri dela: **pojačanja** (`max(3, oblasti/3)` plus bonus za ceo kontinent — Azija 7, Evropa
5, Severna Amerika 4, Afrika i Južna Amerika 3, Okeanija 2), **napad** i jedno **prebacivanje**
između svojih spojenih oblasti. Kockice su klasične: napadač do tri, branilac do dve, poredi se
najveća sa najvećom i **nerešeno brani**. ⚡ *Do kraja* vrti napad dok jedna strana ne padne. Kad
oblast padne, u nju pređe sva vojska osim jedne. Kraj je kad neko drži zadati deo karte — 50%, 70%
ili baš sve.

Brojevi vojske se crtaju kao znaci koji se **razmiču dok se ne prestanu poklapati** i tanko povežu
sa svojim mestom na karti, pa se i gusta Evropa da dodirnuti prstom; dodir prvo gleda znak, pa
kopno, pa najbliži znak. Karta se pomera prevlačenjem i zumira sa dva prsta, kao u Mapi.

Računar rasporedi pojačanja tamo gde gori (protivnička vojska minus svoja), napada samo kad ima
bar 1,35 puta više vojske, uz dodatak za zaokruživanje kontinenta i izbacivanje protivnika, pa na
kraju prebaci višak iz mirne pozadine na prvu liniju. Igra se protiv računara, na jednom telefonu
ili **🌐 u sobi** do četiri igrača — tada je domaćin sudija (kod njega padaju kockice) i posle svake
promene pošalje celu tablu, a gost šalje samo šta hoće da uradi; prazne stolice vodi računar.

## Pravila u samoj igri

`igre.js` nosi kratka pravila za svaku igru (`PRAVILA`) i ubacuje **❔** u zaglavlje svake igre — otvara
prozorčić sa pravilima baš te igre, i usred partije. Veze ka opštoj pomoći dobiju `?od=<igra>.html`,
pa `pomoc.html` prikaže dugme **← Nazad u igru** (odredište se proverava po spisku igara).

## Rad bez interneta (PWA)

`sw.js` je service worker koji pri prvom otvaranju sačuva sve igre na telefon i posle ih
servira iz keša (keš prvo, a nova verzija se povlači u pozadini za sledeće pokretanje).
Registruje se sa `updateViaCache: "none"`, pa provera novog radnika nikad ne ide kroz keš
pregledača. Dugme **🔄 Nova verzija** pita server dvaput: `sw.js?ts=…` (uvek sveže, pa se zna
šta je zaista objavljeno) i običan `sw.js` sa `cache: "reload"` (baš ono što vidi pregledač kad
traži novog radnika). Odatle se razlikuju tri slučaja: ništa novo → tako i piše; server deli novo
a pregledač neće → briše se sve sačuvano i povlači iznova; objavljeno je novo ali server još deli
staru kopiju (GitHub-ov keš je drži do desetak minuta) → to se kaže korisniku i provera se sama
ponavlja svakog minuta dok ne prođe. Traka na dnu spiska igara u tom slučaju piše i koja verzija
čeka na serveru.
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

`cigle.html` — breakout: palica, loptica i **50 nivoa** kroz koje se ide redom (20 ručno složenih
sa imenima i oblicima, ostali se prave po obrascu — deterministički, isti za isti broj, sa sve više
čelika i tvrđih cigli). Izbor bilo kog nivoa otključava skriveni kod. Vrste cigli: zelena (1 udarac),
žuta (2), crvena (3), siva čelična (nerazrušiva) i **tirkizna koja se smanjuje** pri svakom pogotku,
pa je sve teže pogoditi. Bonus **🔫 pištolj** daje palici dve cevi koje 12 sekundi same pucaju nagore
i ruše cigle.
Palica stoji 62 px iznad dna da je prst ne pokriva, sa senkom-pokazivačem ispod. Zelena cigla puca iz prve,
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
Vrednosti su A = 1, **žandar 12, dama 13, kralj 14** — i figure kupe zbir (dama uzme 7+4+2), ali se u
zbir sabiraju samo karte A–10, ne i figure sa stola. Pravilo „žandar kupi sve sa stola" je stvar kuće:
u meniju je prekidač (podrazumevano isključeno, žandar vredi 12); kad je uključeno, njime nema table, tabla nosi +1, na kraju +3 onome ko ima više karata,
a poeni su asovi, desetke (10♦ vredi 2) i 2♣. Protiv računara, u dvoje na jednom telefonu ili preko
interneta. Kad izabereš kartu, igra ponudi sve moguće ulove i označi karte koje bi otišle.

`jamb.html` — listić sa četiri kolone (↓ redom odozgo, ↑ odozdo, ⇅ slobodno, N uz najavu dugim
pritiskom posle prvog bacanja), tri bacanja po potezu, bonus +30 na gornji deo, (maks−min)×jedinice,
kenta 66/56/46, triling +20, ful +30, poker +40, jamb +50.

`igre.js` uz traku ubacuje i **🏠 dugme** u zaglavlje svake igre (iznad svih prozora, pa je povratak
na spisak uvek nadohvat).

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
