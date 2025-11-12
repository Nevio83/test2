// Einfache Test-Funktion um zu prüfen, ob Netlify Functions laufen
exports.handler = async () => {
  return {
    statusCode: 200,
    body: JSON.stringify({
      message: "API-Server läuft!",
      timestamp: new Date().toISOString(),
      environment: "Netlify Functions"
    })
  };
};
