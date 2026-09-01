/* igre.js — zajednička donja traka igara + zvuk (WebAudio, bez audio fajlova) */
(function () {
"use strict";

var GAMES = [
  { id: "sudoku",    href: "sudoku.html",    em: "🔢", nm: "Sudoku" },
  { id: "solitaire", href: "solitaire.html", em: "🎴", nm: "Soliter" },
  { id: "kolona",    href: "kolona.html",    em: "🚧", nm: "Kolona" },
  { id: "aparat",    href: "aparat.html",    em: "🎰", nm: "Aparat" },
  { id: "svercer",   href: "svercer.html",   em: "🚬", nm: "Švercer" },
  { id: "tetris",    href: "tetris.html",    em: "🧱", nm: "Tetris" },
  { id: "avioni",    href: "avioni.html",    em: "✈️", nm: "Avioni" },
  { id: "cigle",     href: "cigle.html",     em: "🕹️", nm: "Cigle" },
  { id: "stvorenja", href: "stvorenja.html", em: "🐉", nm: "Bića" },
  { id: "tablic",    href: "tablic.html",    em: "🃏", nm: "Tablić" },
  { id: "jamb",      href: "jamb.html",      em: "🎲", nm: "Jamb" },
  { id: "geo",       href: "geo.html",       em: "🌍", nm: "Geo" },
  { id: "pikado",    href: "pikado.html",    em: "🎯", nm: "Pikado" },
  { id: "bilijar",   href: "bilijar.html",   em: "🎱", nm: "Bilijar" },
  { id: "kuca",      href: "kuca.html",      em: "🛋", nm: "Kuća" },
  { id: "teren",     href: "teren.html",     em: "🟩", nm: "Teren" }
];
var SKEY = "igre.sound";
var IKEY = "igre.ime";

/* ---------- ime igrača (da se u sobi zna ko je ko) ---------- */
var IGRAC = {
  ime: function () { try { return (localStorage.getItem(IKEY) || "").trim().slice(0, 14); } catch (e) { return ""; } },
  postavi: function (v) {
    v = String(v || "").replace(/[<>]/g, "").trim().slice(0, 14);
    try { localStorage.setItem(IKEY, v); } catch (e) { }
    paintIme();
    return v;
  },
  imeIli: function (rez) { return IGRAC.ime() || rez; },
  pitaj: function (gotovo) {                      // mali prozorčić, radi na svakoj strani
    var stara = document.querySelector(".imeSloj");
    if (stara) stara.remove();
    var sloj = document.createElement("div");
    sloj.className = "imeSloj";
    sloj.innerHTML =
      '<div class="imeBox">' +
      '<h3>👤 Kako se zoveš?</h3>' +
      '<p>Ime se vidi drugom igraču kad igrate u sobi. Čuva se samo na ovom telefonu.</p>' +
      '<input id="imeUnos" maxlength="14" autocomplete="name" placeholder="npr. Branko">' +
      '<div class="imeBtns"><button id="imeOk">Sačuvaj</button><button id="imeNe">Kasnije</button></div></div>';
    document.body.appendChild(sloj);
    var polje = sloj.querySelector("#imeUnos");
    polje.value = IGRAC.ime();
    var zatvori = function (v) { sloj.remove(); if (gotovo) gotovo(v); };
    sloj.querySelector("#imeOk").onclick = function () { zatvori(IGRAC.postavi(polje.value)); };
    sloj.querySelector("#imeNe").onclick = function () { zatvori(IGRAC.ime()); };
    sloj.addEventListener("click", function (e) { if (e.target === sloj) zatvori(IGRAC.ime()); });
    polje.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); zatvori(IGRAC.postavi(polje.value)); } });
    setTimeout(function () { polje.focus(); }, 60);
  }
};
function paintIme() {
  var b = document.getElementById("imeBtn");
  if (b) b.textContent = "👤 " + (IGRAC.ime() || "Upiši ime");
}
window.IGRAC = IGRAC;

/* ---------- zvuk ---------- */
var on = true;
try { var v = localStorage.getItem(SKEY); if (v !== null) on = v === "1"; } catch (e) { }
var ctx = null, master = null;

function engine() {
  if (!on) return null;
  try {
    if (!ctx) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.30;
      master.connect(ctx.destination);
    }
    if (ctx.state === "suspended" && ctx.resume) ctx.resume();
    return ctx;
  } catch (e) { return null; }
}
/* iOS drži zvučni kanal zatvoren dok ga korisnik prvi put ne dodirne.
   Zato na prvi dodir bilo gde otvaramo kanal i pustimo nečujan zvuk. */
var otkljucan = false;
function otkljucaj() {
  if (otkljucan) return;
  var c = engine();
  if (!c) return;
  try { if (c.state === "suspended" && c.resume) c.resume(); } catch (e) { }
  try {
    var b = c.createBuffer(1, 1, 22050), src = c.createBufferSource();
    src.buffer = b; src.connect(master || c.destination); src.start(0);
  } catch (e) { }
  try {                                          // isto i za izgovor: prvi mora unutar dodira
    if (window.speechSynthesis && !GLAS._primljen) {
      GLAS._primljen = true;
      if (window.speechSynthesis.paused && window.speechSynthesis.resume) window.speechSynthesis.resume();
      var u = new SpeechSynthesisUtterance("ok");
      u.volume = 0; u.rate = 2;
      window.speechSynthesis.speak(u);
    }
  } catch (e) { }
  if (c.state === "running") otkljucan = true;
}
["pointerdown", "touchend", "mousedown", "keydown"].forEach(function (t) {
  document.addEventListener(t, otkljucaj, { passive: true, capture: true });
});
document.addEventListener("visibilitychange", function () {
  if (document.hidden) return;
  otkljucan = false;
  try { if (ctx && ctx.state === "suspended" && ctx.resume) ctx.resume(); } catch (e) { }
});

