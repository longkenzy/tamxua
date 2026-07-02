// Manager Dashboard Logic
let socket = null;
let isPollingMode = false;
const isVercel = window.location.hostname.endsWith('vercel.app');

// State variables
let tables = [];
let playEntranceAnimation = true;
let transactions = [];
let filteredTransactions = []; // Filtered copy of transactions list
let activeServeTypeFilter = 'all';
let activePayMethodFilter = 'all';
let menuItems = [];
let selectedTableId = null;
let selectedTransactionId = null;
let currentTab = 'reports'; // Default to Business Overview
let currentDiscountAmount = 0; // Discount applied in checkout modal
let currentPaymentMethod = 'cash'; // Payment method in checkout modal ('cash' or 'bank')
let notificationAudioContext = null;
let revenueChartInstance = null;
let revenueBarChartInstance = null;
let dishesChartInstance = null;
let overviewHourlyChartInstance = null;
let overviewTabbedChartInstance = null;
let paymentMethodDonutChartInstance = null;
let servingTypeDonutChartInstance = null;
let itemsCategoryDonutChartInstance = null;
let itemsBestsellDonutChartInstance = null;
let activePaymentMethodTab = 'revenue'; // 'revenue' or 'count'
let activeServingTypeTab = 'revenue'; // 'revenue' or 'count'
let activeItemsCategoryTab = 'revenue'; // 'revenue' or 'count'
let activeItemsBestsellTab = 'revenue'; // 'revenue' or 'count'
let itemsBestsellLimit = 5; // Default Top 5
let activeMenuMgmtCategory = 'all'; // Filter state for menu management categories
let menuGroups = [];
let selectedGroupItemIds = new Set();
let editingGroupId = null;
let activeFloorFilter = 'trệt'; // Filter state for manager floor tabs ('trệt' or 'lầu')

// DOM Elements
const connectionDot = document.getElementById('connection-dot');
const tabTables = document.getElementById('tab-overview');
const tabReports = document.getElementById('tab-reports');
const tabInvoices = document.getElementById('tab-invoices');
const tabStaff = document.getElementById('tab-staff');
const tabMenuMgmt = document.getElementById('tab-items');

const tablesDashboardView = document.getElementById('tables-dashboard-view');
const reportsDashboardView = document.getElementById('reports-dashboard-view');
const invoicesDashboardView = document.getElementById('invoices-dashboard-view');
const staffDashboardView = document.getElementById('staff-dashboard-view');
const menuMgmtDashboardView = document.getElementById('menu-mgmt-dashboard-view');

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
const statRevenue = document.getElementById('stat-revenue');
const statRevenueLabel = document.getElementById('stat-revenue-label');
const statTotalDiscount = document.getElementById('stat-total-discount');
const statTotalBills = document.getElementById('stat-total-bills');
const statBestSeller = document.getElementById('stat-best-seller');
const menuSalesStatsBody = document.getElementById('menu-sales-stats-body');
const statCashBills = document.getElementById('stat-cash-bills');
const statCashAmount = document.getElementById('stat-cash-amount');
const statBankBills = document.getElementById('stat-bank-bills');
const statBankAmount = document.getElementById('stat-bank-amount');

// Time Filters Elements
const filterPreset = document.getElementById('filter-preset');
const filterCustomDates = document.getElementById('filter-custom-dates');
const filterStartDate = document.getElementById('filter-start-date');
const filterEndDate = document.getElementById('filter-end-date');
const btnApplyFilter = document.getElementById('btn-apply-filter');

// Staff Management Elements
// Staff list variables defined at top level
const staffListContainer = document.getElementById('staff-list-container');
const createStaffForm = document.getElementById('create-staff-form');
const staffUsernameInput = document.getElementById('staff-username-input');
const staffPasswordInput = document.getElementById('staff-password-input');
const staffErrorBanner = document.getElementById('staff-error-banner');
const staffErrorMessage = document.getElementById('staff-error-message');
const staffSuccessBanner = document.getElementById('staff-success-banner');
const btnCreateStaffSubmit = document.getElementById('btn-create-staff-submit');

