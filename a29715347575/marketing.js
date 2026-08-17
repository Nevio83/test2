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
    [ladeUeberblick, ladeJobs, ladeTrends, ladeWarteschlange, ladeErgebnisse,
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
