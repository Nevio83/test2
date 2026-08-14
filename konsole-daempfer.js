/**
 * Daempft console.log/info/debug im Browser auf der Live-Domain -- das
 * Gegenstueck zum LOG_LEVEL-Schalter in server.js. Dort gibt es eine ENV pro
 * Deploy; fuer die statisch ausgelieferten Seiten (kein Build-Step) gibt es
 * das nicht, deshalb hier per Hostname: auf localhost/127.0.0.1 (Entwicklung)
 * bleibt alles wie bisher, auf jeder anderen Domain werden log/info/debug
 * stummgeschaltet. console.warn/error bleiben IMMER sichtbar -- das ist
 * genau das, was wirklich schiefgeht.
 *
 * Muss als ERSTES Skript der Seite laufen (vor app.js/cart.js & Co.), sonst
 * sind deren fruehe console.log-Aufrufe schon durchgelaufen, bevor gedaempft
 * wird.
 */
(function () {
  var lokal = ['localhost', '127.0.0.1', ''].indexOf(location.hostname) !== -1;
  if (lokal) return;
  var stumm = function () {};
  console.log = stumm;
  console.info = stumm;
  console.debug = stumm;
})();