// Menu Management Elements
// Menu management variables defined at top level
const menuMgmtGridContainer = document.getElementById('menu-mgmt-grid-container');
const btnCreateMenuItem = document.getElementById('btn-create-menu-item');
const btnDownloadExcelTemplate = document.getElementById('btn-download-excel-template');
const btnImportExcel = document.getElementById('btn-import-excel');
const btnDeleteAllMenu = document.getElementById('btn-delete-all-menu');
const excelImportFileInput = document.getElementById('excel-import-file-input');
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
const menuItemImageUrlInput = document.getElementById('menu-item-image-url-input');
const btnCancelMenuItemModal = document.getElementById('btn-cancel-menu-item-modal');
const btnCloseMenuItemModal = document.getElementById('btn-close-menu-item-modal');
const btnDeleteMenuItem = document.getElementById('btn-delete-menu-item');
const btnAddTable = document.getElementById('btn-add-table');
const addTableModal = document.getElementById('add-table-modal');
const addTableForm = document.getElementById('add-table-form');
const addTableNameInput = document.getElementById('add-table-name-input');
const addTableErrorMsg = document.getElementById('add-table-error-msg');
const btnCloseAddTableModal = document.getElementById('btn-close-add-table-modal');
const btnCancelAddTableModal = document.getElementById('btn-cancel-add-table-modal');
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

    // Initialize sidebar collapse state
    initSidebarCollapse();

    // Initialize overview selectors sync
    initOverviewControls();

    // Initialize invoices tab selectors sync
    initInvoicesFilter();

    // Prepare audio context on user gesture to bypass autoplay blocks
    initAudioOnUserInteraction();
    
    // Fetch menu groups
    await loadMenuGroups();
    
    // Initialize Menu Group controls
    initMenuGroupControls();

    // Initialize Menu search input listener
    const menuSearchInput = document.getElementById('menu-mgmt-search-input');
    if (menuSearchInput) {
      menuSearchInput.addEventListener('input', () => {
        renderMenuMgmtGrid();
      });
    }

    // Switch to default reports tab
    switchTab('reports');
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
      
      socket.on('checkout_completed', (data) => {
        showToast(`💰 ${data.tableName} đã thanh toán thành công!`);
        playNotificationSound();
      });
      
      socket.on('transactions_updated', (updatedTransactions) => {
        transactions = updatedTransactions;
        applyDateFilter();
      });
      
      socket.on('menu_groups_updated', () => {
        loadMenuGroups();
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
      
      const tablesChanged = JSON.stringify(newTables) !== JSON.stringify(tables);
      const transactionsChanged = JSON.stringify(newTransactions) !== JSON.stringify(transactions);
      const menuChanged = JSON.stringify(newMenuItems) !== JSON.stringify(menuItems);
      
      let needsAnalyticsUpdate = false;
      
      if (tablesChanged) {
        tables = newTables;
        renderTables();
        if (selectedTableId !== null) {
          const table = tables.find(t => t.id === selectedTableId);
          renderTableDetails(table);
        }
        needsAnalyticsUpdate = true;
      }
      
      if (transactionsChanged) {
        transactions = newTransactions;
        applyDateFilter(); // This calls renderTransactionsList and updateAnalytics inside it
        needsAnalyticsUpdate = false; // already called inside applyDateFilter
      }
      
      if (needsAnalyticsUpdate) {
        updateAnalytics();
      }
      
      if (menuChanged) {
        menuItems = newMenuItems;
        if (currentTab === 'menu-mgmt') {
          renderMenuMgmtGrid();
        }
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
// Tab Navigation logic
const tabs = {
  'reports': { el: document.getElementById('tab-overview'), view: document.getElementById('reports-dashboard-view'), title: 'Tổng quan kinh doanh' },
  'tables': { el: document.getElementById('tab-reports'), view: document.getElementById('tables-dashboard-view'), title: 'Sơ đồ bàn ăn' },
  'invoices': { el: document.getElementById('tab-invoices'), view: document.getElementById('invoices-dashboard-view'), title: 'Lịch sử hóa đơn' },
  'menu-mgmt': { el: document.getElementById('subtab-item-list'), view: document.getElementById('menu-mgmt-dashboard-view'), title: 'Quản lý mặt hàng' },
  'menu-preview': { el: document.getElementById('subtab-menu-preview'), view: document.getElementById('menu-preview-dashboard-view'), title: 'Thực đơn' },
  'staff': { el: document.getElementById('tab-staff'), view: document.getElementById('staff-dashboard-view'), title: 'Quản lý nhân viên' }
};

function switchTab(tabKey) {
  currentTab = tabKey;
  
  // Update active-tab-title in topbar
  const activeTabTitle = document.getElementById('active-tab-title');
  if (activeTabTitle && tabs[tabKey]) {
    activeTabTitle.textContent = tabs[tabKey].title;
  }
  
  // Toggle classes and views visibility
  Object.keys(tabs).forEach(key => {
    const tabObj = tabs[key];
    if (tabObj.el) {
      if (key === tabKey) {
        tabObj.el.classList.add('active');
      } else {
        tabObj.el.classList.remove('active');
      }
    }
    if (tabObj.view) {
      if (key === tabKey) {
        if (key === 'tables' || key === 'staff') {
          tabObj.view.style.display = 'grid';
        } else {
          tabObj.view.style.display = 'block';
        }
      } else {
        tabObj.view.style.display = 'none';
      }
    }
  });

  // Toggle filter toolbar visibility (only for reports and invoices)
  const filterToolbar = document.querySelector('.filter-toolbar-container');
  if (filterToolbar) {
    if (tabKey === 'reports' || tabKey === 'invoices') {
      filterToolbar.style.display = 'flex';
    } else {
      filterToolbar.style.display = 'none';
    }
  }

  // Manage submenu items expansion & chevron rotation
  const submenu = document.getElementById('submenu-items');
  const chevron = document.querySelector('#tab-items-toggle .dropdown-chevron-icon');
  const isSubmenuTab = ['menu-mgmt', 'menu-preview'].includes(tabKey);
  if (submenu && chevron) {
    if (isSubmenuTab) {
      submenu.style.display = 'flex';
      submenu.classList.add('show');
      chevron.style.transform = 'rotate(180deg)';
    } else {
      submenu.style.display = 'none';
      submenu.classList.remove('show');
      chevron.style.transform = 'rotate(0deg)';
    }
  }

  // Trigger tab-specific loaders
  if (tabKey === 'reports' || tabKey === 'invoices') {
    applyDateFilter();
  } else if (tabKey === 'staff') {
    loadStaffList();
    if (staffErrorBanner) staffErrorBanner.style.display = 'none';
    if (staffSuccessBanner) staffSuccessBanner.style.display = 'none';
    if (staffUsernameInput) staffUsernameInput.value = '';
    if (staffPasswordInput) staffPasswordInput.value = '';
  } else if (tabKey === 'menu-mgmt') {
    renderMenuMgmtGrid();
  } else if (tabKey === 'menu-preview') {
    renderMenuPreview();
  }
}

window.switchTab = switchTab;

// Bind click events
Object.keys(tabs).forEach(key => {
  const tabObj = tabs[key];
  if (tabObj.el) {
    tabObj.el.addEventListener('click', () => switchTab(key));
  }
});

// Bind click toggle for Mặt hàng dropdown parent
const tabItemsToggle = document.getElementById('tab-items-toggle');
const submenuItems = document.getElementById('submenu-items');
if (tabItemsToggle && submenuItems) {
  tabItemsToggle.addEventListener('click', (e) => {
    e.stopPropagation();
    const isHidden = submenuItems.style.display === 'none' || !submenuItems.classList.contains('show');
    const chevronIcon = tabItemsToggle.querySelector('.dropdown-chevron-icon');
    if (isHidden) {
      submenuItems.style.display = 'flex';
      submenuItems.classList.add('show');
      if (chevronIcon) chevronIcon.style.transform = 'rotate(180deg)';
    } else {
      submenuItems.style.display = 'none';
      submenuItems.classList.remove('show');
      if (chevronIcon) chevronIcon.style.transform = 'rotate(0deg)';
    }
  });
}

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

// Render read-only Menu Preview Grid
function renderMenuPreview() {
  const menuPreviewList = document.getElementById('menu-preview-list');
  if (!menuPreviewList) return;
  menuPreviewList.innerHTML = '';
  
  if (menuItems.length === 0) {
    menuPreviewList.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: var(--muted); padding: 40px; font-size: 14px;">Chưa có món ăn nào trong thực đơn.</div>`;
    return;
  }
  
  const getCategoryLabel = (cat) => {
    switch (cat) {
      case 'main': return '🍛 Món chính';
      case 'side': return '🥗 Món thêm';
      case 'drink': return '🥤 Nước uống';
      default: return '🍽️ Món ăn';
    }
  };

  menuItems.forEach(item => {
    const card = document.createElement('div');
    card.className = 'property-card';
    card.style.cssText = 'background: #ffffff; border: 1px solid var(--hairline-soft); border-radius: var(--rounded-md); overflow: hidden; display: flex; flex-direction: column; height: 100%; transition: transform 0.2s, box-shadow 0.2s;';
    
    // Photo or Emoji backup
    let photoHtml = '';
    if (item.image_url) {
      photoHtml = `<img src="${item.image_url}" style="width: 100%; height: 160px; object-fit: cover;">`;
    } else {
      photoHtml = `<img src="images/logo.png" style="width: 100%; height: 160px; object-fit: cover;">`;
    }

    card.innerHTML = `
      <div style="position: relative;">
        ${photoHtml}
        <span class="card-badge" style="position: absolute; top: 12px; left: 12px; font-weight: 600; font-size: 11px; padding: 4px 8px; background: rgba(255,255,255,0.9); backdrop-filter: blur(4px); border-radius: 12px; color: var(--ink); display: none;">${getCategoryLabel(item.category)}</span>
      </div>
      <div style="padding: var(--space-base); display: flex; flex-direction: column; flex: 1; justify-content: space-between;">
        <div>
          <h3 style="font-size: 15px; font-weight: 700; color: var(--ink); margin: 0 0 6px 0;">${item.name}</h3>
          <p style="font-size: 12px; color: var(--muted); margin: 0 0 12px 0; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; line-height: 1.4;">${item.description || 'Chưa có mô tả chi tiết cho món ăn này.'}</p>
        </div>
        <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--hairline-soft); padding-top: 10px;">
          <span style="font-size: 16px; font-weight: 800; color: var(--primary);">${formatVND(item.price)}</span>
          <span style="font-size: 11px; font-weight: 600; color: #10b981; background: #e6f9f0; padding: 2px 8px; border-radius: 8px;">Đang phục vụ</span>
        </div>
      </div>
    `;
    
    // Add micro-hover animation
    card.style.cursor = 'default';
    card.addEventListener('mouseenter', () => {
      card.style.transform = 'translateY(-4px)';
      card.style.boxShadow = '0 8px 16px rgba(0,0,0,0.06)';
    });
    card.addEventListener('mouseleave', () => {
      card.style.transform = 'none';
      card.style.boxShadow = 'none';
    });
    
    menuPreviewList.appendChild(card);
  });
}

// Render dynamic Categories count table
function renderCategoriesMgmtTable() {
  const tbody = document.getElementById('categories-mgmt-table-body');
  if (!tbody) return;
  tbody.innerHTML = '';
  
  const categoryStats = {
    'main': { name: '🍛 Món chính', count: 0, status: 'Hoạt động' },
    'side': { name: '🥗 Món thêm', count: 0, status: 'Hoạt động' },
    'drink': { name: '🥤 Nước uống', count: 0, status: 'Hoạt động' }
  };
  
  menuItems.forEach(item => {
    if (categoryStats[item.category]) {
      categoryStats[item.category].count++;
    }
  });
  
  Object.values(categoryStats).forEach(cat => {
    const tr = document.createElement('tr');
    tr.style.borderBottom = '1px solid var(--hairline-soft)';
    tr.innerHTML = `
      <td style="padding: 14px 8px; font-weight: 600; color: var(--ink);">${cat.name}</td>
      <td style="padding: 14px 8px; text-align: center; font-weight: 700; color: var(--ink-soft);">${cat.count} sản phẩm</td>
      <td style="padding: 14px 8px; text-align: center;"><span class="badge badge-success" style="background-color: #10b981; color: white; padding: 2px 8px; border-radius: 12px; font-size: 11px;">${cat.status}</span></td>
    `;
    tbody.appendChild(tr);
  });
}

function getFormattedTime(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const hours = String(date.getHours()).padStart(2, '0');
  const mins = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${mins}`;
}

// Render live occupancy status widgets
function updateTableStatsSummary(filteredTables) {
  const statsContainer = document.getElementById('tables-stats-summary');
  if (!statsContainer) return;
  
  const total = filteredTables.length;
  const occupied = filteredTables.filter(t => t.status === 'eating').length;
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
  
  // Update occupied counts on tab headers dynamically
  const tretOccupiedCount = tables.filter(t => {
    const tableId = parseInt(t.id);
    return tableId >= 1 && tableId <= 20 && t.status === 'eating';
  }).length;
  
  const lauOccupiedCount = tables.filter(t => {
    const tableId = parseInt(t.id);
    return tableId >= 21 && tableId <= 40 && t.status === 'eating';
  }).length;
  
  const takeawayOccupiedCount = tables.filter(t => {
    return t.location && t.location.toLowerCase() === 'mang về' && t.status === 'eating';
  }).length;
  
  const tretCountEl = document.getElementById('tret-occupied-count');
  const lauCountEl = document.getElementById('lau-occupied-count');
  const takeawayCountEl = document.getElementById('takeaway-occupied-count');
  if (tretCountEl) tretCountEl.textContent = tretOccupiedCount;
  if (lauCountEl) lauCountEl.textContent = lauOccupiedCount;
  if (takeawayCountEl) takeawayCountEl.textContent = takeawayOccupiedCount;
  
  const filteredTables = tables.filter(table => {
    const tableId = parseInt(table.id);
    if (activeFloorFilter === 'trệt') {
      return tableId >= 1 && tableId <= 20;
    } else if (activeFloorFilter === 'lầu') {
      return tableId >= 21 && tableId <= 40;
    } else if (activeFloorFilter === 'mang đi') {
      return table.location && table.location.toLowerCase() === 'mang về' && table.status === 'eating';
    }
    return true;
  });

  updateTableStatsSummary(filteredTables);

  if (filteredTables.length === 0) {
    managerTablesContainer.innerHTML = `
      <div style="grid-column: 1 / -1; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 60px 20px; color: #64748b; font-size: 14px; gap: 8px; text-align: center;">
        <span style="font-size: 32px;">🛍️</span>
        <span style="font-weight: 600;">Không có đơn mang đi nào đang hoạt động</span>
      </div>
    `;
    playEntranceAnimation = false;
    return;
  }

  filteredTables.forEach((table, index) => {
    const isOccupied = table.status === 'eating';
    const card = document.createElement('div');
    const animClass = playEntranceAnimation ? 'entrance-anim' : '';
    card.className = `manager-table-card ${isOccupied ? 'occupied' : ''} ${selectedTableId === table.id ? 'active' : ''} ${animClass}`;
    if (playEntranceAnimation) {
      card.style.animationDelay = `${index * 20}ms`;
    }
    
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
          <span class="table-card-title">${table.name} <span style="font-size: 10px; font-weight: 500; color: var(--muted); background-color: var(--surface-soft); padding: 1px 5px; border-radius: var(--rounded-full); border: 1px solid var(--hairline-soft); margin-left: 4px; text-transform: capitalize;">${table.location || 'trệt'}</span></span>
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
  playEntranceAnimation = false;
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
      <div class="no-table-selected" style="display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; height: 100%;">
        <div class="no-table-icon">🪑</div>
        <div class="bold" style="font-size: 16px; margin-bottom: 8px;">${table ? table.name : 'Chưa chọn bàn nào'}</div>
        <p style="font-size:14px; line-height: 1.4; margin-bottom: 20px; max-width: 280px; margin-left: auto; margin-right: auto;">
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
      Thanh toán và in hoá đơn
    </button>
  `;

  document.getElementById('btn-trigger-checkout').addEventListener('click', () => openCheckoutModal(table));
}

// Delete table function
async function deleteTable(table) {
  if (!table) return;
  
  if (confirm(`Bạn có chắc chắn muốn xóa "${table.name}" không?`)) {
    try {
      const response = await fetch(`/api/tables/${table.id}`, {
        method: 'DELETE'
      });
      
      const result = await response.json();
      if (result.success) {
        showToast(`✅ Đã xóa bàn "${table.name}" thành công!`);
        selectedTableId = null; // Clear selected state
        
        // Refresh local tables list immediately
        const tablesRes = await fetch('/api/tables');
        if (tablesRes.ok) {
          tables = await tablesRes.json();
          renderTables();
          renderTableDetails(null);
        }
      } else {
        showToast(`❌ Không thể xóa bàn: ${result.error}`);
      }
    } catch (err) {
      console.error('Lỗi khi xóa bàn:', err);
      showToast('❌ Không thể kết nối tới server.');
    }
  }
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

// Render Paid Bills History List in Table Format
function renderTransactionsList() {
  historyListContainer.innerHTML = '';
  
  const serveType = activeServeTypeFilter;
  const payMethod = activePayMethodFilter;

  const displayTransactions = filteredTransactions.filter(tx => {
    // Filter by serving type
    const tableName = tx.tableName || '';
    const isTakeaway = !tableName.startsWith('Bàn ');
    if (serveType === 'table' && isTakeaway) return false;
    if (serveType === 'takeaway' && !isTakeaway) return false;

    // Filter by payment method
    const isBank = tx.paymentMethod && tx.paymentMethod.trim() === 'bank';
    if (payMethod === 'cash' && isBank) return false;
    if (payMethod === 'bank' && !isBank) return false;

    return true;
  });

  if (displayTransactions.length === 0) {
    historyListContainer.innerHTML = `
      <div class="text-center text-muted p-md" style="padding: var(--space-xl) 0;">
        Không tìm thấy hóa đơn nào phù hợp với bộ lọc.
      </div>
    `;
    const btnBulkDelete = document.getElementById('btn-bulk-delete-tx');
    if (btnBulkDelete) btnBulkDelete.style.display = 'none';
    return;
  }

  // Create table wrapper for horizontal scrolling on smaller screens
  const wrapper = document.createElement('div');
  wrapper.style.overflowX = 'auto';
  wrapper.style.overflowY = 'auto';
  wrapper.style.maxHeight = 'calc(100vh - 210px)';
  wrapper.style.position = 'relative';
  wrapper.style.width = '100%';
  wrapper.style.borderRadius = '8px';
  wrapper.style.border = '1px solid var(--hairline)';
  wrapper.style.backgroundColor = '#ffffff';

  const table = document.createElement('table');
  table.style.width = '100%';
  table.style.borderCollapse = 'collapse';
  table.style.textAlign = 'left';
  table.style.fontSize = '13px';

  // Table header
  table.innerHTML = `
    <thead>
      <tr style="background-color: #f8fafc; color: #475569; font-weight: 700;">
        <th style="position: sticky; top: 0; background-color: #f8fafc; z-index: 5; border-bottom: 1px solid var(--hairline); padding: 12px 16px; width: 40px; text-align: center;">
          <input type="checkbox" id="th-select-all-tx" style="transform: scale(1.2); cursor: pointer;">
        </th>
        <th style="position: sticky; top: 0; background-color: #f8fafc; z-index: 5; border-bottom: 1px solid var(--hairline); padding: 12px 16px; width: 60px; text-align: center;">STT</th>
        <th style="position: sticky; top: 0; background-color: #f8fafc; z-index: 5; border-bottom: 1px solid var(--hairline); padding: 12px 16px;">Thời gian thanh toán</th>
        <th style="position: sticky; top: 0; background-color: #f8fafc; z-index: 5; border-bottom: 1px solid var(--hairline); padding: 12px 16px;">Loại hình</th>
        <th style="position: sticky; top: 0; background-color: #f8fafc; z-index: 5; border-bottom: 1px solid var(--hairline); padding: 12px 16px;">Khu vực</th>
        <th style="position: sticky; top: 0; background-color: #f8fafc; z-index: 5; border-bottom: 1px solid var(--hairline); padding: 12px 16px;">Thanh toán</th>
        <th style="position: sticky; top: 0; background-color: #f8fafc; z-index: 5; border-bottom: 1px solid var(--hairline); padding: 12px 16px; text-align: right; width: 120px;">Tổng tiền</th>
        <th style="position: sticky; top: 0; background-color: #f8fafc; z-index: 5; border-bottom: 1px solid var(--hairline); padding: 12px 16px; text-align: center; width: 120px;">Thao tác</th>
      </tr>
    </thead>
    <tbody id="history-table-body"></tbody>
  `;

  const tbody = table.querySelector('#history-table-body');

  displayTransactions.forEach((tx, index) => {
    const finalPaid = tx.subtotal - (tx.discountAmount || 0);
    const cleanTime = formatTime(tx.timestamp).replace(' - ', ' • ');
    const cleanPayment = (tx.paymentMethod && tx.paymentMethod.trim() === 'bank') ? 'Chuyển khoản' : 'Tiền mặt';

    // Determine loại hình and khu vực
    let loaihinh = 'Mang đi';
    let khuvuc = 'Mang đi';
    const tableName = tx.tableName || '';
    if (tableName.startsWith('Bàn ')) {
      const tableNumberStr = tableName.replace('Bàn ', '').trim();
      loaihinh = `Tại bàn số ${tableNumberStr}`;
      const tableNum = parseInt(tableNumberStr);
      if (!isNaN(tableNum)) {
        if (tableNum >= 1 && tableNum <= 20) {
          khuvuc = 'Trệt';
        } else if (tableNum >= 21 && tableNum <= 40) {
          khuvuc = 'Lầu';
        }
      }
    }

    const tr = document.createElement('tr');
    tr.style.borderBottom = '1px solid var(--hairline-soft)';
    tr.style.cursor = 'pointer';
    tr.style.transition = 'background-color 0.2s';
    
    // Zebra striping style
    if (index % 2 === 1) {
      tr.style.backgroundColor = '#f8fafc';
    }

    // Hover effect
    tr.addEventListener('mouseenter', () => { tr.style.backgroundColor = '#f1f5f9'; });
    tr.addEventListener('mouseleave', () => { tr.style.backgroundColor = (index % 2 === 1) ? '#f8fafc' : 'transparent'; });

    tr.innerHTML = `
      <td style="padding: 12px 16px; text-align: center;" onclick="event.stopPropagation();">
        <input type="checkbox" class="row-select-tx" data-id="${tx.id}" style="transform: scale(1.2); cursor: pointer;">
      </td>
      <td style="padding: 12px 16px; text-align: center; font-weight: 600; color: #64748b;">${index + 1}</td>
      <td style="padding: 12px 16px; font-weight: 500; color: #0f172a;">${cleanTime}</td>
      <td style="padding: 12px 16px; font-weight: 600; color: #0f172a;">${loaihinh}</td>
      <td style="padding: 12px 16px; font-weight: 500; color: #475569;">${khuvuc}</td>
      <td style="padding: 12px 16px; font-weight: 500; color: #475569;">${cleanPayment}</td>
      <td style="padding: 12px 16px; text-align: right; font-weight: 700; color: var(--primary);">${formatVND(finalPaid)}</td>
      <td style="padding: 12px 16px; text-align: center;">
        <div style="display: inline-flex; gap: 6px; justify-content: center; align-items: center;">
          <button class="btn btn-secondary btn-detail-inline" data-id="${tx.id}" style="padding: 6px 12px; font-size: 11px; border-radius: 6px; cursor: pointer; border: 1px solid #cbd5e1; display: inline-flex; align-items: center; gap: 4px; font-weight: 600; background: #ffffff; white-space: nowrap;">
            🔍 Chi tiết
          </button>
          <button class="btn btn-danger btn-delete-inline" data-id="${tx.id}" style="padding: 6px 12px; font-size: 11px; border-radius: 6px; cursor: pointer; border: 1px solid #fca5a5; display: inline-flex; align-items: center; gap: 4px; font-weight: 600; background: #fef2f2; color: #ef4444; white-space: nowrap;">
            🗑️ Xóa
          </button>
        </div>
      </td>
    `;

    // Row click opens details modal
    tr.addEventListener('click', () => {
      openTransactionDetail(tx.id);
    });

    // Prevent row click when clicking button to open modal
    tr.querySelector('.btn-detail-inline').addEventListener('click', (e) => {
      e.stopPropagation();
      openTransactionDetail(tx.id);
    });

    // Prevent row click when clicking delete button
    const btnDelete = tr.querySelector('.btn-delete-inline');
    if (btnDelete) {
      btnDelete.addEventListener('click', async (e) => {
        e.stopPropagation();
        const txId = e.currentTarget.getAttribute('data-id');
        if (confirm(`⚠️ Bạn có chắc chắn muốn xóa hóa đơn ${txId} này? Thao tác này không thể hoàn tác.`)) {
          try {
            const res = await fetch(`/api/transactions/${txId}`, {
              method: 'DELETE'
            });
            const result = await res.json();
            if (result.success) {
              showToast('✅ Đã xóa hóa đơn thành công!');
              const transactionsRes = await fetch('/api/transactions');
              if (transactionsRes.ok) {
                transactions = await transactionsRes.json();
                applyDateFilter();
              }
            } else {
              alert(`Lỗi: ${result.error}`);
            }
          } catch (err) {
            console.error(err);
            alert('Không thể kết nối đến máy chủ.');
          }
        }
      });
    }

    tbody.appendChild(tr);
  });

  // Wire Select All and Checkbox update logic
  const thSelectAll = table.querySelector('#th-select-all-tx');
  const rowCheckboxes = table.querySelectorAll('.row-select-tx');
  
  if (thSelectAll) {
    thSelectAll.addEventListener('change', () => {
      const isChecked = thSelectAll.checked;
      rowCheckboxes.forEach(cb => {
        cb.checked = isChecked;
      });
      updateBulkDeleteButtonVisibility();
    });
  }

  rowCheckboxes.forEach(cb => {
    cb.addEventListener('change', () => {
      const allChecked = Array.from(rowCheckboxes).every(c => c.checked);
      if (thSelectAll) thSelectAll.checked = allChecked;
      updateBulkDeleteButtonVisibility();
    });
  });

  function updateBulkDeleteButtonVisibility() {
    const checkedBoxes = Array.from(table.querySelectorAll('.row-select-tx:checked'));
    const btnBulkDelete = document.getElementById('btn-bulk-delete-tx');
    const bulkCount = document.getElementById('bulk-delete-count');
    
    if (btnBulkDelete && bulkCount) {
      if (checkedBoxes.length > 0) {
        bulkCount.textContent = checkedBoxes.length;
        btnBulkDelete.style.display = 'inline-flex';
      } else {
        btnBulkDelete.style.display = 'none';
      }
    }
  }

  // Reset bulk delete button visibility since view list re-rendered
  updateBulkDeleteButtonVisibility();

  wrapper.appendChild(table);
  historyListContainer.appendChild(wrapper);
}

let activeDetailTx = null;

function openTransactionDetail(txIdOrIndex) {
  let tx;
  if (typeof txIdOrIndex === 'string') {
    tx = filteredTransactions.find(t => t.id === txIdOrIndex);
  } else {
    tx = filteredTransactions[txIdOrIndex];
  }
  if (!tx) return;
  activeDetailTx = tx;

  const modalBody = document.getElementById('transaction-detail-modal-body');
  if (!modalBody) return;

  const itemsCount = tx.items.reduce((sum, item) => sum + item.quantity, 0);
  const cleanTime = formatTime(tx.timestamp).replace(' - ', ' • ');
  const finalPaid = tx.subtotal - (tx.discountAmount || 0);
  const paymentMethodLabel = (tx.paymentMethod && tx.paymentMethod.trim() === 'bank') ? 'Chuyển khoản' : 'Tiền mặt';

  // Determine loại hình and khu vực
  let loaihinh = 'Mang đi';
  let khuvuc = 'Mang đi';
  const tableName = tx.tableName || '';
  if (tableName.startsWith('Bàn ')) {
    const tableNumberStr = tableName.replace('Bàn ', '').trim();
    loaihinh = `Tại bàn số ${tableNumberStr}`;
    const tableNum = parseInt(tableNumberStr);
    if (!isNaN(tableNum)) {
      if (tableNum >= 1 && tableNum <= 20) {
        khuvuc = 'Trệt';
      } else if (tableNum >= 21 && tableNum <= 40) {
        khuvuc = 'Lầu';
      }
    }
  }

  modalBody.innerHTML = `
    <div style="display: flex; flex-direction: column; gap: 8px; font-size: 13px;">
      <div style="display: flex; justify-content: space-between;">
        <span style="color: #64748b;">Mã hóa đơn:</span>
        <span style="font-weight: 700; color: #0f172a;">#${tx.id}</span>
      </div>
      <div style="display: flex; justify-content: space-between;">
        <span style="color: #64748b;">Thời gian:</span>
        <span style="font-weight: 600; color: #0f172a;">${cleanTime}</span>
      </div>
      <div style="display: flex; justify-content: space-between;">
        <span style="color: #64748b;">Loại hình:</span>
        <span style="font-weight: 600; color: #0f172a;">${loaihinh}</span>
      </div>
      <div style="display: flex; justify-content: space-between;">
        <span style="color: #64748b;">Khu vực:</span>
        <span style="font-weight: 600; color: #0f172a;">${khuvuc}</span>
      </div>
      <div style="display: flex; justify-content: space-between;">
        <span style="color: #64748b;">Phương thức thanh toán:</span>
        <span style="font-weight: 600; color: #0f172a;">${paymentMethodLabel}</span>
      </div>
      
      <div style="margin-top: 8px; font-weight: 700; color: #475569; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px;">Danh sách món ăn</div>
      <div style="display: flex; flex-direction: column; gap: 8px; max-height: 180px; overflow-y: auto; padding: 4px 0;">
        ${tx.items.map(item => `
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div style="display: flex; flex-direction: column; text-align: left;">
              <span style="font-weight: 600; color: #0f172a;">${item.emoji} ${item.name}</span>
              <span style="font-size: 11px; color: #64748b;">SL: ${item.quantity} × ${formatVND(item.price)}</span>
              ${item.notes ? `<span style="font-size: 11px; color: #ef4444; font-style: italic;">Ghi chú: ${item.notes}</span>` : ''}
            </div>
            <span style="font-weight: 700; color: #0f172a;">${formatVND(item.price * item.quantity)}</span>
          </div>
        `).join('')}
      </div>

      <div style="border-top: 1px dashed #cbd5e1; margin: 8px 0;"></div>
      
      <div style="display: flex; justify-content: space-between;">
        <span style="color: #64748b;">Tiền hàng:</span>
        <span style="font-weight: 600;">${formatVND(tx.subtotal)}</span>
      </div>
      ${tx.discountAmount > 0 ? `
        <div style="display: flex; justify-content: space-between; color: var(--primary);">
          <span>Giảm giá:</span>
          <span>-${formatVND(tx.discountAmount)}</span>
        </div>
      ` : ''}
      <div style="display: flex; justify-content: space-between; font-size: 15px; font-weight: 700; border-top: 1px dashed #cbd5e1; padding-top: 6px;">
        <span>Tổng cộng thực thu:</span>
        <span style="color: var(--primary);">${formatVND(finalPaid)}</span>
      </div>
      <div style="display: flex; justify-content: space-between; font-size: 12px; color: #64748b;">
        <span>Khách đưa:</span>
        <span>${formatVND(tx.receivedAmount)}</span>
      </div>
      <div style="display: flex; justify-content: space-between; font-size: 12px; color: #64748b;">
        <span>Thối lại:</span>
        <span style="color: #10b981; font-weight: 700;">${formatVND(tx.changeAmount)}</span>
      </div>
    </div>
  `;

  // Attach print reprint action
  const reprintBtn = document.getElementById('btn-reprint-modal');
  if (reprintBtn) {
    // Remove old listeners by replacing the element
    const newReprintBtn = reprintBtn.cloneNode(true);
    reprintBtn.parentNode.replaceChild(newReprintBtn, reprintBtn);
    newReprintBtn.addEventListener('click', () => {
      const tableObj = { name: tx.tableName };
      printReceipt(tableObj, tx.items, tx.discountAmount || 0, tx.receivedAmount, tx.id, tx.timestamp);
    });
  }

  const detailModal = document.getElementById('transaction-detail-modal');
  if (detailModal) detailModal.style.display = 'flex';
}

function closeTransactionDetailModal() {
  const detailModal = document.getElementById('transaction-detail-modal');
  if (detailModal) detailModal.style.display = 'none';
  activeDetailTx = null;
}

window.openTransactionDetail = openTransactionDetail;
window.closeTransactionDetailModal = closeTransactionDetailModal;

// Render detailed page for a selected transaction record (No-op as details are shown in modal)
function renderTransactionDetails(tx) {}

// Number counter animation helper
function animateCounter(id, endValue, isCurrency = false, decimals = 0) {
  const el = document.getElementById(id);
  if (!el) return;
  
  let startValue = 0;
  // Parse existing number content as start point
  let curText = el.textContent;
  if (isCurrency) {
    curText = curText.replace(/[^0-9]/g, ''); // strip thousand separators and " đ"
  } else {
    curText = curText.replace(/[^0-9.]/g, ''); // keep decimal dot
  }
  if (curText) {
    startValue = parseFloat(curText) || 0;
  }
  
  if (startValue === endValue) {
    // If value has not changed, update text content directly and exit to avoid animation loop
    if (isCurrency) {
      el.textContent = formatVND(Math.round(endValue));
    } else {
      el.textContent = decimals > 0 ? endValue.toFixed(decimals) : Math.round(endValue);
    }
    return;
  }
  
  let startTimestamp = null;
  const duration = 800; // 800ms
  
  const step = (timestamp) => {
    if (!startTimestamp) startTimestamp = timestamp;
    const progress = Math.min((timestamp - startTimestamp) / duration, 1);
    const easeProgress = progress * (2 - progress); // Ease out quad
    const current = easeProgress * (endValue - startValue) + startValue;
    
    if (isCurrency) {
      el.textContent = formatVND(Math.round(current));
    } else {
      el.textContent = decimals > 0 ? current.toFixed(decimals) : Math.round(current);
    }
    
    if (progress < 1) {
      window.requestAnimationFrame(step);
    }
  };
  window.requestAnimationFrame(step);
}

// Sapo date picker state variables
let calCurrentDate = new Date(2026, 5, 30); // Use June 30, 2026 as current base
let tempRangeStart = new Date(2026, 5, 30);
let tempRangeEnd = new Date(2026, 5, 30);
let rangeStart = new Date(2026, 5, 30);
let rangeEnd = new Date(2026, 5, 30);
let activeChartTab = 'revenue'; // 'revenue' or 'orders'

// Sync Sapo custom select dropdown & calendar picker
function initOverviewControls() {
  const trigger = document.getElementById('sapo-date-trigger');
  const menu = document.getElementById('sapo-date-menu');
  const popup = document.getElementById('sapo-calendar-popup');
  const filterPreset = document.getElementById('filter-preset');
  
  if (!trigger || !menu || !popup) return;

  // Toggle dropdown menu
  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    if (menu.style.display === 'none') {
      menu.style.display = 'flex';
      popup.style.display = 'none'; // Close calendar popup
    } else {
      menu.style.display = 'none';
    }
  });

  // Handle dropdown option click
  document.querySelectorAll('.sapo-dropdown-option').forEach(opt => {
    opt.addEventListener('click', (e) => {
      e.stopPropagation();
      const val = opt.getAttribute('data-value');
      
      // Update active class
      document.querySelectorAll('.sapo-dropdown-option').forEach(o => o.classList.remove('active'));
      opt.classList.add('active');
      
      menu.style.display = 'none';
      
      if (val === 'custom') {
        popup.style.display = 'flex';
        renderCalendarPanes();
      } else {
        popup.style.display = 'none';
        
        // Update label text
        document.getElementById('sapo-date-label').textContent = opt.textContent;
        
        // Sync invoices tab date label & option active class
        const invoicesLabel = document.getElementById('invoices-date-label');
        if (invoicesLabel) {
          const matchOpt = Array.from(document.querySelectorAll('.invoices-dropdown-option')).find(o => o.getAttribute('data-value') === val);
          if (matchOpt) {
            document.querySelectorAll('.invoices-dropdown-option').forEach(o => o.classList.remove('active'));
            matchOpt.classList.add('active');
            invoicesLabel.textContent = matchOpt.textContent;
            
            const customDatesDiv = document.getElementById('invoices-custom-dates');
            if (customDatesDiv) customDatesDiv.style.display = 'none';
          }
        }
        
        // Apply preset
        if (filterPreset) {
          filterPreset.value = val;
          if (typeof filterPreset.onchange === 'function') {
            filterPreset.onchange();
          }
        }
      }
    });
  });

  // Prev/Next month navigation click handlers
  document.getElementById('cal-prev-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    calCurrentDate.setMonth(calCurrentDate.getMonth() - 1);
    renderCalendarPanes();
  });
  
  document.getElementById('cal-next-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    calCurrentDate.setMonth(calCurrentDate.getMonth() + 1);
    renderCalendarPanes();
  });

  // Calendar footer action click handlers
  document.getElementById('cal-cancel-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    popup.style.display = 'none';
    // Restore selection from saved range
    tempRangeStart = rangeStart ? new Date(rangeStart) : null;
    tempRangeEnd = rangeEnd ? new Date(rangeEnd) : null;
  });

  document.getElementById('cal-select-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    if (!tempRangeStart) return;
    
    if (!tempRangeEnd) {
      tempRangeEnd = new Date(tempRangeStart);
    }
    
    rangeStart = new Date(tempRangeStart);
    rangeEnd = new Date(tempRangeEnd);
    
    // Save to hidden inputs
    const startInput = document.getElementById('filter-start-date');
    const endInput = document.getElementById('filter-end-date');
    if (startInput && endInput) {
      const formatToYYYYMMDD = (d) => {
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const date = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${date}`;
      };
      startInput.value = formatToYYYYMMDD(rangeStart);
      endInput.value = formatToYYYYMMDD(rangeEnd);
    }
    
    // Format trigger label: DD/MM/YYYY - DD/MM/YYYY
    const formatToDDMMYYYY = (d) => {
      const date = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      return `${date}/${month}/${year}`;
    };
    
    const rangeText = `${formatToDDMMYYYY(rangeStart)} - ${formatToDDMMYYYY(rangeEnd)}`;
    document.getElementById('sapo-date-label').textContent = rangeText;
    popup.style.display = 'none';
    
    // Sync invoices label & custom dates visibility
    const invoicesLabel = document.getElementById('invoices-date-label');
    if (invoicesLabel) {
      invoicesLabel.textContent = rangeText;
      
      // Update options active class for custom selection
      document.querySelectorAll('.invoices-dropdown-option').forEach(o => {
        if (o.getAttribute('data-value') === 'custom') o.classList.add('active');
        else o.classList.remove('active');
      });
      
      const customDatesDiv = document.getElementById('invoices-custom-dates');
      if (customDatesDiv) {
        customDatesDiv.style.display = 'flex';
        
        const startDateInput = document.getElementById('invoices-start-date');
        const endDateInput = document.getElementById('invoices-end-date');
        if (startDateInput && startInput) startDateInput.value = startInput.value;
        if (endDateInput && endInput) endDateInput.value = endInput.value;
      }
    }
    
    // Trigger custom filtering
    if (filterPreset) {
      filterPreset.value = 'custom';
      applyDateFilter();
    }
  });

  // Close popup and menu on clicking outside Sapo component
  document.addEventListener('click', (e) => {
    const container = document.getElementById('sapo-date-dropdown');
    if (container && !container.contains(e.target)) {
      menu.style.display = 'none';
      popup.style.display = 'none';
    }
  });

  // Chart tab switchers click handlers
  const btnChartRevenue = document.getElementById('btn-chart-revenue');
  const btnChartOrders = document.getElementById('btn-chart-orders');
  const legendTab1 = document.getElementById('chart-legend-tab1');
  const legendTab2 = document.getElementById('chart-legend-tab2');

  if (btnChartRevenue && btnChartOrders) {
    btnChartRevenue.addEventListener('click', () => {
      if (activeChartTab === 'revenue') return;
      activeChartTab = 'revenue';
      btnChartRevenue.classList.add('active');
      btnChartOrders.classList.remove('active');
      if (legendTab1) legendTab1.style.display = 'flex';
      if (legendTab2) legendTab2.style.display = 'none';
      renderCharts();
    });

    btnChartOrders.addEventListener('click', () => {
      if (activeChartTab === 'orders') return;
      activeChartTab = 'orders';
      btnChartOrders.classList.add('active');
      btnChartRevenue.classList.remove('active');
      if (legendTab2) legendTab2.style.display = 'flex';
      if (legendTab1) legendTab1.style.display = 'none';
      renderCharts();
    });
  }

  // Payment Method sub-tab switchers
  const btnPayRevenue = document.getElementById('btn-pay-revenue');
  const btnPayCount = document.getElementById('btn-pay-count');
  if (btnPayRevenue && btnPayCount) {
    btnPayRevenue.addEventListener('click', () => {
      if (activePaymentMethodTab === 'revenue') return;
      activePaymentMethodTab = 'revenue';
      btnPayRevenue.classList.add('active');
      btnPayCount.classList.remove('active');
      updateAnalytics(); // recalculate & render
    });
    btnPayCount.addEventListener('click', () => {
      if (activePaymentMethodTab === 'count') return;
      activePaymentMethodTab = 'count';
      btnPayCount.classList.add('active');
      btnPayRevenue.classList.remove('active');
      updateAnalytics();
    });
  }

  // Serving Type sub-tab switchers
  const btnServeRevenue = document.getElementById('btn-serve-revenue');
  const btnServeCount = document.getElementById('btn-serve-count');
  if (btnServeRevenue && btnServeCount) {
    btnServeRevenue.addEventListener('click', () => {
      if (activeServingTypeTab === 'revenue') return;
      activeServingTypeTab = 'revenue';
      btnServeRevenue.classList.add('active');
      btnServeCount.classList.remove('active');
      updateAnalytics();
    });
    btnServeCount.addEventListener('click', () => {
      if (activeServingTypeTab === 'count') return;
      activeServingTypeTab = 'count';
      btnServeCount.classList.add('active');
      btnServeRevenue.classList.remove('active');
      updateAnalytics();
    });
  }

  // Items by Category sub-tab switchers
  const btnCatRevenue = document.getElementById('btn-cat-revenue');
  const btnCatCount = document.getElementById('btn-cat-count');
  if (btnCatRevenue && btnCatCount) {
    btnCatRevenue.addEventListener('click', () => {
      if (activeItemsCategoryTab === 'revenue') return;
      activeItemsCategoryTab = 'revenue';
      btnCatRevenue.classList.add('active');
      btnCatCount.classList.remove('active');
      updateAnalytics();
    });
    btnCatCount.addEventListener('click', () => {
      if (activeItemsCategoryTab === 'count') return;
      activeItemsCategoryTab = 'count';
      btnCatCount.classList.add('active');
      btnCatRevenue.classList.remove('active');
      updateAnalytics();
    });
  }

  // Best Selling Items sub-tab switchers
  const btnBestsellRevenue = document.getElementById('btn-bestsell-revenue');
  const btnBestsellCount = document.getElementById('btn-bestsell-count');
  if (btnBestsellRevenue && btnBestsellCount) {
    btnBestsellRevenue.addEventListener('click', () => {
      if (activeItemsBestsellTab === 'revenue') return;
      activeItemsBestsellTab = 'revenue';
      btnBestsellRevenue.classList.add('active');
      btnBestsellCount.classList.remove('active');
      updateAnalytics();
    });
    btnBestsellCount.addEventListener('click', () => {
      if (activeItemsBestsellTab === 'count') return;
      activeItemsBestsellTab = 'count';
      btnBestsellCount.classList.add('active');
      btnBestsellRevenue.classList.remove('active');
      updateAnalytics();
    });
  }

  // Best Selling Items Limit dropdown change listener
  const selectTopLimit = document.getElementById('select-top-limit');
  if (selectTopLimit) {
    selectTopLimit.addEventListener('change', () => {
      itemsBestsellLimit = parseInt(selectTopLimit.value) || 5;
      updateAnalytics();
    });
  }
}

function initInvoicesFilter() {
  const trigger = document.getElementById('invoices-date-trigger');
  const menu = document.getElementById('invoices-date-menu');
  const customDatesDiv = document.getElementById('invoices-custom-dates');
  const btnApply = document.getElementById('invoices-btn-apply');
  const startDateInput = document.getElementById('invoices-start-date');
  const endDateInput = document.getElementById('invoices-end-date');
  
  const filterPreset = document.getElementById('filter-preset');
  const filterStartDate = document.getElementById('filter-start-date');
  const filterEndDate = document.getElementById('filter-end-date');

  // Serve Type custom dropdown elements
  const serveTrigger = document.getElementById('invoices-serve-type-trigger');
  const serveMenu = document.getElementById('invoices-serve-type-menu');

  // Pay Method custom dropdown elements
  const payTrigger = document.getElementById('invoices-pay-method-trigger');
  const payMenu = document.getElementById('invoices-pay-method-menu');

  if (!trigger || !menu) return;

  // Set initial dates to today (matching 2026-06-30 base)
  const baseDateStr = '2026-06-30';
  if (startDateInput) startDateInput.value = baseDateStr;
  if (endDateInput) endDateInput.value = baseDateStr;

  // Close menus when clicking outside
  document.addEventListener('click', (e) => {
    if (trigger && !trigger.contains(e.target) && menu && !menu.contains(e.target)) {
      menu.style.display = 'none';
    }
    if (serveTrigger && !serveTrigger.contains(e.target) && serveMenu && !serveMenu.contains(e.target)) {
      serveMenu.style.display = 'none';
    }
    if (payTrigger && !payTrigger.contains(e.target) && payMenu && !payMenu.contains(e.target)) {
      payMenu.style.display = 'none';
    }
  });

  // Toggle Date Menu
  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    menu.style.display = menu.style.display === 'none' ? 'flex' : 'none';
    if (serveMenu) serveMenu.style.display = 'none';
    if (payMenu) payMenu.style.display = 'none';
  });

  // Toggle Serve Type Menu
  if (serveTrigger && serveMenu) {
    serveTrigger.addEventListener('click', (e) => {
      e.stopPropagation();
      serveMenu.style.display = serveMenu.style.display === 'none' ? 'flex' : 'none';
      if (menu) menu.style.display = 'none';
      if (payMenu) payMenu.style.display = 'none';
    });
  }

  // Toggle Pay Method Menu
  if (payTrigger && payMenu) {
    payTrigger.addEventListener('click', (e) => {
      e.stopPropagation();
      payMenu.style.display = payMenu.style.display === 'none' ? 'flex' : 'none';
      if (menu) menu.style.display = 'none';
      if (serveMenu) serveMenu.style.display = 'none';
    });
  }

  // Date selection
  document.querySelectorAll('.invoices-dropdown-option').forEach(opt => {
    opt.addEventListener('click', (e) => {
      e.stopPropagation();
      const val = opt.getAttribute('data-value');
      document.querySelectorAll('.invoices-dropdown-option').forEach(o => o.classList.remove('active'));
      opt.classList.add('active');
      menu.style.display = 'none';
      document.getElementById('invoices-date-label').textContent = opt.textContent;

      if (val === 'custom') {
        if (customDatesDiv) customDatesDiv.style.display = 'flex';
      } else {
        if (customDatesDiv) customDatesDiv.style.display = 'none';
        if (filterPreset) {
          filterPreset.value = val;
          const overviewLabel = document.getElementById('sapo-date-label');
          if (overviewLabel) {
            const matchOpt = Array.from(document.querySelectorAll('.sapo-dropdown-option')).find(o => o.getAttribute('data-value') === val);
            if (matchOpt) {
              document.querySelectorAll('.sapo-dropdown-option').forEach(o => o.classList.remove('active'));
              matchOpt.classList.add('active');
              overviewLabel.textContent = matchOpt.textContent;
            }
          }
          applyDateFilter();
        }
      }
    });
  });

  // Serve Type selection
  document.querySelectorAll('.invoices-serve-option').forEach(opt => {
    opt.addEventListener('click', (e) => {
      e.stopPropagation();
      const val = opt.getAttribute('data-value');
      document.querySelectorAll('.invoices-serve-option').forEach(o => o.classList.remove('active'));
      opt.classList.add('active');
      if (serveMenu) serveMenu.style.display = 'none';
      
      const label = document.getElementById('invoices-serve-type-label');
      if (label) label.textContent = opt.textContent;

      activeServeTypeFilter = val;
      renderTransactionsList();
    });
  });

  // Pay Method selection
  document.querySelectorAll('.invoices-pay-option').forEach(opt => {
    opt.addEventListener('click', (e) => {
      e.stopPropagation();
      const val = opt.getAttribute('data-value');
      document.querySelectorAll('.invoices-pay-option').forEach(o => o.classList.remove('active'));
      opt.classList.add('active');
      if (payMenu) payMenu.style.display = 'none';
      
      const label = document.getElementById('invoices-pay-method-label');
      if (label) label.textContent = opt.textContent;

      activePayMethodFilter = val;
      renderTransactionsList();
    });
  });

  if (btnApply) {
    btnApply.addEventListener('click', (e) => {
      e.stopPropagation();
      if (filterPreset && filterStartDate && filterEndDate) {
        filterStartDate.value = startDateInput.value;
        filterEndDate.value = endDateInput.value;
        filterPreset.value = 'custom';
        
        // Sync overview label
        const overviewLabel = document.getElementById('sapo-date-label');
        if (overviewLabel) {
          const formatDateStr = (val) => {
            const d = new Date(val);
            const date = String(d.getDate()).padStart(2, '0');
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const year = d.getFullYear();
            return `${date}/${month}/${year}`;
          };
          overviewLabel.textContent = `${formatDateStr(startDateInput.value)} - ${formatDateStr(endDateInput.value)}`;
        }
        
        // Sync overview dropdown active options
        document.querySelectorAll('.sapo-dropdown-option').forEach(o => {
          if (o.getAttribute('data-value') === 'custom') o.classList.add('active');
          else o.classList.remove('active');
        });
        
        applyDateFilter();
      }
    });
  }

  const btnBulkDelete = document.getElementById('btn-bulk-delete-tx');
  if (btnBulkDelete) {
    btnBulkDelete.addEventListener('click', async () => {
      const checkedBoxes = Array.from(document.querySelectorAll('.row-select-tx:checked'));
      const ids = checkedBoxes.map(cb => cb.getAttribute('data-id'));
      if (ids.length === 0) return;
      
      if (confirm(`⚠️ Bạn có chắc chắn muốn xóa ${ids.length} hóa đơn đã chọn không? Thao tác này không thể hoàn tác.`)) {
        btnBulkDelete.disabled = true;
        btnBulkDelete.textContent = 'Đang xóa...';
        try {
          const res = await fetch('/api/transactions-bulk', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids })
          });
          const result = await res.json();
          if (result.success) {
            showToast(`✅ Đã xóa thành công ${result.count || ids.length} hóa đơn!`);
            const transactionsRes = await fetch('/api/transactions');
            if (transactionsRes.ok) {
              transactions = await transactionsRes.json();
              applyDateFilter();
            }
          } else {
            alert(`Lỗi: ${result.error}`);
          }
        } catch (err) {
          console.error(err);
          alert('Không thể kết nối đến máy chủ.');
        } finally {
          btnBulkDelete.disabled = false;
          btnBulkDelete.textContent = 'Xóa đã chọn';
          btnBulkDelete.style.display = 'none';
        }
      }
    });
  }
}

function renderCalendarPanes() {
  const leftMonth = new Date(calCurrentDate.getFullYear(), calCurrentDate.getMonth() - 1, 1);
  const rightMonth = new Date(calCurrentDate.getFullYear(), calCurrentDate.getMonth(), 1);
  
  const monthNames = ['Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6', 'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12'];
  document.getElementById('cal-month-left-label').textContent = `${monthNames[leftMonth.getMonth()]} ${leftMonth.getFullYear()}`;
  document.getElementById('cal-month-right-label').textContent = `${monthNames[rightMonth.getMonth()]} ${rightMonth.getFullYear()}`;
  
  // Render both panes
  renderMonthDays('cal-days-left', leftMonth);
  renderMonthDays('cal-days-right', rightMonth);
  
  updateRangeText();
}

function renderMonthDays(containerId, monthDate) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = '';
  
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const numDays = lastDay.getDate();
  
  let startDayIndex = firstDay.getDay();
  startDayIndex = startDayIndex === 0 ? 6 : startDayIndex - 1; // Mon=0, Sun=6
  
  // Previous month overflow days
  const prevMonthLastDay = new Date(year, month, 0).getDate();
  for (let i = startDayIndex - 1; i >= 0; i--) {
    const cell = document.createElement('div');
    cell.className = 'calendar-day-cell overflow-day';
    cell.textContent = prevMonthLastDay - i;
    container.appendChild(cell);
  }
  
  // Current month days
  for (let d = 1; d <= numDays; d++) {
    const cell = document.createElement('div');
    cell.className = 'calendar-day-cell';
    cell.textContent = d;
    
    const dateObj = new Date(year, month, d);
    
    // Set highlights based on temporary selection ranges
    if (tempRangeStart && isSameDay(dateObj, tempRangeStart)) {
      cell.classList.add('selected-start');
    } else if (tempRangeEnd && isSameDay(dateObj, tempRangeEnd)) {
      cell.classList.add('selected-end');
    } else if (tempRangeStart && tempRangeEnd && dateObj > tempRangeStart && dateObj < tempRangeEnd) {
      cell.classList.add('in-range');
    }
    
    cell.addEventListener('click', (e) => {
      e.stopPropagation();
      handleDayClick(dateObj);
    });
    
    container.appendChild(cell);
  }
  
  // Next month overflow days (fill grid to multiple of 7)
  const totalRendered = startDayIndex + numDays;
  const nextMonthDaysNeeded = totalRendered % 7 === 0 ? 0 : 7 - (totalRendered % 7);
  for (let i = 1; i <= nextMonthDaysNeeded; i++) {
    const cell = document.createElement('div');
    cell.className = 'calendar-day-cell overflow-day';
    cell.textContent = i;
    container.appendChild(cell);
  }
}

function handleDayClick(date) {
  if (!tempRangeStart || (tempRangeStart && tempRangeEnd)) {
    tempRangeStart = date;
    tempRangeEnd = null;
  } else if (tempRangeStart && !tempRangeEnd) {
    if (date < tempRangeStart) {
      tempRangeStart = date;
    } else {
      tempRangeEnd = date;
    }
  }
  renderCalendarPanes();
}

function isSameDay(d1, d2) {
  return d1.getFullYear() === d2.getFullYear() &&
         d1.getMonth() === d2.getMonth() &&
         d1.getDate() === d2.getDate();
}

function updateRangeText() {
  const display = document.getElementById('cal-range-display');
  if (!display) return;
  
  const formatToDDMMYYYY = (d) => {
    const date = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${date}/${month}/${year}`;
  };
  
  if (tempRangeStart && tempRangeEnd) {
    display.textContent = `${formatToDDMMYYYY(tempRangeStart)} - ${formatToDDMMYYYY(tempRangeEnd)}`;
  } else if (tempRangeStart) {
    display.textContent = `${formatToDDMMYYYY(tempRangeStart)} - Đang chọn...`;
  } else {
    display.textContent = 'Chọn khoảng thời gian';
  }
}

// Compute Statistics Widgets
function updateAnalytics() {
  // Filtered statistics (calculated on filteredTransactions list)
  let totalDiscount = 0;
  let cashBills = 0;
  let bankBills = 0;
  let cashAmount = 0;
  let bankAmount = 0;
  const itemStats = {};

  filteredTransactions.forEach(tx => {
    totalDiscount += (tx.discountAmount || 0);
    const amount = tx.subtotal - (tx.discountAmount || 0);

    if (tx.paymentMethod === 'bank') {
      bankBills++;
      bankAmount += amount;
    } else {
      cashBills++;
      cashAmount += amount;
    }

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

  const totalRevenue = cashAmount + bankAmount;
  
  let totalItemsQty = 0;
  let totalItemsAmount = 0;
  filteredTransactions.forEach(tx => {
    totalItemsAmount += tx.subtotal;
    tx.items.forEach(item => {
      totalItemsQty += item.quantity;
    });
  });
  
  const avgItemsPerBill = filteredTransactions.length > 0 ? (totalItemsQty / filteredTransactions.length) : 0;
  const avgRevenuePerBill = filteredTransactions.length > 0 ? (totalRevenue / filteredTransactions.length) : 0;

  // Animate metrics row 1 (Primary cards)
  animateCounter('overview-items-amount', totalItemsAmount, true, 0);
  animateCounter('overview-void-amount', 0, true, 0);
  animateCounter('overview-discount-amount', totalDiscount, true, 0);
  animateCounter('overview-tax-amount', 0, true, 0);
  animateCounter('overview-revenue-amount', totalRevenue, true, 0);

  // Animate metrics row 2 (Secondary cards with border accents)
  animateCounter('overview-customers-count', filteredTransactions.length, false, 0);
  animateCounter('overview-bills-count', filteredTransactions.length, false, 0);
  animateCounter('overview-avg-items', avgItemsPerBill, false, 1);
  animateCounter('overview-avg-bill-value', avgRevenuePerBill, true, 0);

  // Animate chart legend revenue
  animateCounter('chart-legend-revenue', totalRevenue, true, 0);

  // Render Menu Item Sales list
  const sortedStats = Object.values(itemStats).sort((a, b) => b.qty - a.qty);
  
  if (menuSalesStatsBody) {
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
  }

  // Update Best Seller widget
  const bestItem = sortedStats[0];
  if (statBestSeller) {
    if (bestItem) {
      statBestSeller.textContent = `${bestItem.emoji} ${bestItem.name} (${bestItem.qty} suất)`;
    } else {
      statBestSeller.textContent = '--';
    }
  }

  // 1. Incomplete Orders Calculation
  let activeTableCount = 0;
  let activeTableAmount = 0;
  let activeTakeawayCount = 0;
  let activeTakeawayAmount = 0;

  tables.forEach(table => {
    if (table.status === 'eating' && table.order && table.order.length > 0) {
      const subtotal = table.order.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      const isTakeaway = (table.location && table.location.toLowerCase() === 'mang về') || (table.name && !table.name.startsWith('Bàn '));
      if (isTakeaway) {
        activeTakeawayCount++;
        activeTakeawayAmount += subtotal;
      } else {
        activeTableCount++;
        activeTableAmount += subtotal;
      }
    }
  });

  const totalIncompleteCount = activeTableCount + activeTakeawayCount;
  const totalIncompleteAmount = activeTableAmount + activeTakeawayAmount;

  // Update HTML elements
  const elIncompleteTableCount = document.getElementById('incomplete-table-count');
  const elIncompleteTableAmount = document.getElementById('incomplete-table-amount');
  const elIncompleteTakeawayCount = document.getElementById('incomplete-takeaway-count');
  const elIncompleteTakeawayAmount = document.getElementById('incomplete-takeaway-amount');
  const elIncompleteTotalCount = document.getElementById('incomplete-total-count');
  const elIncompleteTotalAmount = document.getElementById('incomplete-total-amount');

  if (elIncompleteTableCount) elIncompleteTableCount.textContent = activeTableCount;
  if (elIncompleteTableAmount) elIncompleteTableAmount.textContent = formatVND(activeTableAmount);
  if (elIncompleteTakeawayCount) elIncompleteTakeawayCount.textContent = activeTakeawayCount;
  if (elIncompleteTakeawayAmount) elIncompleteTakeawayAmount.textContent = formatVND(activeTakeawayAmount);
  if (elIncompleteTotalCount) elIncompleteTotalCount.textContent = totalIncompleteCount;
  if (elIncompleteTotalAmount) elIncompleteTotalAmount.textContent = formatVND(totalIncompleteAmount);

  // 2. Staff Revenue Calculation
  const elStaffOwnerAmount = document.getElementById('staff-owner-amount');
  if (elStaffOwnerAmount) elStaffOwnerAmount.textContent = formatVND(totalRevenue);

  // 3. Payment Methods Data Calculation
  let payBankRevenue = 0;
  let payCashRevenue = 0;
  let payBankCount = 0;
  let payCashCount = 0;

  filteredTransactions.forEach(tx => {
    const amount = tx.subtotal - (tx.discountAmount || 0);
    if (tx.paymentMethod === 'bank') {
      payBankRevenue += amount;
      payBankCount += 1;
    } else {
      payCashRevenue += amount;
      payCashCount += 1;
    }
  });

  const elPayBankValue = document.getElementById('pay-bank-value');
  const elPayCashValue = document.getElementById('pay-cash-value');
  if (elPayBankValue && elPayCashValue) {
    if (activePaymentMethodTab === 'revenue') {
      elPayBankValue.textContent = formatVND(payBankRevenue);
      elPayCashValue.textContent = formatVND(payCashRevenue);
    } else {
      elPayBankValue.textContent = `${payBankCount} hóa đơn`;
      elPayCashValue.textContent = `${payCashCount} hóa đơn`;
    }
  }

  // 4. Serving Types Data Calculation
  let serveTableRevenue = 0;
  let serveTakeawayRevenue = 0;
  let serveTableCount = 0;
  let serveTakeawayCount = 0;

  filteredTransactions.forEach(tx => {
    const amount = tx.subtotal - (tx.discountAmount || 0);
    const tableName = tx.tableName || '';
    const isTakeaway = !tableName.startsWith('Bàn ');
    if (isTakeaway) {
      serveTakeawayRevenue += amount;
      serveTakeawayCount += 1;
    } else {
      serveTableRevenue += amount;
      serveTableCount += 1;
    }
  });

  const elServeTableValue = document.getElementById('serve-table-value');
  const elServeTakeawayValue = document.getElementById('serve-takeaway-value');
  if (elServeTableValue && elServeTakeawayValue) {
    if (activeServingTypeTab === 'revenue') {
      elServeTableValue.textContent = formatVND(serveTableRevenue);
      elServeTakeawayValue.textContent = formatVND(serveTakeawayRevenue);
    } else {
      elServeTableValue.textContent = `${serveTableCount} hóa đơn`;
      elServeTakeawayValue.textContent = `${serveTakeawayCount} hóa đơn`;
    }
  }

  // 5. Items by Category Calculations
  const categoryMap = {};
  const getCategoryLabel = (cat) => {
    switch (cat) {
      case 'main': return 'Món chính';
      case 'side': return 'Món thêm';
      case 'drink': return 'Nước uống';
      default: return 'Không có danh mục';
    }
  };

  filteredTransactions.forEach(tx => {
    tx.items.forEach(item => {
      const menuItem = menuItems.find(m => m.name === item.name);
      const catKey = menuItem ? menuItem.category : 'default';
      const catLabel = getCategoryLabel(catKey);
      
      if (!categoryMap[catLabel]) {
        categoryMap[catLabel] = {
          label: catLabel,
          revenue: 0,
          count: 0
        };
      }
      categoryMap[catLabel].revenue += item.price * item.quantity;
      categoryMap[catLabel].count += item.quantity;
    });
  });

  const isCatRev = activeItemsCategoryTab === 'revenue';
  const sortedCategories = Object.values(categoryMap).sort((a, b) => {
    return isCatRev ? b.revenue - a.revenue : b.count - a.count;
  });

  const colorsList = ['#024ad8', '#ff6b8b', '#8b5cf6', '#06b6d4', '#10b981'];
  const catLegendList = document.getElementById('cat-legend-list');
  if (catLegendList) {
    if (sortedCategories.length === 0) {
      catLegendList.innerHTML = `<div style="text-align: center; color: var(--muted); font-size: 13px; padding-top: 20px;">Chưa có dữ liệu.</div>`;
    } else {
      catLegendList.innerHTML = sortedCategories.map((cat, idx) => {
        const color = colorsList[idx % colorsList.length];
        const displayValue = isCatRev ? formatVND(cat.revenue) : `${cat.count} sản phẩm`;
        return `
          <div class="legend-list-item" style="display: flex; justify-content: space-between; align-items: center; font-size: 13px;">
            <span style="display: flex; align-items: center; gap: 8px;">
              <span class="dot-indicator" style="background-color: ${color}; width: 8px; height: 8px; border-radius: 50%; display: inline-block;"></span>
              ${cat.label}
            </span>
            <span class="bold" style="font-weight: 700;">${displayValue}</span>
          </div>
        `;
      }).join('');
    }
  }

  // 6. Best Selling Items Calculations
  const isBestRev = activeItemsBestsellTab === 'revenue';
  const sortedItems = Object.values(itemStats).sort((a, b) => {
    return isBestRev ? b.revenue - a.revenue : b.qty - a.qty;
  });
  
  const topItems = sortedItems.slice(0, itemsBestsellLimit);
  const bestsellLegendList = document.getElementById('bestsell-legend-list');
  if (bestsellLegendList) {
    if (topItems.length === 0) {
      bestsellLegendList.innerHTML = `<div style="text-align: center; color: var(--muted); font-size: 13px; padding-top: 20px;">Chưa có dữ liệu.</div>`;
    } else {
      bestsellLegendList.innerHTML = topItems.map((item, idx) => {
        const color = colorsList[idx % colorsList.length];
        const displayValue = isBestRev ? formatVND(item.revenue) : `${item.qty} sản phẩm`;
        
        let displayName = item.name;
        if (displayName.length > 26) {
          displayName = displayName.substring(0, 24) + '...';
        }
        return `
          <div class="legend-list-item" style="display: flex; justify-content: space-between; align-items: center; font-size: 13px; gap: 8px;">
            <span style="display: flex; align-items: center; gap: 8px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
              <span class="dot-indicator" style="background-color: ${color}; width: 8px; height: 8px; border-radius: 50%; display: inline-block; flex-shrink: 0;"></span>
              ${item.emoji} ${displayName}
            </span>
            <span class="bold" style="font-weight: 700; flex-shrink: 0;">${displayValue}</span>
          </div>
        `;
      }).join('');
    }
  }

  // Render Visual Analytics Charts
  renderCharts(sortedStats);
  renderDonutCharts(payBankRevenue, payCashRevenue, payBankCount, payCashCount, serveTableRevenue, serveTakeawayRevenue, serveTableCount, serveTakeawayCount);
  renderItemsDonutCharts(sortedCategories, isCatRev, topItems, isBestRev);
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
  } else if (preset === 'yesterday') {
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const yesterdayStr = yesterday.toDateString();
    filteredTransactions = transactions.filter(tx => {
      return new Date(tx.timestamp).toDateString() === yesterdayStr;
    });
  } else if (preset === 'week') {
    // Current week starting from Monday (T2)
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(now);
    monday.setDate(diff);
    monday.setHours(0, 0, 0, 0);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);
    filteredTransactions = transactions.filter(tx => {
      const txTime = new Date(tx.timestamp).getTime();
      return txTime >= monday.getTime() && txTime <= sunday.getTime();
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
if (filterPreset) {
  filterPreset.onchange = () => {
    if (filterPreset.value === 'custom') {
      if (filterCustomDates) filterCustomDates.style.display = 'flex';
    } else {
      if (filterCustomDates) filterCustomDates.style.display = 'none';
      applyDateFilter();
    }
  };
}

if (btnApplyFilter) {
  btnApplyFilter.onclick = () => {
    applyDateFilter();
  };
}



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
    
    // Also sync the Sapo overview dropdown select
    const overviewSelect = document.getElementById('overview-preset-select');
    if (overviewSelect) {
      overviewSelect.value = preset;
    }
    
    // Trigger native change event logic
    filterPreset.onchange();
  });
});

// Render Visual Analytics Charts (Chart.js)
function renderCharts(sortedStats) {
  const hourlyRevenuePoints = Array(24).fill(0);
  const hourlyInvoicePoints = Array(24).fill(0);
  
  filteredTransactions.forEach(tx => {
    const d = new Date(tx.timestamp);
    const hour = d.getHours();
    const actualPaid = tx.subtotal - (tx.discountAmount || 0);
    hourlyRevenuePoints[hour] += actualPaid;
    hourlyInvoicePoints[hour] += 1;
  });

  const hourlyLabels = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, '0')}:00`);

  // Update total legends
  const totalRevenue = hourlyRevenuePoints.reduce((sum, x) => sum + x, 0);
  const totalInvoices = filteredTransactions.length;
  
  // 1. Update original general chart legend
  const chartLegendRevenue = document.getElementById('chart-legend-revenue');
  if (chartLegendRevenue) chartLegendRevenue.textContent = formatVND(totalRevenue);
  
  // 2. Update new tabbed chart legends
  const legendTab1Revenue = document.getElementById('legend-tab1-revenue');
  const legendTab1Orders = document.getElementById('legend-tab1-orders');
  const legendTab2Orders = document.getElementById('legend-tab2-orders');
  
  if (legendTab1Revenue) legendTab1Revenue.textContent = formatVND(totalRevenue);
  if (legendTab1Orders) legendTab1Orders.textContent = totalInvoices;
  if (legendTab2Orders) legendTab2Orders.textContent = totalInvoices;

  // Render original hourly revenue bar chart
  const canvasOriginal = document.getElementById('overview-hourly-chart');
  if (canvasOriginal) {
    const ctxOriginal = canvasOriginal.getContext('2d');
    if (overviewHourlyChartInstance) {
      overviewHourlyChartInstance.destroy();
    }
    overviewHourlyChartInstance = new Chart(ctxOriginal, {
      type: 'bar',
      data: {
        labels: hourlyLabels,
        datasets: [{
          label: 'Doanh thu',
          data: hourlyRevenuePoints,
          backgroundColor: '#024ad8',
          hoverBackgroundColor: '#0e3191',
          borderRadius: 2,
          borderWidth: 0,
          barPercentage: 0.6,
          categoryPercentage: 0.8
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            backgroundColor: 'rgba(15, 23, 42, 0.9)',
            titleColor: '#ffffff',
            bodyColor: '#ffffff',
            padding: 12,
            cornerRadius: 4,
            displayColors: false,
            callbacks: {
              label: function(context) {
                return 'Doanh thu: ' + formatVND(context.parsed.y);
              }
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            grid: {
              color: '#f1f5f9',
              drawBorder: false
            },
            ticks: {
              color: '#6b7280',
              font: {
                size: 11
              },
              callback: function(value) {
                return value.toLocaleString('vi-VN') + ' đ';
              }
            }
          },
          x: {
            grid: {
              display: false
            },
            ticks: {
              color: '#6b7280',
              font: {
                size: 11
              }
            }
          }
        },
        animation: {
          duration: 1200,
          easing: 'easeOutQuart'
        }
      }
    });
  }

  // Render new tabbed combo/line charts
  const canvasTabbed = document.getElementById('overview-tabbed-chart');
  if (canvasTabbed) {
    const ctxTabbed = canvasTabbed.getContext('2d');
    if (overviewTabbedChartInstance) {
      overviewTabbedChartInstance.destroy();
    }

    let chartConfig = {};
    if (activeChartTab === 'revenue') {
      // Dual Axis Combo Chart: Bar (Revenue) + Line (Invoices)
      chartConfig = {
        type: 'bar',
        data: {
          labels: hourlyLabels,
          datasets: [
            {
              label: 'Tổng doanh thu',
              data: hourlyRevenuePoints,
              backgroundColor: '#024ad8',
              hoverBackgroundColor: '#0e3191',
              borderRadius: 2,
              borderWidth: 0,
              barPercentage: 0.6,
              categoryPercentage: 0.8,
              yAxisID: 'y1',
              type: 'bar',
              order: 2
            },
            {
              label: 'Tổng hóa đơn',
              data: hourlyInvoicePoints,
              borderColor: '#ff6b8b',
              backgroundColor: '#ff6b8b',
              tension: 0.3,
              fill: false,
              pointRadius: 4,
              pointBackgroundColor: '#ff6b8b',
              yAxisID: 'y2',
              type: 'line',
              order: 1
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              display: false
            },
            tooltip: {
              backgroundColor: 'rgba(15, 23, 42, 0.9)',
              titleColor: '#ffffff',
              bodyColor: '#ffffff',
              padding: 12,
              cornerRadius: 4,
              displayColors: true,
              callbacks: {
                label: function(context) {
                  if (context.dataset.label === 'Tổng doanh thu') {
                    return 'Doanh thu: ' + formatVND(context.parsed.y);
                  } else {
                    return 'Hóa đơn: ' + context.parsed.y;
                  }
                }
              }
            }
          },
          scales: {
            y1: {
              type: 'linear',
              position: 'left',
              beginAtZero: true,
              grid: {
                color: '#f1f5f9',
                drawBorder: false
              },
              ticks: {
                color: '#6b7280',
                font: {
                  size: 11
                },
                callback: function(value) {
                  return value.toLocaleString('vi-VN') + ' đ';
                }
              }
            },
            y2: {
              type: 'linear',
              position: 'right',
              beginAtZero: true,
              grid: {
                drawOnChartArea: false
              },
              ticks: {
                color: '#6b7280',
                font: {
                  size: 11
                },
                precision: 0
              }
            },
            x: {
              grid: {
                display: false
              },
              ticks: {
                color: '#6b7280',
                font: {
                  size: 11
                }
              }
            }
          },
          animation: {
            duration: 1200,
            easing: 'easeOutQuart'
          }
        }
      };
    } else {
      // Single Line Chart (Total orders complete by order creation time)
      chartConfig = {
        type: 'line',
        data: {
          labels: hourlyLabels,
          datasets: [{
            label: 'Tổng hóa đơn',
            data: hourlyInvoicePoints,
            borderColor: '#10b981',
            backgroundColor: '#10b981',
            tension: 0.3,
            fill: false,
            pointRadius: 4,
            pointBackgroundColor: '#10b981',
            borderWidth: 2
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              display: false
            },
            tooltip: {
              backgroundColor: 'rgba(15, 23, 42, 0.9)',
              titleColor: '#ffffff',
              bodyColor: '#ffffff',
              padding: 12,
              cornerRadius: 4,
              displayColors: false,
              callbacks: {
                label: function(context) {
                  return 'Số hóa đơn: ' + context.parsed.y;
                }
              }
            }
          },
          scales: {
            y: {
              beginAtZero: true,
              grid: {
                color: '#f1f5f9',
                drawBorder: false
              },
              ticks: {
                color: '#6b7280',
                font: {
                  size: 11
                },
                precision: 0
              }
            },
            x: {
              grid: {
                display: false
              },
              ticks: {
                color: '#6b7280',
                font: {
                  size: 11
                }
              }
            }
          },
          animation: {
            duration: 1200,
            easing: 'easeOutQuart'
          }
        }
      };
    }
    overviewTabbedChartInstance = new Chart(ctxTabbed, chartConfig);
  }
}

function renderDonutCharts(payBankRevenue, payCashRevenue, payBankCount, payCashCount, serveTableRevenue, serveTakeawayRevenue, serveTableCount, serveTakeawayCount) {
  // 1. Payment Method Donut Chart
  const canvasPay = document.getElementById('payment-method-donut-chart');
  if (canvasPay) {
    const ctxPay = canvasPay.getContext('2d');
    if (paymentMethodDonutChartInstance) {
      paymentMethodDonutChartInstance.destroy();
    }
    
    const isRev = activePaymentMethodTab === 'revenue';
    const dataVals = isRev ? [payBankRevenue, payCashRevenue] : [payBankCount, payCashCount];
    const total = dataVals[0] + dataVals[1];
    
    paymentMethodDonutChartInstance = new Chart(ctxPay, {
      type: 'doughnut',
      data: {
        labels: ['Chuyển khoản', 'Tiền mặt'],
        datasets: [{
          data: dataVals,
          backgroundColor: ['#024ad8', '#ff6b8b'],
          borderWidth: 1,
          borderColor: '#ffffff'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '65%',
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgba(15, 23, 42, 0.9)',
            callbacks: {
              label: function(context) {
                const label = context.label || '';
                const val = context.parsed;
                const pct = total > 0 ? ((val / total) * 100).toFixed(2) : 0;
                if (isRev) {
                  return ` ${label}: ${formatVND(val)} (${pct}%)`;
                } else {
                  return ` ${label}: ${val} hóa đơn (${pct}%)`;
                }
              }
            }
          }
        }
      }
    });
  }

  // 2. Serving Type Donut Chart
  const canvasServe = document.getElementById('serving-type-donut-chart');
  if (canvasServe) {
    const ctxServe = canvasServe.getContext('2d');
    if (servingTypeDonutChartInstance) {
      servingTypeDonutChartInstance.destroy();
    }
    
    const isRev = activeServingTypeTab === 'revenue';
    const dataVals = isRev ? [serveTableRevenue, serveTakeawayRevenue] : [serveTableCount, serveTakeawayCount];
    const total = dataVals[0] + dataVals[1];
    
    servingTypeDonutChartInstance = new Chart(ctxServe, {
      type: 'doughnut',
      data: {
        labels: ['Ăn tại bàn', 'Mang đi'],
        datasets: [{
          data: dataVals,
          backgroundColor: ['#024ad8', '#ff6b8b'],
          borderWidth: 1,
          borderColor: '#ffffff'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '65%',
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgba(15, 23, 42, 0.9)',
            callbacks: {
              label: function(context) {
                const label = context.label || '';
                const val = context.parsed;
                const pct = total > 0 ? ((val / total) * 100).toFixed(2) : 0;
                if (isRev) {
                  return ` ${label}: ${formatVND(val)} (${pct}%)`;
                } else {
                  return ` ${label}: ${val} hóa đơn (${pct}%)`;
                }
              }
            }
          }
        }
      }
    });
  }
}

function renderItemsDonutCharts(sortedCategories, isCatRev, topItems, isBestRev) {
  const colorsList = ['#024ad8', '#ff6b8b', '#8b5cf6', '#06b6d4', '#10b981'];

  // 1. Items Category Donut Chart
  const canvasCat = document.getElementById('items-category-donut-chart');
  if (canvasCat) {
    const ctxCat = canvasCat.getContext('2d');
    if (itemsCategoryDonutChartInstance) {
      itemsCategoryDonutChartInstance.destroy();
    }
    
    const labels = sortedCategories.map(cat => cat.label);
    const dataVals = sortedCategories.map(cat => isCatRev ? cat.revenue : cat.count);
    const total = dataVals.reduce((sum, v) => sum + v, 0);
    const backgroundColors = sortedCategories.map((_, idx) => colorsList[idx % colorsList.length]);

    itemsCategoryDonutChartInstance = new Chart(ctxCat, {
      type: 'doughnut',
      data: {
        labels: labels,
        datasets: [{
          data: dataVals,
          backgroundColor: backgroundColors,
          borderWidth: 1,
          borderColor: '#ffffff'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '65%',
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgba(15, 23, 42, 0.9)',
            callbacks: {
              label: function(context) {
                const label = context.label || '';
                const val = context.parsed;
                const pct = total > 0 ? ((val / total) * 100).toFixed(2) : 0;
                if (isCatRev) {
                  return ` ${label}: ${formatVND(val)} (${pct}%)`;
                } else {
                  return ` ${label}: ${val} sản phẩm (${pct}%)`;
                }
              }
            }
          }
        }
      }
    });
  }

  // 2. Best Selling Items Donut Chart
  const canvasBest = document.getElementById('items-bestsell-donut-chart');
  if (canvasBest) {
    const ctxBest = canvasBest.getContext('2d');
    if (itemsBestsellDonutChartInstance) {
      itemsBestsellDonutChartInstance.destroy();
    }
    
    const labels = topItems.map(item => item.name);
    const dataVals = topItems.map(item => isBestRev ? item.revenue : item.qty);
    const total = dataVals.reduce((sum, v) => sum + v, 0);
    const backgroundColors = topItems.map((_, idx) => colorsList[idx % colorsList.length]);

    itemsBestsellDonutChartInstance = new Chart(ctxBest, {
      type: 'doughnut',
      data: {
        labels: labels,
        datasets: [{
          data: dataVals,
          backgroundColor: backgroundColors,
          borderWidth: 1,
          borderColor: '#ffffff'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '65%',
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgba(15, 23, 42, 0.9)',
            callbacks: {
              label: function(context) {
                const label = context.label || '';
                const val = context.parsed;
                const pct = total > 0 ? ((val / total) * 100).toFixed(2) : 0;
                if (isBestRev) {
                  return ` ${label}: ${formatVND(val)} (${pct}%)`;
                } else {
                  return ` ${label}: ${val} sản phẩm (${pct}%)`;
                }
              }
            }
          }
        }
      }
    });
  }
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

// Render Menu Items Grid inside Menu Management Dashboard (Rendered as list/table)
function renderMenuMgmtGrid() {
  menuMgmtGridContainer.innerHTML = '';
  menuMgmtGridContainer.style.display = 'block'; // Use block layout for list
  
  if (menuItems.length === 0) {
    menuMgmtGridContainer.innerHTML = `
      <div class="text-center text-muted p-md full-width" style="padding: 40px;">
        Thực đơn rỗng. Hãy thêm món ăn mới nhé!
      </div>
    `;
    return;
  }

  // Filter based on active category and search query
  const searchInput = document.getElementById('menu-mgmt-search-input');
  const query = searchInput ? searchInput.value.trim().toLowerCase() : '';

  const filtered = menuItems.filter(item => {
    const matchesCategory = activeMenuMgmtCategory === 'all' || item.category === activeMenuMgmtCategory;
    const matchesSearch = !query || item.name.toLowerCase().includes(query);
    return matchesCategory && matchesSearch;
  });

  if (filtered.length === 0) {
    menuMgmtGridContainer.innerHTML = `
      <div class="text-center text-muted p-md full-width" style="padding: 40px;">
        Không tìm thấy món ăn nào khớp với từ khóa tìm kiếm.
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

  // Create table structure
  const tableContainer = document.createElement('div');
  tableContainer.style.cssText = 'width: 100%; overflow-x: auto; background: #ffffff; border: 1px solid var(--hairline); border-radius: var(--rounded-md); box-shadow: var(--shadow-sm);';

  const table = document.createElement('table');
  table.style.cssText = 'width: 100%; border-collapse: collapse; text-align: left; font-size: 14px;';
  
  table.innerHTML = `
    <thead>
      <tr style="background-color: var(--canvas); border-bottom: 1px solid var(--hairline); font-weight: 600;">
        <th style="padding: 14px 16px; color: var(--ink-soft); width: 60px; text-align: center;">STT</th>
        <th style="padding: 14px 16px; color: var(--ink-soft); width: 80px;">Hình ảnh</th>
        <th style="padding: 14px 16px; color: var(--ink-soft); width: 250px;">Tên món</th>
        <th style="padding: 14px 16px; color: var(--ink-soft); width: 140px; text-align: right;">Giá bán</th>
        <th style="padding: 14px 16px; color: var(--ink-soft);">Mô tả</th>
        <th style="padding: 14px 16px; color: var(--ink-soft); width: 100px; text-align: center;">Hành động</th>
      </tr>
    </thead>
    <tbody id="menu-mgmt-table-body"></tbody>
  `;

  tableContainer.appendChild(table);
  menuMgmtGridContainer.appendChild(tableContainer);

  const tbody = table.querySelector('#menu-mgmt-table-body');

  filtered.forEach((item, index) => {
    const tr = document.createElement('tr');
    tr.style.cssText = 'border-bottom: 1px solid var(--hairline-soft); transition: background-color 0.2s;';
    
    // Hover row styling
    tr.addEventListener('mouseenter', () => { tr.style.backgroundColor = 'var(--canvas)'; });
    tr.addEventListener('mouseleave', () => { tr.style.backgroundColor = 'transparent'; });

    let photoHtml = '';
    if (item.image_url) {
      photoHtml = `<img src="${item.image_url}" style="width: 44px; height: 44px; object-fit: cover; border-radius: var(--rounded-sm); border: 1px solid var(--hairline-soft);">`;
    } else {
      photoHtml = `<div style="width: 44px; height: 44px; display: flex; align-items: center; justify-content: center; font-size: 22px; background-color: var(--canvas); border-radius: var(--rounded-sm); border: 1px solid var(--hairline-soft);">${item.emoji || '🍽️'}</div>`;
    }

    tr.innerHTML = `
      <td style="padding: 12px 16px; vertical-align: middle; text-align: center; color: var(--ink-soft); font-weight: 500;">${index + 1}</td>
      <td style="padding: 12px 16px; vertical-align: middle;">${photoHtml}</td>
      <td style="padding: 12px 16px; vertical-align: middle; font-weight: 600; color: var(--ink);">${item.name}</td>
      <td style="padding: 12px 16px; vertical-align: middle; text-align: right; font-weight: 700; color: var(--primary);">${formatVND(item.price)}</td>
      <td style="padding: 12px 16px; vertical-align: middle; color: var(--muted); max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${item.description || '<span style="color: #cbd5e1; font-style: italic;">Chưa có mô tả</span>'}</td>
      <td style="padding: 12px 16px; vertical-align: middle; text-align: center;">
        <button class="btn btn-secondary btn-pill btn-edit-menu-item" style="height: 30px; padding: 0 12px; font-size: 12px; border-color: var(--ink-soft); font-weight: 500;">Sửa</button>
      </td>
    `;

    tr.querySelector('.btn-edit-menu-item').addEventListener('click', () => openMenuItemModal(item));
    tbody.appendChild(tr);
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
    menuItemEmojiPreview.style.display = 'none';
    menuItemImagePreview.style.display = 'block';
    if (item.image_url) {
      menuItemImagePreview.src = item.image_url;
      if (item.image_url.startsWith('http')) {
        menuItemImageUrlInput.value = item.image_url;
      } else {
        menuItemImageUrlInput.value = '';
      }
    } else {
      menuItemImagePreview.src = 'images/logo.png';
      menuItemImageUrlInput.value = '';
    }
  } else {
    menuItemModalTitle.textContent = 'Thêm món ăn mới';
    btnDeleteMenuItem.style.display = 'none';
    menuItemIdInput.value = '';
    menuItemForm.reset();
    menuItemCategoryInput.value = 'main';
    menuItemEmojiInput.value = '🍽️';
    menuItemImageUrlInput.value = '';

    // Reset visual preview for create mode
    menuItemEmojiPreview.style.display = 'none';
    menuItemImagePreview.src = 'images/logo.png';
    menuItemImagePreview.style.display = 'block';
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
  const imageUrlLink = menuItemImageUrlInput.value.trim();
  
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
  
  const isImageEmpty = menuItemImagePreview.src.includes('images/logo.png');
  if (imageFile) {
    formData.append('image', imageFile);
  } else if (imageUrlLink) {
    formData.append('imageUrlLink', imageUrlLink);
  } else if (isImageEmpty) {
    formData.append('removeImage', 'true');
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
      
      // Refresh local menu list immediately to render new images/details
      const menuRes = await fetch('/api/menu');
      if (menuRes.ok) {
        menuItems = await menuRes.json();
        renderMenuMgmtGrid();
      }
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

if (btnDownloadExcelTemplate) {
  btnDownloadExcelTemplate.addEventListener('click', downloadExcelTemplate);
}
if (btnImportExcel && excelImportFileInput) {
  btnImportExcel.addEventListener('click', () => excelImportFileInput.click());
  excelImportFileInput.addEventListener('change', handleExcelImport);
}

if (btnDeleteAllMenu) {
  btnDeleteAllMenu.addEventListener('click', async () => {
    if (confirm('⚠️ CẢNH BÁO: Hành động này sẽ xóa vĩnh viễn TẤT CẢ các món ăn trong thực đơn và toàn bộ các order hiện tại của các bàn. Bạn có chắc chắn muốn tiếp tục không?')) {
      const secondConfirm = confirm('Xác nhận lần cuối: Bạn thực sự muốn xóa toàn bộ thực đơn?');
      if (!secondConfirm) return;
      
      try {
        const res = await fetch('/api/menu-all', {
          method: 'DELETE'
        });
        
        if (res.status === 401) {
          window.location.href = '/login.html';
          return;
        }
        
        const result = await res.json();
        if (res.ok && result.success) {
          showToast('✅ Đã xóa toàn bộ thực đơn thành công!');
          menuItems = [];
          renderMenuMgmtGrid();
        } else {
          showToast(`❌ Lỗi: ${result.error || 'Không thể xóa thực đơn'}`);
        }
      } catch (err) {
        console.error(err);
        showToast('❌ Không thể kết nối tới server.');
      }
    }
  });
}

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
      menuItemImageUrlInput.value = ''; // Clear URL link input if file is uploaded
    }
  });
}

