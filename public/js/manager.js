// Manager Dashboard Logic
let socket = null;
let isPollingMode = false;
const isVercel = window.location.hostname.endsWith('vercel.app');

// State variables
let tables = [];
let transactions = [];
let filteredTransactions = []; // Filtered copy of transactions list
let menuItems = [];
let selectedTableId = null;
let selectedTransactionId = null;
let currentTab = 'tables'; // 'tables' or 'reports'
let currentDiscountAmount = 0; // Discount applied in checkout modal
let currentPaymentMethod = 'cash'; // Payment method in checkout modal ('cash' or 'bank')
let notificationAudioContext = null;
let revenueChartInstance = null;
let revenueBarChartInstance = null;
let dishesChartInstance = null;
let activeMenuMgmtCategory = 'all'; // Filter state for menu management categories

// DOM Elements
const connectionDot = document.getElementById('connection-dot');
const tabTables = document.getElementById('tab-tables');
const tabReports = document.getElementById('tab-reports');
const tablesDashboardView = document.getElementById('tables-dashboard-view');
const reportsDashboardView = document.getElementById('reports-dashboard-view');

// Active Tables Elements
const managerTablesContainer = document.getElementById('manager-tables-container');
const tableDetailsPanel = document.getElementById('table-details-panel');

// Checkout Modal Elements
const checkoutModal = document.getElementById('checkout-modal');
const checkoutModalTitle = document.getElementById('checkout-modal-title');
const checkoutBillItemsBody = document.getElementById('checkout-bill-items-body');
const checkoutBillTotal = document.getElementById('checkout-bill-total');
const inputReceivedCash = document.getElementById('input-received-cash');
const displayChangeAmount = document.getElementById('display-change-amount');
const btnCancelCheckout = document.getElementById('btn-cancel-checkout');
const btnCloseCheckoutModal = document.getElementById('btn-close-checkout-modal');
const btnConfirmCheckoutPay = document.getElementById('btn-confirm-checkout-pay');

// History & Analytics Elements
const historyListContainer = document.getElementById('history-list-container');
const billDetailsPanel = document.getElementById('bill-details-panel');
const statTodayRevenue = document.getElementById('stat-today-revenue');
const statMonthRevenue = document.getElementById('stat-month-revenue');
const statYearRevenue = document.getElementById('stat-year-revenue');
const statTotalDiscount = document.getElementById('stat-total-discount');
const statTotalBills = document.getElementById('stat-total-bills');
const statBestSeller = document.getElementById('stat-best-seller');
const menuSalesStatsBody = document.getElementById('menu-sales-stats-body');

// Time Filters Elements
const filterPreset = document.getElementById('filter-preset');
const filterCustomDates = document.getElementById('filter-custom-dates');
const filterStartDate = document.getElementById('filter-start-date');
const filterEndDate = document.getElementById('filter-end-date');
const btnApplyFilter = document.getElementById('btn-apply-filter');

// Staff Management Elements
const tabStaff = document.getElementById('tab-staff');
const staffDashboardView = document.getElementById('staff-dashboard-view');
const staffListContainer = document.getElementById('staff-list-container');
const createStaffForm = document.getElementById('create-staff-form');
const staffUsernameInput = document.getElementById('staff-username-input');
const staffPasswordInput = document.getElementById('staff-password-input');
const staffErrorBanner = document.getElementById('staff-error-banner');
const staffErrorMessage = document.getElementById('staff-error-message');
const staffSuccessBanner = document.getElementById('staff-success-banner');
const btnCreateStaffSubmit = document.getElementById('btn-create-staff-submit');

// Menu Management Elements
const tabMenuMgmt = document.getElementById('tab-menu-mgmt');
const menuMgmtDashboardView = document.getElementById('menu-mgmt-dashboard-view');
const menuMgmtGridContainer = document.getElementById('menu-mgmt-grid-container');
const btnCreateMenuItem = document.getElementById('btn-create-menu-item');
const menuMgmtCategoryStrip = document.getElementById('menu-mgmt-category-strip');
const menuItemModal = document.getElementById('menu-item-modal');
const menuItemModalTitle = document.getElementById('menu-item-modal-title');
const menuItemForm = document.getElementById('menu-item-form');
const menuItemIdInput = document.getElementById('menu-item-id-input');
const menuItemNameInput = document.getElementById('menu-item-name-input');
const menuItemPriceInput = document.getElementById('menu-item-price-input');
const menuItemCategoryInput = document.getElementById('menu-item-category-input');
const menuItemDescInput = document.getElementById('menu-item-desc-input');
const menuItemEmojiInput = document.getElementById('menu-item-emoji-input');
const menuItemImageInput = document.getElementById('menu-item-image-input');
const btnCancelMenuItemModal = document.getElementById('btn-cancel-menu-item-modal');
const btnCloseMenuItemModal = document.getElementById('btn-close-menu-item-modal');
const btnDeleteMenuItem = document.getElementById('btn-delete-menu-item');
const menuItemEmojiPreview = document.getElementById('menu-item-emoji-preview');
const menuItemImagePreview = document.getElementById('menu-item-image-preview');
const imageUploadCardZone = document.getElementById('image-upload-card-zone');

// Format Currency
function formatVND(amount) {
  return amount.toLocaleString('vi-VN') + 'đ';
}

// Format Date-Time
function formatTime(isoString) {
  if (!isoString) return '';
  const d = new Date(isoString);
  return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) + ' - ' + d.toLocaleDateString('vi-VN');
}

// Initial Fetch
async function init() {
  try {
    const [tablesRes, transactionsRes, menuRes] = await Promise.all([
      fetch('/api/tables'),
      fetch('/api/transactions'),
      fetch('/api/menu')
    ]);
    
    if (tablesRes.status === 401 || transactionsRes.status === 401 || menuRes.status === 401) {
      window.location.href = '/login.html';
      return;
    }
    
    tables = await tablesRes.json();
    transactions = await transactionsRes.json();
    menuItems = await menuRes.json();
    
    renderTables();
    renderTransactionsList();
    updateAnalytics();
    
    // Initialize WebSockets or Polling
    loadSocketScript(() => {
      initConnection();
    });

    // Initialize custom selects
    initCustomSelects();

    // Prepare audio context on user gesture to bypass autoplay blocks
    initAudioOnUserInteraction();
  } catch (error) {
    console.error('Lỗi tải dữ liệu ban đầu:', error);
  }
}

// Dynamically load socket.io script when not on Vercel
function loadSocketScript(callback) {
  if (isVercel) {
    callback();
    return;
  }
  const script = document.createElement('script');
  script.src = '/socket.io/socket.io.js';
  script.onload = () => callback();
  script.onerror = () => {
    console.warn('Failed to load socket.io script. Using polling.');
    callback();
  };
  document.head.appendChild(script);
}

// Initialize WebSockets or HTTP Polling Fallback
function initConnection() {
  if (typeof io !== 'undefined' && !isVercel) {
    try {
      socket = io({
        reconnectionAttempts: 2,
        timeout: 3000
      });
      
      socket.on('connect', () => {
        connectionDot.className = 'status-dot';
        console.log('⚡ Connected via WebSockets.');
      });
      
      socket.on('disconnect', () => {
        connectionDot.className = 'status-dot offline';
      });
      
      socket.on('tables_updated', (updatedTables) => {
        tables = updatedTables;
        renderTables();
        if (selectedTableId !== null) {
          const table = tables.find(t => t.id === selectedTableId);
          renderTableDetails(table);
        }
      });
      
      socket.on('menu_updated', (updatedMenu) => {
        menuItems = updatedMenu;
        if (currentTab === 'menu-mgmt') {
          renderMenuMgmtGrid();
        }
      });
      
      socket.on('order_submitted', (data) => {
        showToast(`🔔 ${data.tableName} vừa gọi món thành công!`);
        playNotificationSound();
      });
      
      socket.on('transactions_updated', (updatedTransactions) => {
        transactions = updatedTransactions;
        applyDateFilter();
      });
      
      socket.on('connect_error', () => {
        console.warn('WebSocket connection failed. Switching to Polling.');
        activatePolling();
      });
    } catch (e) {
      console.warn('Socket initialization failed, using Polling.', e);
      activatePolling();
    }
  } else {
    console.log('🌐 Vercel or Socket.io not available. Active HTTP Polling Mode.');
    activatePolling();
  }
}