function tone(o) {
  var c = engine(); if (!c) return;
  try {
    var t = c.currentTime + (o.at || 0), d = o.d || .12, vol = o.v == null ? .4 : o.v;
    var osc = c.createOscillator(), g = c.createGain();
    osc.type = o.type || "sine";
    osc.frequency.setValueAtTime(o.f, t);
    if (o.to) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.to), t + d);
    g.gain.setValueAtTime(.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + (o.atk || .01));
    g.gain.exponentialRampToValueAtTime(.0001, t + d);
    osc.connect(g); g.connect(master);
    osc.start(t); osc.stop(t + d + .03);
  } catch (e) { }
}
function noise(o) {
  var c = engine(); if (!c) return;
  try {
    var t = c.currentTime + (o.at || 0), d = o.d || .1;
    var n = Math.max(1, Math.floor(c.sampleRate * d));
    var buf = c.createBuffer(1, n, c.sampleRate), data = buf.getChannelData(0);
    for (var i = 0; i < n; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / n);
    var src = c.createBufferSource(); src.buffer = buf;
    var f = c.createBiquadFilter(); f.type = o.filter || "bandpass";
    f.frequency.setValueAtTime(o.f || 1200, t);
    if (o.to) f.frequency.exponentialRampToValueAtTime(Math.max(30, o.to), t + d);
    f.Q.value = o.q == null ? 1 : o.q;
    var g = c.createGain(); g.gain.value = o.v == null ? .4 : o.v;
    src.connect(f); f.connect(g); g.connect(master);
    src.start(t); src.stop(t + d + .02);
  } catch (e) { }
}

var SFX = {
  isOn: function () { return on; },
  set: function (x) {
    on = !!x;
    try { localStorage.setItem(SKEY, on ? "1" : "0"); } catch (e) { }
    if (on) { engine(); SFX.tap(); } else if (window.GLAS) GLAS.stani();
    paintBtn();
    if (window.GLAS) GLAS.paint();
    return on;
  },
  toggle: function () { return SFX.set(!on); },
  _paintGlas: function () { if (window.GLAS) GLAS.paint(); },

  tick:    function () { tone({ f: 520, d: .05, type: "square", v: .14 }); },
  tap:     function () { tone({ f: 680, to: 900, d: .08, type: "triangle", v: .28 }); },
  good:    function () { tone({ f: 660, d: .1, type: "triangle", v: .28 }); tone({ f: 988, d: .13, type: "triangle", v: .22, at: .075 }); },
  bad:     function () { tone({ f: 210, to: 90, d: .22, type: "sawtooth", v: .22 }); },
  card:    function () { noise({ d: .07, f: 2600, to: 900, v: .3, q: .8 }); },
  shuffle: function () { for (var i = 0; i < 6; i++) noise({ d: .05, f: 2000 + Math.random() * 1400, v: .16, at: i * .045, q: .7 }); },
  whoosh:  function () { noise({ d: .22, f: 400, to: 2400, v: .2, q: .6 }); },
  coin:    function () { tone({ f: 988, d: .08, type: "square", v: .2 }); tone({ f: 1319, d: .16, type: "square", v: .18, at: .07 }); },
  stamp:   function () { noise({ d: .06, f: 320, v: .45, q: .5 }); tone({ f: 130, to: 60, d: .13, type: "square", v: .28 }); },
  reel:    function () { noise({ d: .05, f: 1800, v: .26, q: 1.2 }); tone({ f: 320, d: .05, type: "square", v: .13 }); },
  drum:    function () { for (var i = 0; i < 9; i++) noise({ d: .04, f: 190, v: .2, at: i * .07, q: 1 }); },
  engine:  function () { tone({ f: 70, to: 135, d: .5, type: "sawtooth", v: .2 }); noise({ d: .5, f: 200, to: 520, v: .1, q: .5 }); },
  siren:   function () { tone({ f: 720, to: 420, d: .34, type: "sawtooth", v: .26 }); tone({ f: 720, to: 420, d: .34, type: "sawtooth", v: .26, at: .37 }); },
  win:     function () { [523, 659, 784, 1047].forEach(function (f, i) { tone({ f: f, d: .3, type: "triangle", v: .28, at: i * .1 }); }); },
  jackpot: function () { [523, 659, 784, 1047, 1319, 1047, 1319, 1568].forEach(function (f, i) { tone({ f: f, d: .26, type: "square", v: .22, at: i * .085 }); }); },

  /* bilijar */
  kugle:  function (j) { var v = Math.max(.10, Math.min(.55, j == null ? .3 : j));
            noise({ d: .035, f: 3400, to: 1900, v: v, q: 2.2 });
            tone({ f: 1500, to: 950, d: .05, type: "square", v: v * .45 }); },
  banda:  function (j) { var v = Math.max(.08, Math.min(.45, j == null ? .25 : j));
            noise({ d: .075, f: 760, to: 260, v: v, q: 1.1 });
            tone({ f: 210, to: 110, d: .1, type: "sine", v: v * .7 }); },
  rupa:   function () { noise({ d: .09, f: 950, to: 220, v: .38, q: .8 });
            tone({ f: 280, to: 90, d: .24, type: "sine", v: .32, at: .03 }); },
  stap:   function () { noise({ d: .04, f: 2400, to: 1300, v: .34, q: 1.6 });
            tone({ f: 540, to: 260, d: .07, type: "triangle", v: .28 }); },
  /* pikado */
  strelica: function () { noise({ d: .06, f: 1600, to: 380, v: .4, q: 1.4 });
            tone({ f: 340, to: 150, d: .11, type: "triangle", v: .24 }); },
  mimo:   function () { noise({ d: .12, f: 420, to: 160, v: .3, q: .7 }); }
};
window.SFX = SFX;

