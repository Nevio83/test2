/**
 * AI-CHAT INTEGRATION MIT OPENAI/CHATGPT
 * 
 * Dieses System kombiniert echten Kundenservice mit KI-Unterstützung
 * 
 * FEATURES:
 * - Automatische KI-Antworten wenn kein Agent verfügbar
 * - KI-Vorschläge für Agenten
 * - 24/7 Verfügbarkeit
 * - Nahtlose Übergabe an echte Menschen
 */

class AICustomerSupport {
  constructor(apiKey) {
    this.apiKey = apiKey; // OpenAI API Key
    this.conversationHistory = [];
    this.isAgentAvailable = false;
  }

  /**
   * Initialisiere AI-Chat System
   */
  async init() {
    console.log('🤖 AI Customer Support initialisiert');
    
    // Prüfe ob Tawk.to geladen ist
    if (typeof Tawk_API !== 'undefined') {
      this.setupTawkIntegration();
    }
    
    // Prüfe Agent-Verfügbarkeit
    this.checkAgentAvailability();
  }

  /**
   * Tawk.to Integration
   */
  setupTawkIntegration() {
    // Wenn neue Nachricht vom Kunden kommt
    Tawk_API.onChatMessageVisitor = (message) => {
      console.log('📨 Neue Kundennachricht:', message);
      
      // Wenn kein Agent verfügbar → AI antwortet
      if (!this.isAgentAvailable) {
        this.handleMessageWithAI(message.text);
      } else {
        // Agent ist da → Zeige AI-Vorschlag
        this.suggestResponseToAgent(message.text);
      }
    };
  }

  /**
   * Nachricht mit AI verarbeiten
   */
  async handleMessageWithAI(userMessage) {
    try {
      console.log('🤖 AI verarbeitet Nachricht...');
      
      // Zeige Typing-Indikator
      this.showTypingIndicator();
      
      // Hole AI-Antwort
      const aiResponse = await this.getAIResponse(userMessage);
      
      // Verstecke Typing-Indikator
      this.hideTypingIndicator();
      
      // Sende AI-Antwort über Tawk.to
      if (typeof Tawk_API !== 'undefined' && Tawk_API.sendMessage) {
        Tawk_API.sendMessage(aiResponse);
      }
      
      console.log('✅ AI-Antwort gesendet:', aiResponse);
      
    } catch (error) {
      console.error('❌ AI-Fehler:', error);
      this.sendFallbackMessage();
    }
  }

  /**
   * Hole AI-Antwort von OpenAI
   */
  async getAIResponse(userMessage) {
    // Füge Nachricht zur Historie hinzu
    this.conversationHistory.push({
      role: 'user',
      content: userMessage
    });

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4', // oder 'gpt-3.5-turbo' für günstiger
        messages: [
          {
            role: 'system',
            content: `Du bist ein freundlicher Kundenservice-Mitarbeiter für einen E-Commerce-Shop.
            
            WICHTIGE INFORMATIONEN:
            - Versandkosten: Kostenlos ab 50€, sonst 4,99€
            - Lieferzeit: 3-5 Werktage (Standard), 1-2 Werktage (Express)
            - Rückgaberecht: 30 Tage
            - Zahlungsmethoden: PayPal, Kreditkarte, Klarna, SEPA
            - Support-Zeiten: Mo-Fr 9-18 Uhr, Sa 10-16 Uhr
            
            VERHALTEN:
            - Antworte auf Deutsch
            - Sei freundlich und professionell
            - Halte Antworten kurz (max 3-4 Sätze)
            - Bei komplexen Fragen: Biete an, einen echten Mitarbeiter zu verbinden
            - Verwende Emojis sparsam (max 1-2 pro Nachricht)
            
            BEISPIEL-ANTWORTEN:
            - Versandfrage: "Wir versenden innerhalb von 3-5 Werktagen. Ab 50€ ist der Versand kostenlos! 📦"
            - Retoure: "Sie haben 30 Tage Rückgaberecht. Möchten Sie eine Retoure anmelden?"
            - Zahlung: "Wir akzeptieren PayPal, Kreditkarte, Klarna und SEPA-Lastschrift. 💳"
            `
          },
          ...this.conversationHistory
        ],
        temperature: 0.7,
        max_tokens: 150
      })
    });

    const data = await response.json();
    const aiMessage = data.choices[0].message.content;

    // Füge AI-Antwort zur Historie hinzu
    this.conversationHistory.push({
      role: 'assistant',
      content: aiMessage
    });

    return aiMessage;
  }

  /**
   * Vorschlag für Agent generieren
   */
  async suggestResponseToAgent(userMessage) {
    try {
      const suggestion = await this.getAIResponse(userMessage);
      
      // Zeige Vorschlag im Agent-Dashboard
      console.log('💡 AI-Vorschlag für Agent:', suggestion);
      
      // Optional: Sende als interne Notiz an Tawk.to
      // (Nur Agent sieht das, nicht der Kunde)
      
    } catch (error) {
      console.error('❌ Fehler bei AI-Vorschlag:', error);
    }
  }

  /**
   * Fallback-Nachricht wenn AI nicht funktioniert
   */
  sendFallbackMessage() {
    const fallbackMessage = 
      "Vielen Dank für Ihre Nachricht! 😊\n\n" +
      "Momentan verbinde ich Sie mit einem unserer Mitarbeiter. " +
      "Bitte haben Sie einen kurzen Moment Geduld.\n\n" +
      "Durchschnittliche Wartezeit: 2-3 Minuten";
    
    if (typeof Tawk_API !== 'undefined' && Tawk_API.sendMessage) {
      Tawk_API.sendMessage(fallbackMessage);
    }
  }

  /**
   * Prüfe ob Agent verfügbar ist
   */
  checkAgentAvailability() {
    if (typeof Tawk_API !== 'undefined') {
      Tawk_API.getStatus((status) => {
        this.isAgentAvailable = (status === 'online');
        console.log('👤 Agent verfügbar:', this.isAgentAvailable);
      });
    }
  }

  /**
   * Typing-Indikator anzeigen
   */
  showTypingIndicator() {
    // Tawk.to zeigt automatisch "Agent is typing..." an
    console.log('⌨️ Typing-Indikator aktiv');
  }

  /**
   * Typing-Indikator verstecken
   */
  hideTypingIndicator() {
    console.log('⌨️ Typing-Indikator deaktiviert');
  }

  /**
   * Chat-Historie zurücksetzen
   */
  resetConversation() {
    this.conversationHistory = [];
    console.log('🔄 Chat-Historie zurückgesetzt');
  }
}