// Image URL Change Live Preview
if (menuItemImageUrlInput) {
  menuItemImageUrlInput.addEventListener('input', (e) => {
    const url = e.target.value.trim();
    if (url) {
      menuItemImagePreview.src = url;
      menuItemImagePreview.style.display = 'block';
      menuItemEmojiPreview.style.display = 'none';
      menuItemImageInput.value = ''; // Clear file selection if link is typed
    } else {
      menuItemImagePreview.src = 'images/logo.png';
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
    headerLogoEmoji.style.display = 'none';
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

function initSidebarCollapse() {
  const sidebar = document.getElementById('sidebar');
  const btnCollapse = document.getElementById('btn-sidebar-collapse');
  const sidebarLogoImg = document.getElementById('sidebar-logo-img');
  const sidebarLogoEmoji = document.getElementById('sidebar-logo-emoji');

  if (!sidebar || !btnCollapse) return;

  // 1. Handle logo loading fallback to emoji if fails
  if (sidebarLogoImg && sidebarLogoEmoji) {
    sidebarLogoImg.onerror = function() {
      sidebarLogoImg.style.display = 'none';
      sidebarLogoEmoji.style.display = 'inline-block';
    };
  }

  // 2. Load and apply collapsed state
  const isCollapsed = localStorage.getItem('sidebarCollapsed') === 'true';
  if (isCollapsed) {
    sidebar.classList.add('collapsed');
  }

  // 3. Toggle collapse logic
  btnCollapse.addEventListener('click', (e) => {
    e.stopPropagation();
    sidebar.classList.toggle('collapsed');
    const currentlyCollapsed = sidebar.classList.contains('collapsed');
    localStorage.setItem('sidebarCollapsed', currentlyCollapsed ? 'true' : 'false');
  });
}

// Close custom dropdown menus when clicking outside
document.addEventListener('click', closeAllCustomSelects);

window.switchManagerFloor = function(floor) {
  activeFloorFilter = floor;
  
  // Enable animation for floor transition
  playEntranceAnimation = true;
  
  // Update active state in UI tabs
  const tabs = document.querySelectorAll('#manager-floor-tabs .category-tab');
  tabs.forEach(tab => {
    if (tab.getAttribute('data-floor') === floor) {
      tab.classList.add('active');
    } else {
      tab.classList.remove('active');
    }
  });
  
  // Re-render tables with the selected floor
  renderTables();
};

// Add Table Location segment selector helper
window.selectLocationSegment = (el) => {
  const parent = el.parentElement;
  parent.querySelectorAll('.location-segment').forEach(seg => {
    seg.classList.remove('active');
  });
  el.classList.add('active');
  const val = el.getAttribute('data-value');
  const input = document.getElementById('add-table-location-select');
  if (input) {
    input.value = val;
  }
};

// Add Table Modal handlers
window.openAddTableModalInline = () => {
  const modal = document.getElementById('add-table-modal');
  const input = document.getElementById('add-table-name-input');
  const errorMsg = document.getElementById('add-table-error-msg');
  if (input) input.value = '';
  if (errorMsg) {
    errorMsg.style.display = 'none';
    errorMsg.textContent = '';
  }
  
  // Reset location input & segmented control active state
  const locationInput = document.getElementById('add-table-location-select');
  if (locationInput) locationInput.value = 'trệt';
  
  const segments = document.querySelectorAll('#add-table-modal .location-segment');
  segments.forEach(seg => {
    if (seg.getAttribute('data-value') === 'trệt') {
      seg.classList.add('active');
    } else {
      seg.classList.remove('active');
    }
  });

  if (modal) {
    modal.style.display = 'flex';
  }
  if (input) input.focus();
};

window.closeAddTableModalInline = () => {
  const modal = document.getElementById('add-table-modal');
  if (modal) modal.style.display = 'none';
};

const closeAddTableModal = window.closeAddTableModalInline;

const closeBtn = document.getElementById('btn-close-add-table-modal');
const cancelBtn = document.getElementById('btn-cancel-add-table-modal');
if (closeBtn) closeBtn.addEventListener('click', closeAddTableModal);
if (cancelBtn) cancelBtn.addEventListener('click', closeAddTableModal);

const form = document.getElementById('add-table-form');
if (form) {
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const errorMsg = document.getElementById('add-table-error-msg');
    if (errorMsg) errorMsg.style.display = 'none';
    
    const input = document.getElementById('add-table-name-input');
    const name = input ? input.value.trim() : '';
    if (!name) {
      if (errorMsg) {
        errorMsg.textContent = 'Tên số bàn không được để trống.';
        errorMsg.style.display = 'block';
      }
      return;
    }
    
    // Client-side duplicate check
    const isDuplicate = tables.some(t => t.name.toLowerCase() === name.toLowerCase());
    if (isDuplicate) {
      if (errorMsg) {
        errorMsg.textContent = 'Số bàn này đã tồn tại. Vui lòng nhập số bàn khác.';
        errorMsg.style.display = 'block';
      }
      return;
    }
    
    const locationSelect = document.getElementById('add-table-location-select');
    const location = locationSelect ? locationSelect.value : 'trệt';
    
    try {
      const response = await fetch('/api/tables', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, location })
      });
      
      const result = await response.json();
      if (result.success) {
        showToast(`✅ Đã thêm bàn "${name}" thành công!`);
        closeAddTableModal();
        
        // Refresh local tables list immediately
        const tablesRes = await fetch('/api/tables');
        if (tablesRes.ok) {
          tables = await tablesRes.json();
          renderTables();
        }
      } else {
        if (errorMsg) {
          errorMsg.textContent = result.error || 'Không thể thêm bàn.';
          errorMsg.style.display = 'block';
        }
      }
    } catch (err) {
      console.error(err);
      if (errorMsg) {
        errorMsg.textContent = 'Không thể kết nối tới server.';
        errorMsg.style.display = 'block';
      }
    }
  });
}

