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
  { id: "bilijar",   href: "bilijar.html",   em: "🎱", nm: "Bilijar" }
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
      master.gain.value = 0.20;
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
  try {                                          // isto i za izgovor
    if (window.speechSynthesis && !GLAS._primljen) {
      var u = new SpeechSynthesisUtterance(" ");
      u.volume = 0; window.speechSynthesis.speak(u);
      GLAS._primljen = true;
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
    try {
      if (o.prekini !== false) window.speechSynthesis.cancel();
      var u = new SpeechSynthesisUtterance(String(tekst));
      var v = nadjiGlas();
      if (v) { u.voice = v; u.lang = v.lang; } else u.lang = "en-GB";
      u.rate = o.rate || 1.02;
      u.pitch = o.pitch || 1;
      u.volume = o.volume == null ? 1 : o.volume;
      window.speechSynthesis.speak(u);
    } catch (e) { }
  }
};
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
':root{--navh:38px}.gamenav .t{display:none}.gamenav .e{font-size:17px}.gamenav a,.gamenav button{min-height:34px}}';

function paintBtn() {
  var b = document.getElementById("sndBtn");
  if (!b) return;
  b.querySelector(".e").textContent = on ? "🔊" : "🔇";
  b.querySelector(".t").textContent = on ? "Zvuk" : "Nemo";
  b.classList.toggle("off", !on);
  b.setAttribute("aria-pressed", on ? "true" : "false");
  b.title = on ? "Isključi zvuk" : "Uključi zvuk";
}

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
  if (here !== "igre.html" && here !== "") {          // dugme za povratak na spisak igara
    var thm = document.querySelector("header #theme") || document.querySelector("header button:last-of-type");
    if (thm && thm.parentNode && !document.querySelector(".homeBtn")) {
      var hb = document.createElement("a");
      hb.className = "homeBtn"; hb.href = "igre.html"; hb.title = "Sve igre"; hb.textContent = "🏠";
      thm.parentNode.insertBefore(hb, thm);
    }
  }
  document.getElementById("sndBtn").addEventListener("click", function () { SFX.toggle(); });
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