/* ---------- izgovor (engleski) — „treble twenty“, „foul“, „game shot“ ---------- */
var GKEY = "igre.glas";
var glasOn = true;
try { var gv = localStorage.getItem(GKEY); if (gv !== null) glasOn = gv === "1"; } catch (e) { }
var izabranGlas = null, glasTrazen = false;
function nadjiGlas() {
  if (!window.speechSynthesis) return null;
  if (izabranGlas) return izabranGlas;
  var lista = [];
  try { lista = window.speechSynthesis.getVoices() || []; } catch (e) { }
  var redom = ["en-gb", "en-us", "en-au", "en-ie", "en"];
  for (var i = 0; i < redom.length; i++)
    for (var j = 0; j < lista.length; j++)
      if ((lista[j].lang || "").toLowerCase().replace("_", "-").indexOf(redom[i]) === 0) {
        izabranGlas = lista[j]; return izabranGlas;
      }
  return null;
}
if (window.speechSynthesis && !glasTrazen) {
  glasTrazen = true;
  try { window.speechSynthesis.addEventListener("voiceschanged", function () { izabranGlas = null; nadjiGlas(); }); } catch (e) { }
  setTimeout(nadjiGlas, 300);
}
var GLAS = {
  _primljen: false,
  moze: function () { return !!window.speechSynthesis; },
  isOn: function () { return glasOn && on && !!window.speechSynthesis; },
  set: function (x) {
    glasOn = !!x;
    try { localStorage.setItem(GKEY, glasOn ? "1" : "0"); } catch (e) { }
    if (!glasOn) GLAS.stani(); else GLAS.reci("Voice on");
    paintGlas();
    return glasOn;
  },
  toggle: function () { return GLAS.set(!glasOn); },
  stani: function () { try { window.speechSynthesis && window.speechSynthesis.cancel(); } catch (e) { } },
  reci: function (tekst, o) {
    if (!tekst || !GLAS.isOn()) return;
    o = o || {};
    var S = window.speechSynthesis;
    function spremi() {
      var u = new SpeechSynthesisUtterance(String(tekst));
      var v = nadjiGlas();
      if (v) { u.voice = v; u.lang = v.lang; } else u.lang = "en-GB";
      u.rate = o.rate || 1.02;
      u.pitch = o.pitch || 1;
      u.volume = o.volume == null ? 1 : o.volume;
      return u;
    }
    function kreni(drugiPut) {
      try {
        var u = spremi(), poceo = false;
        u.onstart = function () { poceo = true; GLAS._radi = true; };
        u.onerror = function () { poceo = true; };
        S.speak(u);
        clearTimeout(cuvar);
        if (!drugiPut) cuvar = setTimeout(function () {   // iOS ume da progura izgovor u prazno
          if (poceo || !GLAS.isOn()) return;
          try { S.cancel(); } catch (e) { }
          setTimeout(function () { kreni(true); }, 60);
        }, 320);
      } catch (e) { }
    }
    try {
      if (S.paused && S.resume) S.resume();          // zaglavljen red se odglavi
      if (o.prekini !== false && (S.speaking || S.pending)) {
        S.cancel();
        clearTimeout(cekaj);
        cekaj = setTimeout(function () { kreni(false); }, 90);   // posle prekida treba trenutak
      } else kreni(false);
    } catch (e) { }
  },
  proba: function () {
    glasOn = true;
    try { localStorage.setItem(GKEY, "1"); } catch (e) { }
    on = true;
    try { localStorage.setItem(SKEY, "1"); } catch (e) { }
    paintGlas(); paintBtn();
    GLAS._radi = false;
    GLAS.reci("Treble twenty. One hundred and eighty!", { rate: 1 });
    var lista = [];
    try { lista = window.speechSynthesis ? (window.speechSynthesis.getVoices() || []) : []; } catch (e) { }
    var v = nadjiGlas();
    return {
      moze: !!window.speechSynthesis,
      ukljucen: GLAS.isOn(),
      glasova: lista.length,
      izabran: v ? (v.name + " (" + v.lang + ")") : "podrazumevani glas telefona"
    };
  }
};
var cuvar = null, cekaj = null;
function paintGlas() {
  var b = document.getElementById("glasToggle");
  if (!b) return;
  b.textContent = glasOn ? "🗣 Najava" : "🤐 Bez najave";
  b.disabled = !window.speechSynthesis;
  b.title = window.speechSynthesis
    ? "Izgovara šta si pogodio, na engleskom"
    : "Ovaj pregledač ne ume da govori";
}
GLAS.paint = paintGlas;
window.GLAS = GLAS;

/* brojevi rečima, za najavu */
var JEDNO = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten",
  "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
var DESET = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];
function recima(n) {
  n = Math.round(n);
  if (n < 0) return "minus " + recima(-n);
  if (n < 20) return JEDNO[n];
  if (n < 100) return DESET[Math.floor(n / 10)] + (n % 10 ? "-" + JEDNO[n % 10] : "");
  var st = Math.floor(n / 100), os = n % 100;
  return JEDNO[st] + " hundred" + (os ? " and " + recima(os) : "");
}
window.RECIMA = recima;

window.IGRE = GAMES;

