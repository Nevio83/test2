/**
 * marketing.js — Anzeige des Marketing-Dashboards.
 *
 * Eigene Datei statt Inline-Code, wie bei admin-views.js und
 * markt-insights.js: Die Sicherheitsregel des Shops erlaubt Inline-Code nur
 * ueber Fingerabdruecke (csp-inline.js), und jede Aenderung an einem
 * Inline-Block muesste dort neu berechnet werden. Eine eigene Datei wird von
 * static-guard.js automatisch freigegeben, weil marketing.html sie einbindet.
 *
 * Alle Anfragen laufen ueber same-origin fetch; die Anmeldung uebernimmt der
 * Browser (Basic Auth auf /a29715347575).
 */
(function () {
  'use strict';

  var BASIS = 'api/marketing/';

  function hole(pfad) {
    return fetch(BASIS + pfad, { credentials: 'same-origin' }).then(function (r) {
      if (!r.ok) throw new Error(pfad + ': ' + r.status);
      return r.json();
    });
  }

  function schuetze(text) {
    var d = document.createElement('div');
    d.textContent = text === null || text === undefined ? '' : String(text);
    return d.innerHTML;
  }

  function setze(id, html) {
    var el = document.getElementById(id);
    if (el) el.innerHTML = html;
  }

  function leer(text) {
    return '<div class="leer">' + schuetze(text) + '</div>';
  }

  function zeitpunkt(wert) {
    if (!wert) return '–';
    var d = new Date(wert);
    return isNaN(d) ? '–' : d.toLocaleString('de-DE', {
      day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
    });
  }

  function dauer(sekunden) {
    var s = parseInt(sekunden, 10);
    if (isNaN(s) || s <= 0) return 'jetzt fällig';
    if (s < 60) return s + ' s';
    if (s < 3600) return Math.round(s / 60) + ' Min';
    if (s < 86400) return Math.floor(s / 3600) + ' h ' + Math.round((s % 3600) / 60) + ' Min';
    return Math.floor(s / 86400) + ' T ' + Math.round((s % 86400) / 3600) + ' h';
  }

  function euro(cent) {
    var c = parseInt(cent, 10) || 0;
    return (c / 100).toFixed(2).replace('.', ',') + ' €';
  }

  // ── Überblick ──────────────────────────────────────────────────────

  function ladeUeberblick() {
    return hole('ueberblick').then(function (d) {
      if (!d.datenbank) {
        setze('hinweise', '<div class="hinweis"><strong>Keine Datenbank:</strong> ' +
          schuetze(d.grund) + '. Ohne sie kann der Automat nichts festhalten.</div>');
        setze('ueberblick', leer('Keine Daten.'));
        return;
      }
      var kacheln = [
        ['jobs_aktiv', 'Abläufe aktiv', d.jobs_aktiv + ' / ' + d.jobs_gesamt,
          d.jobs_aktiv === 0 ? 'bad' : ''],
        ['trends_woche', 'Trends (7 Tage)', d.trends_woche, ''],
        ['briefings_frei', 'Briefings frei', d.briefings_frei, ''],
        ['briefings_gesperrt', 'davon gesperrt', d.briefings_gesperrt,
          d.briefings_gesperrt > 0 ? 'warn' : ''],
        ['videos_ok', 'Videos geprüft', d.videos_ok, ''],
        ['videos_verworfen', 'Videos verworfen', d.videos_verworfen,
          d.videos_verworfen > 0 ? 'warn' : ''],
        ['geplant', 'geplant', d.geplant, ''],
        ['trockenlauf', 'im Trockenlauf', d.trockenlauf, ''],
        ['gepostet', 'veröffentlicht', d.gepostet, '']
      ];
      sendezustand.privacy = d.tiktok_privacy || null;
      setze('ueberblick', kacheln.map(function (k) {
        return '<div class="kpi"><div class="kpi-val ' + k[3] + '">' + schuetze(k[2]) +
               '</div><div class="kpi-lab">' + schuetze(k[1]) + '</div></div>';
      }).join(''));

      var warnungen = [];
      if (d.jobs_mit_fehler > 0) {
        warnungen.push(d.jobs_mit_fehler + ' Ablauf/Abläufe hatten zuletzt einen Fehler — siehe Tabelle unten.');
      }
      if (d.gepostet === 0 && d.trockenlauf > 0) {
        warnungen.push('Der Trockenlauf ist aktiv: Es wird alles geplant, aber nichts veröffentlicht. ' +
          'Das ist der Standard und wird nur von Hand umgestellt.');
      }
      if (warnungen.length) {
        setze('hinweise', warnungen.map(function (w) {
          return '<div class="hinweis">' + schuetze(w) + '</div>';
        }).join(''));
      }
    });
  }

  // ── Abläufe ────────────────────────────────────────────────────────

  function ladeJobs() {
    return hole('jobs').then(function (zeilen) {
      if (!zeilen.length) {
        setze('jobs', '<tr><td colspan="6" class="leer">Noch keine Abläufe eingetragen — ' +
          'ein erster Lauf legt sie an.</td></tr>');
        return;
      }
      setze('jobs', zeilen.map(function (z) {
        var zustand = z.enabled
          ? (z.laeuft_seit ? '<span class="zustand z-laeuft">läuft gerade</span>'
                           : '<span class="zustand z-an">an</span>')
          : '<span class="zustand z-aus">angehalten</span>';
        if (z.requires_local) zustand += ' <span class="zustand z-lokal">lokal</span>';
        var fehler = z.fehler_zaehler
          ? '<span class="text-danger">' + schuetze(z.fehler_zaehler) + '× </span>' +
            '<span class="begruendung">' + schuetze(String(z.letzter_fehler || '').slice(0, 70)) + '</span>'
          : '<span class="begruendung">–</span>';
        return '<tr>' +
          '<td class="mono">' + schuetze(z.job) + '</td>' +
          '<td>' + zustand + '</td>' +
          '<td>' + schuetze(z.laeufe) + '</td>' +
          '<td>' + schuetze(dauer(z.in_sekunden)) + '</td>' +
          '<td>' + fehler + '</td>' +
          '<td class="text-end"><button class="btn btn-sm ' +
            (z.enabled ? 'btn-outline-danger' : 'btn-outline-success') +
            '" data-job="' + schuetze(z.job) + '" data-an="' + (z.enabled ? 'false' : 'true') + '">' +
            (z.enabled ? 'anhalten' : 'freigeben') + '</button></td>' +
          '</tr>';
      }).join(''));

      Array.prototype.forEach.call(document.querySelectorAll('#jobs button[data-job]'), function (b) {
        b.addEventListener('click', function () {
          schalte(b.getAttribute('data-job'), b.getAttribute('data-an') === 'true');
        });
      });
    });
  }

  function schalte(job, an) {
    fetch(BASIS + 'schalte', {
      method: 'POST', credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ job: job, an: an })
    }).then(function () { ladeJobs(); ladeUeberblick(); });
  }

  function notaus(an) {
    var frage = an
      ? 'Alle Abläufe wieder freigeben?'
      : 'Alle Abläufe anhalten? Es geht danach nichts mehr raus, bis du sie wieder freigibst.';
    if (!window.confirm(frage)) return;
    fetch(BASIS + 'notaus', {
      method: 'POST', credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ an: an })
    }).then(function () { ladeJobs(); ladeUeberblick(); });
  }

  // ── Freigabe je Beitrag ────────────────────────────────────────────
  //
  // Die einzige Stelle im Dashboard, an der ein Mensch etwas entscheidet
  // statt nur nachzusehen. Bis hierher kannte die Kette zwei Stellungen:
  // Trockenlauf an (nichts geht raus) oder Trockenlauf aus (ALLES geht raus,
  // ohne dass jemand den einzelnen Beitrag gesehen hat). Deshalb blieb der
  // Schalter an — zu Recht. Diese Liste ist die Stellung dazwischen.
  //
  // Bewusst KEINE Sammelfreigabe: Die waere derselbe Alles-oder-Nichts-
  // Schalter, nur mit mehr Klicks. Die Abfrage dahinter (api.js) hat aus
  // demselben Grund keine.

  // Merkt sich, was in die Notizfelder getippt wurde. Ohne das waere jede
  // halb geschriebene Begruendung nach der Minutenaktualisierung weg —
  // und wer seine Notiz zweimal verliert, schreibt beim dritten Mal "ok".
  var notizen = {};

  // Der echte TIKTOK_PRIVACY-Wert aus dem Ueberblick. Bis dahin steht das,
  // was im Zweifel gilt: die Vorgabe.
  var sendezustand = { privacy: null };

  // Den Shop-Link aus der Bildunterschrift ziehen, damit man ihn anklicken
  // kann, statt ihn abzutippen. Er steht dort ohnehin: baue_caption() setzt
  // ihn mit der Kampagnenkennung hinein. Nur http/https, nichts anderes.
  function linkAus(text) {
    var treffer = String(text || '').match(/https?:\/\/[^\s]+/);
    return treffer ? treffer[0] : null;
  }

  function hashtagsAls(wert) {
    if (!wert) return [];
    if (Array.isArray(wert)) return wert;
    try {
      var d = JSON.parse(wert);
      return Array.isArray(d) ? d : [];
    } catch (e) {
      return [];
    }
  }

  // SELF_ONLY heisst: nur fuer das eigene Konto sichtbar. Das steht so
  // nirgends in der Oberflaeche, und "privat" ist das Wort, das jemand
  // erwartet, der gerade freigibt.
  function zustandKlartext() {
    var wert = sendezustand.privacy;
    if (!wert || wert === 'SELF_ONLY') return 'privat — nur für dein eigenes Konto sichtbar';
    if (wert === 'PUBLIC_TO_EVERYONE') return 'öffentlich';
    if (wert === 'MUTUAL_FOLLOW_FRIENDS') return 'nur für Freunde';
    if (wert === 'FOLLOWER_OF_CREATOR') return 'nur für Follower';
    return wert;
  }

  function ladeFreigaben() {
    return hole('freigaben?limit=25').then(function (zeilen) {
      var zahl = document.getElementById('freigaben-zahl');
      if (zahl) {
        zahl.textContent = zeilen.length
          ? '— ' + zeilen.length + (zeilen.length === 1 ? ' Beitrag wartet' : ' Beiträge warten')
          : '';
      }
      if (!zeilen.length) {
        return setze('freigaben', leer('Nichts wartet auf eine Freigabe. ' +
          'Entweder ist alles entschieden, oder es liegt noch kein geprüftes Video in der Warteschlange.'));
      }

      setze('freigaben',
        // Zwei Sperren, die man beim Freigeben im Kopf haben muss und die
        // sonst nirgends stehen. Beide sind richtig als Vorgabe — nur ist
        // "freigegeben und trotzdem nicht sichtbar" ein verlorener Tag.
        '<div class="hinweis">Eine Freigabe hebt den <strong>Trockenlauf</strong> nicht auf: ' +
        'steht der noch, wird der Beitrag vorgemerkt und trotzdem nicht gesendet.<br>' +
        'Geht raus als: <strong>' + schuetze(zustandKlartext()) + '</strong> ' +
        '<span class="begruendung">(<span class="mono">TIKTOK_PRIVACY' +
        (sendezustand.privacy ? '=' + schuetze(sendezustand.privacy) : ' nicht gesetzt') +
        '</span>)</span></div>' +
        zeilen.map(function (z) {
          var link = linkAus(z.caption);
          var tags = hashtagsAls(z.hashtags);
          var felder = [
            '<span class="feld"><b>Sendeplatz</b> ' +
              schuetze(zeitpunkt(z.geplant_fuer)) +
              (z.slot ? ' (' + schuetze(z.slot) + ')' : '') + '</span>',
            '<span class="feld"><b>Stil</b> ' + schuetze(z.stil || '–') +
              (z.schnittliste ? ' <span class="mono">' + schuetze(z.schnittliste) + '</span>' : '') + '</span>',
            '<span class="feld"><b>Länge</b> ' +
              (z.dauer_sek ? Number(z.dauer_sek).toFixed(1) + ' s' : '–') + '</span>',
            '<span class="feld"><b>Produkt</b> ' + schuetze(z.produkt_id != null ? z.produkt_id : '–') + '</span>',
            '<span class="feld"><b>Video</b> #' + schuetze(z.video_id) + '</span>'
          ].join(' ');

          // Die Bildunterschrift im WORTLAUT, nicht gekuerzt. Sie ist das,
          // was der Zuschauer liest — eine auf 60 Zeichen abgeschnittene
          // Vorschau davon kann man nicht freigeben.
          var caption = String(z.caption || '').trim();

          return '<div class="freigabe" data-karte="' + schuetze(z.post_id) + '">' +
            '<div class="kopf">' +
              '<span class="titel">' + schuetze(z.plattform) + '</span>' +
              '<span class="zustand z-laeuft">' + schuetze(z.status) + '</span>' +
              '<span class="feld ms-auto mono">Beitrag #' + schuetze(z.post_id) + '</span>' +
            '</div>' +
            '<div class="mb-1">' + felder + '</div>' +
            (caption
              ? '<div class="caption-text">' + schuetze(caption) + '</div>'
              : '<div class="hinweis">Diese Bildunterschrift ist leer. Bei Stil C ist das der ' +
                'Normalfall — Hook, Aufruf und Hashtags kommen aus dem Briefing, und eine ' +
                'Schnittliste hat keins. So sollte der Beitrag nicht raus.</div>') +
            '<div class="mb-2">' +
              (tags.length
                ? '<span class="feld"><b>Hashtags</b> ' + schuetze(tags.join(' ')) + '</span>'
                : '<span class="feld text-danger"><b>Keine Hashtags</b> — auf TikTok heißt das kaum Reichweite.</span>') +
            '</div>' +
            (link
              ? '<div class="mb-2"><span class="feld"><b>Zielverweis</b></span> ' +
                '<a href="' + schuetze(link) + '" target="_blank" rel="noopener noreferrer" ' +
                'class="mono">' + schuetze(link) + '</a></div>'
              : '<div class="mb-2"><span class="feld text-danger"><b>Kein Link in der Bildunterschrift</b> — ' +
                'ohne ihn lässt sich keine Bestellung diesem Beitrag zuordnen.</span></div>') +
            '<div class="mb-2 feld"><b>Datei</b> <span class="mono">' +
              schuetze(z.pfad || '–') + '</span></div>' +
            '<div class="tat">' +
              '<textarea class="form-control form-control-sm" style="flex:1;min-width:220px" ' +
                'data-notiz="' + schuetze(z.post_id) + '" rows="1" ' +
                'placeholder="Notiz — bei Ablehnung Pflicht, sonst freiwillig">' +
                schuetze(notizen[z.post_id] || '') + '</textarea>' +
              '<button class="btn btn-sm btn-success" data-frei="' + schuetze(z.post_id) + '">' +
                '<i class="bi bi-send"></i> freigeben</button>' +
              '<button class="btn btn-sm btn-outline-danger" data-ablehnen="' + schuetze(z.post_id) + '">' +
                'ablehnen</button>' +
            '</div>' +
          '</div>';
        }).join(''));

      Array.prototype.forEach.call(
        document.querySelectorAll('#freigaben textarea[data-notiz]'), function (t) {
          t.addEventListener('input', function () {
            notizen[t.getAttribute('data-notiz')] = t.value;
          });
        });
      Array.prototype.forEach.call(
        document.querySelectorAll('#freigaben button[data-frei]'), function (b) {
          b.addEventListener('click', function () { entscheide(b.getAttribute('data-frei'), true); });
        });
      Array.prototype.forEach.call(
        document.querySelectorAll('#freigaben button[data-ablehnen]'), function (b) {
          b.addEventListener('click', function () { entscheide(b.getAttribute('data-ablehnen'), false); });
        });
    });
  }

  function entscheide(postId, frei) {
    var notiz = (notizen[postId] || '').trim();

    // Eine Ablehnung ohne Grund ist in drei Wochen wertlos — dann steht in
    // der Tabelle "abgelehnt" und niemand weiss mehr, warum. Bei der
    // Freigabe ist die Notiz freiwillig: Ein Pflichtfeld erzeugt dort "ok".
    if (!frei && !notiz) {
      window.alert('Bitte einen Grund eintragen. Eine Ablehnung ohne Begründung ' +
        'sagt später niemandem mehr etwas.');
      return;
    }
    if (frei && !window.confirm(
        'Beitrag #' + postId + ' freigeben?\n\n' +
        'Damit darf dieser eine Beitrag gesendet werden, sobald der Trockenlauf aus ist. ' +
        'Ein veröffentlichter Beitrag lässt sich nicht kurz zurückholen.')) {
      return;
    }

    fetch(BASIS + 'freigabe', {
      method: 'POST', credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ post_id: Number(postId), frei: frei, notiz: notiz || null })
    }).then(function (r) {
      return r.json().catch(function () { return { ok: false, grund: 'Antwort unlesbar (' + r.status + ')' }; });
    }).then(function (d) {
      // Die Antwort zeigen statt still neu zu laden: Wenn der Beitrag
      // inzwischen gepostet wurde, lehnt der Server ab — und dann soll das
      // dastehen, nicht bloss die Karte verschwinden.
      if (!d || d.ok !== true) {
        window.alert('Nicht gespeichert: ' + ((d && (d.grund || d.error)) || 'unbekannter Fehler'));
      } else {
        delete notizen[postId];
      }
      ladeFreigaben();
      ladeWarteschlange();
      ladeUeberblick();
      ladeProtokoll();
    }).catch(function (e) {
      console.error(e);
      window.alert('Freigabe nicht gesendet: ' + e.message);
    });
  }

  // ── Listen ─────────────────────────────────────────────────────────

  function ladeTrends() {
    return hole('trends?limit=12').then(function (zeilen) {
      if (!zeilen.length) return setze('trends', leer('Noch keine bewerteten Trends.'));
      var hoechst = Math.max.apply(null, zeilen.map(function (z) { return z.score || 0; })) || 1;
      setze('trends', zeilen.map(function (z) {
        var b = z.bestandteile || {};
        var teile = ['Passung ' + (b.passung != null ? b.passung : '–'),
                     'Shop ' + (b.shop_signal != null ? b.shop_signal : '–'),
                     'Wachstum ' + (b.velocity != null ? b.velocity : '–')].join(' · ');
        return '<div class="mb-2">' +
          '<div class="d-flex justify-content-between"><span>' +
            schuetze(String(z.keyword).slice(0, 52)) +
            ' <span class="begruendung">(' + schuetze(z.quelle) + ')</span></span>' +
          '<strong>' + (z.score != null ? Number(z.score).toFixed(3) : '–') + '</strong></div>' +
          '<div class="balken"><i style="width:' +
            Math.max(2, Math.round((z.score || 0) / hoechst * 100)) + '%"></i></div>' +
          '<div class="begruendung">' + schuetze(teile) + '</div></div>';
      }).join(''));
    });
  }

  function ladeWarteschlange() {
    return hole('warteschlange?limit=15').then(function (zeilen) {
      if (!zeilen.length) return setze('warteschlange', leer('Noch nichts eingeplant.'));
      setze('warteschlange', '<div class="table-responsive"><table class="table table-sm">' +
        '<thead><tr><th>Slot</th><th>Stil</th><th>Zustand</th><th>Länge</th></tr></thead><tbody>' +
        zeilen.map(function (z) {
          var farbe = z.status === 'gepostet' ? 'z-an'
                    : z.status === 'fehler' ? 'z-aus' : 'z-laeuft';
          return '<tr><td>' + schuetze(z.slot || zeitpunkt(z.geplant_fuer)) + '</td>' +
            '<td>' + schuetze(z.stil) + '</td>' +
            '<td><span class="zustand ' + farbe + '">' + schuetze(z.status) + '</span></td>' +
            '<td>' + (z.dauer_sek ? Number(z.dauer_sek).toFixed(1) + ' s' : '–') + '</td></tr>';
        }).join('') + '</tbody></table></div>');
    });
  }

  function ladeErgebnisse() {
    return hole('ergebnisse?limit=15').then(function (zeilen) {
      if (!zeilen.length) {
        return setze('ergebnisse', leer('Noch nichts veröffentlicht — im Trockenlauf ist das erwartet.'));
      }
      setze('ergebnisse', '<div class="table-responsive"><table class="table table-sm">' +
        '<thead><tr><th>Slot</th><th>Aufrufe</th><th>Bestellungen</th><th>DB</th><th>Bewertung</th></tr></thead><tbody>' +
        zeilen.map(function (z) {
          var bewertung = z.reward_final != null
            ? '<strong>' + Number(z.reward_final).toFixed(3) + '</strong>'
            : (z.reward_vorlaeufig != null
                ? Number(z.reward_vorlaeufig).toFixed(3) + ' <span class="begruendung">(vorläufig)</span>'
                : '–');
          return '<tr><td>' + schuetze(z.slot || '–') + '</td>' +
            '<td>' + schuetze(z.views != null ? z.views : '–') + '</td>' +
            '<td>' + schuetze(z.bestellungen != null ? z.bestellungen : '–') + '</td>' +
            '<td>' + (z.deckungsbeitrag != null ? Number(z.deckungsbeitrag).toFixed(2) + ' €' : '–') + '</td>' +
            '<td>' + bewertung + '</td></tr>';
        }).join('') + '</tbody></table></div>');
    });
  }

  function ladeVerworfen() {
    return hole('verworfen?limit=10').then(function (zeilen) {
      if (!zeilen.length) return setze('verworfen', leer('Nichts verworfen — gut.'));
      setze('verworfen', zeilen.map(function (z) {
        return '<div class="mb-2"><div>Video #' + schuetze(z.id) + ' (Stil ' + schuetze(z.stil) +
          ') <span class="begruendung">' + zeitpunkt(z.erstellt_am) + '</span></div>' +
          '<div class="begruendung">' + schuetze(String(z.pruefgrund || '').slice(0, 150)) + '</div></div>';
      }).join(''));
    });
  }

  function ladeLernstand() {
    return hole('lernstand').then(function (zeilen) {
      if (!zeilen.length) {
        return setze('lernstand', leer('Noch nichts gelernt — es fehlen bewertete Beiträge. ' +
          'Endgültig bewertet wird erst 72 Stunden nach der Veröffentlichung.'));
      }
      var nachDimension = {};
      zeilen.forEach(function (z) {
        (nachDimension[z.dimension] = nachDimension[z.dimension] || []).push(z);
      });
      setze('lernstand', Object.keys(nachDimension).map(function (dim) {
        return '<div class="mb-3"><strong>' + schuetze(dim) + '</strong>' +
          nachDimension[dim].map(function (z) {
            return '<div class="d-flex justify-content-between align-items-center mt-1">' +
              '<span>' + schuetze(z.auspraegung) +
                (z.gesperrt_bis ? ' <span class="zustand z-aus">gesperrt</span>' : '') +
                ' <span class="begruendung">(' + schuetze(z.versuche) + ' Versuche)</span></span>' +
              '<span style="min-width:52px;text-align:right"><strong>' +
                (z.wert != null ? Number(z.wert).toFixed(2) : '–') + '</strong></span></div>' +
              '<div class="balken"><i style="width:' +
                Math.round((z.wert || 0) * 100) + '%"></i></div>';
          }).join('') + '</div>';
      }).join(''));
    });
  }

  function ladeKosten() {
    return hole('kosten').then(function (d) {
      var kopf = '<div class="kpi-row mb-3">' +
        '<div class="kpi"><div class="kpi-val">' + euro(d.heute_cent) + '</div>' +
        '<div class="kpi-lab">heute</div></div>' +
        '<div class="kpi"><div class="kpi-val">' + euro(d.monat_cent) + '</div>' +
        '<div class="kpi-lab">dieser Monat</div></div></div>';
      var liste = (d.je_anbieter || []).length
        ? '<table class="table table-sm"><tbody>' + d.je_anbieter.map(function (z) {
            return '<tr><td>' + schuetze(z.anbieter) + '</td>' +
              '<td class="text-end">' + euro(z.monat_cent) + '</td>' +
              '<td class="text-end begruendung">' + schuetze(z.aufrufe) + ' Aufrufe</td></tr>';
          }).join('') + '</tbody></table>'
        : leer('Noch keine kostenpflichtigen Aufrufe.');
      setze('kosten', kopf + liste);
    });
  }

  function ladeOverrides() {
    return hole('overrides').then(function (zeilen) {
      if (!zeilen.length) {
        return setze('overrides', leer('Keine — es gelten die Startwerte aus der Konfigurationsdatei.'));
      }
      setze('overrides', '<table class="table table-sm"><tbody>' + zeilen.map(function (z) {
        return '<tr><td class="mono">' + schuetze(z.pfad) + '</td>' +
          '<td>' + schuetze(JSON.stringify(z.wert)) + '</td>' +
          '<td class="begruendung">' + zeitpunkt(z.gesetzt_am) + '</td></tr>';
      }).join('') + '</tbody></table>');
    });
  }

  function ladeProtokoll() {
    return hole('protokoll?limit=25').then(function (zeilen) {
      if (!zeilen.length) return setze('protokoll', leer('Noch keine Entscheidungen protokolliert.'));
      setze('protokoll', '<div class="table-responsive"><table class="table table-sm">' +
        '<thead><tr><th>Zeit</th><th>Ablauf</th><th>Entscheidung</th><th>Begründung</th></tr></thead><tbody>' +
        zeilen.map(function (z) {
          return '<tr><td class="begruendung">' + zeitpunkt(z.zeitpunkt) + '</td>' +
            '<td class="mono">' + schuetze(z.job || '–') + '</td>' +
            '<td>' + schuetze(z.entscheidung) + '</td>' +
            '<td class="begruendung">' + schuetze(String(z.begruendung || '').slice(0, 160)) + '</td></tr>';
        }).join('') + '</tbody></table></div>');
    });
  }

  // ── Start ──────────────────────────────────────────────────────────

  function alles() {
    // Der Ueberblick zuerst, die Freigabeliste danach: Dort steht, ob ein
    // gesendeter Beitrag oeffentlich oder privat landet, und der Wert kommt
    // aus dem Ueberblick. Parallel gestartet zeigte die Liste beim ersten
    // Aufbau die Vorgabe statt des echten Zustands — eine Minute lang, bis
    // zur naechsten Aktualisierung.
    ladeUeberblick()
      .then(ladeFreigaben)
      .catch(function (e) { console.error(e); ladeFreigaben().catch(function () {}); });

    [ladeJobs, ladeTrends, ladeWarteschlange, ladeErgebnisse,
     ladeVerworfen, ladeLernstand, ladeKosten, ladeOverrides, ladeProtokoll]
      .forEach(function (f) {
        f().catch(function (e) { console.error(e); });
      });
  }

  function init() {
    var stop = document.getElementById('btn-stop');
    var start = document.getElementById('btn-start');
    if (stop) stop.addEventListener('click', function () { notaus(false); });
    if (start) start.addEventListener('click', function () { notaus(true); });
    alles();
    // Der Automat taktet alle 5 Minuten; einmal pro Minute nachsehen genuegt.
    setInterval(alles, 60000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
