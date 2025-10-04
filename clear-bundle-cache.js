// Clear Bundle Cache - Löscht alte Bundle-Daten aus dem localStorage
console.log('🧹 Clearing bundle cache...');

// Lösche alte Bundle-Selections
const oldSelections = localStorage.getItem('bundleColorSelections');
if (oldSelections) {
    console.log('📦 Alte Bundle-Selections gefunden:', oldSelections);
    localStorage.removeItem('bundleColorSelections');
    console.log('✅ Bundle-Selections gelöscht');
}

// Optional: Warenkorb leeren (nur wenn gewünscht)
const clearCart = confirm('Möchten Sie auch den Warenkorb leeren?');
if (clearCart) {
    localStorage.removeItem('cart');
    console.log('🛒 Warenkorb geleert');
}

console.log('✨ Cache bereinigt! Bitte die Seite neu laden.');

// Automatisch neu laden
setTimeout(() => {
    location.reload();
}, 1000);