/* ---------- donja traka ---------- */
var CSS =
'.gamenav{position:fixed;left:0;right:0;bottom:0;z-index:60;display:grid;' +
'grid-template-columns:repeat(' + (GAMES.length + 1) + ',1fr);align-items:stretch;' +
'background:var(--panel);border-top:1px solid var(--line);' +
'padding-bottom:env(safe-area-inset-bottom, 0px);box-shadow:0 -4px 18px rgba(0,0,0,.22)}' +
'.gamenav a,.gamenav button{display:flex;flex-direction:column;align-items:center;justify-content:center;' +
'gap:1px;padding:5px 1px;background:transparent;border:0;border-radius:0;color:var(--ink-dim);' +
'text-decoration:none;font:inherit;cursor:pointer;touch-action:manipulation;min-height:46px}' +
'.gamenav .e{font-size:19px;line-height:1.05}' +
'.gamenav .t{font-size:9px;letter-spacing:0;white-space:nowrap;overflow:hidden;max-width:100%;text-overflow:clip}' +
'@media (max-width:460px){.gamenav .t{display:none}.gamenav .e{font-size:20px}.gamenav a,.gamenav button{min-height:42px;padding:6px 0}}' +
'.gamenav a.on{color:var(--gold);box-shadow:inset 0 2px 0 var(--gold);' +
'background:color-mix(in srgb, var(--gold) 9%, transparent)}' +
'.gamenav button.off{opacity:.6}' +
'.gamenav a:active,.gamenav button:active{transform:none;background:color-mix(in srgb, var(--ink) 8%, transparent)}' +
'.homeBtn{display:inline-flex;align-items:center;justify-content:center;gap:4px;' +
'font:inherit;font-size:15px;color:var(--ink);background:var(--panel);border:1px solid var(--line);' +
'border-radius:10px;padding:6px 10px;text-decoration:none;cursor:pointer;touch-action:manipulation;line-height:1.2;' +
'position:relative;z-index:60}' +
'.homeBtn:active{transform:translateY(1px)}' +
/* Zaglavlje mora da stane u jedan red — inače naslov gura tablu sa ekrana. */
'header button,header .homeBtn,header .zvukBtn{white-space:nowrap;flex:0 0 auto}' +
'header>div:first-child{min-width:0}' +
'header h1,header .sub{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
'@media (max-width:360px){.zvukBtn,.homeBtn{padding:5px 7px;font-size:14px}}' +
'.zvukBtn{display:inline-flex;align-items:center;justify-content:center;' +
'font:inherit;font-size:15px;color:var(--ink);background:var(--panel);border:1px solid var(--line);' +
'border-radius:10px;padding:6px 10px;cursor:pointer;touch-action:manipulation;line-height:1.2;' +
'position:relative;z-index:60}' +
'.zvukBtn.nemo{color:var(--bad,#d65a4e);border-color:var(--bad,#d65a4e)}' +
'.zvukBtn:active{transform:translateY(1px)}' +
'@media (max-height:600px){.zvukBtn{padding:4px 8px;font-size:13px}}' +
'.zvukPoruka{position:fixed;left:10px;right:10px;margin:0 auto;max-width:360px;z-index:95;' +
'bottom:calc(var(--navh,52px) + env(safe-area-inset-bottom,0px) + 14px);' +
'background:var(--panel,#16223a);color:var(--ink,#eef2f9);' +
'border:1px solid var(--gold,#c9a227);border-radius:12px;padding:10px 14px;font-size:13px;line-height:1.45;' +
'box-shadow:0 10px 28px rgba(0,0,0,.5);text-align:center;transition:opacity .5s;cursor:pointer}' +
'.zvukPoruka.van{opacity:0}' +
'@media (hover:hover){.homeBtn:hover{border-color:var(--gold)}}' +
'@media (max-height:600px){.homeBtn{padding:4px 8px;font-size:13px}}' +
/* iPhone sam uveća stranicu kad tapneš u polje sa slovom manjim od 16 px, i ne vrati je
   nazad — zato su sva polja bar 16 px. touch-action gasi i uvećavanje na dvostruki tap. */
'input,textarea,select{font-size:16px !important}' +
'.imeSloj{position:fixed;inset:0;z-index:90;display:flex;align-items:center;justify-content:center;' +
'background:rgba(6,11,22,.72);backdrop-filter:blur(3px);padding:18px}' +
'.imeBox{background:var(--panel,#16223a);border:1px solid var(--line,#283a5e);border-radius:16px;' +
'padding:16px;max-width:320px;width:100%;box-shadow:0 12px 30px rgba(0,0,0,.5);text-align:center}' +
'.imeBox h3{margin:0 0 6px;font-size:17px;color:var(--ink,#eef2f9)}' +
'.imeBox p{margin:0 0 10px;font-size:12px;color:var(--ink-dim,#9fb0cc)}' +
'.imeBox input{width:100%;padding:10px;border-radius:10px;border:1px solid var(--line,#283a5e);' +
'background:var(--panel-2,#1b2a4a);color:var(--ink,#eef2f9);text-align:center;font-weight:700}' +
'.imeBtns{display:flex;gap:8px;justify-content:center;margin-top:10px}' +
'.imeBtns button{padding:8px 14px;border-radius:10px;border:1px solid var(--line,#283a5e);' +
'background:var(--panel,#16223a);color:var(--ink,#eef2f9);font:inherit;cursor:pointer}' +
'.imeBtns #imeOk{border-color:var(--gold,#c9a227);color:var(--gold,#c9a227);font-weight:700}' +
'html,body{touch-action:manipulation;-webkit-text-size-adjust:100%;text-size-adjust:100%}' +
':root{--navh:52px;--sat:env(safe-area-inset-top, 0px)}' +
'html,body{height:auto !important}' +
/* spiskovi se skroluju: jastuk racuna i visinu trake i sigurnu zonu, pa dno ostaje
   dohvatljivo i ako merenje trake omane (iPhone ume da javi manju visinu) */
'body.duga-strana{padding-bottom:0 !important}' +
'body.duga-strana .wrap{padding-bottom:calc(var(--navh, 52px) + env(safe-area-inset-bottom, 0px) + 40px) !important}' +
'body{padding-bottom:calc(var(--navh) + 4px) !important}' +
'.wrap{min-height:calc(100dvh - var(--navh) - var(--sat) - 4px) !important}' +
'@media (orientation:landscape) and (max-height:620px){' +
':root{--navh:38px}.gamenav .t{display:none}.gamenav .e{font-size:17px}.gamenav a,.gamenav button{min-height:34px}}' +
/* pravila igre — isti prozorčić u svakoj igri */
'.uputBtn{display:inline-flex;align-items:center;justify-content:center;' +
'font:inherit;font-size:15px;color:var(--ink);background:var(--panel);border:1px solid var(--line);' +
'border-radius:10px;padding:6px 10px;cursor:pointer;touch-action:manipulation;line-height:1.2;' +
'position:relative;z-index:60}' +
'.uputBtn:active{transform:translateY(1px)}' +
'@media (hover:hover){.uputBtn:hover{border-color:var(--gold)}}' +
'@media (max-width:360px){.uputBtn{padding:5px 7px;font-size:14px}}' +
'@media (max-height:600px){.uputBtn{padding:4px 8px;font-size:13px}}' +
'header button,header .homeBtn,header .zvukBtn,header .uputBtn{white-space:nowrap;flex:0 0 auto}' +
'.pravilaSloj{position:fixed;inset:0;z-index:120;display:flex;align-items:center;justify-content:center;' +
'background:rgba(6,11,22,.74);backdrop-filter:blur(3px);padding:14px}' +
'.pravilaBox{background:var(--panel,#16223a);border:1px solid var(--line,#283a5e);border-radius:16px;' +
'padding:14px 16px;max-width:420px;width:100%;max-height:82vh;overflow:auto;-webkit-overflow-scrolling:touch;' +
'box-shadow:0 12px 30px rgba(0,0,0,.55);color:var(--ink,#eef2f9)}' +
'.pravilaBox h3{margin:0 0 8px;font-size:17px}' +
'.pravilaBox ul{margin:0;padding-left:20px;font-size:14px;line-height:1.55;color:var(--ink-dim,#9fb0cc)}' +
'.pravilaBox li{margin-bottom:7px}' +
'.pravilaBox li b{color:var(--ink,#eef2f9)}' +
'.pravilaBtns{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin-top:12px}' +
'.pravilaBtns button,.pravilaBtns a{padding:8px 14px;border-radius:10px;border:1px solid var(--line,#283a5e);' +
'background:var(--panel-2,#1b2a4a);color:var(--ink,#eef2f9);font:inherit;font-size:14px;cursor:pointer;text-decoration:none}' +
'.pravilaBtns #pravZatvori{border-color:var(--gold,#c9a227);color:var(--gold,#c9a227);font-weight:700}';