function activatePolling() {
  if (isPollingMode) return;
  isPollingMode = true;
  connectionDot.className = 'status-dot offline';
  
  if (socket) {
    socket.disconnect();
  }
  
  // Initial fetch
  fetchDataPoll();
  
  // Periodic poll every 4 seconds
  setInterval(fetchDataPoll, 4000);
}

async function fetchDataPoll() {
  try {
    const [tablesRes, transactionsRes, menuRes] = await Promise.all([
      fetch('/api/tables'),
      fetch('/api/transactions'),
      fetch('/api/menu')
    ]);
    
    if (tablesRes.ok && transactionsRes.ok && menuRes.ok) {
      const newTables = await tablesRes.json();
      const newTransactions = await transactionsRes.json();
      const newMenuItems = await menuRes.json();
      
      // Check if there is any new order before updating local cache
      if (tables && tables.length > 0) {
        newTables.forEach(newTable => {
          const oldTable = tables.find(t => t.id === newTable.id);
          if (oldTable) {
            const oldQty = oldTable.order.reduce((sum, item) => sum + item.quantity, 0);
            const newQty = newTable.order.reduce((sum, item) => sum + item.quantity, 0);
            if (newQty > oldQty) {
              console.log(`[Order Alert] Table ${newTable.name} updated: items increased from ${oldQty} to ${newQty}`);
              showToast(`🔔 Bàn ${newTable.name} vừa gọi thêm món mới!`);
              playNotificationSound();
            }
          }
        });
      }
      
      tables = newTables;
      transactions = newTransactions;
      menuItems = newMenuItems;
      
      renderTables();
      applyDateFilter(); // This calls renderTransactionsList and updateAnalytics inside it
      
      if (selectedTableId !== null) {
        const table = tables.find(t => t.id === selectedTableId);
        renderTableDetails(table);
      }
      
      if (currentTab === 'menu-mgmt') {
        renderMenuMgmtGrid();
      }
    }
  } catch (err) {
    console.error('Polling error:', err);
  }
}

// Toast notification function
function showToast(message) {
  const toastContainer = document.getElementById('toast-container');
  if (!toastContainer) return;
  
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `
    <div class="toast-content">
      <span>${message}</span>
    </div>
    <button class="btn-toast-close">&times;</button>
  `;
  
  toast.querySelector('.btn-toast-close').addEventListener('click', () => {
    toast.remove();
  });
  
  toastContainer.appendChild(toast);
  
  // Auto-remove element from DOM after animation completes
  setTimeout(() => {
    toast.remove();
  }, 4500);
}

// Synthesize a beautiful double-beep chime using HTML5 Web Audio API
function playNotificationSound() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    
    // Use user-gesture initialized context or fallback to new instance
    const ctx = notificationAudioContext || new AudioContext();
    if (ctx.state === 'suspended') {
      console.warn('[AudioContext] Suspended! Resuming context...');
      ctx.resume();
    }
    
    // Play first tone (D5 note, 587.33Hz)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(587.33, ctx.currentTime);
    gain1.gain.setValueAtTime(0, ctx.currentTime);
    gain1.gain.linearRampToValueAtTime(0.2, ctx.currentTime + 0.05);
    gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    
    osc1.start(ctx.currentTime);
    osc1.stop(ctx.currentTime + 0.3);
    
    // Play second tone (A5 note, 880Hz) after a short delay
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(880, ctx.currentTime + 0.12);
    gain2.gain.setValueAtTime(0, ctx.currentTime + 0.12);
    gain2.gain.linearRampToValueAtTime(0.2, ctx.currentTime + 0.17);
    gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);
    
    osc2.start(ctx.currentTime + 0.12);
    osc2.stop(ctx.currentTime + 0.45);
    console.log('[Audio] Notification sound chime triggered successfully.');
  } catch (e) {
    console.warn('Cannot play synthesized audio notification:', e);
  }
}

// User interaction gesture binds to unlock/resume AudioContext
function initAudioOnUserInteraction() {
  const resumeAudio = () => {
    if (!notificationAudioContext) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        notificationAudioContext = new AudioContext();
        console.log('[AudioContext] Initialized via user gesture');
      }
    }
    if (notificationAudioContext && notificationAudioContext.state === 'suspended') {
      notificationAudioContext.resume().then(() => {
        console.log('[AudioContext] Resumed successfully via user gesture');
      });
    }
    // Remove listeners once active
    document.removeEventListener('click', resumeAudio);
    document.removeEventListener('touchstart', resumeAudio);
  };
  
  document.addEventListener('click', resumeAudio);
  document.addEventListener('touchstart', resumeAudio);
}

// Tab Navigation logic
tabTables.addEventListener('click', () => {
  currentTab = 'tables';
  tabTables.classList.add('active');
  tabReports.classList.remove('active');
  tabStaff.classList.remove('active');
  tabMenuMgmt.classList.remove('active');
  tablesDashboardView.style.display = 'grid';
  reportsDashboardView.style.display = 'none';
  staffDashboardView.style.display = 'none';
  menuMgmtDashboardView.style.display = 'none';
});

tabReports.addEventListener('click', () => {
  currentTab = 'reports';
  tabReports.classList.add('active');
  tabTables.classList.remove('active');
  tabStaff.classList.remove('active');
  tabMenuMgmt.classList.remove('active');
  tablesDashboardView.style.display = 'none';
  reportsDashboardView.style.display = 'grid';
  staffDashboardView.style.display = 'none';
  menuMgmtDashboardView.style.display = 'none';
  applyDateFilter();
});

tabStaff.addEventListener('click', () => {
  currentTab = 'staff';
  tabStaff.classList.add('active');
  tabTables.classList.remove('active');
  tabReports.classList.remove('active');
  tabMenuMgmt.classList.remove('active');
  tablesDashboardView.style.display = 'none';
  reportsDashboardView.style.display = 'none';
  staffDashboardView.style.display = 'grid';
  menuMgmtDashboardView.style.display = 'none';
  loadStaffList();
  
  // Clear staff banners & input
  staffErrorBanner.style.display = 'none';
  staffSuccessBanner.style.display = 'none';
  staffUsernameInput.value = '';
  staffPasswordInput.value = '';
});

tabMenuMgmt.addEventListener('click', () => {
  currentTab = 'menu-mgmt';
  tabMenuMgmt.classList.add('active');
  tabTables.classList.remove('active');
  tabReports.classList.remove('active');
  tabStaff.classList.remove('active');
  tablesDashboardView.style.display = 'none';
  reportsDashboardView.style.display = 'none';
  staffDashboardView.style.display = 'none';
  menuMgmtDashboardView.style.display = 'block';
  renderMenuMgmtGrid();
});

// Render Active Tables Grid Map
// Calculate sitting time in minutes/hours
function getSittingTimeText(updatedAtStr) {
  if (!updatedAtStr) return '';
  const orderTime = new Date(updatedAtStr);
  const now = new Date();
  const diffMs = now - orderTime;
  if (diffMs < 0) return '0 phút';
  
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 60) {
    return `${diffMins} phút`;
  } else {
    const hours = Math.floor(diffMins / 60);
    const mins = diffMins % 60;
    return `${hours}g ${mins}p`;
  }
}

