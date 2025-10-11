// Admin Orders Dashboard JavaScript

class AdminOrdersDashboard {
  constructor() {
    this.orders = [];
    this.filteredOrders = [];
    this.currentPage = 1;
    this.ordersPerPage = 10;
    this.currentFilter = 'all';
    this.searchTerm = '';
    
    this.init();
  }

  async init() {
    // Lade Statistiken
    await this.loadStatistics();
    
    // Lade Bestellungen
    await this.loadOrders();
    
    // Initialisiere Event-Listener
    this.attachEventListeners();
  }

  async loadStatistics() {
    try {
      const response = await fetch('/api/receipt/statistics');
      if (!response.ok) throw new Error('Fehler beim Laden der Statistiken');
      
      const stats = await response.json();
      
      // Aktualisiere UI
      document.getElementById('total-orders').textContent = stats.totalOrders?.count || 0;
      document.getElementById('total-revenue').textContent = (stats.totalRevenue?.total || 0).toFixed(2);
      document.getElementById('today-orders').textContent = stats.todayOrders?.count || 0;
      document.getElementById('pending-orders').textContent = stats.pendingOrders?.count || 0;
      
    } catch (error) {
      console.error('Statistik-Fehler:', error);
    }
  }

  async loadOrders(limit = 50, offset = 0) {
    try {
      const response = await fetch(`/api/receipt/orders?limit=${limit}&offset=${offset}`);
      if (!response.ok) throw new Error('Fehler beim Laden der Bestellungen');
      
      this.orders = await response.json();
      this.filteredOrders = [...this.orders];
      
      this.applyFilters();
      this.renderOrders();
      
    } catch (error) {
      console.error('Bestellungen laden Fehler:', error);
      this.showError('Fehler beim Laden der Bestellungen');
    }
  }

