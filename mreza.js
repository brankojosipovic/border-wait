/* mreza.js — igra u dvoje preko interneta: jedan napravi sobu i dobije kod, drugi ga ukuca.
   Veza je direktna između telefona (WebRTC); javni server služi samo da se nađu.

   Zašto ovoliko rezervi: besplatni javni serveri ume da budu zauzeti, a mobilne mreže
   (4G/5G) često ne daju direktan prolaz. Zato:
     • biblioteka se skida sa tri različita CDN-a redom,
     • domaćin se prijavi na SVE poznate servere odjednom, gost ih obilazi redom,
     • uz STUN se koristi i besplatan TURN relej, za mreže koje ne daju direktnu vezu.
   Sve se skida tek kad se izabere igra u dvoje, pa offline rad ostaje netaknut. */
(function () {
  "use strict";

  var CDN = [
    "https://cdnjs.cloudflare.com/ajax/libs/peerjs/1.5.4/peerjs.min.js",
    "https://cdn.jsdelivr.net/npm/peerjs@1.5.4/dist/peerjs.min.js",
    "https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js"
  ];

  /* serveri za upoznavanje igrača (signaling) — proba se svaki */
  var SERVERI = [
    { ime: "peerjs.com", opcije: { host: "0.peerjs.com", port: 443, path: "/", secure: true, key: "peerjs" } },
    { ime: "92k.de", opcije: { host: "peerjs.92k.de", port: 443, path: "/", secure: true, key: "peerjs" } }
  ];

  /* STUN nađe javnu adresu; TURN prenosi saobraćaj kad mreža ne da direktnu vezu */
  var LED = {
    iceServers: [
      { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302", "stun:stun.cloudflare.com:3478"] },
      {
        urls: ["turn:openrelay.metered.ca:80", "turn:openrelay.metered.ca:443", "turns:openrelay.metered.ca:443?transport=tcp"],
        username: "openrelayproject", credential: "openrelayproject"
      },
      {
        urls: ["turn:staticauth.openrelay.metered.ca:80", "turn:staticauth.openrelay.metered.ca:443"],
        username: "openrelayproject", credential: "openrelayproject"
      }
    ],
    sdpSemantics: "unified-plan",
    iceCandidatePoolSize: 2
  };

  var ROK_SERVER = 9000;      // koliko čekamo da se server javi
  var ROK_VEZA = 15000;       // koliko čekamo da se probije put do domaćina
  var AZBUKA = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";      // bez I, L, O, 0, 1 — da se ne mešaju
  var PREFIKS = "bwigre-";

  var peerovi = [], veza = null, uloga = null, kod = null, zadnjaGreska = "";
  var naPoruku = function () { }, naStatus = function () { };
  var lokalni = null;                                   // kanal za probu na istom uređaju

  function kodiraj(n) {
    var s = "";
    for (var i = 0; i < n; i++) s += AZBUKA[(Math.random() * AZBUKA.length) | 0];
    return s;
  }
  function status(st, detalj) { try { naStatus(st, detalj); } catch (e) { } }
  function ubij(p) { try { p && p.destroy(); } catch (e) { } }
  function skloni(p) {
    peerovi = peerovi.filter(function (x) { return x !== p; });
    ubij(p);
  }
  function zatvoriOstale(cuvaj) {
    peerovi.filter(function (p) { return p !== cuvaj; }).forEach(ubij);
    peerovi = cuvaj ? [cuvaj] : [];
  }
  function opcijeZa(srv) {
    var o = { debug: 0, config: LED };
    for (var k in srv.opcije) o[k] = srv.opcije[k];
    return o;
  }

  function skripta(url, rok) {
    return new Promise(function (res, rej) {
      var s = document.createElement("script");
      s.src = url; s.async = true;
      var t = setTimeout(function () { s.onload = s.onerror = null; rej(new Error("rok")); }, rok);
      s.onload = function () { clearTimeout(t); window.Peer ? res(window.Peer) : rej(new Error("prazno")); };
      s.onerror = function () { clearTimeout(t); rej(new Error("pad")); };
      document.head.appendChild(s);
    });
  }

  function ucitaj() {
    if (window.__PeerTest) return Promise.resolve(window.__PeerTest);   // za probu bez interneta
    if (window.Peer) return Promise.resolve(window.Peer);
    var i = -1;
    function sledeci() {
      i++;
      if (i >= CDN.length) return Promise.reject(new Error("Ne mogu da skinem mrežni deo — proveri internet."));
      status("spajam", "skidam mrežni deo (" + (i + 1) + "/" + CDN.length + ")");
      return skripta(CDN[i], 9000).catch(sledeci);
    }
    return sledeci();
  }

  function vezi(v) {
    veza = v;
    v.on("data", function (d) { try { naPoruku(d); } catch (e) { } });
    v.on("close", function () { status("prekinuto"); veza = null; });
    v.on("error", function () { status("prekinuto"); });
    if (v.open) status("povezan", uloga);
    else v.on("open", function () { status("povezan", uloga); });
  }

  /* ---------- domaćin: prijavi se na svaki server pod istim kodom ---------- */
  function domacinNa(Peer, srv, mojKod) {
    return new Promise(function (res, rej) {
      var p, gotov = false;
      try { p = new Peer(PREFIKS + mojKod, opcijeZa(srv)); }
      catch (e) { return rej(e); }
      var t = setTimeout(function () {
        if (gotov) return;
        gotov = true; ubij(p); rej({ type: "timeout", server: srv.ime });
      }, ROK_SERVER);
      p.on("open", function () {
        if (gotov) return;
        gotov = true; clearTimeout(t); res(p);
      });
      p.on("connection", function (v) {
        if (veza) { try { v.close(); } catch (e) { } return; }   // već imamo protivnika
        zatvoriOstale(p);
        vezi(v);
      });
      p.on("disconnected", function () { if (!p.destroyed) { try { p.reconnect(); } catch (e) { } } });
      p.on("error", function (e) {
        if (!gotov) { gotov = true; clearTimeout(t); ubij(p); if (e) e.server = srv.ime; rej(e || { type: "unknown" }); return; }
        if (e && (e.type === "unavailable-id" || e.type === "invalid-id")) skloni(p);   // taj server otpada
      });
    });
  }

  /* ---------- gost: obilazi servere dok ne nađe sobu ---------- */
  function gostNa(Peer, srv, trazeniKod) {
    return new Promise(function (res, rej) {
      var p, gotov = false, v = null;
      function kraj(ok, sta) {
        if (gotov) return;
        gotov = true; clearTimeout(t);
        if (ok) res({ peer: p, veza: sta });
        else { ubij(p); rej(sta); }
      }
      try { p = new Peer(null, opcijeZa(srv)); }
      catch (e) { return rej(e); }
      var t = setTimeout(function () { kraj(false, { type: "timeout", server: srv.ime }); }, ROK_SERVER + ROK_VEZA);
      p.on("open", function () {
        try { v = p.connect(PREFIKS + trazeniKod, { reliable: true }); }
        catch (e) { return kraj(false, e); }
        if (!v) return kraj(false, { type: "peer-unavailable", server: srv.ime });
        v.on("open", function () { kraj(true, v); });
        v.on("error", function (e) { if (e) e.server = srv.ime; kraj(false, e || { type: "unknown" }); });
      });
      p.on("error", function (e) {
        if (e) e.server = srv.ime;
        if (!gotov) return kraj(false, e || { type: "unknown" });
      });
    });
  }

  var API = {
    podrzana: function () { return typeof RTCPeerConnection !== "undefined"; },
    kod: function () { return kod; },
    uloga: function () { return uloga; },                // "domacin" | "gost"
    povezan: function () { return !!(veza && veza.open) || !!lokalni; },
    detalji: function () { return zadnjaGreska; },

    napravi: function (opcije) {
      opcije = opcije || {};
      naPoruku = opcije.poruka || naPoruku; naStatus = opcije.status || naStatus;
      uloga = "domacin"; kod = kodiraj(5); zadnjaGreska = "";
      status("spajam", "tražim server");
      return ucitaj().then(function (Peer) {
        return new Promise(function (res, rej) {
          var pokusaj = 0;
          function kreni() {
            var razreseno = false;
            peerovi = [];
            var poslovi = SERVERI.map(function (srv) {
              return domacinNa(Peer, srv, kod).then(
                function (p) {
                  peerovi.push(p);
                  if (!razreseno) { razreseno = true; status("cekam", kod); res(kod); }
                  return { ok: true };
                },
                function (e) { return { ok: false, e: e }; }
              );
            });
            Promise.all(poslovi).then(function (rez) {
              if (razreseno) return;
              var zauzet = rez.some(function (r) { return r.e && r.e.type === "unavailable-id"; });
              if (zauzet && pokusaj++ < 4) { kod = kodiraj(5); return kreni(); }
              var e = (rez.filter(function (r) { return r.e; })[0] || {}).e || { type: "unknown" };
              zadnjaGreska = opis(rez);
              status("greska", poruka(e) + zadnjaGreska);
              rej(e);
            });
          }
          kreni();
        });
      }, function (e) { status("greska", e.message || poruka(e)); throw e; });
    },

    pridruzi: function (uneti, opcije) {
      opcije = opcije || {};
      naPoruku = opcije.poruka || naPoruku; naStatus = opcije.status || naStatus;
      uloga = "gost"; kod = (uneti || "").toUpperCase().replace(/[^A-Z0-9]/g, ""); zadnjaGreska = "";
      if (kod.length < 4) return Promise.reject(new Error("Kod nije potpun."));
      status("spajam", "tražim server");
      return ucitaj().then(function (Peer) {
        var greske = [];
        function redom(i) {
          if (i >= SERVERI.length) {
            var nadjeno = greske.every(function (e) { return e && e.type === "peer-unavailable"; });
            zadnjaGreska = opis(greske.map(function (e) { return { e: e }; }));
            status("greska", (nadjeno ? "Nema sobe sa tim kodom. Proveri da li je domaćin još u sobi i da li je kod dobro ukucan."
              : poruka(greske[0])) + zadnjaGreska);
            return Promise.reject(greske[0] || new Error("neuspeh"));
          }
          status("spajam", "server " + (i + 1) + "/" + SERVERI.length + " (" + SERVERI[i].ime + ")");
          return gostNa(Peer, SERVERI[i], kod).then(function (r) {
            peerovi = [r.peer]; vezi(r.veza); return kod;
          }, function (e) {
            greske.push(e || { type: "unknown" });
            return redom(i + 1);
          });
        }
        return redom(0);
      }, function (e) { status("greska", e.message || poruka(e)); throw e; });
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
      zatvoriOstale(null);
      try { if (lokalni) lokalni.close(); } catch (e) { }
      veza = lokalni = null; uloga = null; kod = null;
      status("zatvoreno");
    }
  };

  function poruka(e) {
    var t = e && e.type;
    if (t === "network" || t === "server-error" || t === "socket-error" || t === "socket-closed" || t === "timeout")
      return "Nijedan server za spajanje se ne javlja. Probaj ponovo za koji minut ili igrajte na jednom telefonu.";
    if (t === "browser-incompatible") return "Ovaj pregledač ne podržava direktnu vezu.";
    if (t === "ssl-unavailable") return "Stranica mora biti otvorena preko https.";
    if (t === "peer-unavailable") return "Nema sobe sa tim kodom.";
    if (t === "webrtc" || t === "disconnected")
      return "Veza je pukla u toku spajanja — mreža ne da direktan prolaz. Probaj preko Wi-Fi mreže.";
    return "Spajanje nije uspelo.";
  }

  /* kratak tehnički trag, da se zna gde je puklo */
  function opis(rez) {
    var d = rez.map(function (r) {
      var e = r && r.e; if (!e) return null;
      return (e.server || "?") + ": " + (e.type || e.message || "greška");
    }).filter(Boolean).join(" · ");
    return d ? "<br><small style=\"opacity:.65\">(" + d + ")</small>" : "";
  }

  window.Mreza = API;
})();