function getFormattedTime(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const hours = String(date.getHours()).padStart(2, '0');
  const mins = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${mins}`;
}

// Render live occupancy status widgets
function updateTableStatsSummary() {
  const statsContainer = document.getElementById('tables-stats-summary');
  if (!statsContainer) return;
  
  const total = tables.length;
  const occupied = tables.filter(t => t.status === 'eating').length;
  const empty = total - occupied;
  
  statsContainer.innerHTML = `
    <div class="stat-badge-v2">
      <span class="stat-dot-v2" style="background-color: var(--border-strong);"></span>
      Tổng: <span class="bold" style="color: var(--ink); margin-left: 2px;">${total}</span>
    </div>
    <div class="stat-badge-v2 active">
      <span class="stat-dot-v2" style="background-color: var(--primary);"></span>
      Đang dùng: <span class="bold" style="margin-left: 2px;">${occupied}</span>
    </div>
    <div class="stat-badge-v2 empty">
      <span class="stat-dot-v2" style="background-color: var(--success);"></span>
      Bàn trống: <span class="bold" style="margin-left: 2px;">${empty}</span>
    </div>
  `;
}

function renderTables() {
  managerTablesContainer.innerHTML = '';
  updateTableStatsSummary();
  
  tables.forEach(table => {
    const isOccupied = table.status === 'eating';
    const card = document.createElement('div');
    card.className = `manager-table-card ${isOccupied ? 'occupied' : ''} ${selectedTableId === table.id ? 'active' : ''}`;
    
    let subtotal = 0;
    let itemsCount = 0;
    let itemsDetailHtml = '';
    
    if (isOccupied && table.order.length > 0) {
      itemsCount = table.order.reduce((sum, item) => sum + item.quantity, 0);
      subtotal = table.order.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      
      itemsDetailHtml = `
        <div class="table-card-items-list" style="margin-top: 8px; border-top: 1px solid var(--hairline-soft); padding-top: 8px; text-align: left; display: flex; flex-direction: column; gap: 4px;">
          ${table.order.map(item => `
            <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 4px; line-height: 1.2; padding: 2px 0; font-size: 12px;">
              <div style="display: flex; flex-direction: column; overflow: hidden; max-width: 70%;">
                <span style="font-weight: 500; text-overflow: ellipsis; overflow: hidden; white-space: nowrap;" title="${item.name}">
                  ${item.emoji} ${item.name}
                </span>
                <span class="text-muted" style="font-size: 10px; margin-left: 14px;">
                  SL: ${item.quantity} × ${formatVND(item.price)}
                </span>
              </div>
              <span class="bold" style="flex-shrink: 0; font-size: 12px; color: var(--ink); align-self: flex-start;">
                ${formatVND(item.price * item.quantity)}
              </span>
            </div>
            ${item.notes ? `
              <div style="font-size: 10px; color: var(--primary-error-text); font-style: italic; margin-left: 14px; margin-bottom: 4px; line-height: 1.1;">
                * ${item.notes}
              </div>
            ` : ''}
          `).join('')}
        </div>
      `;
    }

    card.innerHTML = `
      <div class="table-card-header" style="border-bottom: ${isOccupied ? '1px solid var(--hairline-soft)' : 'none'}; padding-bottom: ${isOccupied ? '4px' : '0'};">
        <div style="display: flex; flex-direction: column; text-align: left;">
          <span class="table-card-title">${table.name}</span>
          ${isOccupied && table.updatedAt ? `
            <span style="font-size: 11px; color: var(--muted); font-weight: 500; margin-top: 2px;">
              Vào: ${getFormattedTime(table.updatedAt)} (${getSittingTimeText(table.updatedAt)})
            </span>
          ` : ''}
        </div>
        <span class="table-card-badge ${isOccupied ? 'occupied' : 'empty'}">
          ${isOccupied ? 'Đang dùng' : 'Trống'}
        </span>
      </div>
      <div class="table-card-body" style="display: flex; flex-direction: column; justify-content: space-between; flex-grow: 1; margin-top: 4px;">
        ${isOccupied ? `
          ${itemsDetailHtml}
          <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 8px; border-top: 1px dashed var(--border-strong); padding-top: 6px;">
            <span class="table-card-items-count" style="font-size: 11px; color: var(--muted);">${itemsCount} món</span>
            <span class="table-card-price" style="font-size: 15px; font-weight: 700; color: var(--primary);">${formatVND(subtotal)}</span>
          </div>
        ` : `
          <span class="table-card-items-count text-muted" style="font-size: 13px;">Bàn trống</span>
        `}
      </div>
    `;
    
    card.addEventListener('click', () => {
      selectedTableId = table.id;
      // Re-render grid to update active outline state
      renderTables();
      renderTableDetails(table);
    });
    
    managerTablesContainer.appendChild(card);
  });
}

// Auto-refresh sitting time timer in UI every 15 seconds
setInterval(() => {
  if (currentTab === 'tables') {
    renderTables();
  }
}, 15000);

// Render Table Details Panel (Right Section)
function renderTableDetails(table) {
  tableDetailsPanel.innerHTML = '';
  
  if (!table || table.status === 'empty' || table.order.length === 0) {
    tableDetailsPanel.innerHTML = `
      <div class="no-table-selected">
        <div class="no-table-icon">🪑</div>
        <div class="bold" style="font-size: 16px;">${table ? table.name : 'Chưa chọn bàn nào'}</div>
        <p style="font-size:14px; line-height: 1.4;">
          ${table ? 'Bàn này đang trống. Hãy đợi phục vụ gửi order hoặc ghi món ăn.' : 'Chọn một bàn ăn ở bản đồ bên trái để xem chi tiết các món ăn đã gọi và xử lý thanh toán.'}
        </p>
      </div>
    `;
    return;
  }

  const itemsCount = table.order.reduce((sum, item) => sum + item.quantity, 0);
  const totalAmount = table.order.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  // Panel structure mimicking Airbnb booking card
  tableDetailsPanel.innerHTML = `
    <div class="panel-header">
      <div class="panel-header-title">
        <h2>${table.name}</h2>
        <p>Phục vụ cập nhật: ${formatTime(table.updatedAt)}</p>
      </div>
      <div class="panel-header-price">
        <div class="panel-price-amount">${formatVND(totalAmount)}</div>
        <div class="panel-price-label">Tổng cộng</div>
      </div>
    </div>

    <h4 class="bold" style="font-size: 15px; margin-top: var(--space-xs);">Danh sách món đã gọi (${itemsCount})</h4>
    
    <div class="panel-items-list">
      ${table.order.map(item => `
        <div class="panel-item-row">
          <div>
            <span class="panel-item-name">${item.emoji} ${item.name}</span>
            <div class="panel-item-qty">Số lượng: ${item.quantity} × ${formatVND(item.price)}</div>
            ${item.notes ? `<div class="panel-item-note">Ghi chú: ${item.notes}</div>` : ''}
          </div>
          <span class="panel-item-subtotal">${formatVND(item.price * item.quantity)}</span>
        </div>
      `).join('')}
    </div>

    <button class="btn btn-primary full-width mt-md" id="btn-trigger-checkout" style="margin-top: 12px; height: 50px;">
      Thanh toán & Trả bàn
    </button>
  `;

  document.getElementById('btn-trigger-checkout').addEventListener('click', () => openCheckoutModal(table));
}

// Global Print Receipt Function
async function printReceipt(tableObj, orderItems, discountAmount, receivedAmount, transactionId = null, timestamp = null) {
  const subtotal = orderItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const finalTotal = Math.max(0, subtotal - discountAmount);
  const changeAmount = receivedAmount ? (receivedAmount - finalTotal) : 0;

  // Format date/times
  const orderTimeStr = tableObj.updatedAt 
    ? formatTime(tableObj.updatedAt).replace(' - ', ' • ') 
    : (timestamp ? formatTime(timestamp).replace(' - ', ' • ') : formatTime(new Date().toISOString()).replace(' - ', ' • '));

  const checkoutTimeStr = timestamp 
    ? formatTime(timestamp).replace(' - ', ' • ') 
    : formatTime(new Date().toISOString()).replace(' - ', ' • ');

  let payMethod = currentPaymentMethod;
  if (tableObj && tableObj.paymentMethod) {
    payMethod = tableObj.paymentMethod;
  }
  const payMethodLabel = payMethod === 'bank' ? 'Chuyển khoản' : 'Tiền mặt';

  const templateData = {
    table_name: tableObj.name,
    order_time: orderTimeStr,
    checkout_time: checkoutTimeStr,
    subtotal: formatVND(subtotal),
    discount: discountAmount > 0 ? `-${formatVND(discountAmount)}` : '0đ',
    final_total: formatVND(finalTotal),
    received_amount: formatVND(receivedAmount || finalTotal),
    change_amount: formatVND(Math.max(0, changeAmount)),
    payment_method: payMethodLabel,
    items: orderItems.map(item => ({
      emoji: item.emoji || '🍽️',
      name: item.name,
      price: formatVND(item.price),
      quantity: item.quantity,
      total: formatVND(item.price * item.quantity)
    }))
  };

  showToast('🔄 Đang gửi dữ liệu in hóa đơn...');
  try {
    const response = await fetch('/api/print-docx', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(templateData)
    });
    
    if (!response.ok) {
      throw new Error('Lỗi phản hồi từ server');
    }
    
    const htmlContent = await response.text();
    
    // Print by writing the styled HTML content to a hidden iframe
    let iframe = document.getElementById('print-receipt-iframe');
    if (iframe) {
      iframe.remove();
    }
    
    iframe = document.createElement('iframe');
    iframe.id = 'print-receipt-iframe';
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    
    document.body.appendChild(iframe);
    
    const doc = iframe.contentWindow.document;
    doc.open();
    doc.write(htmlContent);
    doc.close();

    // Dynamically adjust header text alignments and font sizes based on text content
    const paragraphs = doc.getElementsByTagName('p');
    for (let p of paragraphs) {
      const txt = p.textContent.trim();
      
      // Left-align Order and Checkout times
      if (txt.includes('Giờ vào') || txt.includes('Giờ ra')) {
        p.style.textAlign = 'left';
        p.style.fontSize = '12px';
      }
      
      // Increase size for TẤM XƯA
      if (txt.toUpperCase().includes('TẤM XƯA')) {
        p.style.fontSize = '22px';
        p.style.fontWeight = 'bold';
        p.style.letterSpacing = '1px';
      }
      
      // Increase size for HOÁ ĐƠN
      if (txt.toUpperCase().includes('HOÁ ĐƠN') || txt.toUpperCase().includes('HÓA ĐƠN')) {
        p.style.fontSize = '20px';
        p.style.fontWeight = 'bold';
        p.style.marginTop = '15px';
      }
      
      // Increase size for Table Name (e.g. Bàn 7)
      if (txt.startsWith('Bàn') || (txt.includes('Bàn') && txt.length < 15)) {
        p.style.fontSize = '16px';
        p.style.fontWeight = 'bold';
        p.style.marginBottom = '10px';
      }
    }
    
    iframe.contentWindow.focus();
    // Wait a brief moment to ensure DOM renders properly, then trigger print
    setTimeout(() => {
      iframe.contentWindow.print();
      showToast('✅ Đã mở hộp thoại in hóa đơn!');
    }, 300);
    
  } catch (error) {
    console.error('Lỗi xuất hóa đơn Word:', error);
    showToast('❌ Không thể mở hộp thoại in hóa đơn.');
  }
}

// Open Cash Calculation Modal
function openCheckoutModal(table) {
  checkoutModalTitle.textContent = `Thanh toán - ${table.name}`;
  
  // Render bill details in modal
  checkoutBillItemsBody.innerHTML = '';
  table.order.forEach(item => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>
        <div class="checkout-item-details">
          <span class="checkout-item-name">${item.emoji} ${item.name}</span>
          ${item.notes ? `<span class="checkout-item-note-badge">Ghi chú: ${item.notes}</span>` : ''}
        </div>
      </td>
      <td class="text-center bold" style="font-size: 15px; vertical-align: middle;">${item.quantity}</td>
      <td class="text-right bold" style="vertical-align: middle;">${formatVND(item.price * item.quantity)}</td>
    `;
    checkoutBillItemsBody.appendChild(row);
  });

  const totalAmount = table.order.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  checkoutBillTotal.textContent = formatVND(totalAmount);

  // Discount elements references
  const discountTypeInput = document.getElementById('checkout-discount-type');
  const discountValueInput = document.getElementById('checkout-discount-value');
  const calcSummaryCard = document.getElementById('checkout-calc-summary');
  const summarySubtotal = document.getElementById('checkout-summary-subtotal');
  const summaryDiscount = document.getElementById('checkout-summary-discount');
  const summaryFinalTotal = document.getElementById('checkout-summary-final-total');
  
  // Payment methods elements references
  const methodCashBtn = document.getElementById('method-cash');
  const methodBankBtn = document.getElementById('method-bank');
  const cashFields = document.getElementById('cash-payment-fields');
  const bankFields = document.getElementById('bank-payment-fields');

  // Reset Payment Method to default Cash
  currentPaymentMethod = 'cash';
  methodCashBtn.classList.add('active');
  methodBankBtn.classList.remove('active');
  cashFields.style.display = 'block';
  bankFields.style.display = 'none';

  // Reset Discount inputs & state
  discountTypeInput.value = 'none';
  discountValueInput.value = '0';
  discountValueInput.disabled = true;
  calcSummaryCard.style.display = 'none';
  currentDiscountAmount = 0;
  
  // Reset Cash inputs & displays
  inputReceivedCash.value = '';
  displayChangeAmount.textContent = formatVND(0);
  displayChangeAmount.className = 'change-value-v2';
  btnConfirmCheckoutPay.disabled = true;

  // Real-time calculation function
  function updateCheckoutCalculations() {
    const type = discountTypeInput.value;
    const value = parseFloat(discountValueInput.value) || 0;
    
    if (type === 'none') {
      discountValueInput.disabled = true;
      discountValueInput.value = '0';
      calcSummaryCard.style.display = 'none';
      currentDiscountAmount = 0;
    } else {
      discountValueInput.disabled = false;
      if (type === 'percent') {
        let pct = Math.max(0, Math.min(100, value));
        if (value !== pct) discountValueInput.value = pct;
        currentDiscountAmount = Math.round(totalAmount * pct / 100);
      } else if (type === 'cash') {
        let cashVal = Math.max(0, Math.min(totalAmount, value));
        if (value !== cashVal) discountValueInput.value = cashVal;
        currentDiscountAmount = cashVal;
      }
      
      summarySubtotal.textContent = formatVND(totalAmount);
      summaryDiscount.textContent = `-${formatVND(currentDiscountAmount)}`;
      summaryFinalTotal.textContent = formatVND(totalAmount - currentDiscountAmount);
      calcSummaryCard.style.display = 'flex';
    }
    
    const finalToPay = Math.max(0, totalAmount - currentDiscountAmount);
    
    if (currentPaymentMethod === 'bank') {
      // For Bank Transfer, received amount is exactly finalToPay, change is 0
      inputReceivedCash.value = finalToPay;
      displayChangeAmount.textContent = formatVND(0);
      displayChangeAmount.className = 'change-value-v2';
      btnConfirmCheckoutPay.disabled = false;
      
      // No QR code needed, just show transfer details in UI
    } else {
      // Cash payment
      const cash = parseFloat(inputReceivedCash.value) || 0;
      const change = cash - finalToPay;
      
      if (inputReceivedCash.value === '' || change < 0) {
        displayChangeAmount.textContent = 'Chưa đủ tiền';
        displayChangeAmount.className = 'change-value-v2 insufficient';
        btnConfirmCheckoutPay.disabled = true;
      } else {
        displayChangeAmount.textContent = formatVND(change);
        displayChangeAmount.className = 'change-value-v2';
        btnConfirmCheckoutPay.disabled = false;
      }
    }
  }

  // Bind Payment Method Toggle listeners
  methodCashBtn.onclick = () => {
    currentPaymentMethod = 'cash';
    methodCashBtn.classList.add('active');
    methodBankBtn.classList.remove('active');
    cashFields.style.display = 'block';
    bankFields.style.display = 'none';
    
    // Clear cash input so they must enter it again
    inputReceivedCash.value = '';
    updateCheckoutCalculations();
    setTimeout(() => inputReceivedCash.focus(), 50);
  };

  methodBankBtn.onclick = () => {
    currentPaymentMethod = 'bank';
    methodBankBtn.classList.add('active');
    methodCashBtn.classList.remove('active');
    cashFields.style.display = 'none';
    bankFields.style.display = 'block';
    
    updateCheckoutCalculations();
  };

  // Bind input listeners
  discountTypeInput.onchange = updateCheckoutCalculations;
  discountValueInput.oninput = updateCheckoutCalculations;
  inputReceivedCash.oninput = updateCheckoutCalculations;

  checkoutModal.style.display = 'flex';
  
  // Set focus automatically to input
  setTimeout(() => inputReceivedCash.focus(), 100);

  // Print temporarily calculated receipt on checkout modal
  const btnPrintCheckout = document.getElementById('btn-print-checkout');
  if (btnPrintCheckout) {
    btnPrintCheckout.onclick = () => {
      printReceipt(table, table.order, currentDiscountAmount, parseFloat(inputReceivedCash.value) || 0, null);
    };
  }
}

