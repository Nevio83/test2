console.log('Versuche, sqlite3 zu laden...');
try {
  const sqlite3 = require('sqlite3');
  console.log('sqlite3 wurde erfolgreich geladen!', sqlite3);
} catch (e) {
  console.error('Fehler beim Laden von sqlite3:', e);
}