  attachEventListeners() {
    // Suchfeld
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchTerm = e.target.value.toLowerCase();
        this.applyFilters();
      });
    }

    // Filter-Badges
    document.querySelectorAll('.filter-badge').forEach(badge => {
      badge.addEventListener('click', (e) => {
        // Entferne active von allen
        document.querySelectorAll('.filter-badge').forEach(b => b.classList.remove('active'));
        // Setze active auf geklicktes
        e.target.classList.add('active');
        
        this.currentFilter = e.target.dataset.status;
        this.applyFilters();
      });
    });

    // Setze ersten Filter als aktiv
    document.querySelector('.filter-badge[data-status="all"]')?.classList.add('active');
  }

  applyFilters() {
    this.filteredOrders = this.orders.filter(order => {
      // Status-Filter
      if (this.currentFilter !== 'all' && order.order_status !== this.currentFilter) {
        return false;
      }
      
      // Suchfilter
      if (this.searchTerm) {
        const searchableText = `
          ${order.order_id} 
          ${order.receipt_number} 
          ${order.customer_name} 
          ${order.customer_email}
        `.toLowerCase();
        
        if (!searchableText.includes(this.searchTerm)) {
          return false;
        }
      }
      
      return true;
    });

    this.currentPage = 1;
    this.renderOrders();
    this.renderPagination();
  }

  renderOrders() {
    const tbody = document.getElementById('orders-tbody');
    if (!tbody) return;

    // Berechne Pagination
    const startIndex = (this.currentPage - 1) * this.ordersPerPage;
    const endIndex = startIndex + this.ordersPerPage;
    const pageOrders = this.filteredOrders.slice(startIndex, endIndex);

    if (pageOrders.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" class="text-center py-4">
            <i class="bi bi-inbox fs-1 text-muted"></i>
            <p class="text-muted">Keine Bestellungen gefunden</p>
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = pageOrders.map(order => `
      <tr>
        <td>
          <strong>${order.order_id}</strong>
        </td>
        <td>
          <span class="text-muted">${order.receipt_number}</span>
        </td>
        <td>
          <div>${order.customer_name}</div>
          <small class="text-muted">${order.customer_email}</small>
        </td>
        <td>
          ${new Date(order.created_at).toLocaleDateString('de-DE')}<br>
          <small class="text-muted">${new Date(order.created_at).toLocaleTimeString('de-DE')}</small>
        </td>
        <td>
          <strong>€ ${order.total_amount.toFixed(2)}</strong>
        </td>
        <td>
          <span class="order-status status-${order.order_status}">
            ${this.getStatusText(order.order_status)}
          </span>
        </td>
        <td>
          <div class="action-buttons">
            <button class="btn btn-sm btn-primary" onclick="adminDashboard.viewOrder('${order.order_id}')" title="Details">
              <i class="bi bi-eye"></i>
            </button>
            <button class="btn btn-sm btn-success" onclick="adminDashboard.downloadReceipt('${order.receipt_number}')" title="Kassenbon">
              <i class="bi bi-receipt"></i>
            </button>
            <button class="btn btn-sm btn-warning" onclick="adminDashboard.updateStatus('${order.order_id}')" title="Status ändern">
              <i class="bi bi-pencil"></i>
            </button>
          </div>
        </td>
      </tr>
    `).join('');
  }

  renderPagination() {
    const pagination = document.getElementById('pagination');
    if (!pagination) return;

    const totalPages = Math.ceil(this.filteredOrders.length / this.ordersPerPage);
    
    if (totalPages <= 1) {
      pagination.innerHTML = '';
      return;
    }

    let paginationHTML = '';
    
    // Previous button
    paginationHTML += `
      <li class="page-item ${this.currentPage === 1 ? 'disabled' : ''}">
        <a class="page-link" href="#" onclick="adminDashboard.goToPage(${this.currentPage - 1})">
          <i class="bi bi-chevron-left"></i>
        </a>
      </li>
    `;

    // Page numbers
    for (let i = 1; i <= totalPages; i++) {
      if (i === 1 || i === totalPages || (i >= this.currentPage - 2 && i <= this.currentPage + 2)) {
        paginationHTML += `
          <li class="page-item ${i === this.currentPage ? 'active' : ''}">
            <a class="page-link" href="#" onclick="adminDashboard.goToPage(${i})">${i}</a>
          </li>
        `;
      } else if (i === this.currentPage - 3 || i === this.currentPage + 3) {
        paginationHTML += `
          <li class="page-item disabled">
            <span class="page-link">...</span>
          </li>
        `;
      }
    }

    // Next button
    paginationHTML += `
      <li class="page-item ${this.currentPage === totalPages ? 'disabled' : ''}">
        <a class="page-link" href="#" onclick="adminDashboard.goToPage(${this.currentPage + 1})">
          <i class="bi bi-chevron-right"></i>
        </a>
      </li>
    `;

    pagination.innerHTML = paginationHTML;
  }

  goToPage(page) {
    const totalPages = Math.ceil(this.filteredOrders.length / this.ordersPerPage);
    
    if (page < 1 || page > totalPages) return;
    
    this.currentPage = page;
    this.renderOrders();
    this.renderPagination();
    
    // Scrolle nach oben
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async viewOrder(orderId) {
    try {
      const response = await fetch(`/api/receipt/order/${orderId}`);
      if (!response.ok) throw new Error('Bestellung nicht gefunden');
      
      const order = await response.json();
      
      // Zeige Modal mit Details
      this.showOrderDetail(order);
      
    } catch (error) {
      console.error('Bestellung laden Fehler:', error);
      alert('Fehler beim Laden der Bestellung');
    }
  }

  showOrderDetail(order) {
    const modal = new bootstrap.Modal(document.getElementById('orderDetailModal'));
    const content = document.getElementById('order-detail-content');
    
    content.innerHTML = `
      <div class="row">
        <div class="col-md-6">
          <h6 class="text-muted">Bestellinformationen</h6>
          <div class="order-detail-item">
            <strong>Bestellnummer:</strong> ${order.order_id}
          </div>
          <div class="order-detail-item">
            <strong>Kassenbon-Nr:</strong> ${order.receipt_number}
          </div>
          <div class="order-detail-item">
            <strong>Datum:</strong> ${new Date(order.created_at).toLocaleString('de-DE')}
          </div>
          <div class="order-detail-item">
            <strong>Status:</strong> 
            <span class="order-status status-${order.order_status}">
              ${this.getStatusText(order.order_status)}
            </span>
          </div>
        </div>
        <div class="col-md-6">
          <h6 class="text-muted">Kundeninformationen</h6>
          <div class="order-detail-item">
            <strong>Name:</strong> ${order.customer_name}
          </div>
          <div class="order-detail-item">
            <strong>E-Mail:</strong> ${order.customer_email}
          </div>
          ${order.customer_phone ? `
            <div class="order-detail-item">
              <strong>Telefon:</strong> ${order.customer_phone}
            </div>
          ` : ''}
          ${order.shipping_address ? `
            <div class="order-detail-item">
              <strong>Lieferadresse:</strong><br>
              ${this.formatAddress(order.shipping_address)}
            </div>
          ` : ''}
        </div>
      </div>
      
      <hr>
      
      <h6 class="text-muted">Bestellte Artikel</h6>
      <table class="table table-sm">
        <thead>
          <tr>
            <th>Artikel</th>
            <th>Farbe</th>
            <th>Menge</th>
            <th>Einzelpreis</th>
            <th>Gesamt</th>
          </tr>
        </thead>
        <tbody>
          ${order.items.map(item => `
            <tr>
              <td>
                ${item.product_name}
                ${item.product_sku ? `<br><small class="text-muted">SKU: ${item.product_sku}</small>` : ''}
              </td>
              <td>${item.color || '-'}</td>
              <td>${item.quantity}</td>
              <td>€ ${item.unit_price.toFixed(2)}</td>
              <td>€ ${item.total_price.toFixed(2)}</td>
            </tr>
          `).join('')}
        </tbody>
        <tfoot>
          <tr>
            <td colspan="4" class="text-end"><strong>Zwischensumme:</strong></td>
            <td><strong>€ ${order.subtotal.toFixed(2)}</strong></td>
          </tr>
          ${order.shipping_cost > 0 ? `
            <tr>
              <td colspan="4" class="text-end">Versandkosten:</td>
              <td>€ ${order.shipping_cost.toFixed(2)}</td>
            </tr>
          ` : ''}
          <tr>
            <td colspan="4" class="text-end">MwSt. (19%):</td>
            <td>€ ${order.tax_amount.toFixed(2)}</td>
          </tr>
          <tr class="table-active">
            <td colspan="4" class="text-end"><strong>Gesamtsumme:</strong></td>
            <td><strong>€ ${order.total_amount.toFixed(2)}</strong></td>
          </tr>
        </tfoot>
      </table>
    `;
    
    // Resend Receipt Button
    const resendBtn = document.getElementById('resend-receipt-btn');
    resendBtn.onclick = () => this.resendReceipt(order.order_id);
    
    modal.show();
  }

  formatAddress(addressJson) {
    try {
      const addr = JSON.parse(addressJson);
      return `${addr.street || ''}<br>${addr.zip || ''} ${addr.city || ''}<br>${addr.country || ''}`;
    } catch {
      return addressJson;
    }
  }

  async resendReceipt(orderId) {
    const email = prompt('E-Mail-Adresse für Kassenbon-Versand:');
    if (!email) return;
    
    try {
      const response = await fetch(`/api/receipt/resend/${orderId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      
      if (!response.ok) throw new Error('Fehler beim Versand');
      
      alert('Kassenbon wurde erfolgreich versendet!');
      
    } catch (error) {
      console.error('Kassenbon versenden Fehler:', error);
      alert('Fehler beim Versenden des Kassenbons');
    }
  }

  downloadReceipt(receiptNumber) {
    window.open(`/receipts/receipt_${receiptNumber}.pdf`, '_blank');
  }

  async updateStatus(orderId) {
    const statuses = [
      { value: 'pending', text: 'Ausstehend' },
      { value: 'processing', text: 'In Bearbeitung' },
      { value: 'shipped', text: 'Versendet' },
      { value: 'completed', text: 'Abgeschlossen' },
      { value: 'cancelled', text: 'Storniert' }
    ];
    
    const statusOptions = statuses.map(s => `<option value="${s.value}">${s.text}</option>`).join('');
    
    const newStatus = prompt('Neuer Status:\n\n' + statuses.map(s => `${s.value}: ${s.text}`).join('\n'));
    
    if (!newStatus) return;
    
    try {
      const response = await fetch(`/api/receipt/order/${orderId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      
      if (!response.ok) throw new Error('Fehler beim Status-Update');
      
      alert('Status wurde erfolgreich aktualisiert!');
      this.loadOrders(); // Neu laden
      
    } catch (error) {
      console.error('Status-Update Fehler:', error);
      alert('Fehler beim Aktualisieren des Status');
    }
  }

  getStatusText(status) {
    const statusTexts = {
      'pending': 'Ausstehend',
      'processing': 'In Bearbeitung',
      'shipped': 'Versendet',
      'completed': 'Abgeschlossen',
      'cancelled': 'Storniert'
    };
    return statusTexts[status] || status;
  }

  showError(message) {
    const tbody = document.getElementById('orders-tbody');
    if (tbody) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" class="text-center py-4">
            <div class="alert alert-danger">
              <i class="bi bi-exclamation-triangle"></i> ${message}
            </div>
          </td>
        </tr>
      `;
    }
  }
}

// Globale Instanz für onclick-Handler
let adminDashboard;

// Initialisiere beim Laden
document.addEventListener('DOMContentLoaded', () => {
  adminDashboard = new AdminOrdersDashboard();
});

// Export-Funktion
function exportOrders() {
  // Erstelle CSV
  let csv = 'Bestellnr,Kassenbon,Kunde,E-Mail,Datum,Betrag,Status\n';
  
  adminDashboard.filteredOrders.forEach(order => {
    csv += `"${order.order_id}","${order.receipt_number}","${order.customer_name}","${order.customer_email}","${new Date(order.created_at).toLocaleString('de-DE')}","€ ${order.total_amount.toFixed(2)}","${adminDashboard.getStatusText(order.order_status)}"\n`;
  });
  
  // Download CSV
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `bestellungen_${new Date().toISOString().split('T')[0]}.csv`;
  link.click();
}