function closeCheckoutModal() {
  checkoutModal.style.display = 'none';
}

// Actions inside Cash Calculator modal
btnCancelCheckout.addEventListener('click', closeCheckoutModal);
btnCloseCheckoutModal.addEventListener('click', closeCheckoutModal);

btnConfirmCheckoutPay.addEventListener('click', async () => {
  const cash = parseFloat(inputReceivedCash.value) || 0;
  if (!selectedTableId) return;

  btnConfirmCheckoutPay.disabled = true;
  btnConfirmCheckoutPay.textContent = 'Đang thanh toán...';

  try {
    const response = await fetch('/api/checkout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        tableId: selectedTableId,
        receivedAmount: cash,
        discountAmount: currentDiscountAmount,
        paymentMethod: currentPaymentMethod
      })
    });
    
    if (response.status === 401) {
      window.location.href = '/login.html';
      return;
    }
    
    const result = await response.json();
    if (result.success) {
      showToast(`✅ Đã thanh toán hóa đơn ${result.transaction.id} thành công! Thối lại khách: ${formatVND(result.transaction.changeAmount)}`);
      
      closeCheckoutModal();
      selectedTableId = null;
      renderTableDetails(null);
      renderTables();
    } else {
      alert(`Lỗi khi tính tiền: ${result.error}`);
    }
  } catch (error) {
    console.error('Lỗi checkout:', error);
    alert('Không thể thực hiện kết nối. Vui lòng kiểm tra lại máy chủ.');
  } finally {
    btnConfirmCheckoutPay.disabled = false;
    btnConfirmCheckoutPay.textContent = 'Xác nhận thanh toán';
  }
});