/* Kratka lestvica koja se ne može promašiti — služi da korisnik čuje da zvuk radi. */
SFX.proba = function () {
  on = true;
  try { localStorage.setItem(SKEY, "1"); } catch (e) { }
  otkljucan = false;
  otkljucaj();
  var c = engine();
  [660, 880, 1175].forEach(function (f, i) {
    tone({ f: f, d: .18, type: "triangle", v: .5, at: i * .13 });
  });
  noise({ d: .1, f: 2000, v: .3, at: .4, q: .8 });
  paintBtn();
  return SFX.stanje();
};
SFX.stanje = function () {
  return {
    ukljucen: on,
    kanal: ctx ? ctx.state : "nije otvoren",
    webaudio: !!(window.AudioContext || window.webkitAudioContext),
    govor: !!window.speechSynthesis
  };
};

/* kratka poruka preko ekrana, da korisnik zna šta se desilo */
function poruciNaEkranu(html) {
  var stari = document.querySelector(".zvukPoruka");
  if (stari) stari.remove();
  var d = document.createElement("div");
  d.className = "zvukPoruka";
  d.innerHTML = html;
  document.body.appendChild(d);
  setTimeout(function () { d.classList.add("van"); }, 4200);
  setTimeout(function () { if (d.parentNode) d.remove(); }, 4800);
  d.addEventListener("click", function () { d.remove(); });
}
SFX.poruka = poruciNaEkranu;

function paintBtn() {
  var b = document.getElementById("sndBtn");
  if (!b) return;
  b.querySelector(".e").textContent = on ? "🔊" : "🔇";
  b.querySelector(".t").textContent = on ? "Zvuk" : "Nemo";
  b.classList.toggle("off", !on);
  b.setAttribute("aria-pressed", on ? "true" : "false");
  b.title = on ? "Isključi zvuk" : "Uključi zvuk";
  paintZvukBtn();
}
function paintZvukBtn() {
  var lista = document.querySelectorAll(".zvukBtn");
  for (var i = 0; i < lista.length; i++) {
    lista[i].textContent = on ? "🔊" : "🔇";
    lista[i].title = on ? "Zvuk je uključen — dodirni da utišaš" : "Zvuk je isključen — dodirni da uključiš";
    lista[i].classList.toggle("nemo", !on);
  }
}
/* jedno dugme za zvuk radi svuda isto: pali, proba i kaže šta je zatekao */
function prekidacZvuka() {
  if (on) {
    SFX.set(false);
    poruciNaEkranu("🔇 <b>Zvuk isključen.</b>");
    return;
  }
  var st = SFX.proba();
  if (!st.webaudio) return poruciNaEkranu("⚠️ Ovaj pregledač ne ume da pušta zvuk.");
  poruciNaEkranu("🔊 <b>Zvuk uključen</b> — čuo si tri tona?<br>" +
    "Ako nisi: pojačaj dugmićima sa strane i proveri <b>mali prekidač iznad njih</b> " +
    "(kad je na crveno, telefon ćuti).");
}
SFX.prekidac = prekidacZvuka;

function measure() {                      // stvarna visina trake → --navh (safe-area je već u njoj)
  var nav = document.querySelector(".gamenav");
  if (!nav) return;
  var h = Math.ceil(nav.getBoundingClientRect().height);
  if (h > 0) document.documentElement.style.setProperty("--navh", h + "px");
}
/* iOS ume da doda sigurnu zonu tek posle prvog crtanja — zato merimo i kasnije,
   i pratimo svaku promenu visine trake, da dno strane nikad ne ostane ispod nje */
function pratiTraku() {
  var nav = document.querySelector(".gamenav");
  if (!nav) return;
  if (window.ResizeObserver) {
    try { new ResizeObserver(measure).observe(nav); } catch (e) { }
  }
  [60, 250, 800, 2000].forEach(function (ms) { setTimeout(measure, ms); });
  window.addEventListener("load", measure);
  window.addEventListener("pageshow", measure);
  document.addEventListener("visibilitychange", function () { if (!document.hidden) setTimeout(measure, 60); });
  if (window.visualViewport) window.visualViewport.addEventListener("resize", measure);
}

/* ---------- pravila svake igre (dugme ❔ u zaglavlju) ----------
   Kratko uputstvo baš za igru koja je otvorena; opšta pomoć (soba, offline)
   ostaje na pomoc.html, a odavde do nje vodi dugme. */