// ============================================================================
// ALTERNATIVE: Einfachere AI-Antworten ohne OpenAI
// ============================================================================

/**
 * Wenn Sie kein OpenAI verwenden möchten, können Sie auch
 * einfache regelbasierte Antworten verwenden:
 */

class SimpleAISupport {
  constructor() {
    this.responses = {
      // Versand-Fragen
      'versand': 'Wir versenden innerhalb von 3-5 Werktagen. Ab 50€ ist der Versand kostenlos! 📦',
      'lieferzeit': 'Die Standardlieferzeit beträgt 3-5 Werktage. Express-Versand (1-2 Tage) ist auch verfügbar! 🚚',
      'tracking': 'Sie erhalten eine Tracking-Nummer per E-Mail, sobald Ihre Bestellung versendet wurde. 📧',
      
      // Zahlungs-Fragen
      'zahlung': 'Wir akzeptieren PayPal, Kreditkarte, Klarna und SEPA-Lastschrift. 💳',
      'paypal': 'Ja, PayPal wird akzeptiert! Wählen Sie es einfach beim Checkout aus. ✅',
      'rechnung': 'Kauf auf Rechnung ist über Klarna möglich. 📄',
      
      // Retoure-Fragen
      'retoure': 'Sie haben 30 Tage Rückgaberecht. Möchten Sie eine Retoure anmelden? 🔄',
      'rückgabe': 'Kein Problem! Sie können innerhalb von 30 Tagen zurücksenden. Der Rückversand ist kostenlos. ✅',
      'umtausch': 'Umtausch ist möglich! Senden Sie das Produkt zurück und bestellen Sie das gewünschte neu. 🔄',
      
      // Produkt-Fragen
      'verfügbar': 'Alle Produkte mit "Auf Lager" sind sofort verfügbar! 📦',
      'größe': 'Die Größentabelle finden Sie auf der Produktseite unter "Größeninfo". 📏',
      'farbe': 'Alle verfügbaren Farben sehen Sie auf der Produktseite. 🎨',
      
      // Kontakt
      'kontakt': 'Sie erreichen uns unter support@ihre-website.de oder telefonisch unter 0800-123456. 📞',
      'öffnungszeiten': 'Unser Support ist Mo-Fr 9-18 Uhr und Sa 10-16 Uhr erreichbar. ⏰',
      
      // Default
      'default': 'Vielen Dank für Ihre Nachricht! Ein Mitarbeiter wird sich gleich bei Ihnen melden. 😊'
    };
  }

  getResponse(message) {
    const lowerMessage = message.toLowerCase();
    
    // Suche nach Keywords
    for (const [keyword, response] of Object.entries(this.responses)) {
      if (lowerMessage.includes(keyword)) {
        return response;
      }
    }
    
    // Default-Antwort
    return this.responses.default;
  }
}

// ============================================================================
// EXPORT
// ============================================================================

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { AICustomerSupport, SimpleAISupport };
}