// Render Paid Bills History List
function renderTransactionsList() {
  historyListContainer.innerHTML = '';
  
  if (filteredTransactions.length === 0) {
    historyListContainer.innerHTML = `
      <div class="text-center text-muted p-md" style="padding: var(--space-xl) 0;">
        Không tìm thấy hóa đơn nào trong khoảng thời gian này.
      </div>
    `;
    return;
  }

  filteredTransactions.forEach(tx => {
    const card = document.createElement('div');
    card.className = `history-card ${selectedTransactionId === tx.id ? 'active' : ''}`;
    
    const itemsCount = tx.items.reduce((sum, item) => sum + item.quantity, 0);
    const cleanTime = formatTime(tx.timestamp).replace(' - ', ' • ');
    
    card.innerHTML = `
      <div class="history-card-left">
        <div class="history-card-title" title="${tx.tableName}">${tx.tableName}</div>
        <div class="history-card-time">${cleanTime}</div>
      </div>
      <div class="history-card-right">
        <div class="history-card-price">${formatVND(tx.subtotal - (tx.discountAmount || 0))}</div>
        <div class="history-card-qty">${itemsCount} món</div>
      </div>
    `;
    
    card.addEventListener('click', () => {
      selectedTransactionId = tx.id;
      renderTransactionsList();
      renderTransactionDetails(tx);
    });
    
    historyListContainer.appendChild(card);
  });
}

// Render detailed page for a selected transaction record
function renderTransactionDetails(tx) {
  billDetailsPanel.innerHTML = '';
  
  if (!tx) {
    billDetailsPanel.innerHTML = `
      <div class="no-table-selected" style="padding: var(--space-xl) 0;">
        <div class="no-table-icon">🧾</div>
        <div class="bold" style="font-size: 16px;">Chi tiết hóa đơn</div>
        <p style="font-size:14px; line-height: 1.4;">Chọn một hóa đơn trong danh sách lịch sử bên trái để xem chi tiết thống kê thanh toán.</p>
      </div>
    `;
    return;
  }

  const itemsQty = tx.items.reduce((sum, item) => sum + item.quantity, 0);
  const finalPaid = tx.subtotal - (tx.discountAmount || 0);

  const paymentMethodLabel = tx.paymentMethod === 'bank' ? '🏦 Chuyển khoản' : '💵 Tiền mặt';

  billDetailsPanel.innerHTML = `
    <div class="panel-header">
      <div class="panel-header-title">
        <h2>${tx.tableName}</h2>
        <p>Mã HĐ: <span class="bold">${tx.id}</span></p>
        <p>Thời gian: ${formatTime(tx.timestamp)}</p>
        <p>Hình thức: <span class="bold">${paymentMethodLabel}</span></p>
      </div>
      <div class="panel-header-price">
        <div class="panel-price-amount" style="color: var(--ink);">${formatVND(finalPaid)}</div>
        <div class="panel-price-label">Thực thu</div>
      </div>
    </div>

    <h4 class="bold" style="font-size: 15px; margin-top: var(--space-xs);">Món ăn đã thanh toán (${itemsQty})</h4>
    
    <div class="panel-items-list" style="max-height: 220px;">
      ${tx.items.map(item => `
        <div class="panel-item-row">
          <div>
            <span class="panel-item-name">${item.emoji} ${item.name}</span>
            <div class="panel-item-qty">Số lượng: ${item.quantity} × ${formatVND(item.price)}</div>
            ${item.notes ? `<div class="panel-item-note">Ghi chú: ${item.notes}</div>` : ''}
          </div>
          <span class="panel-item-subtotal">${formatVND(item.price * item.quantity)}</span>
        </div>
      `).join('')}
    </div>

    <div class="checkout-calculation-box" style="margin-top: 4px; gap: 8px;">
      <div class="flex justify-between" style="font-size: 14px;">
        <span class="text-muted">Tổng cộng tiền món:</span>
        <span class="bold">${formatVND(tx.subtotal)}</span>
      </div>
      ${tx.discountAmount > 0 ? `
        <div class="flex justify-between" style="font-size: 14px; color: var(--primary-error-text);">
          <span>Được giảm giá:</span>
          <span class="bold">-${formatVND(tx.discountAmount)}</span>
        </div>
        <div class="flex justify-between" style="font-size: 14px; font-weight: 700; border-top: 1px dashed var(--border-strong); padding-top: 4px;">
          <span>Tổng số thực thu:</span>
          <span class="bold">${formatVND(finalPaid)}</span>
        </div>
      ` : ''}
      <div class="flex justify-between" style="font-size: 14px; ${tx.discountAmount > 0 ? '' : 'border-top: 1px dashed var(--border-strong); padding-top: 4px;'}">
        <span class="text-muted">Khách đưa:</span>
        <span class="bold">${formatVND(tx.receivedAmount)}</span>
      </div>
      <div class="flex justify-between" style="font-size: 14px; padding-top: var(--space-sm); border-top: 1px dashed var(--border-strong);">
        <span class="bold">Tiền thối lại:</span>
        <span class="bold text-success" style="font-size: 16px;">${formatVND(tx.changeAmount)}</span>
      </div>
    </div>
    <button class="btn btn-secondary full-width mt-md" id="btn-reprint-bill" style="margin-top: 16px; height: 42px; border-color: var(--primary); color: var(--primary); font-weight: 600;">
      🖨️ In lại hóa đơn
    </button>
  `;

  // Attach click listener for reprint
  const btnReprint = document.getElementById('btn-reprint-bill');
  if (btnReprint) {
    btnReprint.onclick = () => {
      const tableObj = { name: tx.tableName };
      printReceipt(tableObj, tx.items, tx.discountAmount || 0, tx.receivedAmount, tx.id, tx.timestamp);
    };
  }
}

// Compute Statistics Widgets
function updateAnalytics() {
  const now = new Date();
  const todayDay = now.getDate();
  const todayMonth = now.getMonth();
  const todayYear = now.getFullYear();

  // Absolute revenues (always calculated on full transactions list)
  let todayRev = 0;
  let monthRev = 0;
  let yearRev = 0;

  transactions.forEach(tx => {
    const txDate = new Date(tx.timestamp);
    const amount = tx.subtotal - (tx.discountAmount || 0);
    
    if (txDate.getDate() === todayDay && txDate.getMonth() === todayMonth && txDate.getFullYear() === todayYear) {
      todayRev += amount;
    }
    if (txDate.getMonth() === todayMonth && txDate.getFullYear() === todayYear) {
      monthRev += amount;
    }
    if (txDate.getFullYear() === todayYear) {
      yearRev += amount;
    }
  });

  // Filtered statistics (calculated on filteredTransactions list)
  let totalDiscount = 0;
  const itemStats = {};

  filteredTransactions.forEach(tx => {
    totalDiscount += (tx.discountAmount || 0);

    tx.items.forEach(item => {
      if (!itemStats[item.name]) {
        itemStats[item.name] = {
          name: item.name,
          emoji: item.emoji,
          qty: 0,
          revenue: 0
        };
      }
      itemStats[item.name].qty += item.quantity;
      itemStats[item.name].revenue += item.price * item.quantity;
    });
  });

  // Render Stats widgets
  statTodayRevenue.textContent = formatVND(todayRev);
  statMonthRevenue.textContent = formatVND(monthRev);
  statYearRevenue.textContent = formatVND(yearRev);
  statTotalDiscount.textContent = formatVND(totalDiscount);
  statTotalBills.textContent = filteredTransactions.length;

  // Render Menu Item Sales list
  const sortedStats = Object.values(itemStats).sort((a, b) => b.qty - a.qty);
  
  if (sortedStats.length === 0) {
    menuSalesStatsBody.innerHTML = `
      <tr>
        <td colspan="3" class="text-center text-muted" style="padding: var(--space-base);">Chưa có dữ liệu bán hàng.</td>
      </tr>
    `;
  } else {
    menuSalesStatsBody.innerHTML = sortedStats.map(stat => `
      <tr>
        <td style="padding: 8px 12px; font-weight: 500;">${stat.emoji} ${stat.name}</td>
        <td class="text-center bold" style="padding: 8px 12px; font-size: 14px;">${stat.qty}</td>
        <td class="text-right bold" style="padding: 8px 12px; color: var(--primary);">${formatVND(stat.revenue)}</td>
      </tr>
    `).join('');
  }

  // Update Best Seller widget
  const bestItem = sortedStats[0];
  if (bestItem) {
    statBestSeller.textContent = `${bestItem.emoji} ${bestItem.name} (${bestItem.qty} suất)`;
  } else {
    statBestSeller.textContent = '--';
  }

  // Render Visual Analytics Charts
  renderCharts(sortedStats);
}

