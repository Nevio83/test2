// Auto-Dropdown-Fix - Macht Bilder automatisch klickbar
(function() {
    'use strict';
    
    function makeClickable() {
        let fixed = 0;
        
        // Empfehlungen
        document.querySelectorAll('#cartDropdown .recommendation-card').forEach(card => {
            const img = card.querySelector('.recommendation-image');
            if (!img || img.parentElement.tagName === 'A') return;
            
            const name = card.querySelector('.recommendation-name')?.textContent.trim();
            if (!name) return;
            
            // Vollständiges Produkt-ID Mapping (alle Produkte)
            const ids = {
                // Technik/Gadgets
                'Elektrischer Wasserspender für Schreibtisch': 10,
                '350ml Elektrischer Mixer Entsafter': 11,
                'Bluetooth Anti-Lost Finder Wassertropfen': 17,
                'Home Electronic Clock Digitale Uhr': 18,
                'Elektronisches Distanzmessgerät Digital': 19,
                'ZigBee Smart DIY Motorisierte Rollos': 20,
                
                // Beleuchtung
                'LED Water Ripple Crystal': 21,
                'LED Wasserwellen Kristall Tischlampe': 21,
                'Waterproof RGB LED Solar Light': 22,
                'Waterproof RGB LED Solarleuchte': 22,
                'Solarleuchte Metall Laterne': 23,
                'COBLED Arbeitsleuchte': 24,
                'Nachtlichter mit Bewegungsmelder': 25,
                
                // Haushalt & Küche
                'Multifunktions Gemüseschneider': 12,
                'Elektrische Küchenwaage Digital': 13,
                'Automatischer Seifenspender': 14,
                'Vakuum Aufbewahrungsbeutel Set': 15,
                'Silikon Stretch Deckel 6er Set': 16,
                
                // Wellness & Körperpflege
                '4 In 1 Self Cleaning Hair Brush': 26,
                'Volcanic Flame Aroma Essential Oil Diffuser': 27,
                'Mini Muskel Massage Pistole': 28,
                'Haaröl-Applikator Kopfhaut Massager': 29,
                'Mini Electric Shoulder And Neck Massager': 30,
                'Elektrischer Kopfhaut-Massagekamm': 31,
                
                // Zusätzliche Schreibweisen für Wellness
                'Massage Gun': 28,
                'Massage Pistole': 28,
                'Aromatherapie Diffuser': 27,
                'Aroma Diffuser': 27,
                'Kopfhaut Massager': 29,
                'Kopfhautmassage': 31,
                'Elektrischer Kopfhaut-Massagekamm,Haaröl-Applikator Kopfhaut Massager': 31,
                
                // Varianten mit verschiedenen Schreibweisen
                'Bluetooth Anti-Lost Finder': 17,
                'Home Electronic Clock': 18,
                'LED Wasserwellen Kristall': 21,
                'RGB LED Solar Light': 22,
                'COBLED Lampe': 24,
                'Nachtlicht mit Bewegungsmelder': 25
            };
            
            const id = ids[name] || (window.products?.find(p => p.name === name)?.id);
            
            if (id) {
                const a = document.createElement('a');
                a.href = 'produkte/produkt-' + id + '.html';
                a.style.textDecoration = 'none';
                img.style.cursor = 'pointer';
                img.parentNode.insertBefore(a, img);
                a.appendChild(img);
                fixed++;
            }
        });
        
        // Warenkorb
        document.querySelectorAll('#cartDropdown .cart-item').forEach(item => {
            const img = item.querySelector('.cart-item-image');
            if (!img || img.parentElement.tagName === 'A') return;
            
            const name = item.querySelector('.cart-item-name')?.textContent.trim();
            const cart = JSON.parse(localStorage.getItem('cart') || '[]');
            const product = cart.find(p => p.name === name);
            
            if (product?.id) {
                const a = document.createElement('a');
                a.href = 'produkte/produkt-' + product.id + '.html';
                a.style.textDecoration = 'none';
                img.style.cursor = 'pointer';
                img.parentNode.insertBefore(a, img);
                a.appendChild(img);
                fixed++;
            }
        });
        
        if (fixed > 0) console.log('✅ ' + fixed + ' Bilder klickbar');
    }
    
    // Bei Dropdown-Klick
    document.addEventListener('click', e => {
        if (e.target.closest('.cart-btn, [data-bs-toggle="dropdown"]')) {
            setTimeout(makeClickable, 300);
        }
    });
    
    // Patch renderCartDropdown
    const wait = setInterval(() => {
        if (window.renderCartDropdown) {
            clearInterval(wait);
            const orig = window.renderCartDropdown;
            window.renderCartDropdown = function() {
                orig.apply(this, arguments);
                setTimeout(makeClickable, 200);
            };
            console.log('✅ Auto-Dropdown-Fix aktiv');
        }
    }, 100);
    
    setTimeout(() => clearInterval(wait), 5000);
})();