// App Initialization
async function loadMenuGroups() {
  try {
    const res = await fetch('/api/menu-groups');
    if (res.ok) {
      menuGroups = await res.json();
      renderMenuGroups();
    }
  } catch (error) {
    console.error('Lỗi lấy nhóm thực đơn:', error);
  }
}

function renderMenuGroups() {
  const container = document.getElementById('menu-groups-container');
  if (!container) return;
  container.innerHTML = '';
  
  if (menuGroups.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; background: #ffffff; border: 1.5px dashed var(--hairline-strong); border-radius: var(--rounded-md); padding: 40px; color: var(--muted); font-size: 14px;">
        Chưa có thực đơn nào được tạo. Click "Tạo thực đơn mới" để bắt đầu!
      </div>
    `;
    return;
  }
  
  menuGroups.forEach(group => {
    const card = document.createElement('div');
    card.className = 'overview-card-panel';
    card.style.cssText = 'padding: 24px; display: flex; flex-direction: column; justify-content: space-between; min-height: 280px; background: #ffffff; border-radius: 12px; border: 1.5px solid var(--border-soft); box-shadow: 0 4px 12px rgba(0,0,0,0.02); transition: all 0.2s ease-in-out; cursor: default;';
    
    // Smooth premium hover scaling and border highlights
    card.addEventListener('mouseenter', () => {
      card.style.transform = 'translateY(-4px)';
      card.style.boxShadow = '0 10px 25px rgba(0,0,0,0.06)';
      card.style.borderColor = 'var(--primary-disabled)';
    });
    card.addEventListener('mouseleave', () => {
      card.style.transform = 'none';
      card.style.boxShadow = '0 4px 12px rgba(0,0,0,0.02)';
      card.style.borderColor = 'var(--border-soft)';
    });

    let itemsListHtml = '';
    if (group.items && group.items.length > 0) {
      itemsListHtml = group.items.map(item => `
        <div style="display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 8px 12px; background-color: var(--canvas-soft); border: 1px solid var(--hairline); border-radius: var(--rounded-sm); transition: background-color 0.15s;">
          <div style="display: flex; align-items: center; gap: 8px; flex: 1; min-width: 0;">
            <img src="${item.image_url || 'images/logo.png'}" style="width: 24px; height: 24px; object-fit: cover; border-radius: 4px; border: 1px solid var(--hairline); flex-shrink: 0;" onerror="this.src='images/logo.png'">
            <span style="font-size: 13px; font-weight: 600; color: var(--ink); word-break: break-word; white-space: normal; line-height: 1.3;">${item.name}</span>
          </div>
          <span style="font-size: 12px; font-weight: 700; color: var(--primary); flex-shrink: 0; background-color: rgba(2, 74, 216, 0.05); padding: 2px 6px; border-radius: 4px;">${formatVND(item.price)}</span>
        </div>
      `).join('');
    } else {
      itemsListHtml = `<div style="font-size: 12px; color: var(--muted); font-style: italic; text-align: center; padding: 20px 0;">Chưa có món ăn nào trong thực đơn này.</div>`;
    }
    
    card.innerHTML = `
      <div>
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; border-bottom: 1.5px dashed var(--hairline-soft); padding-bottom: 12px;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 20px; line-height: 1;">📂</span>
            <h3 style="font-size: 16px; font-weight: 700; color: var(--ink); margin: 0; letter-spacing: -0.3px;">${group.name}</h3>
          </div>
          <span style="font-size: 11px; font-weight: 700; color: var(--primary); background-color: rgba(2, 74, 216, 0.08); padding: 4px 10px; border-radius: var(--rounded-full); text-transform: uppercase; letter-spacing: 0.5px;">${group.items ? group.items.length : 0} món</span>
        </div>
        
        <div style="display: flex; flex-direction: column; gap: 8px; max-height: 190px; overflow-y: auto; padding-right: 4px;">
          ${itemsListHtml}
        </div>
      </div>
      
      <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 16px; border-top: 1.5px solid var(--hairline-soft); padding-top: 12px; gap: 8px;">
        <button class="btn btn-secondary btn-pill" onclick="editMenuGroup(${group.id})" style="border-color: var(--border-strong); color: var(--ink-soft); height: 32px; font-size: 12px; padding: 0 12px; font-weight: 600; background: transparent; display: flex; align-items: center; gap: 4px; transition: all 0.2s;">
          <svg style="width: 13px; height: 13px;" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4z"></path></svg>
          Sửa thực đơn
        </button>
        <button class="btn btn-secondary btn-pill" onclick="deleteMenuGroup(${group.id})" style="border-color: #fca5a5; color: #ef4444; height: 32px; font-size: 12px; padding: 0 12px; font-weight: 600; background: transparent; display: flex; align-items: center; gap: 4px; transition: all 0.2s;">
          <svg style="width: 13px; height: 13px;" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
          Xóa thực đơn
        </button>
      </div>
    `;
    container.appendChild(card);
  });
}

function renderItemsChecklist() {
  const container = document.getElementById('menu-group-items-checklist');
  if (!container) return;
  container.innerHTML = '';
  
  const searchInput = document.getElementById('menu-group-search-input');
  const query = searchInput ? searchInput.value.trim().toLowerCase() : '';
  
  const filtered = menuItems.filter(item => {
    return !query || item.name.toLowerCase().includes(query);
  });
  
  if (filtered.length === 0) {
    container.innerHTML = `<div style="text-align: center; color: var(--muted); font-size: 13px; padding: 10px;">Không tìm thấy mặt hàng nào.</div>`;
    return;
  }
  
  filtered.forEach(item => {
    const label = document.createElement('label');
    
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.value = item.id;
    checkbox.name = 'group-items';
    checkbox.checked = selectedGroupItemIds.has(item.id);
    
    checkbox.addEventListener('change', () => {
      if (checkbox.checked) {
        selectedGroupItemIds.add(item.id);
      } else {
        selectedGroupItemIds.delete(item.id);
      }
      
      // Update select value text
      const selectValue = document.getElementById('menu-group-select-value');
      if (selectValue) {
        if (selectedGroupItemIds.size === 0) {
          selectValue.textContent = 'Chọn mặt hàng...';
          selectValue.style.color = 'var(--muted)';
        } else {
          const selectedNames = menuItems
            .filter(m => selectedGroupItemIds.has(m.id))
            .map(m => m.name);
          selectValue.textContent = selectedNames.join(', ');
          selectValue.style.color = 'var(--ink)';
        }
      }
    });
    
    const span = document.createElement('span');
    span.style.color = 'var(--ink)';
    span.textContent = `${item.emoji} ${item.name}`;
    
    label.appendChild(checkbox);
    label.appendChild(span);
    
    container.appendChild(label);
  });
}

async function deleteMenuGroup(id) {
  if (!confirm('Bạn có chắc chắn muốn xóa thực đơn này không?')) return;
  try {
    const res = await fetch(`/api/menu-groups/${id}`, { method: 'DELETE' });
    const result = await res.json();
    if (result.success) {
      showToast('✅ Đã xóa thực đơn thành công!');
      loadMenuGroups();
    } else {
      showToast(`❌ Lỗi: ${result.error || 'Không thể xóa thực đơn'}`);
    }
  } catch (error) {
    console.error('Lỗi xóa thực đơn:', error);
    showToast('❌ Không thể kết nối tới server.');
  }
}

function initMenuGroupControls() {
  const modal = document.getElementById('menu-group-modal');
  const openBtn = document.getElementById('btn-create-menu-group');
  const closeBtn = document.getElementById('btn-close-menu-group-modal');
  const cancelBtn = document.getElementById('btn-cancel-menu-group-modal');
  const form = document.getElementById('menu-group-form');
  const nameInput = document.getElementById('menu-group-name-input');
  const errorMsg = document.getElementById('menu-group-error-msg');
  
  const selectWrapper = document.getElementById('menu-group-select-wrapper');
  const selectTrigger = document.getElementById('menu-group-select-trigger');
  const selectValue = document.getElementById('menu-group-select-value');
  const selectMenu = document.getElementById('menu-group-select-menu');
  const searchInput = document.getElementById('menu-group-search-input');
  
  if (selectTrigger && selectWrapper) {
    selectTrigger.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = selectWrapper.classList.contains('open');
      closeAllCustomSelects();
      if (!isOpen) {
        selectWrapper.classList.add('open');
        if (searchInput) {
          searchInput.value = '';
          searchInput.focus();
          renderItemsChecklist();
        }
      }
    });
  }
  
  if (selectMenu) {
    selectMenu.addEventListener('click', (e) => {
      e.stopPropagation();
    });
  }
  
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      renderItemsChecklist();
    });
  }
  
  if (openBtn) {
    openBtn.addEventListener('click', () => {
      editingGroupId = null;
      const modalTitle = document.querySelector('#menu-group-modal .modal-title');
      if (modalTitle) modalTitle.textContent = 'Tạo thực đơn mới';
      
      if (nameInput) nameInput.value = '';
      if (errorMsg) {
        errorMsg.style.display = 'none';
        errorMsg.textContent = '';
      }
      
      // Reset search-select dropdown state
      selectedGroupItemIds.clear();
      if (searchInput) searchInput.value = '';
      if (selectValue) {
        selectValue.textContent = 'Chọn mặt hàng...';
        selectValue.style.color = 'var(--muted)';
      }
      if (selectWrapper) selectWrapper.classList.remove('open');
      
      renderItemsChecklist();
      if (modal) modal.style.display = 'flex';
      if (nameInput) nameInput.focus();
    });
  }
  
  const closeModal = () => {
    if (modal) modal.style.display = 'none';
    if (selectWrapper) selectWrapper.classList.remove('open');
  };
  
  if (closeBtn) closeBtn.addEventListener('click', closeModal);
  if (cancelBtn) cancelBtn.addEventListener('click', closeModal);
  
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (errorMsg) errorMsg.style.display = 'none';
      
      const name = nameInput ? nameInput.value.trim() : '';
      if (!name) {
        if (errorMsg) {
          errorMsg.textContent = 'Tên thực đơn không được để trống.';
          errorMsg.style.display = 'block';
        }
        return;
      }
      
      const itemIds = Array.from(selectedGroupItemIds);
      const isEdit = editingGroupId !== null;
      const url = isEdit ? `/api/menu-groups/${editingGroupId}` : '/api/menu-groups';
      const method = isEdit ? 'PUT' : 'POST';
      
      try {
        const response = await fetch(url, {
          method: method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, itemIds })
        });
        
        if (!response.ok) {
          let errorMessage = 'Lỗi lưu thực đơn.';
          try {
            const errResult = await response.json();
            errorMessage = errResult.error || errorMessage;
          } catch (e) {
            errorMessage = `Lỗi hệ thống (${response.status}). Bạn đã khởi động lại server.js chưa?`;
          }
          if (errorMsg) {
            errorMsg.textContent = errorMessage;
            errorMsg.style.display = 'block';
          }
          return;
        }
        
        const result = await response.json();
        if (result.success) {
          showToast(isEdit ? `✅ Đã cập nhật thực đơn "${name}" thành công!` : `✅ Đã tạo thực đơn "${name}" thành công!`);
          closeModal();
          loadMenuGroups();
        } else {
          if (errorMsg) {
            errorMsg.textContent = result.error || 'Không thể lưu thực đơn.';
            errorMsg.style.display = 'block';
          }
        }
      } catch (err) {
        console.error(err);
        if (errorMsg) {
          errorMsg.textContent = 'Không thể kết nối tới server.';
          errorMsg.style.display = 'block';
        }
      }
    });
  }
}

function editMenuGroup(id) {
  const group = menuGroups.find(g => g.id === id);
  if (!group) return;
  
  editingGroupId = id;
  
  const modalTitle = document.querySelector('#menu-group-modal .modal-title');
  if (modalTitle) modalTitle.textContent = 'Chỉnh sửa thực đơn';
  
  const nameInput = document.getElementById('menu-group-name-input');
  if (nameInput) nameInput.value = group.name;
  
  const errorMsg = document.getElementById('menu-group-error-msg');
  if (errorMsg) {
    errorMsg.style.display = 'none';
    errorMsg.textContent = '';
  }
  
  selectedGroupItemIds.clear();
  if (group.items) {
    group.items.forEach(item => {
      selectedGroupItemIds.add(item.id);
    });
  }
  
  const selectValue = document.getElementById('menu-group-select-value');
  if (selectValue) {
    if (selectedGroupItemIds.size === 0) {
      selectValue.textContent = 'Chọn mặt hàng...';
      selectValue.style.color = 'var(--muted)';
    } else {
      const selectedNames = menuItems
        .filter(m => selectedGroupItemIds.has(m.id))
        .map(m => m.name);
      selectValue.textContent = selectedNames.join(', ');
      selectValue.style.color = 'var(--ink)';
    }
  }
  
  const searchInput = document.getElementById('menu-group-search-input');
  if (searchInput) searchInput.value = '';
  
  const selectWrapper = document.getElementById('menu-group-select-wrapper');
  if (selectWrapper) selectWrapper.classList.remove('open');
  
  renderItemsChecklist();
  
  const modal = document.getElementById('menu-group-modal');
  if (modal) modal.style.display = 'flex';
  if (nameInput) nameInput.focus();
}

// Download template Excel file
function downloadExcelTemplate() {
  // Column names in Vietnamese: tên mặt hàng, giá bán, thực đơn, mô tả, hình ảnh (link)
  const data = [
    { "Tên mặt hàng": "Cơm tấm đặc biệt", "Giá bán": 85000, "Thực đơn": "SƯỜN", "Mô tả": "Sườn, bì, chả và trứng ốp la lòng đào", "Hình ảnh (link)": "https://images.unsplash.com/photo-1541832676-9b763b0239ab?q=80&w=300" },
    { "Tên mặt hàng": "Trà đá sả chanh", "Giá bán": 15000, "Thực đơn": "CANH VÀ TOPPING", "Mô tả": "Nước uống mát lạnh sảng khoái", "Hình ảnh (link)": "https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?q=80&w=300" },
    { "Tên mặt hàng": "Món ăn theo thời giá", "Giá bán": "", "Thực đơn": "CƠM NHÀ TẤM XƯA", "Mô tả": "Tự nhập giá khi nhân viên order", "Hình ảnh (link)": "" }
  ];
  
  if (typeof XLSX === 'undefined') {
    alert("Đang tải thư viện xử lý Excel. Vui lòng thử lại sau giây lát.");
    return;
  }
  
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Danh sách mặt hàng");
  
  // Set column widths
  worksheet["!cols"] = [
    { wch: 30 }, // Tên mặt hàng
    { wch: 15 }, // Giá bán
    { wch: 20 }, // Thực đơn
    { wch: 40 }, // Mô tả
    { wch: 40 }  // Hình ảnh (link)
  ];
  
  XLSX.writeFile(workbook, "Mau_nhap_thuc_don.xlsx");
}

// Import from Excel file
function handleExcelImport(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  if (typeof XLSX === 'undefined') {
    alert("Thư viện xử lý Excel chưa được tải xong. Vui lòng đợi trong giây lát.");
    event.target.value = '';
    return;
  }

  // Tự động inject HTML của Modal thanh tiến trình nếu chưa có
  if (!document.getElementById('import-progress-modal')) {
    const progressModalHtml = `
      <div class="modal-backdrop" id="import-progress-modal" style="display: none; z-index: 2000; align-items: center; justify-content: center; position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.5);">
        <div class="modal-content" style="max-width: 400px; width: 90%; border-radius: 16px; padding: 28px 24px; text-align: center; background: #ffffff; box-shadow: 0 10px 25px rgba(0,0,0,0.15); box-sizing: border-box; display: block; margin: auto;">
          <span style="font-size: 40px; display: block; margin-bottom: 16px;">📥</span>
          <h3 style="margin: 0 0 8px 0; font-weight: 700; font-size: 18px; color: #1e293b;">Đang nhập thực đơn từ Excel</h3>
          <p id="import-progress-text" style="color: #64748b; font-size: 14px; margin: 0 0 20px 0;">Đang chuẩn bị...</p>
          <div style="width: 100%; height: 8px; background-color: #f1f5f9; border-radius: 4px; overflow: hidden; margin-bottom: 12px;">
            <div id="import-progress-bar" style="width: 0%; height: 100%; background-color: var(--primary); transition: width 0.2s ease-out; border-radius: 4px;"></div>
          </div>
          <p id="import-progress-item-name" style="font-size: 13px; font-style: italic; color: #94a3b8; margin: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-height: 18px;"></p>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', progressModalHtml);
  }
  
  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      
      // Parse and merge data from all sheets in the workbook
      const rawData = [];
      workbook.SheetNames.forEach(sheetName => {
        const worksheet = workbook.Sheets[sheetName];
        const sheetData = XLSX.utils.sheet_to_json(worksheet);
        if (Array.isArray(sheetData)) {
          rawData.push(...sheetData);
        }
      });
      
      if (rawData.length === 0) {
        alert("File Excel trống hoặc không đúng định dạng mẫu.");
        return;
      }
      
      // Parse and validate items
      const itemsToImport = [];
      for (let i = 0; i < rawData.length; i++) {
        const row = rawData[i];
        
        // Find matching columns (handling potential spacing/case variations)
        const nameKey = Object.keys(row).find(k => k.trim().toLowerCase() === "tên mặt hàng");
        const priceKey = Object.keys(row).find(k => k.trim().toLowerCase() === "giá bán");
        const categoryKey = Object.keys(row).find(k => {
          const keyLower = k.trim().toLowerCase();
          return keyLower === "thực đơn" || keyLower === "phân loại" || keyLower === "nhóm";
        });
        const descKey = Object.keys(row).find(k => k.trim().toLowerCase() === "mô tả");
        const imgKey = Object.keys(row).find(k => k.trim().toLowerCase().includes("hình ảnh") || k.trim().toLowerCase().includes("ảnh"));
        
        const name = nameKey ? String(row[nameKey]).trim() : "";
        const priceVal = priceKey ? row[priceKey] : null;
        const category = categoryKey ? String(row[categoryKey]).trim() : "main";
        const description = descKey ? String(row[descKey]).trim() : "";
        const imageUrlLink = imgKey ? String(row[imgKey]).trim() : "";
        
        if (!name) {
          alert(`Dòng số ${i + 2}: Tên mặt hàng không được để trống.`);
          return;
        }
        
        let price = 0;
        if (priceVal !== undefined && priceVal !== null && String(priceVal).trim() !== "") {
          const parsedPrice = parseInt(priceVal);
          if (isNaN(parsedPrice) || parsedPrice < 0) {
            alert(`Dòng số ${i + 2} ("${name}"): Giá bán không hợp lệ (phải là số lớn hơn hoặc bằng 0).`);
            return;
          }
          price = parsedPrice;
        }
        
        itemsToImport.push({
          name,
          price,
          description,
          category: category || "main",
          emoji: "🍽️", // Default emoji
          imageUrlLink: imageUrlLink || null
        });
      }
      
      if (confirm(`Bạn có đồng ý nhập ${itemsToImport.length} mặt hàng từ file Excel vào thực đơn không?`)) {
        // Lấy các phần tử giao diện hiển thị tiến trình
        const progressModal = document.getElementById('import-progress-modal');
        const progressText = document.getElementById('import-progress-text');
        const progressBar = document.getElementById('import-progress-bar');
        const progressItemName = document.getElementById('import-progress-item-name');

        if (progressModal) progressModal.style.display = 'flex';
        if (progressBar) progressBar.style.width = '0%';
        if (progressText) progressText.textContent = `Chuẩn bị nhập (0/${itemsToImport.length} món)...`;

        let successCount = 0;
        let errors = [];

        // Gửi tuần tự từng sản phẩm lên server để cập nhật thanh tiến trình mượt mà
        for (let idx = 0; idx < itemsToImport.length; idx++) {
          const item = itemsToImport[idx];
          if (progressItemName) progressItemName.textContent = `Đang tải lên: ${item.name}`;

          try {
            const res = await fetch('/api/menu-import', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({ items: [item] }) // Gửi mảng chứa 1 món ăn
            });

            if (res.status === 401) {
              window.location.href = '/login.html';
              return;
            }

            const result = await res.json();
            if (res.ok && result.success) {
              successCount++;
            } else {
              errors.push(`Dòng ${idx + 2} (${item.name}): ${result.error || 'Lỗi hệ thống.'}`);
            }
          } catch (err) {
            errors.push(`Dòng ${idx + 2} (${item.name}): Lỗi kết nối mạng.`);
          }

          // Cập nhật thanh tiến trình (%)
          const percent = Math.round(((idx + 1) / itemsToImport.length) * 100);
          if (progressBar) progressBar.style.width = `${percent}%`;
          if (progressText) progressText.textContent = `Đang xử lý: ${percent}% (${idx + 1}/${itemsToImport.length} món)`;
        }

        // Ẩn modal tiến trình khi hoàn thành
        if (progressModal) progressModal.style.display = 'none';

        if (successCount > 0) {
          showToast(`✅ Đã nhập thành công ${successCount}/${itemsToImport.length} mặt hàng!`);
          
          // Làm mới giao diện tức thì
          const menuRes = await fetch('/api/menu');
          if (menuRes.ok) {
            menuItems = await menuRes.json();
            renderMenuMgmtGrid();
          }
          if (typeof loadMenuGroups === 'function') {
            loadMenuGroups();
          }
        }

        // Hiển thị báo lỗi chi tiết nếu có dòng nào gặp lỗi
        if (errors.length > 0) {
          alert(`Một số món gặp lỗi khi nhập:\n\n${errors.slice(0, 10).join('\n')}${errors.length > 10 ? '\n... và ' + (errors.length - 10) + ' lỗi khác.' : ''}`);
        }
      }
    } catch (err) {
      console.error("Lỗi khi đọc file Excel:", err);
      alert("Đã xảy ra lỗi khi đọc file Excel. Vui lòng kiểm tra lại định dạng file.");
    } finally {
      // Clear file input so same file can be selected again
      event.target.value = '';
    }
  };
  reader.readAsArrayBuffer(file);
}

window.deleteMenuGroup = deleteMenuGroup;
window.editMenuGroup = editMenuGroup;

init();