var PRAVILA = {
  sudoku: ["🔢 Sudoku", [
    "U svakom <b>redu</b>, svakoj <b>koloni</b> i svakom <b>kvadratu 3×3</b> stoje cifre od 1 do 9, svaka tačno jednom.",
    "Tapni polje pa cifru ispod table. <b>⌫</b> briše, <b>↶</b> vraća potez.",
    "<b>✎ Beleške</b> — cifre se upisuju sitno, kao podsetnik šta sve može u to polje.",
    "<b>💡 Savet</b> popunjava jedno polje umesto tebe; broj grešaka se broji.",
    "Težina se bira gore levo; nova zagonetka uvek ima tačno jedno rešenje."
  ]],
  solitaire: ["🎴 Soliter (Klondike)", [
    "Cilj: sva četiri <b>temelja</b> gore desno složiti od keca do kralja, po bojama.",
    "U kolonama se slaže <b>naniže i naizmenično crveno-crno</b>; prazna kolona prima samo kralja.",
    "Tapni kartu pa je tapni <b>drugi put</b> — sama nađe gde može. Ili tapni kartu pa odredište.",
    "<b>Vuci 1 / Vuci 3</b> gore levo: koliko karata izlazi sa špila. U „Vuci 1“ se na otpadu vidi jedna karta, u „Vuci 3“ tri.",
    "<b>💡 Potez</b> nalazi potez, <b>↶ Poništi</b> vraća, <b>⏫ Završi</b> sam slaže kad su sve karte otvorene, <b>⟲ Isti špil</b> deli isto deljenje ispočetka."
  ]],
  kolona: ["🚧 Kolona", [
    "Stojiš u koloni na prelazu i biraš traku. Cilj je <b>proći za što manje minuta</b>.",
    "Svaki tap na <b>⏳ sačekaj minut</b> je jedan minut. Rampa obrađuje: 🚗 1′ · 🚐 2′ · 🚌 3′ · 🚚 4′, a 🔍 pregled dodaje +3′.",
    "<b>⬅ levo</b> i <b>desno ➡</b> menjaju traku — ali staješ <b>na kraj</b> nove trake.",
    "I drugi vozači menjaju trake, pa procena nije uvek tačna: rizik je deo igre.",
    "<b>📅 Dnevna kolona</b> je ista za sve tog dana — rezultat se poredi; <b>🎲 Slobodna igra</b> je nasumična."
  ]],
  aparat: ["🎰 Aparat", [
    "Krediti su <b>virtuelni</b> i ništa ne vrede. Kad ih potrošiš, <b>＋100</b> ih vrati, a <b>⟲</b> te vrati na početnih 100.",
    "<b>🃏 Poker:</b> uzmeš pet karata, tapneš one koje <b>zadržavaš</b>, pa DELI još jednom. Isplata piše ispod: par (J+) 1× … rojal 250×.",
    "<b>🍒 Voćkice:</b> pet linija (tri reda i dve dijagonale). Tri ista na liniji plaćaju po tabeli, ulog je po liniji.",
    "Posle dobitka ide <b>duplanje</b>: pogodiš boju — duplo, promašiš — nema ništa. Možeš i odmah da naplatiš.",
    "Ulog se bira dugmićima iznad; statistika ispod pamti kako ti ide."
  ]],
  svercer: ["🚬 Švercer", [
    "Pet tura. U svakoj natovariš <b>gepek od 8 mesta</b> i voziš kroz <b>tri punkta</b>.",
    "Vrednija roba nosi <b>veći rizik pregleda</b>. Na punktu vidiš raspoloženje carinika i još uvek smeš da baciš robu kroz prozor.",
    "Posle svakog prođenog punkta biraš: <b>prodaj tu</b> (×1,5 pa ×2) ili <b>teraj do pijace</b> (×3).",
    "Padneš li na pregledu — <b>sve ti uzmu</b> za tu turu. Zato se zna kad je dosta.",
    "<b>📅 Dnevna sezona</b> je ista za sve tog dana; na kraju se rezultat poredi sa „savršenim švercerom“."
  ]],
  tetris: ["🧱 Tetris", [
    "Slažeš kockice tako da <b>popuniš ceo red</b> — pun red nestaje i nosi bodove.",
    "Dugmad ispod: <b>◀ ▶</b> pomeraju, <b>⟳</b> okreće, <b>▼</b> spušta brže, <b>⤓</b> tresne do dna.",
    "<b>↹ sačuvaj</b> odloži komad za kasnije. Sa strane se vidi šta sledi.",
    "Više redova odjednom nosi više bodova; sa nivoom komadi padaju brže.",
    "Igra se pamti posle svakog spuštenog komada — <b>▶ Nastavi</b> te vraća gde si stao."
  ]],
  avioni: ["✈️ Avioni", [
    "Prevlačiš prstom po ekranu da voziš avion; <b>puca sam</b>, ne moraš da držiš dugme.",
    "Pokupi <b>nadogradnje oružja</b> koje padaju — topovi, laser, rakete, fazer; isto oružje dvaput je jače.",
    "<b>☢️ nuklearka</b> čisti ceo ekran — jednom po nivou, kad zagusti.",
    "Svaki nivo se završava <b>bosom</b>; on ima svoj obrazac napada, uči se izbegavanje.",
    "<b>⏸</b> pauzira. Nivo, poeni, životi i oružje se pamte — <b>▶ Nastavi</b> vraća partiju."
  ]],
  cigle: ["🕹️ Cigle", [
    "<b>Prevlači prstom</b> ispod palice da je pomeriš, tapni da ispališ lopticu.",
    "Cigle: <b>zelena</b> puca iz prve, <b>žuta</b> traži dva, <b>crvena</b> tri udarca; <b>siva čelična</b> se ne razbija.",
    "Bonusi padaju: 🟦 šira palica, ⬤ tri loptice, 🐢 sporije, 🔫 pištolj, ❤️ život.",
    "Ugao odbijanja zavisi od toga <b>gde loptica pogodi palicu</b> — tako biraš smer.",
    "<b>🏁 Trka u dvoje</b> — isti nivo na dva telefona preko sobe, gleda se ko brže odmakne."
  ]],
  stvorenja: ["🐉 Bića", [
    "Šetaj mapom strelicama i ulazi u <b>🍀 travu</b> — tamo iskaču divlja stvorenja.",
    "U borbi ih prvo <b>oslabi</b>, pa baci <b>🔮 loptu</b> da ih uhvatiš. Tim ide do šest.",
    "Tipovi: 🔥 tuče 🌿, 🌿 tuče 💧, 💧 tuče 🔥 — u prednosti je <b>dvostruka šteta</b>.",
    "Na nivou 12 se većina <b>razvija</b>. Kod <b>💚 vidara</b> se lečiš, a cilj su <b>🏛️ tri arene</b>.",
    "<b>👥</b> pokazuje tim i statistiku, <b>⟲</b> počinje sasvim novu igru."
  ]],
  tablic: ["🃏 Tablić", [
    "Kartom iz ruke <b>uzimaš</b> karte sa stola: ili istu vrednost, ili više karata čiji je <b>zbir</b> jednak tvojoj.",
    "<b>Kec vredi 1 ili 11</b> — kecom se uzimaju i 8 i 3 zajedno, i sam kec sa stola.",
    "Ako ne uzimaš, karta se <b>odlaže</b> na sto. Ko pokupi sve sa stola ima <b>tablu</b>.",
    "Poeni na kraju: karo 10 i tref 2 posebno, kečevi, pa bod onome ko ima <b>više karata</b>.",
    "U sobi se igra <b>udvoje</b>, uz 💬 poruke protivniku."
  ]],
  jamb: ["🎲 Jamb", [
    "Bacaš pet kocki, do <b>tri puta</b> po potezu; između bacanja zadržavaš koje hoćeš.",
    "Rezultat upisuješ u polje po kolonama: <b>naniže</b>, <b>naviše</b>, <b>slobodno</b> i <b>najava</b>.",
    "<b>Najava</b> se kaže posle prvog bacanja i mora se ispuniti baš to polje — nosi najviše.",
    "Gore idu jedinice do šestica (dovoljan zbir nosi bonus), dole kenta, ful, poker i jamb.",
    "U sobi igraju do <b>četiri igrača</b>, svako na svom telefonu; ima i dugme za poruke."
  ]],
  geo: ["🌍 Geo", [
    "Kviz iz geografije: zastave, glavni gradovi, reke, mora, planine, granice.",
    "<b>Vežbanje</b> je samo za tebe i pamti dokle si stigao; <b>kviz u sobi</b> ide na vreme, do četvoro igrača.",
    "Posle svakog pitanja piše šta je tačno — i zašto, kad je zeznuto.",
    "Oblasti i broj pitanja biraju se na početnom ekranu.",
    "U sobi svi vide isto pitanje u isto vreme i tabelu posle svakog kruga."
  ]],
  pikado: ["🎯 Pikado", [
    "Igra se <b>501</b>, oduzima se, a izlazi se <b>na duplo</b>.",
    "Nišan se pomera <b>prevlačenjem prsta</b>, a strelica ide <b>tapom</b>. Ruka se ljulja — zato se cilja mirno i kratko.",
    "Ako je uključen žiroskop, nagib telefona pomera nišan; može i bez njega, samo prstom.",
    "U sobi svi imaju <b>istu mirnoću ruke</b> i po <b>10 sekundi</b> na strelicu.",
    "Na kraju lega ide <b>statistika</b>: prosek za tri strelice, najbolji krug, koliko trostrukih dvadesetica i bulova. Pod <b>⚙︎</b> se pali glasovna najava."
  ]],
  bilijar: ["🎱 Bilijar", [
    "<b>Osmica</b> ili <b>snuker</b>, protiv računara (tri težine) ili udvoje u sobi.",
    "Smer se bira <b>prevlačenjem</b>, jačina klizačem, a na kugli se prstom namešta <b>felš</b> — gore/dole i levo/desno.",
    "Felš menja belu posle udara: donji je vraća nazad, gornji je gura napred, bočni je skreće.",
    "U osmici prvo svoje kugle (pune ili polupune), pa <b>osmica na kraju</b>.",
    "U snukeru ide crvena pa boja; posle poslednje crvene boje idu <b>redom</b>. Faul poklanja poene protivniku. U meniju pod <b>🔈</b> se pali najava šta je palo."
  ]],
  teren: ["🟩 Teren", [
    "Izađi iz svoje boje, napravi krug i vrati se na svoje — <b>sve unutar kruga postaje tvoje</b>.",
    "Dok si napolju, za tobom stoji <b>trag</b>: ko ga pregazi, gotov si. Tako i ti obaraš protivnika — preseci njegov trag.",
    "Smer se menja <b>prevlačenjem prsta</b> po tabli ili tipkama ispod; unazad se ne može. Na ivici table se <b>staje</b>, ne gine — ali sopstveni trag ubija.",
    "Tabla je <b>mnogo veća od ekrana</b> — ekran prati tvoju glavu, a cela tabla i svi igrači se vide na <b>mapici u desnom uglu</b>.",
    "Po tabli su <b>skriveni dragulji</b>: vide se tek kad im priđeš. 🛡 štit — deset sekundi te niko ne može oboriti · ⚡ brzina · ❄ led (protivnici uspore) · 💎 parče terena odmah.",
    "Cilj se bira: <b>25, 40, 50 ili 60%</b> table. Ko prvi stigne — pobedio je.",
    "<b>🌐 Igra u sobi</b> — do <b>četiri igrača</b> na istoj tabli, svako na svom telefonu; ko izgubi teren, vraća se na novo mesto i partija ide dalje."
  ]],
  kuca: ["🛋 Kuća", [
    "Nameštaj se <b>prevlači</b> u sobu koja mu odgovara — kuhinja, spavaća, dnevna, kupatilo.",
    "Tapni komad pa ga okreni dugmetom <b>⟳</b>, a veličinu menjaj sa <b>⬌</b> i <b>⬍</b>.",
    "Komadi se lepe za mrežu i <b>naslanjaju leđima na zid</b> kad im je tu mesto — krevet, orman, sudopera.",
    "<b>Slagalica</b> ima zadatak i proverava se, a u <b>slobodnom uređivanju</b> radiš šta hoćeš i sve se pamti.",
    "<b>🏠 Drugi plan</b> daje novi raspored soba."
  ]]
};