// Filter logic
function applyDateFilter() {
  const preset = filterPreset.value;
  const now = new Date();
  
  if (preset === 'all') {
    filteredTransactions = [...transactions];
  } else if (preset === 'today') {
    const todayStr = now.toDateString();
    filteredTransactions = transactions.filter(tx => {
      return new Date(tx.timestamp).toDateString() === todayStr;
    });
  } else if (preset === 'month') {
    const thisMonth = now.getMonth();
    const thisYear = now.getFullYear();
    filteredTransactions = transactions.filter(tx => {
      const d = new Date(tx.timestamp);
      return d.getMonth() === thisMonth && d.getFullYear() === thisYear;
    });
  } else if (preset === 'year') {
    const thisYear = now.getFullYear();
    filteredTransactions = transactions.filter(tx => {
      return new Date(tx.timestamp).getFullYear() === thisYear;
    });
  } else if (preset === 'custom') {
    const startVal = filterStartDate.value;
    const endVal = filterEndDate.value;
    
    if (!startVal || !endVal) {
      filteredTransactions = [...transactions];
      return;
    }
    
    const startDate = new Date(startVal);
    startDate.setHours(0, 0, 0, 0);
    
    const endDate = new Date(endVal);
    endDate.setHours(23, 59, 59, 999);
    
    filteredTransactions = transactions.filter(tx => {
      const txTime = new Date(tx.timestamp).getTime();
      return txTime >= startDate.getTime() && txTime <= endDate.getTime();
    });
  }
  
  renderTransactionsList();
  updateAnalytics();
  
  if (selectedTransactionId !== null) {
    const tx = filteredTransactions.find(t => t.id === selectedTransactionId);
    if (tx) {
      renderTransactionDetails(tx);
    } else {
      renderTransactionDetails(null);
    }
  }
}

// Bind Filter Listeners
filterPreset.onchange = () => {
  if (filterPreset.value === 'custom') {
    filterCustomDates.style.display = 'flex';
  } else {
    filterCustomDates.style.display = 'none';
    applyDateFilter();
  }
};

btnApplyFilter.onclick = () => {
  applyDateFilter();
};

// Segmented control click handlers for time filter
document.querySelectorAll('.filter-segment').forEach(btn => {
  btn.addEventListener('click', (e) => {
    const preset = e.target.getAttribute('data-preset');
    filterPreset.value = preset;
    
    // Update active class on buttons
    document.querySelectorAll('.filter-segment').forEach(b => {
      b.classList.remove('active');
    });
    e.target.classList.add('active');
    
    // Trigger native change event logic
    filterPreset.onchange();
  });
});

