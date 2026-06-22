/**
 * newsletter.js — Admin-Newsletter-Verwaltung.
 *
 * Holt Abonnenten + Kennzahlen von api/newsletter/* (RELATIVE URLs unter
 * /a29715347575/ -> Browser sendet Basic-Auth automatisch mit) und versendet
 * Kampagnen an alle bestätigten Abonnenten.
 */
(function () {
  'use strict';

  var currentStatus = '';
  var confirmedCount = 0;

  function getJSON(url, opts) {
    return fetch(url, Object.assign({ credentials: 'same-origin' }, opts || {}))
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      });
  }

  function setText(id, v) {
    var el = document.getElementById(id);
    if (el) el.textContent = v;
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function fmtDate(s) {
    if (!s) return '–';
    try { return new Date(s).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }); }
    catch (e) { return '–'; }
  }

  var STATUS_BADGE = {
    confirmed: '<span class="badge-status badge-confirmed">Bestätigt</span>',
    pending: '<span class="badge-status badge-pending">Offen</span>',
    unsubscribed: '<span class="badge-status badge-unsubscribed">Abgemeldet</span>'
  };

  function renderRows(rows) {
    var tbody = document.getElementById('subscriber-rows');
    if (!tbody) return;
    if (!rows || !rows.length) {
      tbody.innerHTML = '<tr><td colspan="4" class="empty">Noch keine Abonnenten in dieser Ansicht.</td></tr>';
      return;
    }
    tbody.innerHTML = rows.map(function (r) {
      return '<tr>' +
        '<td>' + escapeHtml(r.email) + '</td>' +
        '<td>' + (STATUS_BADGE[r.status] || escapeHtml(r.status)) + '</td>' +
        '<td class="small text-muted">' + fmtDate(r.created_at) + '</td>' +
        '<td class="small text-muted">' + escapeHtml(r.source || '–') + '</td>' +
      '</tr>';
    }).join('');
  }

  function loadSubscribers() {
    var url = 'api/newsletter/subscribers' + (currentStatus ? ('?status=' + encodeURIComponent(currentStatus)) : '');
    getJSON(url)
      .then(function (data) {
        var s = data.stats || {};
        setText('stat-confirmed', s.confirmed != null ? s.confirmed : 0);
        setText('stat-pending', s.pending != null ? s.pending : 0);
        setText('stat-unsub', s.unsubscribed != null ? s.unsubscribed : 0);
        setText('stat-total', s.total != null ? s.total : 0);
        confirmedCount = s.confirmed || 0;
        setText('bc-count', confirmedCount);
        renderRows(data.subscribers);
      })
      .catch(function (e) {
        var tbody = document.getElementById('subscriber-rows');
        if (tbody) tbody.innerHTML = '<tr><td colspan="4" class="text-danger small">Fehler beim Laden: ' + escapeHtml(e.message) + '</td></tr>';
      });
  }
  window.loadSubscribers = loadSubscribers;

  function attachStatusFilter() {
    var group = document.getElementById('status-filter');
    if (!group) return;
    var buttons = group.querySelectorAll('button[data-status]');
    buttons.forEach(function (btn) {
      btn.addEventListener('click', function () {
        currentStatus = btn.dataset.status || '';
        buttons.forEach(function (b) { b.classList.toggle('active', b === btn); });
        loadSubscribers();
      });
    });
  }

  function attachSend() {
    var btn = document.getElementById('bc-send');
    if (!btn) return;
    btn.addEventListener('click', function () {
      var subject = (document.getElementById('bc-subject').value || '').trim();
      var message = (document.getElementById('bc-message').value || '').trim();
      var result = document.getElementById('bc-result');
      result.className = 'mt-2 mb-0 small';
      if (!subject || !message) {
        result.classList.add('text-danger');
        result.textContent = 'Bitte Betreff und Nachricht ausfüllen.';
        return;
      }
      if (confirmedCount === 0) {
        result.classList.add('text-danger');
        result.textContent = 'Es gibt noch keine bestätigten Abonnenten.';
        return;
      }
      if (!window.confirm('Werbe-Mail wirklich an ' + confirmedCount + ' bestätigte Abonnenten senden?')) return;

      btn.disabled = true;
      result.classList.add('text-muted');
      result.textContent = 'Versand läuft …';
      getJSON('api/newsletter/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject: subject, message: message })
      })
        .then(function (d) {
          btn.disabled = false;
          result.className = 'mt-2 mb-0 small';
          if (d.success) {
            result.classList.add('text-success');
            result.textContent = '✅ Gesendet: ' + (d.sent || 0) +
              (d.failed ? (' · Fehlgeschlagen: ' + d.failed) : '') + (d.message ? (' · ' + d.message) : '');
            document.getElementById('bc-subject').value = '';
            document.getElementById('bc-message').value = '';
          } else {
            result.classList.add('text-danger');
            result.textContent = d.error || 'Versand fehlgeschlagen.';
          }
        })
        .catch(function (e) {
          btn.disabled = false;
          result.className = 'mt-2 mb-0 small text-danger';
          result.textContent = 'Fehler: ' + e.message;
        });
    });
  }

  function init() {
    attachStatusFilter();
    attachSend();
    loadSubscribers();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