function pravilaZa(ime) { return PRAVILA[ime] || null; }

function pokaziPravila(ime) {
  var pr = pravilaZa(ime);
  if (!pr) return;
  var stari = document.querySelector(".pravilaSloj");
  if (stari) stari.remove();
  var sloj = document.createElement("div");
  sloj.className = "pravilaSloj";
  var stavke = "";
  for (var i = 0; i < pr[1].length; i++) stavke += "<li>" + pr[1][i] + "</li>";
  sloj.innerHTML = '<div class="pravilaBox" role="dialog" aria-modal="true">' +
    "<h3>❔ " + pr[0] + " — pravila</h3><ul>" + stavke + "</ul>" +
    '<div class="pravilaBtns"><button type="button" id="pravZatvori">Nastavi igru</button>' +
    '<a href="pomoc.html?od=' + ime + '.html">❔ Opšta pomoć</a></div></div>';
  document.body.appendChild(sloj);
  var zatvori = function () { sloj.remove(); };
  sloj.querySelector("#pravZatvori").addEventListener("click", zatvori);
  sloj.addEventListener("click", function (e) { if (e.target === sloj) zatvori(); });
  document.addEventListener("keydown", function beg(e) {
    if (e.key === "Escape") { zatvori(); document.removeEventListener("keydown", beg); }
  });
}