// Render Visual Analytics Charts (Chart.js)
function renderCharts(sortedStats) {
  // 1. Calculate hourly distribution (for Line Chart)
  const hourlyPoints = Array(24).fill(0);
  filteredTransactions.forEach(tx => {
    const d = new Date(tx.timestamp);
    const hour = d.getHours();
    const actualPaid = tx.subtotal - (tx.discountAmount || 0);
    hourlyPoints[hour] += actualPaid;
  });

  const hourlyLabels = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, '0')}:00`);
  const hourlyData = hourlyPoints;

  const ctxRev = document.getElementById('revenue-chart').getContext('2d');
  if (revenueChartInstance) {
    revenueChartInstance.destroy();
  }
  
  revenueChartInstance = new Chart(ctxRev, {
    type: 'line',
    data: {
      labels: hourlyLabels,
      datasets: [{
        label: 'Doanh thu (VNĐ)',
        data: hourlyData,
        borderColor: '#FF385C',
        backgroundColor: 'rgba(255, 56, 92, 0.08)',
        borderWidth: 2,
        tension: 0.35,
        fill: true,
        pointBackgroundColor: '#FF385C',
        pointRadius: 3
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: function(value) {
              return value.toLocaleString('vi-VN') + 'đ';
            },
            font: {
              size: 9
            }
          },
          grid: {
            color: 'rgba(0, 0, 0, 0.04)'
          }
        },
        x: {
          ticks: {
            font: {
              size: 9
            }
          },
          grid: {
            display: false
          }
        }
      }
    }
  });

  // 1.2 Calculate trend points (for Bar Chart)
  const sortedTxs = [...filteredTransactions].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  
  const trendPoints = {};
  sortedTxs.forEach(tx => {
    const d = new Date(tx.timestamp);
    const preset = filterPreset.value;
    let label = '';
    if (preset === 'today') {
      const hour = d.getHours();
      label = `${String(hour).padStart(2, '0')}:00`;
    } else if (preset === 'month') {
      label = `${d.getDate()}/${d.getMonth() + 1}`;
    } else if (preset === 'year') {
      label = `Thg ${d.getMonth() + 1}`;
    } else {
      label = `${d.getDate()}/${d.getMonth() + 1}`;
    }
    
    const actualPaid = tx.subtotal - (tx.discountAmount || 0);
    trendPoints[label] = (trendPoints[label] || 0) + actualPaid;
  });

  const trendLabels = Object.keys(trendPoints);
  const trendData = Object.values(trendPoints);

  const ctxBar = document.getElementById('revenue-bar-chart').getContext('2d');
  if (revenueBarChartInstance) {
    revenueBarChartInstance.destroy();
  }

  revenueBarChartInstance = new Chart(ctxBar, {
    type: 'bar',
    data: {
      labels: trendLabels.length > 0 ? trendLabels : ['Chưa có dữ liệu'],
      datasets: [{
        label: 'Doanh thu (VNĐ)',
        data: trendData.length > 0 ? trendData : [0],
        backgroundColor: '#00A699', // Teal color for bar chart to distinguish it
        borderRadius: 4,
        maxBarThickness: 32
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: function(value) {
              return value.toLocaleString('vi-VN') + 'đ';
            },
            font: {
              size: 9
            }
          },
          grid: {
            color: 'rgba(0, 0, 0, 0.04)'
          }
        },
        x: {
          ticks: {
            font: {
              size: 9
            }
          },
          grid: {
            display: false
          }
        }
      }
    }
  });

  // 2. Dish Breakdown Doughnut Chart
  const topStats = sortedStats.slice(0, 5);
  const otherStats = sortedStats.slice(5);
  
  const dishLabels = topStats.map(s => `${s.emoji} ${s.name}`);
  const dishData = topStats.map(s => s.qty);
  
  if (otherStats.length > 0) {
    const otherQty = otherStats.reduce((sum, s) => sum + s.qty, 0);
    dishLabels.push('🍔 Khác');
    dishData.push(otherQty);
  }

  const ctxDishes = document.getElementById('dishes-chart').getContext('2d');
  if (dishesChartInstance) {
    dishesChartInstance.destroy();
  }
  
  const colors = [
    '#FF385C', // Rausch
    '#00A699', // Teal
    '#FC642D', // Arches
    '#484848', // Hof
    '#767676', // Foggy
    '#A61D24'  // Dark Rausch
  ];
  
  dishesChartInstance = new Chart(ctxDishes, {
    type: 'doughnut',
    data: {
      labels: dishLabels.length > 0 ? dishLabels : ['Chưa có dữ liệu'],
      datasets: [{
        data: dishData.length > 0 ? dishData : [1],
        backgroundColor: dishData.length > 0 ? colors : ['rgba(0,0,0,0.05)'],
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'right',
          labels: {
            boxWidth: 10,
            font: {
              size: 9
            }
          }
        }
      },
      cutout: '65%'
    }
  });
}

// Load Staff accounts list
async function loadStaffList() {
  try {
    const res = await fetch('/api/users');
    if (res.status === 401) {
      window.location.href = '/login.html';
      return;
    }
    const staff = await res.json();
    renderStaffList(staff);
  } catch (error) {
    console.error('Lỗi lấy danh sách nhân viên:', error);
  }
}

// Render Staff accounts list
function renderStaffList(staff) {
  staffListContainer.innerHTML = '';
  
  if (staff.length === 0) {
    staffListContainer.innerHTML = `
      <div class="text-center text-muted p-md">
        Chưa có tài khoản nhân viên nào được tạo.
      </div>
    `;
    return;
  }

  staff.forEach(user => {
    const card = document.createElement('div');
    card.className = 'history-card';
    card.style.cursor = 'default';
    card.innerHTML = `
      <div class="history-card-left">
        <div class="history-card-title">👤 ${user.username}</div>
      </div>
      <div class="history-card-right">
        <span class="role-badge waiter" style="font-size:11px; padding:3px 8px; margin-left:0;">Phục vụ</span>
      </div>
    `;
    staffListContainer.appendChild(card);
  });
}

// Handle Form Submission for creating Waiter accounts
async function handleCreateStaff(event) {
  event.preventDefault();
  
  const username = staffUsernameInput.value.trim();
  const password = staffPasswordInput.value;
  
  if (!username || !password) return;
  
  btnCreateStaffSubmit.disabled = true;
  btnCreateStaffSubmit.textContent = 'Đang tạo...';
  staffErrorBanner.style.display = 'none';
  staffSuccessBanner.style.display = 'none';

  try {
    const res = await fetch('/api/users', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ username, password })
    });

    if (res.status === 401) {
      window.location.href = '/login.html';
      return;
    }

    const result = await res.json();
    if (res.ok && result.success) {
      staffSuccessBanner.style.display = 'flex';
      staffUsernameInput.value = '';
      staffPasswordInput.value = '';
      loadStaffList();
    } else {
      staffErrorMessage.textContent = result.error || 'Có lỗi xảy ra.';
      staffErrorBanner.style.display = 'flex';
    }
  } catch (error) {
    console.error('Lỗi khi tạo nhân viên:', error);
    staffErrorMessage.textContent = 'Không thể kết nối máy chủ.';
    staffErrorBanner.style.display = 'flex';
  } finally {
    btnCreateStaffSubmit.disabled = false;
    btnCreateStaffSubmit.textContent = 'Tạo tài khoản';
  }
}

// Render Menu Items Grid inside Menu Management Dashboard
function renderMenuMgmtGrid() {
  menuMgmtGridContainer.innerHTML = '';
  
  if (menuItems.length === 0) {
    menuMgmtGridContainer.innerHTML = `
      <div class="text-center text-muted p-md full-width">
        Thực đơn rỗng. Hãy thêm món ăn mới nhé!
      </div>
    `;
    return;
  }

  // Filter based on active category
  const filtered = menuItems.filter(item => {
    return activeMenuMgmtCategory === 'all' || item.category === activeMenuMgmtCategory;
  });

  if (filtered.length === 0) {
    menuMgmtGridContainer.innerHTML = `
      <div class="text-center text-muted p-md full-width" style="padding: var(--space-xl) 0;">
        Không có món ăn nào thuộc phân loại này.
      </div>
    `;
    return;
  }

  // Get nice display text for category
  const getCategoryText = (cat) => {
    switch(cat) {
      case 'main': return '🍛 Món chính';
      case 'side': return '🥗 Món thêm';
      case 'drink': return '🥤 Nước uống';
      default: return '🍽️ Món ăn';
    }
  };

  filtered.forEach(item => {
    const card = document.createElement('div');
    card.className = 'property-card';
    
    // Photo container handles image or emoji backup
    let photoHtml = '';
    if (item.image_url) {
      photoHtml = `<img src="${item.image_url}" style="width:100%; height:100%; object-fit:cover;">`;
    } else {
      photoHtml = `
        <div style="width:100%; height:100%; background-color:var(--surface-soft); display:flex; align-items:center; justify-content:center; font-size:64px; user-select:none;">
          ${item.emoji || '🍽️'}
        </div>
      `;
    }

    card.innerHTML = `
      <div class="card-img-container" style="height:160px; overflow:hidden;">
        ${photoHtml}
        <span class="card-badge" style="top:12px; left:12px; font-weight:600;">${getCategoryText(item.category)}</span>
      </div>
      <div class="card-body" style="padding:16px; flex-grow:1; display:flex; flex-direction:column; gap:4px; min-height:120px;">
        <div class="card-title" style="font-size:16px; font-weight:600;">${item.name}</div>
        <div class="bold text-rausch" style="font-size:15px; margin-top:2px;">${formatVND(item.price)}</div>
        <div class="card-desc" style="font-size:12px; color:var(--muted); margin-top:4px; height:34px; overflow:hidden; text-overflow:ellipsis; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical;">
          ${item.description || 'Chưa có mô tả.'}
        </div>
      </div>
      <div class="card-footer" style="padding:12px 16px; background-color:var(--canvas); border-top:1px solid var(--hairline-soft);">
        <button class="btn btn-secondary btn-pill btn-edit-menu-item" style="height:36px; padding:0 16px; font-size:13px; width:100%; border-color:var(--ink);">Chỉnh sửa</button>
      </div>
    `;

    card.querySelector('.btn-edit-menu-item').addEventListener('click', () => openMenuItemModal(item));
    menuMgmtGridContainer.appendChild(card);
  });
}

// Modal Form management
function openMenuItemModal(item = null) {
  // If item is null: Create Mode. Otherwise: Edit Mode
  if (item) {
    menuItemModalTitle.textContent = 'Chỉnh sửa món ăn';
    btnDeleteMenuItem.style.display = 'block';
    menuItemIdInput.value = item.id;
    menuItemNameInput.value = item.name;
    menuItemPriceInput.value = item.price;
    menuItemCategoryInput.value = item.category;
    menuItemDescInput.value = item.description || '';
    menuItemEmojiInput.value = item.emoji || '🍽️';

    // Update visual preview for edit mode
    if (item.image_url) {
      menuItemImagePreview.src = item.image_url;
      menuItemImagePreview.style.display = 'block';
      menuItemEmojiPreview.style.display = 'none';
    } else {
      menuItemImagePreview.src = '';
      menuItemImagePreview.style.display = 'none';
      menuItemEmojiPreview.textContent = item.emoji || '🍽️';
      menuItemEmojiPreview.style.display = 'block';
    }
  } else {
    menuItemModalTitle.textContent = 'Thêm món ăn mới';
    btnDeleteMenuItem.style.display = 'none';
    menuItemIdInput.value = '';
    menuItemForm.reset();
    menuItemCategoryInput.value = 'main';
    menuItemEmojiInput.value = '🍽️';

    // Reset visual preview for create mode
    menuItemImagePreview.src = '';
    menuItemImagePreview.style.display = 'none';
    menuItemEmojiPreview.textContent = '🍽️';
    menuItemEmojiPreview.style.display = 'block';
  }
  
  menuItemImageInput.value = ''; // Reset file input
  menuItemModal.style.display = 'flex';
}

function closeMenuItemModal() {
  menuItemModal.style.display = 'none';
}

// Delete menu item click handler
btnDeleteMenuItem.addEventListener('click', async () => {
  const id = menuItemIdInput.value;
  if (!id) return;
  
  if (confirm(`Bạn có chắc chắn muốn xóa món "${menuItemNameInput.value}" không? Mọi yêu cầu gọi món này ở các bàn hiện tại cũng sẽ bị xóa.`)) {
    try {
      btnDeleteMenuItem.disabled = true;
      btnDeleteMenuItem.textContent = 'Đang xóa...';
      
      const response = await fetch(`/api/menu/${id}`, {
        method: 'DELETE'
      });
      
      const result = await response.json();
      if (result.success) {
        showToast('✅ Đã xóa món ăn thành công!');
        closeMenuItemModal();
        
        // Refresh local menu list immediately
        const menuRes = await fetch('/api/menu');
        if (menuRes.ok) {
          menuItems = await menuRes.json();
          renderMenuMgmtGrid();
        }
        
        // Refresh tables list because orders might have been removed
        const tablesRes = await fetch('/api/tables');
        if (tablesRes.ok) {
          tables = await tablesRes.json();
          renderTables();
        }
      } else {
        showToast(`❌ Không thể xóa món ăn: ${result.error || 'Vui lòng thử lại.'}`);
      }
    } catch (err) {
      console.error('Lỗi khi xóa món ăn:', err);
      showToast('❌ Không thể kết nối tới server.');
    } finally {
      btnDeleteMenuItem.disabled = false;
      btnDeleteMenuItem.textContent = 'Xóa món';
    }
  }
});

// Form Submission (Multipart data to support file uploads)
menuItemForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const id = menuItemIdInput.value;
  const name = menuItemNameInput.value.trim();
  const price = menuItemPriceInput.value;
  const category = menuItemCategoryInput.value;
  const description = menuItemDescInput.value.trim();
  const emoji = menuItemEmojiInput.value.trim();
  const imageFile = menuItemImageInput.files[0];
  
  if (!name || !price || !category) return;
  
  const btnSave = document.getElementById('btn-save-menu-item');
  btnSave.disabled = true;
  btnSave.textContent = 'Đang lưu...';

  // Build FormData object for file upload
  const formData = new FormData();
  formData.append('name', name);
  formData.append('price', price);
  formData.append('category', category);
  formData.append('description', description);
  formData.append('emoji', emoji);
  if (imageFile) {
    formData.append('image', imageFile);
  }

  // Create vs Update endpoints
  const url = id ? `/api/menu/${id}` : '/api/menu';
  
  try {
    const res = await fetch(url, {
      method: 'POST', // Use POST for both creation and updates with file uploads
      body: formData
    });

    if (res.status === 401) {
      window.location.href = '/login.html';
      return;
    }

    const result = await res.json();
    if (res.ok && result.success) {
      closeMenuItemModal();
      // Socket.IO event 'menu_updated' will automatically re-render the list
    } else {
      alert(`Lỗi lưu món ăn: ${result.error || 'Vui lòng thử lại.'}`);
    }
  } catch (error) {
    console.error('Lỗi API lưu món ăn:', error);
    alert('Không thể kết nối đến máy chủ.');
  } finally {
    btnSave.disabled = false;
    btnSave.textContent = 'Lưu món ăn';
  }
});

// Event listeners for Menu management
btnCreateMenuItem.addEventListener('click', () => openMenuItemModal(null));
btnCancelMenuItemModal.addEventListener('click', closeMenuItemModal);
btnCloseMenuItemModal.addEventListener('click', closeMenuItemModal);

// Image Upload click trigger
if (imageUploadCardZone && menuItemImageInput) {
  imageUploadCardZone.addEventListener('click', () => {
    menuItemImageInput.click();
  });
}

// Image File Change Preview
if (menuItemImageInput) {
  menuItemImageInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      const url = URL.createObjectURL(file);
      menuItemImagePreview.src = url;
      menuItemImagePreview.style.display = 'block';
      menuItemEmojiPreview.style.display = 'none';
    }
  });
}

// Emoji Input Live Preview
if (menuItemEmojiInput) {
  menuItemEmojiInput.addEventListener('input', (e) => {
    // Only update preview if no image file is loaded and no image preview is currently showing
    if (menuItemImagePreview.style.display !== 'block') {
      menuItemEmojiPreview.textContent = e.target.value.trim() || '🍽️';
      menuItemEmojiPreview.style.display = 'block';
    }
  });
}

// Category Filter click listener in Menu Management
if (menuMgmtCategoryStrip) {
  menuMgmtCategoryStrip.querySelectorAll('.category-tab').forEach(tab => {
    tab.addEventListener('click', (e) => {
      const target = e.currentTarget;
      activeMenuMgmtCategory = target.getAttribute('data-category');
      
      // Update active tab style
      menuMgmtCategoryStrip.querySelectorAll('.category-tab').forEach(t => {
        if (t.getAttribute('data-category') === activeMenuMgmtCategory) {
          t.classList.add('active');
        } else {
          t.classList.remove('active');
        }
      });
      
      renderMenuMgmtGrid();
    });
  });
}

// Header Logo and Logout Handling
const headerLogoImg = document.getElementById('header-logo-img');
const headerLogoEmoji = document.getElementById('header-logo-emoji');
if (headerLogoImg) {
  headerLogoImg.onload = function() {
    headerLogoImg.style.display = 'block';
    if (headerLogoEmoji) {
      headerLogoEmoji.style.display = 'none';
    }
  };
  if (headerLogoImg.complete) {
    headerLogoImg.onload();
  }
}

const btnLogoutHeader = document.getElementById('btn-logout-header');
if (btnLogoutHeader) {
  btnLogoutHeader.addEventListener('click', async () => {
    try {
      await fetch('/api/logout', { method: 'POST' });
      window.location.href = '/login.html';
    } catch (err) {
      console.error('Logout error:', err);
    }
  });
}

// Convert native select to custom select with Airbnb styling
function makeSelectCustom(selectEl, labelText, showChevron = true) {
  if (!selectEl) return;
  
  // Hide native select
  selectEl.style.display = 'none';
  
  // Create wrapper
  const wrapper = document.createElement('div');
  wrapper.className = 'custom-select-wrapper';
  
  // Create trigger button
  const trigger = document.createElement('div');
  trigger.className = 'custom-select-trigger';
  
  const label = document.createElement('span');
  label.className = 'custom-select-label';
  label.textContent = labelText;
  
  const valueText = document.createElement('span');
  valueText.className = 'custom-select-value';
  valueText.textContent = selectEl.options[selectEl.selectedIndex] ? selectEl.options[selectEl.selectedIndex].text : '';
  
  trigger.appendChild(label);
  trigger.appendChild(valueText);

  if (showChevron) {
    const chevron = document.createElement('span');
    chevron.className = 'custom-select-chevron';
    chevron.textContent = '▼';
    trigger.appendChild(chevron);
  }

  wrapper.appendChild(trigger);
  
  // Create options menu dropdown
  const menu = document.createElement('div');
  menu.className = 'custom-select-menu';
  
  // Populate option items
  Array.from(selectEl.options).forEach(opt => {
    const item = document.createElement('div');
    item.className = 'custom-select-item' + (opt.selected ? ' selected' : '');
    item.dataset.value = opt.value;
    item.textContent = opt.text;
    
    item.onclick = (e) => {
      e.stopPropagation();
      selectEl.value = opt.value;
      // Dispatch change event to run original listeners
      selectEl.dispatchEvent(new Event('change'));
      closeAllCustomSelects();
    };
    
    menu.appendChild(item);
  });
  
  wrapper.appendChild(menu);
  selectEl.parentNode.insertBefore(wrapper, selectEl);
  
  // Toggle menu on click
  trigger.onclick = (e) => {
    e.stopPropagation();
    const isOpen = wrapper.classList.contains('open');
    closeAllCustomSelects();
    if (!isOpen) {
      wrapper.classList.add('open');
    }
  };
  
  // Override native select .value property descriptor to hook programmatic updates
  const originalDescriptor = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value');
  
  Object.defineProperty(selectEl, 'value', {
    get: function() {
      return originalDescriptor.get.call(this);
    },
    set: function(val) {
      originalDescriptor.set.call(this, val);
      
      // Update custom select wrapper trigger label and item state
      const selectedOpt = this.options[this.selectedIndex];
      valueText.textContent = selectedOpt ? selectedOpt.text : '';
      
      Array.from(menu.children).forEach(child => {
        if (child.dataset.value === val) {
          child.classList.add('selected');
        } else {
          child.classList.remove('selected');
        }
      });
    }
  });
}

function closeAllCustomSelects() {
  document.querySelectorAll('.custom-select-wrapper').forEach(w => {
    w.classList.remove('open');
  });
}

function initCustomSelects() {
  const discountSelect = document.getElementById('checkout-discount-type');
  const categorySelect = document.getElementById('menu-item-category-input');
  
  makeSelectCustom(discountSelect, 'Loại giảm giá', false);
  makeSelectCustom(categorySelect, 'Phân loại món', true);
}

// Close custom dropdown menus when clicking outside
document.addEventListener('click', closeAllCustomSelects);

// App Initialization
init();
