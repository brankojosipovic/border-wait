/* mreza.js — igra u dvoje preko interneta: jedan napravi sobu i dobije kod, drugi ga ukuca.
   Veza je direktna između telefona (WebRTC); javni PeerJS server služi samo da se nađu.
   Biblioteka se skida tek kad se izabere igra u dvoje, pa offline rad ostaje netaknut. */
(function () {
  "use strict";
  var PEERJS = "https://cdnjs.cloudflare.com/ajax/libs/peerjs/1.5.4/peerjs.min.js";
  var AZBUKA = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";      // bez I, L, O, 0, 1 — da se ne mešaju
  var PREFIKS = "bwigre-";

  var peer = null, veza = null, uloga = null, kod = null;
  var naPoruku = function () { }, naStatus = function () { };
  var lokalni = null;                                   // kanal za probu na istom uređaju

  function kodiraj(n) {
    var s = "";
    for (var i = 0; i < n; i++) s += AZBUKA[(Math.random() * AZBUKA.length) | 0];
    return s;
  }
  function status(st, detalj) { try { naStatus(st, detalj); } catch (e) { } }

  function ucitaj() {
    return new Promise(function (res, rej) {
      if (window.Peer) return res(window.Peer);
      var s = document.createElement("script");
      s.src = PEERJS; s.async = true;
      var t = setTimeout(function () { rej(new Error("Ne mogu da skinem mrežni deo — proveri internet.")); }, 12000);
      s.onload = function () { clearTimeout(t); window.Peer ? res(window.Peer) : rej(new Error("Mrežni deo se nije učitao.")); };
      s.onerror = function () { clearTimeout(t); rej(new Error("Ne mogu da skinem mrežni deo — proveri internet.")); };
      document.head.appendChild(s);
    });
  }

  function vezi(v) {
    veza = v;
    v.on("open", function () { status("povezan", uloga); });
    v.on("data", function (d) { try { naPoruku(d); } catch (e) { } });
    v.on("close", function () { status("prekinuto"); veza = null; });
    v.on("error", function () { status("prekinuto"); });
  }

  var API = {
    podrzana: function () { return typeof RTCPeerConnection !== "undefined"; },
    kod: function () { return kod; },
    uloga: function () { return uloga; },                // "domacin" | "gost"
    povezan: function () { return !!(veza && veza.open) || !!lokalni; },

    napravi: function (opcije) {
      opcije = opcije || {};
      naPoruku = opcije.poruka || naPoruku; naStatus = opcije.status || naStatus;
      uloga = "domacin"; kod = kodiraj(5);
      status("spajam");
      return ucitaj().then(function (Peer) {
        return new Promise(function (res, rej) {
          var pokusaj = 0;
          function kreni() {
            peer = new Peer(PREFIKS + kod, { debug: 0 });
            peer.on("open", function () { status("cekam", kod); res(kod); });
            peer.on("connection", function (v) { vezi(v); });
            peer.on("error", function (e) {
              if (e && e.type === "unavailable-id" && pokusaj++ < 4) { kod = kodiraj(5); try { peer.destroy(); } catch (x) { } return kreni(); }
              status("greska", poruka(e)); rej(e);
            });
          }
          kreni();
        });
      });
    },

    pridruzi: function (uneti, opcije) {
      opcije = opcije || {};
      naPoruku = opcije.poruka || naPoruku; naStatus = opcije.status || naStatus;
      uloga = "gost"; kod = (uneti || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
      if (kod.length < 4) return Promise.reject(new Error("Kod nije potpun."));
      status("spajam");
      return ucitaj().then(function (Peer) {
        return new Promise(function (res, rej) {
          peer = new Peer({ debug: 0 });
          var rok = setTimeout(function () { status("greska", "Soba se ne javlja — proveri kod."); rej(new Error("rok")); }, 20000);
          peer.on("open", function () {
            var v = peer.connect(PREFIKS + kod, { reliable: true });
            v.on("open", function () { clearTimeout(rok); vezi(v); res(kod); });
            v.on("error", function (e) { clearTimeout(rok); status("greska", poruka(e)); rej(e); });
          });
          peer.on("error", function (e) {
            clearTimeout(rok);
            var t = e && e.type;
            status("greska", t === "peer-unavailable" ? "Nema sobe sa tim kodom." : poruka(e));
            rej(e);
          });
        });
      });
    },

    /* proba na istom uređaju: dva prozora iste igre razgovaraju bez interneta */
    lokalno: function (ime, opcije) {
      opcije = opcije || {};
      naPoruku = opcije.poruka || naPoruku; naStatus = opcije.status || naStatus;
      uloga = opcije.uloga || "domacin"; kod = "LOKAL";
      lokalni = new BroadcastChannel("bwigre-" + ime);
      lokalni.onmessage = function (e) { try { naPoruku(e.data); } catch (x) { } };
      status("povezan", uloga);
      return Promise.resolve(kod);
    },

    posalji: function (obj) {
      if (lokalni) { try { lokalni.postMessage(obj); } catch (e) { } return true; }
      if (veza && veza.open) { try { veza.send(obj); return true; } catch (e) { } }
      return false;
    },

    zatvori: function () {
      try { if (veza) veza.close(); } catch (e) { }
      try { if (peer) peer.destroy(); } catch (e) { }
      try { if (lokalni) lokalni.close(); } catch (e) { }
      veza = peer = lokalni = null; uloga = null; kod = null;
      status("zatvoreno");
    }
  };

  function poruka(e) {
    var t = e && e.type;
    if (t === "network" || t === "server-error" || t === "socket-error" || t === "socket-closed")
      return "Server za spajanje trenutno ne radi. Probaj kasnije ili igrajte na jednom telefonu.";
    if (t === "browser-incompatible") return "Ovaj pregledač ne podržava direktnu vezu.";
    if (t === "peer-unavailable") return "Nema sobe sa tim kodom.";
    return "Spajanje nije uspelo.";
  }

  window.Mreza = API;
})();