/* svaka veza ka opštoj pomoći nosi ime igre, da pomoć zna kuda da vrati */
function obeleziPomoc(ime) {
  var veze = document.querySelectorAll('a[href="pomoc.html"]');
  for (var i = 0; i < veze.length; i++) veze[i].href = "pomoc.html?od=" + ime + ".html";
}

function build() {
  if (document.querySelector(".gamenav")) return;
  var st = document.createElement("style");
  st.textContent = CSS;
  document.head.appendChild(st);

  var here = (location.pathname.split("/").pop() || "").toLowerCase();
  if (here === "igre.html" || here === "pomoc.html" || here === "")
    document.body.classList.add("duga-strana");        // spiskovi se skroluju, pa im treba jastuk na dnu
  var nav = document.createElement("nav");
  nav.className = "gamenav";
  nav.setAttribute("aria-label", "Izbor igre");
  var h = "";
  for (var i = 0; i < GAMES.length; i++) {
    var g = GAMES[i], act = here === g.href ? " on" : "";
    h += '<a class="' + act.trim() + '" href="' + g.href + '" title="' + g.nm + '">' +
      '<span class="e">' + g.em + '</span><span class="t">' + g.nm + '</span></a>';
  }
  h += '<button id="sndBtn" type="button"><span class="e">🔊</span><span class="t">Zvuk</span></button>';
  nav.innerHTML = h;
  document.body.appendChild(nav);
  if (here !== "igre.html" && here !== "") {          // kućica i zvuk u zaglavlju svake igre
    var thm = document.querySelector("header #theme") || document.querySelector("header button:last-of-type");
    if (thm && thm.parentNode) {
      var imeIgre = here.replace(/\.html$/, "");
      if (pravilaZa(imeIgre) && !document.querySelector(".uputBtn")) {
        var pb = document.createElement("button");
        pb.type = "button"; pb.className = "uputBtn"; pb.textContent = "❔";
        pb.title = "Pravila igre";
        pb.addEventListener("click", function () { pokaziPravila(imeIgre); });
        thm.parentNode.insertBefore(pb, thm);
      }
      if (!document.querySelector(".zvukBtn")) {
        var zb = document.createElement("button");
        zb.type = "button"; zb.className = "zvukBtn"; zb.textContent = "🔊";
        zb.addEventListener("click", prekidacZvuka);
        thm.parentNode.insertBefore(zb, thm);
      }
      if (!document.querySelector(".homeBtn")) {
        var hb = document.createElement("a");
        hb.className = "homeBtn"; hb.href = "igre.html"; hb.title = "Sve igre"; hb.textContent = "🏠";
        thm.parentNode.insertBefore(hb, thm);
      }
    }
  }
  if (here !== "igre.html" && here !== "pomoc.html" && here !== "")
    obeleziPomoc(here.replace(/\.html$/, ""));
  document.getElementById("sndBtn").addEventListener("click", prekidacZvuka);
  paintBtn();
  paintIme();
  measure();
  pratiTraku();
  window.addEventListener("resize", measure);
  window.addEventListener("orientationchange", function () { setTimeout(measure, 120); });

  // prvi dodir budi audio (politika pregledača)
  var wake = function () { engine(); document.removeEventListener("pointerdown", wake); };
  document.addEventListener("pointerdown", wake);
}

window.PRAVILA_IGRE = { spisak: PRAVILA, pokazi: pokaziPravila };

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", build);
else build();

/* ---------- offline: service worker ---------- */
(function () {
  if (!("serviceWorker" in navigator)) return;
  var ok = location.protocol === "https:" || location.hostname === "localhost" || location.hostname === "127.0.0.1";
  if (!ok) return;                                   // sa file:// SW ne radi — tada je stranica ionako lokalna

  var hadController = !!navigator.serviceWorker.controller;
  var reloading = false;
  function osveziJednom(oznaka) {
    if (reloading) return;
    try {
      var k = "igre.reload." + oznaka;
      if (sessionStorage.getItem(k)) return;          // zaštita od petlje
      sessionStorage.setItem(k, "1");
    } catch (e) { }
    reloading = true;
    location.reload();
  }
  navigator.serviceWorker.addEventListener("message", function (e) {
    if (e.data && e.data.type === "sw-activated") osveziJednom(e.data.version);
  });
  navigator.serviceWorker.addEventListener("controllerchange", function () {
    if (!hadController) return;                       // prva instalacija ne traži osvežavanje
    osveziJednom("ctrl");
  });

  var lastCheck = 0;
  function proveri(reg) {
    var now = Date.now();
    if (now - lastCheck < 4000) return;
    lastCheck = now;
    reg.update().catch(function () { });
  }

  function reg() {
    navigator.serviceWorker.register("sw.js").then(function (r) {
      window.__swReg = r;
      proveri(r);                                     // odmah pitaj ima li nove verzije
      document.addEventListener("visibilitychange", function () {
        if (!document.hidden) proveri(r);             // i svaki put kad se aplikacija vrati u prvi plan
      });
      window.addEventListener("focus", function () { proveri(r); });
      setInterval(function () { proveri(r); }, 30 * 60 * 1000);
      r.addEventListener("updatefound", function () {
        var w = r.installing;
        if (!w) return;
        w.addEventListener("statechange", function () {
          if (w.state === "installed" && navigator.serviceWorker.controller) w.postMessage("skipWaiting");
        });
      });
      if (r.waiting && navigator.serviceWorker.controller) r.waiting.postMessage("skipWaiting");
    }).catch(function () { });
  }
  if (document.readyState === "complete") reg();
  else window.addEventListener("load", reg);
})();
})();
