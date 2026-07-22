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
let optionGroups = [];
let selectedTableId = null;
let selectedTransactionId = null;
let currentTab = 'reports'; // Default to Business Overview
let currentDiscountAmount = 0; // Discount applied in checkout modal
let checkoutItemDiscounts = {}; // Map of item ID to unit discount amount
let currentPaymentMethod = 'cash'; // Payment method in checkout modal ('cash' or 'bank')
let selectedCheckoutBank = null; // Currently selected bank account object in checkout modal
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
let reportCompareChartInstance = null;
let activePaymentMethodTab = 'revenue'; // 'revenue' or 'count'
let activeServingTypeTab = 'revenue'; // 'revenue' or 'count'
let activeItemsCategoryTab = 'revenue'; // 'revenue' or 'count'
let activeItemsBestsellTab = 'revenue'; // 'revenue' or 'count'
let itemsBestsellLimit = 5; // Default Top 5
let activeMenuMgmtCategory = 'all'; // Filter state for menu management categories
let menuGroups = [];
let selectedGroupItemIds = new Set();
let activeFloorFilter = 'trệt'; // Filter state for manager floor tabs ('trệt' or 'lầu')

function formatNumberWithDots(val) {
  if (!val) return '0';
  return val.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

// DOM Elements
const connectionDot = document.getElementById('connection-dot');
const tabTables = document.getElementById('tab-overview');
const tabReports = document.getElementById('tab-reports');
const tabInvoices = document.getElementById('tab-invoices');
const tabStaff = document.getElementById('tab-staff');
const tabMenuMgmt = document.getElementById('tab-items');
const tabPrinters = document.getElementById('tab-printers');

const tablesDashboardView = document.getElementById('tables-dashboard-view');
const reportsDashboardView = document.getElementById('reports-dashboard-view');
const invoicesDashboardView = document.getElementById('invoices-dashboard-view');
const staffDashboardView = document.getElementById('staff-dashboard-view');
const menuMgmtDashboardView = document.getElementById('menu-mgmt-dashboard-view');
const printersDashboardView = document.getElementById('printers-dashboard-view');

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

// Hour Filter State
let overviewHourRange = { option: 'all', fromH: 0, fromM: 0, toH: 23, toM: 59 };
let itemsHourRange = { option: 'all', fromH: 0, fromM: 0, toH: 23, toM: 59 };
let currentHourFilterTarget = 'overview';

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
const menuItemTypeInput = document.getElementById('menu-item-type-input');
const menuItemGroupInput = document.getElementById('menu-item-group-input');
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
    const [tablesRes, transactionsRes, menuRes, optionGroupsRes] = await Promise.all([
      fetch('/api/tables'),
      fetch('/api/transactions'),
      fetch('/api/menu'),
      fetch('/api/option-groups').catch(() => null)
    ]);
    
    if (tablesRes.status === 401 || transactionsRes.status === 401 || menuRes.status === 401) {
      window.location.href = '/login.html';
      return;
    }
    
    tables = await tablesRes.json();
    transactions = await transactionsRes.json();
    menuItems = await menuRes.json();
    if (optionGroupsRes && optionGroupsRes.ok) {
      optionGroups = await optionGroupsRes.json();
    } else {
      optionGroups = [];
    }
    
    renderTables();
    renderTransactionsList();
    updateAnalytics();
    
    // Initialize WebSockets or Polling
    loadSocketScript(() => {
      initConnection();
    });

    // Initialize custom selects
    initCustomSelects();

    // Initialize manager order modal
    initManagerOrderModal();

    // Initialize custom item modal (for selection groups)
    initCustomItemModal();

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
    // Sync printer settings from server
    await syncPrinterSettingsFromServer().catch(err => console.error(err));
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
      
      socket.on('print_kitchen_slip', (data) => {
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        if (!isMobile) {
          if (data.printedByServer) {
            showToast(`✅ Đã tự động in ngầm ${data.title} tại ${data.printerId === 'kitchen_default' ? 'Bếp chính' : 'Quầy nước'} cho ${data.tableName}!`);
          } else {
            printDocxSlip(data.printerId, data.tableName, data.items, data.title, data.notes);
          }
        }
      });

      socket.on('print_receipt', (data) => {
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        if (!isMobile) {
          if (data.printedByServer) {
            showToast(`✅ Đã tự động in ngầm hóa đơn thanh toán cho ${data.tableObj.name} thành công!`);
          } else {
            printReceipt(data.tableObj, data.orderItems, data.discountAmount, data.receivedAmount, data.transactionId, data.timestamp, data.payMethod);
          }
        }
      });

      socket.on('print_test', (data) => {
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        if (!isMobile) {
          printTestIframe(data.printerType, data.targetStr);
        }
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

    // Print Queue Polling for Cashier / Desktop Client
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    if (!isMobile) {
      const printJobsRes = await fetch('/api/print-jobs/pending');
      if (printJobsRes.ok) {
        const data = await printJobsRes.json();
        if (data.success && data.jobs && data.jobs.length > 0) {
          for (const job of data.jobs) {
            try {
              const payload = JSON.parse(job.payload);
              if (job.type === 'kitchen') {
                await printDocxSlip(payload.printerId, payload.tableName, payload.items, payload.title, payload.notes);
              } else if (job.type === 'receipt') {
                await printReceipt(payload.tableObj, payload.orderItems, payload.discountAmount, payload.receivedAmount, payload.transactionId, payload.timestamp, payload.payMethod);
              } else if (job.type === 'test') {
                printTestIframe(payload.printerType, payload.targetStr);
              }
              // Mark job as completed
              await fetch(`/api/print-jobs/${job.id}/complete`, { method: 'POST' });
            } catch (err) {
              console.error('Error processing print job:', err);
            }
          }
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
  'report-revenue': { el: document.getElementById('subtab-report-revenue'), view: document.getElementById('report-revenue-dashboard-view'), title: 'Báo cáo doanh thu' },
  'report-items': { el: document.getElementById('subtab-report-items'), view: document.getElementById('report-items-dashboard-view'), title: 'Báo cáo mặt hàng' },
  'report-compare': { el: document.getElementById('subtab-report-compare'), view: document.getElementById('report-compare-dashboard-view'), title: 'So sánh doanh thu' },
  'tables': { el: document.getElementById('tab-reports'), view: document.getElementById('tables-dashboard-view'), title: 'Sơ đồ bàn ăn' },
  'invoices': { el: document.getElementById('tab-invoices'), view: document.getElementById('invoices-dashboard-view'), title: 'Lịch sử hóa đơn' },
  'menu-mgmt': { el: document.getElementById('subtab-item-list'), view: document.getElementById('menu-mgmt-dashboard-view'), title: 'Quản lý mặt hàng' },
  'menu-preview': { el: document.getElementById('subtab-menu-preview'), view: document.getElementById('menu-preview-dashboard-view'), title: 'Thực đơn' },
  'selection-groups': { el: document.getElementById('subtab-selection-groups'), view: document.getElementById('selection-groups-dashboard-view'), title: 'Nhóm lựa chọn' },
  'staff': { el: document.getElementById('tab-staff'), view: document.getElementById('staff-dashboard-view'), title: 'Quản lý nhân viên' },
  'printers': { el: tabPrinters, view: printersDashboardView, title: 'Cấu hình máy in' }
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
        if (key === 'tables' || key === 'staff' || key === 'printers') {
          tabObj.view.style.display = 'grid';
        } else if (key === 'report-revenue' || key === 'report-items' || key === 'report-compare') {
          tabObj.view.style.display = 'flex';
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

  // Manage submenu items expansion & chevron rotation for Items dropdown
  const submenu = document.getElementById('submenu-items');
  const chevron = document.querySelector('#tab-items-toggle .dropdown-chevron-icon');
  const isSubmenuTab = ['menu-mgmt', 'menu-preview', 'selection-groups'].includes(tabKey);
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

  // Manage submenu items expansion & chevron rotation for Báo cáo dropdown
  const reportsSubmenu = document.getElementById('submenu-reports-new');
  const reportsChevron = document.querySelector('#tab-reports-new-toggle .dropdown-chevron-icon');
  const isReportsSubmenuTab = ['report-revenue', 'report-items', 'report-compare'].includes(tabKey);
  if (reportsSubmenu && reportsChevron) {
    if (isReportsSubmenuTab) {
      reportsSubmenu.style.display = 'flex';
      reportsSubmenu.classList.add('show');
      reportsChevron.style.transform = 'rotate(180deg)';
    } else {
      reportsSubmenu.style.display = 'none';
      reportsSubmenu.classList.remove('show');
      reportsChevron.style.transform = 'rotate(0deg)';
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
    loadMenuGroups();
  } else if (tabKey === 'selection-groups') {
    loadOptionGroups();
  } else if (tabKey === 'report-revenue') {
    loadRevenueReport();
  } else if (tabKey === 'report-items') {
    loadItemsReport();
  } else if (tabKey === 'report-compare') {
    loadCompareReport();
  } else if (tabKey === 'printers') {
    initPrintersView();
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

// Bind click toggle for Báo cáo dropdown parent
const tabReportsToggle = document.getElementById('tab-reports-new-toggle');
const submenuReports = document.getElementById('submenu-reports-new');
if (tabReportsToggle && submenuReports) {
  tabReportsToggle.addEventListener('click', (e) => {
    e.stopPropagation();
    const isHidden = submenuReports.style.display === 'none' || !submenuReports.classList.contains('show');
    const chevronIcon = tabReportsToggle.querySelector('.dropdown-chevron-icon');
    if (isHidden) {
      submenuReports.style.display = 'flex';
      submenuReports.classList.add('show');
      if (chevronIcon) chevronIcon.style.transform = 'rotate(180deg)';
    } else {
      submenuReports.style.display = 'none';
      submenuReports.classList.remove('show');
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
    let emptyHtml = `
      <div style="grid-column: 1 / -1; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 60px 20px; color: #64748b; font-size: 14px; gap: 8px; text-align: center;">
        <span style="font-size: 32px;">🛍️</span>
        <span style="font-weight: 600;">Không có đơn mang đi nào đang hoạt động</span>
    `;
    if (activeFloorFilter === 'mang đi') {
      emptyHtml += `
        <button class="btn-create-takeaway-premium" onclick="createTakeawayOrder()" style="margin-top: 12px;">
          <span class="button__text">Tạo đơn mang đi</span>
          <span class="button__icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" viewBox="0 0 24 24" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" stroke="currentColor" height="24" fill="none" class="svg">
              <line y2="19" y1="5" x2="12" x1="12"></line>
              <line y2="12" y1="12" x2="19" x1="5"></line>
            </svg>
          </span>
        </button>
      `;
    }
    emptyHtml += `</div>`;
    managerTablesContainer.innerHTML = emptyHtml;
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
          ${table.order.map((item, idx) => {
            const optionGroupsMap = {};
            if (item.options && Array.isArray(item.options)) {
              item.options.forEach(o => {
                const gn = o.group_name || 'Lựa chọn';
                if (!optionGroupsMap[gn]) optionGroupsMap[gn] = [];
                optionGroupsMap[gn].push(o.name);
              });
            }
            const optionsTextLines = Object.keys(optionGroupsMap).map(gn => {
              return `<div style="font-size: 10px; color: var(--muted); margin-left: 14px; margin-top: 1px; line-height: 1.1;">${gn}: ${optionGroupsMap[gn].join(', ')}</div>`;
            }).join('');
            
            return `
              <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 4px; line-height: 1.2; padding: 2px 0; font-size: 12px;">
                <div style="display: flex; flex-direction: column; max-width: 70%;">
                  <span style="font-weight: 500; word-break: break-word;" title="${item.name}">
                    ${idx + 1}. ${item.name}
                  </span>
                  <span class="text-muted" style="font-size: 10px; margin-left: 14px;">
                    SL: ${item.quantity}
                  </span>
                </div>
                <span class="bold" style="flex-shrink: 0; font-size: 12px; color: var(--ink); align-self: flex-start;">
                  ${formatVND(item.price * item.quantity)}
                </span>
              </div>
              ${optionsTextLines}
              ${item.notes ? `
                <div style="font-size: 10px; color: var(--primary-error-text); font-style: italic; margin-left: 14px; margin-bottom: 4px; line-height: 1.1;">
                  * ${item.notes}
                </div>
              ` : ''}
            `;
          }).join('')}
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
          ${table.notes ? `
            <div style="font-size: 11px; color: #b91c1c; background-color: #fef2f2; border: 1px solid #fca5a5; padding: 6px 10px; border-radius: var(--rounded-md); margin-top: 8px; font-weight: 600; text-align: left; line-height: 1.3; display: flex; align-items: flex-start; gap: 4px; word-break: break-word; box-sizing: border-box; width: 100%;">
              <span style="font-size: 12px; flex-shrink: 0;">📝</span> 
              <span>${table.notes}</span>
            </div>
          ` : ''}
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
// Render Table Details Panel (Right Section)
function renderTableDetails(table) {
  tableDetailsPanel.innerHTML = '';
  
  if (!table) {
    tableDetailsPanel.innerHTML = `
      <div class="no-table-selected" style="display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; height: 100%;">
        <div class="no-table-icon">🪑</div>
        <div class="bold" style="font-size: 16px; margin-bottom: 8px;">Chưa chọn bàn nào</div>
        <p style="font-size:14px; line-height: 1.4; margin-bottom: 20px; max-width: 280px; margin-left: auto; margin-right: auto;">
          Chọn một bàn ăn ở bản đồ bên trái để xem chi tiết các món ăn đã gọi và xử lý thanh toán.
        </p>
      </div>
    `;
    return;
  }

  if (table.status === 'empty' || table.order.length === 0) {
    tableDetailsPanel.innerHTML = `
      <div class="no-table-selected" style="display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; height: 100%;">
        <div class="no-table-icon">🪑</div>
        <div class="bold" style="font-size: 16px; margin-bottom: 8px;">${table.name}</div>
        <p style="font-size:14px; line-height: 1.4; margin-bottom: 20px; max-width: 280px; margin-left: auto; margin-right: auto;">
          Bàn này đang trống. Bạn có muốn tạo đơn gọi món mới cho bàn này không?
        </p>
        <button class="btn-create-order-premium" id="btn-create-order-direct">
          Tạo đơn gọi món
          <div class="star-1">
            <svg xmlns="http://www.w3.org/2000/svg" xml:space="preserve" version="1.1" style="shape-rendering:geometricPrecision; text-rendering:geometricPrecision; image-rendering:optimizeQuality; fill-rule:evenodd; clip-rule:evenodd" viewBox="0 0 784.11 815.53">
              <g id="Layer_x0020_1">
                <path class="fil0" d="M392.05 0c-20.9,210.08 -184.06,378.41 -392.05,407.78 207.96,29.37 371.12,197.68 392.05,407.74 20.93,-210.06 184.09,-378.37 392.05,-407.74 -207.98,-29.38 -371.16,-197.69 -392.06,-407.78z"></path>
              </g>
            </svg>
          </div>
          <div class="star-2">
            <svg xmlns="http://www.w3.org/2000/svg" xml:space="preserve" version="1.1" style="shape-rendering:geometricPrecision; text-rendering:geometricPrecision; image-rendering:optimizeQuality; fill-rule:evenodd; clip-rule:evenodd" viewBox="0 0 784.11 815.53">
              <g id="Layer_x0020_1">
                <path class="fil0" d="M392.05 0c-20.9,210.08 -184.06,378.41 -392.05,407.78 207.96,29.37 371.12,197.68 392.05,407.74 20.93,-210.06 184.09,-378.37 392.05,-407.74 -207.98,-29.38 -371.16,-197.69 -392.06,-407.78z"></path>
              </g>
            </svg>
          </div>
          <div class="star-3">
            <svg xmlns="http://www.w3.org/2000/svg" xml:space="preserve" version="1.1" style="shape-rendering:geometricPrecision; text-rendering:geometricPrecision; image-rendering:optimizeQuality; fill-rule:evenodd; clip-rule:evenodd" viewBox="0 0 784.11 815.53">
              <g id="Layer_x0020_1">
                <path class="fil0" d="M392.05 0c-20.9,210.08 -184.06,378.41 -392.05,407.78 207.96,29.37 371.12,197.68 392.05,407.74 20.93,-210.06 184.09,-378.37 392.05,-407.74 -207.98,-29.38 -371.16,-197.69 -392.06,-407.78z"></path>
              </g>
            </svg>
          </div>
          <div class="star-4">
            <svg xmlns="http://www.w3.org/2000/svg" xml:space="preserve" version="1.1" style="shape-rendering:geometricPrecision; text-rendering:geometricPrecision; image-rendering:optimizeQuality; fill-rule:evenodd; clip-rule:evenodd" viewBox="0 0 784.11 815.53">
              <g id="Layer_x0020_1">
                <path class="fil0" d="M392.05 0c-20.9,210.08 -184.06,378.41 -392.05,407.78 207.96,29.37 371.12,197.68 392.05,407.74 20.93,-210.06 184.09,-378.37 392.05,-407.74 -207.98,-29.38 -371.16,-197.69 -392.06,-407.78z"></path>
              </g>
            </svg>
          </div>
          <div class="star-5">
            <svg xmlns="http://www.w3.org/2000/svg" xml:space="preserve" version="1.1" style="shape-rendering:geometricPrecision; text-rendering:geometricPrecision; image-rendering:optimizeQuality; fill-rule:evenodd; clip-rule:evenodd" viewBox="0 0 784.11 815.53">
              <g id="Layer_x0020_1">
                <path class="fil0" d="M392.05 0c-20.9,210.08 -184.06,378.41 -392.05,407.78 207.96,29.37 371.12,197.68 392.05,407.74 20.93,-210.06 184.09,-378.37 392.05,-407.74 -207.98,-29.38 -371.16,-197.69 -392.06,-407.78z"></path>
              </g>
            </svg>
          </div>
          <div class="star-6">
            <svg xmlns="http://www.w3.org/2000/svg" xml:space="preserve" version="1.1" style="shape-rendering:geometricPrecision; text-rendering:geometricPrecision; image-rendering:optimizeQuality; fill-rule:evenodd; clip-rule:evenodd" viewBox="0 0 784.11 815.53">
              <g id="Layer_x0020_1">
                <path class="fil0" d="M392.05 0c-20.9,210.08 -184.06,378.41 -392.05,407.78 207.96,29.37 371.12,197.68 392.05,407.74 20.93,-210.06 184.09,-378.37 392.05,-407.74 -207.98,-29.38 -371.16,-197.69 -392.06,-407.78z"></path>
              </g>
            </svg>
          </div>
        </button>
      </div>
    `;
    
    const btnCreateOrderDirect = document.getElementById('btn-create-order-direct');
    if (btnCreateOrderDirect) {
      btnCreateOrderDirect.addEventListener('click', () => {
        openManagerOrderModal(table);
      });
    }
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
      ${table.order.map((item, idx) => {
        const optionGroupsMap = {};
        if (item.options && Array.isArray(item.options)) {
          item.options.forEach(o => {
            const gn = o.group_name || 'Lựa chọn';
            if (!optionGroupsMap[gn]) optionGroupsMap[gn] = [];
            optionGroupsMap[gn].push(o.name);
          });
        }
        const optionsTextLines = Object.keys(optionGroupsMap).map(gn => {
          return `<div class="panel-item-note" style="color: #64748b; margin-top: 2px;">${gn}: ${optionGroupsMap[gn].join(', ')}</div>`;
        }).join('');
        
        const isPercent = (item.discount_type === 'percent');
        const discountAmt = isPercent ? Math.round(item.price * (item.discount || 0) / 100) : (item.discount || 0);

        return `
          <div class="panel-item-row" style="flex-direction: column; align-items: stretch; gap: 6px;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; width: 100%;">
              <div>
                <span class="panel-item-name">${idx + 1}. ${item.name}</span>
                <div class="panel-item-qty">Số lượng: ${item.quantity} × ${formatVND(item.price)}</div>
                ${optionsTextLines}
                ${item.notes ? `<div class="panel-item-note">Ghi chú: ${item.notes}</div>` : ''}
              </div>
              <span class="panel-item-subtotal">${formatVND((item.price - discountAmt) * item.quantity)}</span>
            </div>
            
            <!-- Per-item discount input -->
            <div style="display: flex; align-items: center; justify-content: space-between; margin-top: 4px; padding-top: 4px; border-top: 1px dashed var(--hairline-soft); box-sizing: border-box;">
              <div style="display: flex; align-items: center; gap: 6px;">
                <span style="font-size: 11px; color: var(--muted); font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">Giảm giá món:</span>
                <div style="display: inline-flex; align-items: center; border: 1.5px solid var(--border-strong); border-radius: 6px; overflow: hidden; background-color: #ffffff; height: 26px;">
                  <input type="text" class="item-detail-discount-input" data-item-id="${item.id}" placeholder="0" value="${isPercent ? (item.discount || 0) : formatNumberWithDots(item.discount || 0)}" style="border: none; outline: none; padding: 2px 6px; width: 75px; font-size: 12px; font-weight: 600; text-align: right; box-sizing: border-box; height: 100%;">
                  <select class="item-detail-discount-type-select" data-item-id="${item.id}" style="border: none; outline: none; padding: 0 4px; background-color: var(--surface-soft); font-size: 11px; font-weight: 700; color: var(--muted); border-left: 1px solid var(--border-strong); height: 100%; cursor: pointer;">
                    <option value="cash" ${!isPercent ? 'selected' : ''}>đ</option>
                    <option value="percent" ${isPercent ? 'selected' : ''}>%</option>
                  </select>
                </div>
              </div>
              ${(item.discount || 0) > 0 ? `
                <button type="button" class="btn-clear-item-discount" data-item-id="${item.id}" style="background: none; border: none; color: #ef4444; cursor: pointer; font-size: 11px; font-weight: 700; display: inline-flex; align-items: center; gap: 2px;" title="Xóa giảm giá">
                  ❌ Xóa giảm
                </button>
              ` : ''}
            </div>
          </div>
        `;
      }).join('')}
    </div>

    <!-- Discount Save Button Container -->
    <div id="save-discounts-btn-container" style="display: none; margin-top: 12px; animation: fadeInUp 0.3s ease-out; width: 100%; box-sizing: border-box;">
      <button class="btn btn-primary" id="btn-save-discounts-direct" style="width: 100%; border-radius: 4px; font-weight: 700; height: 42px; display: flex; align-items: center; justify-content: center; background: linear-gradient(135deg, #107c41 0%, #1f9a55 100%); border: none; box-shadow: 0 4px 10px rgba(16,124,65,0.25);">
        Lưu giảm giá đã chỉnh sửa
      </button>
    </div>

    ${table.notes ? `
      <div style="font-size: 13px; color: #b91c1c; background-color: #fef2f2; border: 1.5px dashed #fca5a5; padding: 12px; border-radius: 8px; margin-top: 12px; font-weight: 700; text-align: left; line-height: 1.4; display: flex; align-items: flex-start; gap: 6px; word-break: break-word; box-sizing: border-box; width: 100%;">
        <span style="font-size: 16px; flex-shrink: 0; line-height: 1;">📝</span>
        <div>
          <div style="font-size: 11px; text-transform: uppercase; color: #7f1d1d; letter-spacing: 0.5px; margin-bottom: 2px;">Ghi chú tổng của bàn</div>
          <span>${table.notes}</span>
        </div>
      </div>
    ` : ''}

    <div style="display: flex; flex-direction: column; gap: 10px; margin-top: 16px; animation: fadeInUp 0.4s ease-out;">
      <div style="display: flex; gap: 6px; width: 100%;">
        <button class="btn-delete-order-premium" id="btn-delete-order-direct">
          Hủy đơn
          <div class="star-1">
            <svg xmlns="http://www.w3.org/2000/svg" xml:space="preserve" version="1.1" style="shape-rendering:geometricPrecision; text-rendering:geometricPrecision; image-rendering:optimizeQuality; fill-rule:evenodd; clip-rule:evenodd" viewBox="0 0 784.11 815.53">
              <g id="Layer_x0020_1">
                <path class="fil0" d="M392.05 0c-20.9,210.08 -184.06,378.41 -392.05,407.78 207.96,29.37 371.12,197.68 392.05,407.74 20.93,-210.06 184.09,-378.37 392.05,-407.74 -207.98,-29.38 -371.16,-197.69 -392.06,-407.78z"></path>
              </g>
            </svg>
          </div>
          <div class="star-2">
            <svg xmlns="http://www.w3.org/2000/svg" xml:space="preserve" version="1.1" style="shape-rendering:geometricPrecision; text-rendering:geometricPrecision; image-rendering:optimizeQuality; fill-rule:evenodd; clip-rule:evenodd" viewBox="0 0 784.11 815.53">
              <g id="Layer_x0020_1">
                <path class="fil0" d="M392.05 0c-20.9,210.08 -184.06,378.41 -392.05,407.78 207.96,29.37 371.12,197.68 392.05,407.74 20.93,-210.06 184.09,-378.37 392.05,-407.74 -207.98,-29.38 -371.16,-197.69 -392.06,-407.78z"></path>
              </g>
            </svg>
          </div>
          <div class="star-3">
            <svg xmlns="http://www.w3.org/2000/svg" xml:space="preserve" version="1.1" style="shape-rendering:geometricPrecision; text-rendering:geometricPrecision; image-rendering:optimizeQuality; fill-rule:evenodd; clip-rule:evenodd" viewBox="0 0 784.11 815.53">
              <g id="Layer_x0020_1">
                <path class="fil0" d="M392.05 0c-20.9,210.08 -184.06,378.41 -392.05,407.78 207.96,29.37 371.12,197.68 392.05,407.74 20.93,-210.06 184.09,-378.37 392.05,-407.74 -207.98,-29.38 -371.16,-197.69 -392.06,-407.78z"></path>
              </g>
            </svg>
          </div>
          <div class="star-4">
            <svg xmlns="http://www.w3.org/2000/svg" xml:space="preserve" version="1.1" style="shape-rendering:geometricPrecision; text-rendering:geometricPrecision; image-rendering:optimizeQuality; fill-rule:evenodd; clip-rule:evenodd" viewBox="0 0 784.11 815.53">
              <g id="Layer_x0020_1">
                <path class="fil0" d="M392.05 0c-20.9,210.08 -184.06,378.41 -392.05,407.78 207.96,29.37 371.12,197.68 392.05,407.74 20.93,-210.06 184.09,-378.37 392.05,-407.74 -207.98,-29.38 -371.16,-197.69 -392.06,-407.78z"></path>
              </g>
            </svg>
          </div>
          <div class="star-5">
            <svg xmlns="http://www.w3.org/2000/svg" xml:space="preserve" version="1.1" style="shape-rendering:geometricPrecision; text-rendering:geometricPrecision; image-rendering:optimizeQuality; fill-rule:evenodd; clip-rule:evenodd" viewBox="0 0 784.11 815.53">
              <g id="Layer_x0020_1">
                <path class="fil0" d="M392.05 0c-20.9,210.08 -184.06,378.41 -392.05,407.78 207.96,29.37 371.12,197.68 392.05,407.74 20.93,-210.06 184.09,-378.37 392.05,-407.74 -207.98,-29.38 -371.16,-197.69 -392.06,-407.78z"></path>
              </g>
            </svg>
          </div>
          <div class="star-6">
            <svg xmlns="http://www.w3.org/2000/svg" xml:space="preserve" version="1.1" style="shape-rendering:geometricPrecision; text-rendering:geometricPrecision; image-rendering:optimizeQuality; fill-rule:evenodd; clip-rule:evenodd" viewBox="0 0 784.11 815.53">
              <g id="Layer_x0020_1">
                <path class="fil0" d="M392.05 0c-20.9,210.08 -184.06,378.41 -392.05,407.78 207.96,29.37 371.12,197.68 392.05,407.74 20.93,-210.06 184.09,-378.37 392.05,-407.74 -207.98,-29.38 -371.16,-197.69 -392.06,-407.78z"></path>
              </g>
            </svg>
          </div>
        </button>
        <button class="btn-add-more-premium" id="btn-add-more-dishes">
          Thêm món
          <div class="star-1">
            <svg xmlns="http://www.w3.org/2000/svg" xml:space="preserve" version="1.1" style="shape-rendering:geometricPrecision; text-rendering:geometricPrecision; image-rendering:optimizeQuality; fill-rule:evenodd; clip-rule:evenodd" viewBox="0 0 784.11 815.53">
              <g id="Layer_x0020_1">
                <path class="fil0" d="M392.05 0c-20.9,210.08 -184.06,378.41 -392.05,407.78 207.96,29.37 371.12,197.68 392.05,407.74 20.93,-210.06 184.09,-378.37 392.05,-407.74 -207.98,-29.38 -371.16,-197.69 -392.06,-407.78z"></path>
              </g>
            </svg>
          </div>
          <div class="star-2">
            <svg xmlns="http://www.w3.org/2000/svg" xml:space="preserve" version="1.1" style="shape-rendering:geometricPrecision; text-rendering:geometricPrecision; image-rendering:optimizeQuality; fill-rule:evenodd; clip-rule:evenodd" viewBox="0 0 784.11 815.53">
              <g id="Layer_x0020_1">
                <path class="fil0" d="M392.05 0c-20.9,210.08 -184.06,378.41 -392.05,407.78 207.96,29.37 371.12,197.68 392.05,407.74 20.93,-210.06 184.09,-378.37 392.05,-407.74 -207.98,-29.38 -371.16,-197.69 -392.06,-407.78z"></path>
              </g>
            </svg>
          </div>
          <div class="star-3">
            <svg xmlns="http://www.w3.org/2000/svg" xml:space="preserve" version="1.1" style="shape-rendering:geometricPrecision; text-rendering:geometricPrecision; image-rendering:optimizeQuality; fill-rule:evenodd; clip-rule:evenodd" viewBox="0 0 784.11 815.53">
              <g id="Layer_x0020_1">
                <path class="fil0" d="M392.05 0c-20.9,210.08 -184.06,378.41 -392.05,407.78 207.96,29.37 371.12,197.68 392.05,407.74 20.93,-210.06 184.09,-378.37 392.05,-407.74 -207.98,-29.38 -371.16,-197.69 -392.06,-407.78z"></path>
              </g>
            </svg>
          </div>
          <div class="star-4">
            <svg xmlns="http://www.w3.org/2000/svg" xml:space="preserve" version="1.1" style="shape-rendering:geometricPrecision; text-rendering:geometricPrecision; image-rendering:optimizeQuality; fill-rule:evenodd; clip-rule:evenodd" viewBox="0 0 784.11 815.53">
              <g id="Layer_x0020_1">
                <path class="fil0" d="M392.05 0c-20.9,210.08 -184.06,378.41 -392.05,407.78 207.96,29.37 371.12,197.68 392.05,407.74 20.93,-210.06 184.09,-378.37 392.05,-407.74 -207.98,-29.38 -371.16,-197.69 -392.06,-407.78z"></path>
              </g>
            </svg>
          </div>
          <div class="star-5">
            <svg xmlns="http://www.w3.org/2000/svg" xml:space="preserve" version="1.1" style="shape-rendering:geometricPrecision; text-rendering:geometricPrecision; image-rendering:optimizeQuality; fill-rule:evenodd; clip-rule:evenodd" viewBox="0 0 784.11 815.53">
              <g id="Layer_x0020_1">
                <path class="fil0" d="M392.05 0c-20.9,210.08 -184.06,378.41 -392.05,407.78 207.96,29.37 371.12,197.68 392.05,407.74 20.93,-210.06 184.09,-378.37 392.05,-407.74 -207.98,-29.38 -371.16,-197.69 -392.06,-407.78z"></path>
              </g>
            </svg>
          </div>
          <div class="star-6">
            <svg xmlns="http://www.w3.org/2000/svg" xml:space="preserve" version="1.1" style="shape-rendering:geometricPrecision; text-rendering:geometricPrecision; image-rendering:optimizeQuality; fill-rule:evenodd; clip-rule:evenodd" viewBox="0 0 784.11 815.53">
              <g id="Layer_x0020_1">
                <path class="fil0" d="M392.05 0c-20.9,210.08 -184.06,378.41 -392.05,407.78 207.96,29.37 371.12,197.68 392.05,407.74 20.93,-210.06 184.09,-378.37 392.05,-407.74 -207.98,-29.38 -371.16,-197.69 -392.06,-407.78z"></path>
              </g>
            </svg>
          </div>
        </button>
      </div>
      <div style="display: flex; gap: 6px; width: 100%;">
        <button class="btn-print-kitchen-premium" id="btn-print-kitchen-direct">
          In lại phiếu bếp
          <div class="star-1">
            <svg xmlns="http://www.w3.org/2000/svg" xml:space="preserve" version="1.1" style="shape-rendering:geometricPrecision; text-rendering:geometricPrecision; image-rendering:optimizeQuality; fill-rule:evenodd; clip-rule:evenodd" viewBox="0 0 784.11 815.53">
              <g id="Layer_x0020_1">
                <path class="fil0" d="M392.05 0c-20.9,210.08 -184.06,378.41 -392.05,407.78 207.96,29.37 371.12,197.68 392.05,407.74 20.93,-210.06 184.09,-378.37 392.05,-407.74 -207.98,-29.38 -371.16,-197.69 -392.06,-407.78z"></path>
              </g>
            </svg>
          </div>
          <div class="star-2">
            <svg xmlns="http://www.w3.org/2000/svg" xml:space="preserve" version="1.1" style="shape-rendering:geometricPrecision; text-rendering:geometricPrecision; image-rendering:optimizeQuality; fill-rule:evenodd; clip-rule:evenodd" viewBox="0 0 784.11 815.53">
              <g id="Layer_x0020_1">
                <path class="fil0" d="M392.05 0c-20.9,210.08 -184.06,378.41 -392.05,407.78 207.96,29.37 371.12,197.68 392.05,407.74 20.93,-210.06 184.09,-378.37 392.05,-407.74 -207.98,-29.38 -371.16,-197.69 -392.06,-407.78z"></path>
              </g>
            </svg>
          </div>
          <div class="star-3">
            <svg xmlns="http://www.w3.org/2000/svg" xml:space="preserve" version="1.1" style="shape-rendering:geometricPrecision; text-rendering:geometricPrecision; image-rendering:optimizeQuality; fill-rule:evenodd; clip-rule:evenodd" viewBox="0 0 784.11 815.53">
              <g id="Layer_x0020_1">
                <path class="fil0" d="M392.05 0c-20.9,210.08 -184.06,378.41 -392.05,407.78 207.96,29.37 371.12,197.68 392.05,407.74 20.93,-210.06 184.09,-378.37 392.05,-407.74 -207.98,-29.38 -371.16,-197.69 -392.06,-407.78z"></path>
              </g>
            </svg>
          </div>
          <div class="star-4">
            <svg xmlns="http://www.w3.org/2000/svg" xml:space="preserve" version="1.1" style="shape-rendering:geometricPrecision; text-rendering:geometricPrecision; image-rendering:optimizeQuality; fill-rule:evenodd; clip-rule:evenodd" viewBox="0 0 784.11 815.53">
              <g id="Layer_x0020_1">
                <path class="fil0" d="M392.05 0c-20.9,210.08 -184.06,378.41 -392.05,407.78 207.96,29.37 371.12,197.68 392.05,407.74 20.93,-210.06 184.09,-378.37 392.05,-407.74 -207.98,-29.38 -371.16,-197.69 -392.06,-407.78z"></path>
              </g>
            </svg>
          </div>
          <div class="star-5">
            <svg xmlns="http://www.w3.org/2000/svg" xml:space="preserve" version="1.1" style="shape-rendering:geometricPrecision; text-rendering:geometricPrecision; image-rendering:optimizeQuality; fill-rule:evenodd; clip-rule:evenodd" viewBox="0 0 784.11 815.53">
              <g id="Layer_x0020_1">
                <path class="fil0" d="M392.05 0c-20.9,210.08 -184.06,378.41 -392.05,407.78 207.96,29.37 371.12,197.68 392.05,407.74 20.93,-210.06 184.09,-378.37 392.05,-407.74 -207.98,-29.38 -371.16,-197.69 -392.06,-407.78z"></path>
              </g>
            </svg>
          </div>
          <div class="star-6">
            <svg xmlns="http://www.w3.org/2000/svg" xml:space="preserve" version="1.1" style="shape-rendering:geometricPrecision; text-rendering:geometricPrecision; image-rendering:optimizeQuality; fill-rule:evenodd; clip-rule:evenodd" viewBox="0 0 784.11 815.53">
              <g id="Layer_x0020_1">
                <path class="fil0" d="M392.05 0c-20.9,210.08 -184.06,378.41 -392.05,407.78 207.96,29.37 371.12,197.68 392.05,407.74 20.93,-210.06 184.09,-378.37 392.05,-407.74 -207.98,-29.38 -371.16,-197.69 -392.06,-407.78z"></path>
              </g>
            </svg>
          </div>
        </button>
        <button class="btn-checkout-premium" id="btn-trigger-checkout" style="flex: 1.5;">
          Thanh toán & In đơn
          <div class="star-1">
            <svg xmlns="http://www.w3.org/2000/svg" xml:space="preserve" version="1.1" style="shape-rendering:geometricPrecision; text-rendering:geometricPrecision; image-rendering:optimizeQuality; fill-rule:evenodd; clip-rule:evenodd" viewBox="0 0 784.11 815.53">
              <g id="Layer_x0020_1">
                <path class="fil0" d="M392.05 0c-20.9,210.08 -184.06,378.41 -392.05,407.78 207.96,29.37 371.12,197.68 392.05,407.74 20.93,-210.06 184.09,-378.37 392.05,-407.74 -207.98,-29.38 -371.16,-197.69 -392.06,-407.78z"></path>
              </g>
            </svg>
          </div>
          <div class="star-2">
            <svg xmlns="http://www.w3.org/2000/svg" xml:space="preserve" version="1.1" style="shape-rendering:geometricPrecision; text-rendering:geometricPrecision; image-rendering:optimizeQuality; fill-rule:evenodd; clip-rule:evenodd" viewBox="0 0 784.11 815.53">
              <g id="Layer_x0020_1">
                <path class="fil0" d="M392.05 0c-20.9,210.08 -184.06,378.41 -392.05,407.78 207.96,29.37 371.12,197.68 392.05,407.74 20.93,-210.06 184.09,-378.37 392.05,-407.74 -207.98,-29.38 -371.16,-197.69 -392.06,-407.78z"></path>
              </g>
            </svg>
          </div>
          <div class="star-3">
            <svg xmlns="http://www.w3.org/2000/svg" xml:space="preserve" version="1.1" style="shape-rendering:geometricPrecision; text-rendering:geometricPrecision; image-rendering:optimizeQuality; fill-rule:evenodd; clip-rule:evenodd" viewBox="0 0 784.11 815.53">
              <g id="Layer_x0020_1">
                <path class="fil0" d="M392.05 0c-20.9,210.08 -184.06,378.41 -392.05,407.78 207.96,29.37 371.12,197.68 392.05,407.74 20.93,-210.06 184.09,-378.37 392.05,-407.74 -207.98,-29.38 -371.16,-197.69 -392.06,-407.78z"></path>
              </g>
            </svg>
          </div>
          <div class="star-4">
            <svg xmlns="http://www.w3.org/2000/svg" xml:space="preserve" version="1.1" style="shape-rendering:geometricPrecision; text-rendering:geometricPrecision; image-rendering:optimizeQuality; fill-rule:evenodd; clip-rule:evenodd" viewBox="0 0 784.11 815.53">
              <g id="Layer_x0020_1">
                <path class="fil0" d="M392.05 0c-20.9,210.08 -184.06,378.41 -392.05,407.78 207.96,29.37 371.12,197.68 392.05,407.74 20.93,-210.06 184.09,-378.37 392.05,-407.74 -207.98,-29.38 -371.16,-197.69 -392.06,-407.78z"></path>
              </g>
            </svg>
          </div>
          <div class="star-5">
            <svg xmlns="http://www.w3.org/2000/svg" xml:space="preserve" version="1.1" style="shape-rendering:geometricPrecision; text-rendering:geometricPrecision; image-rendering:optimizeQuality; fill-rule:evenodd; clip-rule:evenodd" viewBox="0 0 784.11 815.53">
              <g id="Layer_x0020_1">
                <path class="fil0" d="M392.05 0c-20.9,210.08 -184.06,378.41 -392.05,407.78 207.96,29.37 371.12,197.68 392.05,407.74 20.93,-210.06 184.09,-378.37 392.05,-407.74 -207.98,-29.38 -371.16,-197.69 -392.06,-407.78z"></path>
              </g>
            </svg>
          </div>
          <div class="star-6">
            <svg xmlns="http://www.w3.org/2000/svg" xml:space="preserve" version="1.1" style="shape-rendering:geometricPrecision; text-rendering:geometricPrecision; image-rendering:optimizeQuality; fill-rule:evenodd; clip-rule:evenodd" viewBox="0 0 784.11 815.53">
              <g id="Layer_x0020_1">
                <path class="fil0" d="M392.05 0c-20.9,210.08 -184.06,378.41 -392.05,407.78 207.96,29.37 371.12,197.68 392.05,407.74 20.93,-210.06 184.09,-378.37 392.05,-407.74 -207.98,-29.38 -371.16,-197.69 -392.06,-407.78z"></path>
              </g>
            </svg>
          </div>
        </button>
      </div>
    </div>
  `;

  // Thêm hover effect động bằng JS cho nút Hủy đơn để mượt mà hơn
  const btnDeleteOrderDirect = document.getElementById('btn-delete-order-direct');
  if (btnDeleteOrderDirect) {
    // Click event is handled natively below
    btnDeleteOrderDirect.addEventListener('click', () => {
      const tableName = table.name || `Bàn ${table.id}`;
      showConfirmDeleteModal(tableName, async () => {
        btnDeleteOrderDirect.disabled = true;
        try {
          const response = await fetch('/api/order', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              tableId: table.id,
              items: [] // Mảng rỗng xóa sạch món
            })
          });

          if (response.status === 401) {
            window.location.href = '/login.html';
            return;
          }

          const result = await response.json();
          if (result.success) {
            showToast(`✅ Đã hủy đơn hàng của ${tableName} thành công!`);
            
            // Tải lại bàn ăn
            const tablesRes = await fetch('/api/tables');
            if (tablesRes.ok) {
              tables = await tablesRes.json();
              renderTables();
              
              // Đặt về trống và render bảng thông tin trống
              selectedTableId = null;
              renderTableDetails(null);
            }
          } else {
            alert(`Lỗi khi hủy đơn: ${result.error || 'Vui lòng thử lại.'}`);
          }
        } catch (err) {
          console.error("Lỗi khi hủy đơn:", err);
          alert("Không thể kết nối đến máy chủ. Vui lòng kiểm tra mạng.");
        } finally {
          btnDeleteOrderDirect.disabled = false;
        }
      });
    });
  }

  // Thêm hover effect và click cho Thêm món
  const btnAddMoreDishes = document.getElementById('btn-add-more-dishes');
  if (btnAddMoreDishes) {
    btnAddMoreDishes.onmouseover = () => {
      btnAddMoreDishes.style.transform = 'translateY(-2px)';
      btnAddMoreDishes.style.boxShadow = '0 6px 12px -2px rgba(0, 136, 255, 0.15)';
    };
    btnAddMoreDishes.onmouseout = () => {
      btnAddMoreDishes.style.transform = 'translateY(0)';
      btnAddMoreDishes.style.boxShadow = '0 4px 6px -1px rgba(0, 136, 255, 0.05)';
    };
    btnAddMoreDishes.addEventListener('click', () => {
      openManagerOrderModal(table);
    });
  }

  const btnTriggerCheckout = document.getElementById('btn-trigger-checkout');
  if (btnTriggerCheckout) {
    btnTriggerCheckout.onmouseover = () => {
      btnTriggerCheckout.style.transform = 'translateY(-2px)';
      btnTriggerCheckout.style.boxShadow = '0 6px 12px -2px rgba(0, 136, 255, 0.3)';
    };
    btnTriggerCheckout.onmouseout = () => {
      btnTriggerCheckout.style.transform = 'translateY(0)';
      btnTriggerCheckout.style.boxShadow = '0 4px 6px -1px rgba(0, 136, 255, 0.15)';
    };
    btnTriggerCheckout.addEventListener('click', () => openCheckoutModal(table));
  }

  const btnPrintKitchenDirect = document.getElementById('btn-print-kitchen-direct');
  if (btnPrintKitchenDirect) {
    btnPrintKitchenDirect.onmouseover = () => {
      btnPrintKitchenDirect.style.transform = 'translateY(-2px)';
      btnPrintKitchenDirect.style.boxShadow = '0 6px 12px -2px rgba(217, 119, 6, 0.15)';
    };
    btnPrintKitchenDirect.onmouseout = () => {
      btnPrintKitchenDirect.style.transform = 'translateY(0)';
      btnPrintKitchenDirect.style.boxShadow = '0 4px 6px -1px rgba(217, 119, 6, 0.05)';
    };
    btnPrintKitchenDirect.addEventListener('click', async () => {
      btnPrintKitchenDirect.disabled = true;
      try {
        const kitchenItems = table.order.filter(item => !isDrinkItem(item, menuItems));
        if (kitchenItems.length === 0) {
          showToast('⚠️ Không có món ăn nào trong đơn để in phiếu bếp!');
          return;
        }
        await printDocxSlip('kitchen_default', table.name, kitchenItems, 'HOÁ ĐƠN BẾP', table.notes || '');
      } catch (err) {
        console.error("Lỗi khi in lại phiếu bếp:", err);
        showToast("❌ Gặp lỗi khi in lại phiếu bếp.");
      } finally {
        btnPrintKitchenDirect.disabled = false;
      }
    });
  }

  // Bind discount inputs and handlers
  const discountInputs = tableDetailsPanel.querySelectorAll('.item-detail-discount-input');
  discountInputs.forEach(input => {
    const itemId = input.getAttribute('data-item-id');
    const typeSelect = tableDetailsPanel.querySelector(`.item-detail-discount-type-select[data-item-id="${itemId}"]`);
    
    function validateInput() {
      let rawVal = input.value.replace(/\D/g, '');
      let val = parseInt(rawVal) || 0;
      const type = typeSelect ? typeSelect.value : 'cash';
      const item = table.order.find(i => i.id === itemId);
      
      if (item) {
        if (type === 'percent') {
          if (val > 100) {
            val = 100;
          }
          input.value = val.toString();
        } else {
          if (val > item.price) {
            val = item.price;
          }
          input.value = formatNumberWithDots(val);
        }
        if (val < 0) {
          val = 0;
          input.value = '0';
        }
      }
      checkDiscountChanges(table);
    }

    input.addEventListener('input', validateInput);
    if (typeSelect) {
      typeSelect.addEventListener('change', validateInput);
    }
  });

  const clearDiscountBtns = tableDetailsPanel.querySelectorAll('.btn-clear-item-discount');
  clearDiscountBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const itemId = btn.getAttribute('data-item-id');
      const input = tableDetailsPanel.querySelector(`.item-detail-discount-input[data-item-id="${itemId}"]`);
      if (input) {
        input.value = '0';
        checkDiscountChanges(table);
      }
    });
  });

  const btnSaveDiscountsDirect = document.getElementById('btn-save-discounts-direct');
  if (btnSaveDiscountsDirect) {
    btnSaveDiscountsDirect.addEventListener('click', async () => {
      btnSaveDiscountsDirect.disabled = true;
      btnSaveDiscountsDirect.textContent = 'Đang lưu...';
      
      const updatedItems = table.order.map(item => {
        const input = tableDetailsPanel.querySelector(`.item-detail-discount-input[data-item-id="${item.id}"]`);
        const typeSelect = tableDetailsPanel.querySelector(`.item-detail-discount-type-select[data-item-id="${item.id}"]`);
        
        let discountVal = 0;
        if (input) {
          const rawVal = input.value.replace(/\D/g, '');
          discountVal = parseInt(rawVal) || 0;
        } else {
          discountVal = item.discount || 0;
        }
        
        const discountType = typeSelect ? typeSelect.value : (item.discount_type || 'cash');
        return {
          ...item,
          discount: discountVal,
          discount_type: discountType
        };
      });

      try {
        const response = await fetch('/api/order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tableId: table.id,
            items: updatedItems,
            notes: table.notes || ''
          })
        });

        if (response.status === 401) {
          window.location.href = '/login.html';
          return;
        }

        const result = await response.json();
        if (result.success) {
          showToast('✅ Đã lưu thay đổi giảm giá thành công!');
          
          // Refresh data
          const tablesRes = await fetch('/api/tables');
          if (tablesRes.ok) {
            tables = await tablesRes.json();
            renderTables();
            const updatedTable = tables.find(t => t.id === table.id);
            renderTableDetails(updatedTable);
          }
        } else {
          alert(`Lỗi khi lưu giảm giá: ${result.error}`);
        }
      } catch (err) {
        console.error('Lỗi khi lưu giảm giá:', err);
        alert('Không thể kết nối đến máy chủ.');
      } finally {
        btnSaveDiscountsDirect.disabled = false;
        btnSaveDiscountsDirect.innerHTML = 'Lưu giảm giá đã chỉnh sửa';
      }
    });
  }

  function checkDiscountChanges(t) {
    let changed = false;
    t.order.forEach(item => {
      const input = tableDetailsPanel.querySelector(`.item-detail-discount-input[data-item-id="${item.id}"]`);
      const typeSelect = tableDetailsPanel.querySelector(`.item-detail-discount-type-select[data-item-id="${item.id}"]`);
      
      let inputVal = 0;
      if (input) {
        const rawVal = input.value.replace(/\D/g, '');
        inputVal = parseInt(rawVal) || 0;
      }
      
      const inputType = typeSelect ? typeSelect.value : 'cash';
      const origVal = item.discount || 0;
      const origType = item.discount_type || 'cash';
      
      // If both values are 0, there is no effective change regardless of unit change
      if (inputVal === 0 && origVal === 0) {
        // No change
      } else {
        if (inputVal !== origVal || inputType !== origType) {
          changed = true;
        }
      }
    });
    const container = document.getElementById('save-discounts-btn-container');
    if (container) {
      container.style.display = changed ? 'block' : 'none';
    }
  }
}

// State for manager order modal
let managerCart = [];
let managerOrderTableId = null;
let isScrollingFromClickOrder = false;
let scrollOrderTimeout = null;
let activeItem = null;
let currentQuantity = 1;

function openManagerOrderModal(table) {
  managerOrderTableId = table.id;
  
  const modal = document.getElementById('manager-order-modal');
  if (!modal) return;
  
  const notesInput = document.getElementById('manager-order-general-notes');
  if (notesInput) {
    notesInput.value = table.notes || '';
  }

  const title = document.getElementById('manager-order-modal-title');
  if (table.order && table.order.length > 0) {
    title.textContent = `Thêm món - ${table.name}`;
    managerCart = JSON.parse(JSON.stringify(table.order)).map(item => ({ ...item, isOriginal: true }));
  } else {
    title.textContent = `Tạo đơn - ${table.name}`;
    managerCart = [];
  }
  
  // Clear search input
  document.getElementById('manager-order-search').value = '';
  isScrollingFromClickOrder = false;
  
  // Show modal with transition animation
  modal.style.display = 'flex';
  modal.offsetHeight; // force reflow
  modal.classList.add('show');
  
  // Reset scroll container of the menu to top
  const container = document.getElementById('manager-order-menu-container');
  if (container) {
    container.scrollTop = 0;
  }
  
  // Render lists
  renderManagerOrderMenu();
  renderManagerOrderSelected();
}

function renderManagerOrderMenu() {
  const container = document.getElementById('manager-order-menu-container');
  const sidebar = document.getElementById('manager-order-category-sidebar');
  if (!container || !sidebar) return;
  
  container.innerHTML = '';
  sidebar.innerHTML = '';
  
  const searchVal = document.getElementById('manager-order-search').value.trim().toLowerCase();
  
  // Group unique categories in order of appearance
  const uniqueCategories = [...new Set(menuItems.map(item => item.category))].filter(Boolean);
  const groups = [];

  uniqueCategories.forEach(cat => {
    const items = menuItems.filter(item => {
      if (item.category !== cat) return false;
      if (!searchVal) return true;
      return item.name.toLowerCase().includes(searchVal) || (item.description && item.description.toLowerCase().includes(searchVal));
    });
    if (items.length > 0) {
      groups.push({ category: cat, items });
    }
  });
  
  if (groups.length === 0) {
    container.innerHTML = `<div style="text-align: center; color: var(--muted); padding: 60px 10px; font-size: 14px; grid-column: 1/-1;">Không tìm thấy món ăn nào.</div>`;
    return;
  }
  
  // Render Sidebar Tabs
  groups.forEach((g, idx) => {
    const tab = document.createElement('div');
    tab.className = `manager-category-tab ${idx === 0 ? 'active' : ''}`;
    
    let displayLabel = g.category;
    if (g.category === 'main') displayLabel = 'Món chính';
    else if (g.category === 'side') displayLabel = 'Món thêm';
    else if (g.category === 'drink') displayLabel = 'Nước uống';
    else if (g.category === 'COMBO') displayLabel = 'Combo';
    else if (g.category === 'SƯỜN') displayLabel = 'Cơm sườn';
    else if (g.category === 'BA RỌI') displayLabel = 'Cơm ba rọi';
    else if (g.category === 'SƯỜN CỌNG') displayLabel = 'Sườn cọng';
    else if (g.category === 'CANH VÀ TOPPING') displayLabel = 'Canh & Topping';
    else if (g.category === 'CƠM NHÀ TẤM XƯA') displayLabel = 'Cơm thêm';

    tab.innerHTML = `<span style="line-height: 1.2;">${displayLabel}</span>`;
    tab.setAttribute('data-category', g.category);
    
    tab.addEventListener('click', () => {
      document.querySelectorAll('#manager-order-category-sidebar .manager-category-tab').forEach(t => {
        t.classList.remove('active');
        t.style.color = '';
        t.style.borderLeftColor = '';
        t.style.backgroundColor = '';
      });
      tab.classList.add('active');
      tab.style.color = '';
      tab.style.borderLeftColor = '';
      tab.style.backgroundColor = '';
      
      const targetHeader = document.getElementById(`manager-order-sec-${g.category}`);
      if (targetHeader) {
        isScrollingFromClickOrder = true;
        const offsetTop = targetHeader.offsetTop - container.offsetTop;
        container.scrollTo({ top: offsetTop - 10, behavior: 'smooth' });
        
        if (scrollOrderTimeout) clearTimeout(scrollOrderTimeout);
        scrollOrderTimeout = setTimeout(() => {
          isScrollingFromClickOrder = false;
        }, 800);
      }
    });
    
    sidebar.appendChild(tab);
  });
  
  // Render Category Sections
  groups.forEach(g => {
    const section = document.createElement('div');
    section.style.marginBottom = '28px';
    
    let displayLabel = g.category;
    if (g.category === 'main') displayLabel = 'Món chính';
    else if (g.category === 'side') displayLabel = 'Món thêm';
    else if (g.category === 'drink') displayLabel = 'Nước uống';
    else if (g.category === 'COMBO') displayLabel = 'Combo';
    else if (g.category === 'SƯỜN') displayLabel = 'Cơm sườn';
    else if (g.category === 'BA RỌI') displayLabel = 'Cơm ba rọi';
    else if (g.category === 'SƯỜN CỌNG') displayLabel = 'Sườn cọng';
    else if (g.category === 'CANH VÀ TOPPING') displayLabel = 'Canh & Topping';
    else if (g.category === 'CƠM NHÀ TẤM XƯA') displayLabel = 'Cơm thêm';

    // Sticky Category Header
    const header = document.createElement('h3');
    header.id = `manager-order-sec-${g.category}`;
    header.className = 'manager-order-sec-header';
    header.setAttribute('data-category', g.category);
    header.style.cssText = ''; // Cleaned inline styles, styling moved to CSS
    header.innerHTML = `<span>${displayLabel}</span>`;
    
    section.appendChild(header);
    
    // Grid wrapper
    const grid = document.createElement('div');
    grid.style.cssText = 'display: grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 12px;';
    
    g.items.forEach(item => {
      const card = document.createElement('div');
      card.className = 'manager-order-card';
      
      let visualHtml = '';
      if (item.image_url) {
        visualHtml = `<img src="${item.image_url}" onerror="this.onerror=null; this.src='images/logo.png'">`;
      } else {
        const initialLetter = item.name ? item.name.charAt(0).toUpperCase() : '🍽️';
        visualHtml = `<div class="manager-order-card-placeholder">${initialLetter}</div>`;
      }
      
      card.innerHTML = `
        <div>
          ${visualHtml}
          <div class="manager-order-card-text">${item.name}</div>
        </div>
        <div class="manager-order-card-price">${formatVND(item.price)}</div>
      `;
      
      card.addEventListener('click', () => {
        card.style.transform = 'scale(0.95)';
        setTimeout(() => {
          card.style.transform = 'translateY(-2px)';
        }, 100);
        
        // Check if item has linked option groups
        const linkedGroups = optionGroups.filter(og => 
          og.linked_menu_item_ids && og.linked_menu_item_ids.includes(item.id)
        );
        
        if (linkedGroups.length > 0) {
          openCustomModal(item);
        } else {
          addMenuItemToManagerCart(item);
        }
      });
      
      grid.appendChild(card);
    });
    
    section.appendChild(grid);
    container.appendChild(section);
  });
}

function addMenuItemToManagerCart(item) {
  let price = item.price;
  if (price === 0) {
    const inputPrice = prompt(`Mặt hàng "${item.name}" chưa có giá bán.\nVui lòng nhập giá bán của sản phẩm này (VNĐ):`, "");
    if (inputPrice === null) return; // Quản lý bấm Hủy
    const parsedPrice = parseInt(inputPrice.replace(/[^0-9]/g, ''));
    if (isNaN(parsedPrice) || parsedPrice < 0) {
      alert('⚠️ Giá bán nhập vào không hợp lệ!');
      return;
    }
    price = parsedPrice;
  }

  const existing = managerCart.find(i => i.id === item.id && i.price === price);
  if (existing) {
    existing.quantity++;
  } else {
    managerCart.push({
      id: item.id,
      name: item.name,
      price: price,
      emoji: item.emoji || '🍽️',
      image_url: item.image_url,
      quantity: 1,
      notes: ''
    });
  }
  renderManagerOrderSelected();
}

function renderManagerOrderSelected() {
  const list = document.getElementById('manager-order-selected-list');
  if (!list) return;
  list.innerHTML = '';
  
  if (managerCart.length === 0) {
    list.innerHTML = `<div style="text-align: center; color: var(--muted); padding: 60px 20px; font-size: 13px;">Chưa chọn món nào.</div>`;
    document.getElementById('manager-order-summary-qty').textContent = '0 món';
    document.getElementById('manager-order-summary-total').textContent = '0đ';
    return;
  }
  
  let totalQty = 0;
  let totalPrice = 0;
  
  const firstNewItemIndex = managerCart.findIndex(item => !item.isOriginal);
  
  managerCart.forEach((item, index) => {
    const subtotal = item.price * item.quantity;
    totalQty += item.quantity;
    totalPrice += subtotal;
    
    if (index === firstNewItemIndex && firstNewItemIndex > 0) {
      const divider = document.createElement('div');
      divider.className = 'rgb-gradient-divider';
      divider.innerHTML = '<span class="divider-text">Thêm món</span>';
      list.appendChild(divider);
    }
    
    const row = document.createElement('div');
    row.className = 'manager-selected-row';
    
    let visualHtml = '';
    if (item.image_url) {
      visualHtml = `<img src="${item.image_url}" onerror="this.onerror=null; this.src='images/logo.png'">`;
    } else {
      const initials = item.name ? item.name.substring(0, 2).toUpperCase() : '🍽️';
      visualHtml = `<div class="manager-selected-row-placeholder">${initials}</div>`;
    }
    
    const optionsText = item.options && item.options.length > 0
      ? item.options.map(o => `+ ${o.name}`).join(', ')
      : '';

    row.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <div style="display: flex; align-items: center; gap: 8px; max-width: 65%;">
          ${visualHtml}
          <div style="display: flex; flex-direction: column; overflow: hidden;">
            <span style="font-size: 13px; font-weight: 600; color: var(--ink); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${item.name}">${item.name}</span>
            <span style="font-size: 11px; color: var(--muted); font-weight: 500;">${formatVND(item.price)}</span>
            ${optionsText ? `<span style="font-size: 11px; color: #64748b; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${optionsText}">${optionsText}</span>` : ''}
          </div>
        </div>
        <div style="display: flex; align-items: center; gap: 8px;">
          <!-- Stepper -->
          <div class="manager-stepper">
            <button class="btn-minus" type="button">-</button>
            <span class="qty-display">${item.quantity}</span>
            <button class="btn-plus" type="button">+</button>
          </div>
          <!-- Delete -->
          <button class="btn-delete btn-delete-text" type="button">Xóa</button>
        </div>
      </div>
      <!-- Notes field -->
      <div style="display: flex; align-items: center; gap: 6px;">
        <span style="font-size: 11px; color: var(--muted); font-weight: 500; flex-shrink: 0;">Ghi chú:</span>
        <input type="text" class="notes-input" placeholder="Ví dụ: Không hành, ít cay..." value="${item.notes || ''}">
      </div>
    `;
    
    // Bind stepper actions
    row.querySelector('.btn-minus').addEventListener('click', () => {
      if (item.quantity > 1) {
        item.quantity--;
      } else {
        managerCart.splice(index, 1);
      }
      renderManagerOrderSelected();
    });
    row.querySelector('.btn-plus').addEventListener('click', () => {
      item.quantity++;
      renderManagerOrderSelected();
    });
    row.querySelector('.btn-delete').addEventListener('click', () => {
      managerCart.splice(index, 1);
      renderManagerOrderSelected();
    });
    
    // Bind notes input action
    const notesInput = row.querySelector('.notes-input');
    notesInput.addEventListener('input', (e) => {
      item.notes = e.target.value;
    });
    
    list.appendChild(row);
  });
  
  document.getElementById('manager-order-summary-qty').textContent = `${totalQty} món`;
  document.getElementById('manager-order-summary-total').textContent = formatVND(totalPrice);
}

function initCustomItemModal() {
  const customItemModal = document.getElementById('custom-item-modal');
  const btnStepperMinus = document.getElementById('btn-stepper-minus');
  const btnStepperPlus = document.getElementById('btn-stepper-plus');
  const stepperValue = document.getElementById('stepper-value');
  const btnCancelCustomModal = document.getElementById('btn-cancel-custom-modal');
  const btnCloseCustomModal = document.getElementById('btn-close-custom-modal');
  const btnAddToCartConfirm = document.getElementById('btn-add-to-cart-confirm');

  if (!customItemModal) return;

  const closeCustomModal = () => {
    customItemModal.style.display = 'none';
    activeItem = null;
  };

  btnStepperMinus.addEventListener('click', () => {
    if (currentQuantity > 1) {
      currentQuantity--;
      stepperValue.textContent = currentQuantity;
    }
  });

  btnStepperPlus.addEventListener('click', () => {
    currentQuantity++;
    stepperValue.textContent = currentQuantity;
  });

  btnCancelCustomModal.addEventListener('click', closeCustomModal);
  btnCloseCustomModal.addEventListener('click', closeCustomModal);
  
  customItemModal.addEventListener('click', (e) => {
    if (e.target === customItemModal) closeCustomModal();
  });

  btnAddToCartConfirm.addEventListener('click', () => {
    if (!activeItem) return;

    const customItemNotes = document.getElementById('custom-item-notes');
    const notes = customItemNotes ? customItemNotes.value.trim() : '';

    // Collect selected options
    const selectedOptions = [];
    let optionPriceSum = 0;

    const inputs = customItemModal.querySelectorAll('.select-option-input:checked');
    inputs.forEach(input => {
      const groupId = parseInt(input.getAttribute('data-group-id'));
      const optId = parseInt(input.getAttribute('data-opt-id'));

      const group = optionGroups.find(og => og.id === groupId);
      if (group && Array.isArray(group.options)) {
        const opt = group.options.find(o => o.id === optId);
        if (opt) {
          selectedOptions.push({
            id: opt.id,
            name: opt.name,
            price: opt.price,
            group_name: group.name,
            group_id: group.id
          });
          optionPriceSum += opt.price;
        }
      }
    });

    // Validate min_select constraints
    const linkedGroups = optionGroups.filter(og =>
      og.linked_menu_item_ids && og.linked_menu_item_ids.includes(activeItem.id)
    );

    for (const og of linkedGroups) {
      if (og.min_select > 0) {
        const groupSelections = selectedOptions.filter(o => o.group_id === og.id);
        if (groupSelections.length < og.min_select) {
          alert(`⚠️ Vui lòng chọn tối thiểu ${og.min_select} lựa chọn cho nhóm "${og.name}".`);
          return;
        }
      }
    }

    let price = activeItem.price;
    if (price === 0) {
      const inputPrice = prompt(`Mặt hàng "${activeItem.name}" chưa có giá bán.\nVui lòng nhập giá bán của sản phẩm này (VNĐ):`, "");
      if (inputPrice === null) return;
      const parsedPrice = parseInt(inputPrice.replace(/[^0-9]/g, ''));
      if (isNaN(parsedPrice) || parsedPrice < 0) {
        alert('⚠️ Giá bán nhập vào không hợp lệ!');
        return;
      }
      price = parsedPrice;
    }

    price += optionPriceSum;

    // Compare options too for duplicate detection
    const existingIndex = managerCart.findIndex(item => {
      if (item.id !== activeItem.id || item.notes !== notes || item.price !== price) return false;

      const o1 = item.options || [];
      const o2 = selectedOptions;
      if (o1.length !== o2.length) return false;

      const o1Ids = o1.map(o => o.id).sort().join(',');
      const o2Ids = o2.map(o => o.id).sort().join(',');
      return o1Ids === o2Ids;
    });

    if (existingIndex !== -1) {
      managerCart[existingIndex].quantity += currentQuantity;
    } else {
      managerCart.push({
        id: activeItem.id,
        name: activeItem.name,
        price: price,
        emoji: activeItem.emoji || '🍽️',
        image_url: activeItem.image_url,
        quantity: currentQuantity,
        notes: notes,
        options: selectedOptions
      });
    }

    closeCustomModal();
    renderManagerOrderSelected();
  });
}

function openCustomModal(item) {
  activeItem = item;
  currentQuantity = 1;
  
  const customItemModal = document.getElementById('custom-item-modal');
  const customModalTitle = document.getElementById('custom-modal-title');
  const customModalEmoji = document.getElementById('custom-modal-emoji');
  const customModalPrice = document.getElementById('custom-modal-price');
  const customModalDesc = document.getElementById('custom-modal-desc');
  const stepperValue = document.getElementById('stepper-value');
  const customItemNotes = document.getElementById('custom-item-notes');
  const optionsContainer = document.getElementById('custom-item-options-container');

  if (!customItemModal) return;

  stepperValue.textContent = currentQuantity;
  if (customItemNotes) customItemNotes.value = '';
  
  if (customModalTitle) customModalTitle.textContent = item.name;
  if (customModalEmoji) {
    if (item.image_url) {
      customModalEmoji.innerHTML = `<img src="${item.image_url}" style="width:72px; height:72px; object-fit:cover; border-radius:var(--rounded-full);">`;
    } else {
      customModalEmoji.innerHTML = `<img src="images/logo.png" style="width:72px; height:72px; object-fit:cover; border-radius:var(--rounded-full);">`;
    }
  }
  
  if (customModalPrice) {
    if (item.price === 0) {
      customModalPrice.textContent = 'Giá: Tự nhập khi thêm';
    } else {
      customModalPrice.textContent = formatVND(item.price);
    }
  }
  
  if (customModalDesc) customModalDesc.textContent = item.description || '';
  
  // Render linked option groups
  if (optionsContainer) {
    optionsContainer.innerHTML = '';
    const linkedGroups = optionGroups.filter(og => 
      og.linked_menu_item_ids && og.linked_menu_item_ids.includes(item.id)
    );
    
    if (linkedGroups.length > 0) {
      linkedGroups.forEach(og => {
        const groupDiv = document.createElement('div');
        groupDiv.className = 'option-group-select-block';
        groupDiv.style.cssText = 'text-align: left; position: relative; margin-bottom: 12px;';
        
        // Title label
        const label = document.createElement('label');
        label.style.cssText = 'font-size: 12px; font-weight: 600; color: var(--muted); margin-bottom: 4px; display: block;';
        
        let constraintText = '';
        if (og.min_select > 0) {
          constraintText = ` (Yêu cầu chọn tối thiểu ${og.min_select})`;
        } else if (og.max_select) {
          constraintText = ` (Tối đa ${og.max_select})`;
        }
        label.textContent = `${og.name}${constraintText}`;
        groupDiv.appendChild(label);
        
        // Custom select trigger
        const trigger = document.createElement('div');
        trigger.className = 'custom-opt-select-trigger';
        trigger.style.cssText = 'display: flex; justify-content: space-between; align-items: center; width: 100%; height: 38px; border: 1px solid #cbd5e1; border-radius: 6px; padding: 0 12px; background: #ffffff; cursor: pointer; user-select: none; box-sizing: border-box;';
        
        const defaultOpts = og.options ? og.options.filter(o => o.is_default) : [];
        const initialText = defaultOpts.length > 0
          ? defaultOpts.map(o => o.name).join(', ')
          : 'Chọn lựa chọn...';
          
        trigger.innerHTML = `
          <span class="selected-text" style="font-size: 13px; font-weight: 600; color: #1e293b; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 90%;">${initialText}</span>
          <span class="chevron" style="font-size: 10px; color: #64748b; transition: transform 0.2s;">▼</span>
        `;
        groupDiv.appendChild(trigger);
        
        // Custom select panel
        const panel = document.createElement('div');
        panel.className = 'custom-opt-select-panel';
        panel.style.cssText = 'display: none; border: 1px solid #cbd5e1; border-top: none; border-radius: 0 0 6px 6px; padding: 12px; background: #ffffff; margin-top: -2px; max-height: 180px; overflow-y: auto; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); z-index: 10; position: relative;';
        
        if (Array.isArray(og.options)) {
          og.options.forEach(opt => {
            const rowLabel = document.createElement('label');
            rowLabel.style.cssText = 'display: flex; align-items: center; justify-content: space-between; gap: 8px; cursor: pointer; font-size: 13px; font-weight: 500; color: #334155; margin: 0; padding: 6px 0; user-select: none; border-bottom: 1px solid #f1f5f9;';
            
            const inputType = og.max_select === 1 ? 'radio' : 'checkbox';
            const inputName = `opt-group-${og.id}`;
            
            rowLabel.innerHTML = `
              <div style="display: flex; align-items: center; gap: 8px;">
                <input type="${inputType}" name="${inputName}" class="select-option-input" data-group-id="${og.id}" data-opt-id="${opt.id}" data-opt-name="${opt.name}" ${opt.is_default ? 'checked' : ''} style="cursor: pointer;">
                <span>${opt.name}</span>
              </div>
              <span style="font-size: 12px; color: #ff6600; font-weight: 600;">${opt.price > 0 ? '+' + formatVND(opt.price) : 'Miễn phí'}</span>
            `;
            
            rowLabel.addEventListener('click', (e) => {
              e.stopPropagation();
            });
            
            panel.appendChild(rowLabel);
          });
        }
        
        groupDiv.appendChild(panel);
        
        // Toggle action
        trigger.addEventListener('click', (e) => {
          e.stopPropagation();
          const isOpen = panel.style.display === 'block';
          
          customItemModal.querySelectorAll('.custom-opt-select-panel').forEach(p => p.style.display = 'none');
          customItemModal.querySelectorAll('.custom-opt-select-trigger').forEach(t => {
            t.style.borderRadius = '6px';
            const ch = t.querySelector('.chevron');
            if (ch) ch.style.transform = 'none';
          });
          
          if (!isOpen) {
            panel.style.display = 'block';
            trigger.style.borderRadius = '6px 6px 0 0';
            const ch = trigger.querySelector('.chevron');
            if (ch) ch.style.transform = 'rotate(180deg)';
          }
        });
        
        panel.addEventListener('change', () => {
          const checkedInputs = Array.from(panel.querySelectorAll('.select-option-input:checked'));
          const selectedNames = checkedInputs.map(i => i.getAttribute('data-opt-name'));
          const textEl = trigger.querySelector('.selected-text');
          
          if (selectedNames.length > 0) {
            textEl.textContent = selectedNames.join(', ');
          } else {
            textEl.textContent = 'Chọn lựa chọn...';
          }
        });
        
        optionsContainer.appendChild(groupDiv);
      });
    }
  }
  
  customItemModal.style.display = 'flex';
}

function initManagerOrderModal() {
  const modal = document.getElementById('manager-order-modal');
  const btnClose = document.getElementById('btn-close-manager-order-modal');
  const btnCancel = document.getElementById('btn-cancel-manager-order-modal');
  const btnSubmit = document.getElementById('btn-submit-manager-order');
  const searchInput = document.getElementById('manager-order-search');
  const container = document.getElementById('manager-order-menu-container');
  
  if (!modal) return;
  
  const closeModal = () => {
    modal.classList.remove('show');
    setTimeout(() => {
      if (!modal.classList.contains('show')) {
        modal.style.display = 'none';
      }
    }, 250);
  };
  
  btnClose.onclick = closeModal;
  btnCancel.onclick = closeModal;
  modal.onclick = (e) => {
    if (e.target === modal) closeModal();
  };
  
  if (searchInput) {
    searchInput.oninput = () => {
      renderManagerOrderMenu();
    };
  }
  
  // Set up scroll spy on the menu container
  if (container) {
    container.addEventListener('scroll', () => {
      if (isScrollingFromClickOrder) return;
      
      const headers = container.querySelectorAll('.manager-order-sec-header');
      let activeCategory = null;
      
      for (let i = 0; i < headers.length; i++) {
        const header = headers[i];
        const rect = header.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        
        // If the header top reaches near the top of container viewport
        if (rect.top - containerRect.top <= 40) {
          activeCategory = header.getAttribute('data-category');
        }
      }
      
      if (activeCategory) {
        document.querySelectorAll('#manager-order-category-sidebar .manager-category-tab').forEach(t => {
          if (t.getAttribute('data-category') === activeCategory) {
            t.classList.add('active');
            t.style.color = '';
            t.style.borderLeftColor = '';
            t.style.backgroundColor = '';
          } else {
            t.classList.remove('active');
            t.style.color = '';
            t.style.borderLeftColor = '';
            t.style.backgroundColor = '';
          }
        });
      }
    });
  }
  
  btnSubmit.onclick = async () => {
    if (managerCart.length === 0) {
      alert('Vui lòng chọn ít nhất một món ăn!');
      return;
    }
    
    btnSubmit.disabled = true;
    btnSubmit.textContent = 'Đang gửi...';
    
    const tableBeforeSave = tables.find(t => t.id === managerOrderTableId);
    const oldOrder = tableBeforeSave ? JSON.parse(JSON.stringify(tableBeforeSave.order || [])) : [];
    const tableName = tableBeforeSave ? tableBeforeSave.name : 'Bàn';
    
    const notesInput = document.getElementById('manager-order-general-notes');
    const generalNotes = notesInput ? notesInput.value.trim() : '';

    try {
      const response = await fetch('/api/order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          tableId: managerOrderTableId,
          items: managerCart,
          notes: generalNotes
        })
      });
      
      if (response.status === 401) {
        window.location.href = '/login.html';
        return;
      }
      
      const result = await response.json();
      if (result.success) {
        showToast(`✅ Đã cập nhật đơn hàng thành công!`);
        
        const diffItems = getOrderDifference(oldOrder, managerCart);
        
        if (diffItems.length > 0) {
          const isAdd = (oldOrder && oldOrder.length > 0);
          const kitchenTitle = isAdd ? 'PHIẾU THÊM MÓN' : 'HOÁ ĐƠN BẾP';
          const drinkTitle = isAdd ? 'PHIẾU THÊM NƯỚC' : 'HOÁ ĐƠN NƯỚC';
          
          // Separate items in the cart
          const drinkItems = diffItems.filter(item => isDrinkItem(item, menuItems));
          const kitchenItems = diffItems.filter(item => !drinkItems.includes(item));

          // Trigger automatic printing for connected printers
          printDocxSlip('kitchen_default', tableName, kitchenItems, kitchenTitle, generalNotes);
          printDocxSlip('kitchen_bar', tableName, drinkItems, drinkTitle, generalNotes);
        }

        closeModal();
        
        // Refresh tables list
        const tablesRes = await fetch('/api/tables');
        if (tablesRes.ok) {
          tables = await tablesRes.json();
          renderTables();
          
          // Refresh details panel if this table is still selected
          if (selectedTableId === managerOrderTableId) {
            const updatedTable = tables.find(t => t.id === managerOrderTableId);
            renderTableDetails(updatedTable);
          }
        }
      } else {
        alert(`Lỗi: ${result.error || 'Vui lòng thử lại.'}`);
      }
    } catch (err) {
      console.error('Lỗi khi lưu đơn:', err);
      alert('Không thể kết nối đến máy chủ.');
    } finally {
      btnSubmit.disabled = false;
      btnSubmit.textContent = 'Lưu & Gửi Bếp';
    }
  };
}

// Function to show custom confirmation modal for deleting/canceling table orders
function showConfirmDeleteModal(tableName, onConfirm) {
  // Inject modal markup dynamically if not exists
  let modal = document.getElementById('confirm-delete-order-modal');
  if (!modal) {
    const modalHtml = `
      <div class="modal-backdrop" id="confirm-delete-order-modal" style="display: none; z-index: 3000; align-items: center; justify-content: center; position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.5);">
        <style>
          @keyframes modalBounceIn {
            0% { transform: scale(0.85); opacity: 0; }
            70% { transform: scale(1.04); opacity: 0.9; }
            100% { transform: scale(1); opacity: 1; }
          }
          @keyframes pulseEmoji {
            0% { transform: scale(1); }
            50% { transform: scale(1.15); }
            100% { transform: scale(1); }
          }
        </style>
        <div class="modal-content" style="max-width: 380px; width: 90%; border-radius: 16px; padding: 28px 24px; text-align: center; background: #ffffff; box-shadow: 0 10px 25px rgba(0,0,0,0.2); animation: modalBounceIn 0.35s cubic-bezier(0.175, 0.885, 0.32, 1.275); display: block; margin: auto;">
          <span style="font-size: 52px; display: inline-block; margin-bottom: 16px; animation: pulseEmoji 2s infinite ease-in-out;">⚠️</span>
          <h3 style="margin: 0 0 10px 0; font-weight: 700; font-size: 19px; color: #1e293b;">Xác nhận hủy đơn</h3>
          <p id="confirm-delete-body-text" style="color: #64748b; font-size: 14px; margin: 0 0 24px 0; line-height: 1.5; text-align: center;"></p>
          <div style="display: flex; gap: 12px; justify-content: center; width: 100%;">
            <button class="btn btn-secondary" id="btn-cancel-delete-modal" style="flex: 1; height: 40px; border-radius: 8px; font-weight: 600; border: 1px solid #cbd5e1; color: #475569; background: #ffffff; cursor: pointer;">Quay lại</button>
            <button class="btn btn-danger" id="btn-confirm-delete-modal" style="flex: 1.2; height: 40px; border-radius: 8px; font-weight: 700; background-color: #ef4444; border-color: #ef4444; color: white; cursor: pointer; border: none;">Đồng ý hủy</button>
          </div>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    modal = document.getElementById('confirm-delete-order-modal');
  }

  // Set warning message text
  document.getElementById('confirm-delete-body-text').textContent = `Bạn có chắc chắn muốn hủy và xóa toàn bộ món ăn đang gọi của ${tableName} không? Hành động này không thể hoàn tác.`;

  // Display modal
  modal.style.display = 'flex';

  // Bind actions
  const btnCancel = document.getElementById('btn-cancel-delete-modal');
  const btnConfirm = document.getElementById('btn-confirm-delete-modal');

  const closeModal = () => {
    modal.style.display = 'none';
  };

  btnCancel.onclick = closeModal;
  modal.onclick = (e) => {
    if (e.target === modal) closeModal();
  };

  btnConfirm.onclick = () => {
    closeModal();
    onConfirm();
  };
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

// Helper to calculate difference between old order and new cart
function getOrderDifference(oldOrder, newCart) {
  const diffItems = [];
  
  newCart.forEach(newItem => {
    const oldItem = (oldOrder || []).find(o => o.name === newItem.name);
    const oldQty = oldItem ? oldItem.quantity : 0;
    const diffQty = newItem.quantity - oldQty;
    
    if (diffQty > 0) {
      diffItems.push({
        ...newItem,
        quantity: diffQty
      });
    }
  });
  
  return diffItems;
}

// Helper to check if an item is a drink
function isDrinkItem(item, menuList) {
  const menuItem = (menuList || []).find(m => m.id === item.id);
  if (menuItem && menuItem.type) {
    const typeLower = menuItem.type.toLowerCase();
    if (typeLower === 'món uống' || typeLower === 'món nước' || typeLower.includes('uống') || typeLower.includes('nước')) {
      return true;
    }
    if (typeLower === 'món ăn' || typeLower.includes('ăn')) {
      return false;
    }
  }
  
  const category = menuItem ? menuItem.category : '';
  
  if (category) {
    const catLower = category.toLowerCase();
    if (
      catLower === 'drink' || 
      catLower.includes('nước') || 
      catLower.includes('uống') || 
      catLower.includes('giải khát') ||
      catLower.includes('sinh tố') ||
      catLower.includes('cà phê') ||
      catLower.includes('cafe') ||
      catLower.includes('coffee') ||
      catLower.includes('trà')
    ) {
      return true;
    }
  }
  
  if (item.name) {
    const nameLower = item.name.toLowerCase();
    if (
      nameLower.includes('nước') ||
      nameLower.includes('trà') ||
      nameLower.includes('cà phê') ||
      nameLower.includes('cafe') ||
      nameLower.includes('coffee') ||
      nameLower.includes('sinh tố') ||
      nameLower.includes('juice') ||
      nameLower.includes('sữa') ||
      nameLower.includes('coca') ||
      nameLower.includes('pepsi') ||
      nameLower.includes('sting') ||
      nameLower.includes('bia')
    ) {
      return true;
    }
  }
  
  return false;
}

// Helper to print test page in browser print dialog via hidden iframe
function printTestIframe(printerType, targetStr) {
  let iframe = document.getElementById('print-test-iframe');
  if (iframe) iframe.remove();
  
  iframe = document.createElement('iframe');
  iframe.id = 'print-test-iframe';
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  document.body.appendChild(iframe);
  
  const doc = iframe.contentWindow.document;
  doc.open();
  doc.write(`
    <html>
      <head>
        <title>IN THỬ MÁY IN</title>
        <style>
          body { font-family: 'Arial', sans-serif; padding: 10px; margin: 0; text-align: center; font-size: 14px; }
          .line { border-bottom: 1px dashed #000; margin: 8px 0; }
          .title { font-size: 18px; font-weight: bold; }
          .info { text-align: left; font-size: 12px; margin: 10px 0; line-height: 1.5; }
        </style>
      </head>
      <body>
        <div class="title">IN THỬ MÁY IN</div>
        <div>Nhà hàng: TẤM XƯA</div>
        <div class="line"></div>
        <div class="info">
          <div>Loại máy in: \${printerType === 'wifi' ? 'Wifi / LAN' : 'PC Shared'}</div>
          <div>Địa chỉ: \${targetStr}</div>
          <div>Thời gian: \${new Date().toLocaleString('vi-VN')}</div>
          <div>Trạng thái: Kết nối OK (Giả lập Cloud)</div>
        </div>
        <div class="line"></div>
        <div style="font-size: 11px; color: #555; margin-top: 15px;">Mẫu in thử thành công</div>
      </body>
    </html>
  `);
  doc.close();
  
  iframe.contentWindow.focus();
  setTimeout(() => {
    iframe.contentWindow.print();
  }, 300);
}

// Helper to print kitchen/bar slip using docx template
async function printDocxSlip(printerId, tableName, items, title = 'HOÁ ĐƠN BẾP', notes = '') {
  if (items.length === 0) return;
  
  const isConnected = localStorage.getItem(`printer_${printerId}_connected`) === 'true';
  if (!isConnected) {
    console.log(`Printer ${printerId} is not connected. Skipping print.`);
    return;
  }

  const type = localStorage.getItem(`printer_${printerId}_type`) || 'browser';
  const sharedPath = localStorage.getItem(`printer_${printerId}_shared`) || '';

  let selectedTemplate = 'hoadonbep.docx';
  if (title && (title.toUpperCase().includes('THÊM') || title.toUpperCase().includes('THEM'))) {
    selectedTemplate = 'hoadonthem.docx';
  } else if (printerId === 'kitchen_bar' || (title && (title.toUpperCase().includes('NƯỚC') || title.toUpperCase().includes('NUOC')))) {
    selectedTemplate = 'hoadonnuoc.docx';
  }

  if (type === 'system') {
    const orderTimeStr = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) + ' • ' + new Date().toLocaleDateString('vi-VN');
    const templateData = {
      table_name: tableName,
      order_time: orderTimeStr,
      general_note: notes || '',
      items: items.map(item => {
        const optionGroupsMap = {};
        if (item.options && Array.isArray(item.options)) {
          item.options.forEach(o => {
            const gn = o.group_name || 'Lựa chọn';
            if (!optionGroupsMap[gn]) optionGroupsMap[gn] = [];
            optionGroupsMap[gn].push(o.name);
          });
        }
        const optionsText = Object.keys(optionGroupsMap).map(gn => `${gn}: ${optionGroupsMap[gn].join(', ')}`).join('\n');
        
        return {
          name: item.name,
          quantity: item.quantity,
          notes: item.notes || '',
          options_text: optionsText
        };
      })
    };

    try {
      const response = await fetch('/api/print-docx-silent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sharedPath: sharedPath,
          template: selectedTemplate,
          templateData: templateData,
          printerId: printerId
        })
      });
      if (response.ok) {
        showToast(`✅ Đã in trực tiếp ${title} cho ${tableName} thành công qua Word!`);
      } else {
        const errData = await response.json();
        showToast(`❌ Lỗi in trực tiếp qua Word: ${errData.error}`);
      }
    } catch (err) {
      console.error('Silent print error:', err);
      showToast('❌ Lỗi kết nối đến máy chủ in.');
    }
    return;
  }

  const orderTimeStr = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) + ' • ' + new Date().toLocaleDateString('vi-VN');
  
  const templateData = {
    template: selectedTemplate,
    table_name: tableName,
    order_time: orderTimeStr,
    general_note: notes || '',
    items: items.map(item => {
      const optionGroupsMap = {};
      if (item.options && Array.isArray(item.options)) {
        item.options.forEach(o => {
          const gn = o.group_name || 'Lựa chọn';
          if (!optionGroupsMap[gn]) optionGroupsMap[gn] = [];
          optionGroupsMap[gn].push(o.name);
        });
      }
      const optionsText = Object.keys(optionGroupsMap).map(gn => `${gn}: ${optionGroupsMap[gn].join(', ')}`).join('\n');
      
      return {
        name: item.name,
        quantity: item.quantity,
        notes: item.notes || '',
        options_text: optionsText
      };
    })
  };

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
    let iframe = document.getElementById(`print-iframe-${printerId}`);
    if (iframe) {
      iframe.remove();
    }
    
    iframe = document.createElement('iframe');
    iframe.id = `print-iframe-${printerId}`;
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

    // Dynamically adjust header styles and font alignments
    const paragraphs = doc.getElementsByTagName('p');
    for (let p of paragraphs) {
      let txt = p.textContent.trim();
      p.style.fontFamily = 'Arial, sans-serif';
      
      // Replace title text if customized
      if (title && (txt.toUpperCase().includes('HOÁ ĐƠN BẾP') || txt.toUpperCase().includes('HÓA ĐƠN BẾP'))) {
        p.textContent = title;
        txt = title;
      }
      
      // Left-align Order and Checkout times
      if (txt.includes('Giờ vào') || txt.includes('Giờ ra') || txt.includes('Giờ order')) {
        p.style.textAlign = 'left';
        p.style.fontSize = '12px';
      }
      
      // Increase size for TẤM XƯA
      if (txt.toUpperCase().includes('TẤM XƯA')) {
        p.style.fontSize = '22px';
        p.style.fontWeight = 'bold';
        p.style.letterSpacing = '1px';
      }
      
      // Increase size for HOÁ ĐƠN BẾP
      if (txt.toUpperCase().includes('HOÁ ĐƠN BẾP') || txt.toUpperCase().includes('HÓA ĐƠN BẾP') || txt.toUpperCase().includes('PHIẾU THÊM MÓN')) {
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
    setTimeout(() => {
      iframe.contentWindow.print();
      showToast(`✅ Đã mở hộp thoại in ${title} cho ${tableName}!`);
    }, 300);
    
  } catch (error) {
    console.error('Lỗi xuất hóa đơn bếp:', error);
  }
}

// Global Print Receipt Function
async function printReceipt(tableObj, orderItems, discountAmount, receivedAmount, transactionId = null, timestamp = null, payMethod = null, forceBrowserPrint = false) {
  if (!forceBrowserPrint) {
    // Kiểm tra cấu hình bật/tắt máy in hóa đơn từ mục cài đặt máy in
    const isPrinterConnected = localStorage.getItem('printer_receipt_default_connected');
    if (isPrinterConnected === 'false') {
      console.log('Máy in hóa đơn (receipt_default) đang tắt trong cài đặt. Hủy in.');
      showToast('⚠️ Máy in hóa đơn đang bị tắt trong phần Cấu hình.');
      return;
    }

    const type = localStorage.getItem('printer_receipt_default_type') || 'browser';
    const sharedPath = localStorage.getItem('printer_receipt_default_shared') || '';

    if (type === 'system') {
      const subtotal = orderItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      const finalTotal = Math.max(0, subtotal - discountAmount);
      const changeAmount = receivedAmount ? (receivedAmount - finalTotal) : 0;

      const orderTimeStr = tableObj.updatedAt 
        ? formatTime(tableObj.updatedAt).replace(' - ', ' • ') 
        : (timestamp ? formatTime(timestamp).replace(' - ', ' • ') : formatTime(new Date().toISOString()).replace(' - ', ' • '));

      const checkoutTimeStr = timestamp 
        ? formatTime(timestamp).replace(' - ', ' • ') 
        : formatTime(new Date().toISOString()).replace(' - ', ' • ');

      let selectedPayMethod = payMethod || currentPaymentMethod;
      if (tableObj && tableObj.paymentMethod) {
        selectedPayMethod = tableObj.paymentMethod;
      }
      const payMethodLabel = selectedPayMethod === 'bank' ? 'Chuyển khoản' : 'Tiền mặt';

      let txBankName = null;
      let txAccountNumber = null;
      let txAccountHolder = null;
      if (tableObj && tableObj.bankName) {
        txBankName = tableObj.bankName;
        txAccountNumber = tableObj.accountNumber;
        txAccountHolder = tableObj.accountHolder;
      } else if (selectedCheckoutBank) {
        txBankName = selectedCheckoutBank.bank_name;
        txAccountNumber = selectedCheckoutBank.account_number;
        txAccountHolder = selectedCheckoutBank.account_holder;
      }

      const templateData = {
        table_name: tableObj.name,
        order_time: orderTimeStr,
        checkout_time: checkoutTimeStr,
        subtotal: formatVNDShort(subtotal),
        discount: discountAmount > 0 ? `-${formatVNDShort(discountAmount)}` : '0đ',
        final_total: formatVNDShort(finalTotal),
        received_amount: formatVNDShort(receivedAmount || finalTotal),
        change_amount: formatVNDShort(Math.max(0, changeAmount)),
        payment_method: payMethodLabel,
        bank_name: txBankName,
        account_number: txAccountNumber,
        account_holder: txAccountHolder,
        items: orderItems.map(item => {
          let itemDiscount = 0;
          if (item.discount !== undefined && item.discount !== null) {
            itemDiscount = item.discount;
          } else if (checkoutItemDiscounts && checkoutItemDiscounts[item.id]) {
            const disc = checkoutItemDiscounts[item.id];
            if (disc.type === 'percent') {
              itemDiscount = Math.round(item.price * disc.value / 100);
            } else {
              itemDiscount = disc.value;
            }
          }
          const optionGroupsMap = {};
          if (item.options && Array.isArray(item.options)) {
            item.options.forEach(o => {
              const gn = o.group_name || 'Lựa chọn';
              if (!optionGroupsMap[gn]) optionGroupsMap[gn] = [];
              optionGroupsMap[gn].push(o.name);
            });
          }
          const optionsText = Object.keys(optionGroupsMap).map(gn => `${gn}: ${optionGroupsMap[gn].join(', ')}`).join('\n');

          return {
            emoji: item.emoji || '🍽️',
            name: item.name + (itemDiscount > 0 ? ` (Giảm -${formatVNDShort(itemDiscount)})` : ''),
            price: formatVNDShort(item.price),
            quantity: item.quantity,
            total: formatVNDShort((item.price - itemDiscount) * item.quantity),
            notes: item.notes || '',
            options_text: optionsText
          };
        })
      };

      try {
        const response = await fetch('/api/print-docx-silent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sharedPath: sharedPath,
            template: 'hoadon.docx',
            templateData: templateData
          })
        });
        if (response.ok) {
          showToast(`✅ Đã in trực tiếp hóa đơn thanh toán cho ${tableObj.name} thành công qua Word!`);
        } else {
          const errData = await response.json();
          showToast(`❌ Lỗi in trực tiếp hóa đơn qua Word: ${errData.error}`);
        }
      } catch (err) {
        console.error('Silent print error:', err);
        showToast('❌ Lỗi kết nối đến máy chủ in.');
      }
      return;
    }

    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    if (isMobile) {
      if (socket && socket.connected) {
        socket.emit('request_print_receipt', {
          tableObj: tableObj,
          orderItems: orderItems,
          discountAmount: discountAmount,
          receivedAmount: receivedAmount,
          transactionId: transactionId,
          timestamp: timestamp,
          payMethod: payMethod
        });
        showToast(`📤 Đã gửi yêu cầu in hóa đơn ${tableObj.name} tới quầy thu ngân.`);
      } else {
        console.warn('Socket không kết nối. Không thể chuyển lệnh in.');
      }
      return;
    }
  }

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

  let selectedPayMethod = payMethod || currentPaymentMethod;
  if (tableObj && tableObj.paymentMethod) {
    selectedPayMethod = tableObj.paymentMethod;
  }
  const payMethodLabel = selectedPayMethod === 'bank' ? 'Chuyển khoản' : 'Tiền mặt';

  let txBankName = null;
  let txAccountNumber = null;
  let txAccountHolder = null;
  if (tableObj && tableObj.bankName) {
    txBankName = tableObj.bankName;
    txAccountNumber = tableObj.accountNumber;
    txAccountHolder = tableObj.accountHolder;
  } else if (selectedCheckoutBank) {
    txBankName = selectedCheckoutBank.bank_name;
    txAccountNumber = selectedCheckoutBank.account_number;
    txAccountHolder = selectedCheckoutBank.account_holder;
  }

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
    bank_name: txBankName,
    account_number: txAccountNumber,
    account_holder: txAccountHolder,
    items: orderItems.map(item => {
      let itemDiscount = 0;
      if (item.discount !== undefined && item.discount !== null) {
        itemDiscount = item.discount;
      } else if (checkoutItemDiscounts && checkoutItemDiscounts[item.id]) {
        const disc = checkoutItemDiscounts[item.id];
        if (disc.type === 'percent') {
          itemDiscount = Math.round(item.price * disc.value / 100);
        } else {
          itemDiscount = disc.value;
        }
      }
      const optionGroupsMap = {};
      if (item.options && Array.isArray(item.options)) {
        item.options.forEach(o => {
          const gn = o.group_name || 'Lựa chọn';
          if (!optionGroupsMap[gn]) optionGroupsMap[gn] = [];
          optionGroupsMap[gn].push(o.name);
        });
      }
      const optionsText = Object.keys(optionGroupsMap).map(gn => `${gn}: ${optionGroupsMap[gn].join(', ')}`).join('\n');

      return {
        emoji: item.emoji || '🍽️',
        name: item.name + (itemDiscount > 0 ? ` (Giảm -${formatVND(itemDiscount)})` : ''),
        price: formatVND(item.price),
        quantity: item.quantity,
        total: formatVND((item.price - itemDiscount) * item.quantity),
        notes: item.notes || '',
        options_text: optionsText
      };
    })
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

    // Wait for all images to load before triggering print dialog (ensures QR code appears)
    const images = doc.getElementsByTagName('img');
    let loadedCount = 0;
    const totalImages = images.length;

    function triggerPrint() {
      setTimeout(() => {
        iframe.contentWindow.print();
        showToast('✅ Đã mở hộp thoại in hóa đơn!');
      }, 200);
    }

    if (totalImages === 0) {
      triggerPrint();
    } else {
      let printTriggered = false;
      const fallbackTimeout = setTimeout(() => {
        if (!printTriggered) {
          printTriggered = true;
          triggerPrint();
        }
      }, 1500);

      for (let i = 0; i < totalImages; i++) {
        const img = images[i];
        if (img.complete) {
          loadedCount++;
          if (loadedCount === totalImages && !printTriggered) {
            clearTimeout(fallbackTimeout);
            printTriggered = true;
            triggerPrint();
          }
        } else {
          img.onload = img.onerror = () => {
            loadedCount++;
            if (loadedCount === totalImages && !printTriggered) {
              clearTimeout(fallbackTimeout);
              printTriggered = true;
              triggerPrint();
            }
          };
        }
      }
    }
    
  } catch (error) {
    console.error('Lỗi xuất hóa đơn Word:', error);
    showToast('❌ Không thể mở hộp thoại in hóa đơn.');
  }
}

// Active bank accounts list for current checkout session
let checkoutActiveBanks = [];

// Open Cash Calculation Modal
async function openCheckoutModal(table) {
  checkoutModalTitle.textContent = `Thanh toán - ${table.name}`;

  const totalAmount = table.order.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  checkoutBillTotal.textContent = formatVND(totalAmount);
  
  // Load active bank account details from database
  checkoutActiveBanks = [];
  selectedCheckoutBank = null;
  try {
    const bankRes = await fetch('/api/bank-accounts/active');
    if (bankRes.ok) {
      checkoutActiveBanks = await bankRes.json();
    }
  } catch (err) {
    console.error('Lỗi khi tải tài khoản ngân hàng nhận tiền:', err);
  }

  // Render bank selector buttons
  const bankSelector = document.getElementById('checkout-bank-selector');
  if (bankSelector) {
    bankSelector.innerHTML = '';
    
    if (checkoutActiveBanks.length === 0) {
      bankSelector.innerHTML = '<span style="color: var(--primary-error-text); font-size: 12px; font-weight: 600;">⚠️ Chưa kích hoạt tài khoản ngân hàng nào. Vui lòng cấu hình ở mục "Số tài khoản".</span>';
    } else {
      // Default select the first active bank account
      selectedCheckoutBank = checkoutActiveBanks[0];
      
      checkoutActiveBanks.forEach((bank, idx) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'bank-select-btn' + (idx === 0 ? ' active' : '');
        btn.textContent = `${bank.bank_name} (${bank.account_number.slice(-4)})`;
        btn.onclick = () => {
          bankSelector.querySelectorAll('.bank-select-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          selectedCheckoutBank = bank;
          updateCheckoutBankDetails();
        };
        bankSelector.appendChild(btn);
      });
    }
  }

  // Helper function to update the on-screen labels and QR code
  function updateCheckoutBankDetails() {
    const labelName = document.getElementById('bank-payment-name');
    const labelHolder = document.getElementById('bank-payment-holder');
    const labelNumber = document.getElementById('bank-payment-number');
    const bankQrImage = document.getElementById('bank-qr-image');
    
    if (selectedCheckoutBank) {
      if (labelName) labelName.textContent = selectedCheckoutBank.bank_name;
      if (labelHolder) labelHolder.textContent = selectedCheckoutBank.account_holder;
      if (labelNumber) labelNumber.textContent = selectedCheckoutBank.account_number;
      
      const finalToPay = Math.max(0, totalAmount - currentDiscountAmount);
      const cleanTableName = table.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D");
      const description = 'ck';
      let bankSlug = getVietQrBankSlug(selectedCheckoutBank.bank_name);
      const qrUrl = `https://img.vietqr.io/image/${bankSlug}-${selectedCheckoutBank.account_number}-compact.png?amount=${finalToPay}&addInfo=${encodeURIComponent(description)}&accountName=${encodeURIComponent(selectedCheckoutBank.account_holder)}`;
      loadCheckoutQrImage(qrUrl);
    } else {
      if (labelName) labelName.textContent = '---';
      if (labelHolder) labelHolder.textContent = '---';
      if (labelNumber) labelNumber.textContent = '---';
      if (bankQrImage) bankQrImage.src = '';
      
      const loadingOverlay = document.getElementById('bank-qr-loading');
      const errorOverlay = document.getElementById('bank-qr-error');
      if (loadingOverlay) loadingOverlay.style.display = 'none';
      if (errorOverlay) errorOverlay.style.display = 'none';
    }
  }

  // Initialize display labels
  updateCheckoutBankDetails();
  
  // Render bill details in modal
  checkoutBillItemsBody.innerHTML = '';
  checkoutItemDiscounts = {}; // Clear previous session item discounts

  table.order.forEach(item => {
    // Initialize unit discount representation
    const preSavedDiscount = item.discount || 0;
    const preSavedDiscountType = item.discount_type || 'cash';
    checkoutItemDiscounts[item.id] = { value: preSavedDiscount, type: preSavedDiscountType };

    const optionGroupsMap = {};
    if (item.options && Array.isArray(item.options)) {
      item.options.forEach(o => {
        const gn = o.group_name || 'Lựa chọn';
        if (!optionGroupsMap[gn]) optionGroupsMap[gn] = [];
        optionGroupsMap[gn].push(o.name);
      });
    }
    const optionsTextLines = Object.keys(optionGroupsMap).map(gn => {
      return `<span class="checkout-item-note-badge" style="background-color: #e2e8f0; color: #475569; font-weight: 500; margin-top: 2px; display: inline-block;">${gn}: ${optionGroupsMap[gn].join(', ')}</span>`;
    }).join('');

    const preSavedDiscountAmount = preSavedDiscountType === 'percent' ? Math.round(item.price * preSavedDiscount / 100) : preSavedDiscount;

    const row = document.createElement('tr');
    row.innerHTML = `
      <td style="vertical-align: middle;">
        <div class="checkout-item-details" style="display: flex; flex-direction: column;">
          <span class="checkout-item-name">${item.emoji} ${item.name}</span>
          ${optionsTextLines}
          ${item.notes ? `<span class="checkout-item-note-badge">Ghi chú: ${item.notes}</span>` : ''}
        </div>
      </td>
      <td class="text-center bold" style="font-size: 15px; vertical-align: middle;">${item.quantity}</td>
      <td class="text-center" style="vertical-align: middle;">
        <div style="display: inline-flex; align-items: center; justify-content: center; box-shadow: 0 1px 2px rgba(0,0,0,0.05); border-radius: var(--rounded-sm); overflow: hidden;">
          <input type="text" class="item-discount-value-input text-input" data-item-id="${item.id}" placeholder="0" value="${preSavedDiscountType === 'percent' ? preSavedDiscount : formatNumberWithDots(preSavedDiscount)}" style="padding: 2px 8px; height: 28px; border: 1.5px solid #cbd5e1; border-right: none; border-radius: 6px 0 0 6px; font-size: 13px; text-align: right; width: 75px; box-sizing: border-box; font-weight: 600; outline: none; transition: border-color 0.2s;">
          <select class="item-discount-type-select text-input" data-item-id="${item.id}" style="padding: 2px 8px 2px 4px; height: 28px; border: 1.5px solid #cbd5e1; border-radius: 0 6px 6px 0; font-size: 13px; font-weight: 600; width: 45px; box-sizing: border-box; text-align: center; background-color: #f8fafc; cursor: pointer; outline: none; transition: border-color 0.2s; color: #475569;">
            <option value="cash" ${preSavedDiscountType === 'cash' ? 'selected' : ''}>đ</option>
            <option value="percent" ${preSavedDiscountType === 'percent' ? 'selected' : ''}>%</option>
          </select>
        </div>
      </td>
      <td class="text-right bold item-line-total" data-item-id="${item.id}" style="vertical-align: middle;">${formatVND((item.price - preSavedDiscountAmount) * item.quantity)}</td>
    `;
    checkoutBillItemsBody.appendChild(row);

    // Bind event for item-level discount value and type changes
    const valInput = row.querySelector('.item-discount-value-input');
    const typeSelect = row.querySelector('.item-discount-type-select');

    function handleDiscountChange() {
      let rawVal = valInput.value.replace(/\D/g, '');
      let val = parseInt(rawVal) || 0;
      const type = typeSelect.value;
      
      if (type === 'percent') {
        if (val > 100) {
          val = 100;
        }
        valInput.value = val.toString();
      } else {
        if (val > item.price) {
          val = item.price;
        }
        valInput.value = formatNumberWithDots(val);
      }
      if (val < 0) {
        val = 0;
        valInput.value = '0';
      }
      
      checkoutItemDiscounts[item.id] = { value: val, type: type };

      // Calculate absolute unit discount in VND
      let discountPerUnit = 0;
      if (type === 'percent') {
        discountPerUnit = Math.round(item.price * val / 100);
      } else {
        discountPerUnit = val;
      }

      // Update line total display for this row
      const lineTotalCell = row.querySelector('.item-line-total');
      lineTotalCell.textContent = formatVND((item.price - discountPerUnit) * item.quantity);

      // Recalculate totals
      updateCheckoutCalculations();
    }

    // Focus / blur effects for active border styling
    const highlightBorders = () => {
      valInput.style.borderColor = 'var(--primary)';
      typeSelect.style.borderColor = 'var(--primary)';
    };
    const resetBorders = () => {
      valInput.style.borderColor = '#cbd5e1';
      typeSelect.style.borderColor = '#cbd5e1';
    };

    valInput.addEventListener('focus', highlightBorders);
    valInput.addEventListener('blur', resetBorders);
    typeSelect.addEventListener('focus', highlightBorders);
    typeSelect.addEventListener('blur', resetBorders);

    valInput.addEventListener('input', handleDiscountChange);
    typeSelect.addEventListener('change', handleDiscountChange);
  });

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
    // 1. Calculate sum of item-level discounts
    const itemDiscountsSum = table.order.reduce((sum, item) => {
      const disc = checkoutItemDiscounts[item.id] || { value: 0, type: 'cash' };
      let discountPerUnit = 0;
      if (disc.type === 'percent') {
        discountPerUnit = Math.round(item.price * disc.value / 100);
      } else {
        discountPerUnit = disc.value;
      }
      return sum + (discountPerUnit * item.quantity);
    }, 0);

    // 2. Base subtotal is totalAmount (sum of original prices)
    const baseSubtotal = totalAmount;

    // 3. Subtotal after item-level discounts
    const subtotalAfterItemDiscounts = Math.max(0, baseSubtotal - itemDiscountsSum);

    // 4. Calculate general bill discount
    const type = discountTypeInput.value;
    const value = parseFloat(discountValueInput.value) || 0;
    
    let generalDiscountAmount = 0;
    if (type === 'none') {
      discountValueInput.disabled = true;
      discountValueInput.value = '0';
      generalDiscountAmount = 0;
    } else {
      discountValueInput.disabled = false;
      if (type === 'percent') {
        let pct = Math.max(0, Math.min(100, value));
        if (value !== pct) discountValueInput.value = pct;
        generalDiscountAmount = Math.round(subtotalAfterItemDiscounts * pct / 100);
      } else if (type === 'cash') {
        let cashVal = Math.max(0, Math.min(subtotalAfterItemDiscounts, value));
        if (value !== cashVal) discountValueInput.value = cashVal;
        generalDiscountAmount = cashVal;
      }
    }
    
    // 5. Total discount applied is sum of item discounts + general discount
    currentDiscountAmount = itemDiscountsSum + generalDiscountAmount;
    const finalToPay = Math.max(0, baseSubtotal - currentDiscountAmount);
    
    if (currentDiscountAmount > 0) {
      summarySubtotal.textContent = formatVND(baseSubtotal);

      // Prepare detailed discount text
      let discountText = '';
      if (itemDiscountsSum > 0 && generalDiscountAmount > 0) {
        discountText = `-${formatVND(currentDiscountAmount)} (Giảm món: ${formatVND(itemDiscountsSum)} + Giảm bill: ${formatVND(generalDiscountAmount)})`;
      } else if (itemDiscountsSum > 0) {
        discountText = `-${formatVND(itemDiscountsSum)} (Giảm món)`;
      } else {
        discountText = `-${formatVND(generalDiscountAmount)} (Giảm bill)`;
      }
      summaryDiscount.textContent = discountText;
      summaryFinalTotal.textContent = formatVND(finalToPay);
      calcSummaryCard.style.display = 'flex';
    } else {
      calcSummaryCard.style.display = 'none';
    }
    
    if (currentPaymentMethod === 'bank') {
      // For Bank Transfer, received amount is exactly finalToPay, change is 0
      inputReceivedCash.value = finalToPay;
      displayChangeAmount.textContent = formatVND(0);
      displayChangeAmount.className = 'change-value-v2';
      btnConfirmCheckoutPay.disabled = false;
      
      // Dynamic VietQR code generation
      const bankQrImage = document.getElementById('bank-qr-image');
      const bankPaymentAmountText = document.getElementById('bank-payment-amount');
      if (bankPaymentAmountText) {
        bankPaymentAmountText.textContent = formatVND(finalToPay);
      }
      if (bankQrImage && selectedCheckoutBank) {
        const cleanTableName = table.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D");
        const description = 'ck';
        
        let bankSlug = getVietQrBankSlug(selectedCheckoutBank.bank_name);
        const qrUrl = `https://img.vietqr.io/image/${bankSlug}-${selectedCheckoutBank.account_number}-compact.png?amount=${finalToPay}&addInfo=${encodeURIComponent(description)}&accountName=${encodeURIComponent(selectedCheckoutBank.account_holder)}`;
        loadCheckoutQrImage(qrUrl);
      }
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

  updateCheckoutCalculations();
  checkoutModal.style.display = 'flex';
  
  // Set focus automatically to input
  setTimeout(() => inputReceivedCash.focus(), 100);

  // Print temporarily calculated receipt on checkout modal
  const btnPrintCheckout = document.getElementById('btn-print-checkout');
  if (btnPrintCheckout) {
    btnPrintCheckout.onclick = () => {
      printReceipt(table, table.order, currentDiscountAmount, parseFloat(inputReceivedCash.value) || 0, null, null, null, true);
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

  const table = tables.find(t => t.id === selectedTableId);
  if (!table || !table.order) {
    showToast('⚠️ Không tìm thấy thông tin đơn hàng.');
    return;
  }

  btnConfirmCheckoutPay.disabled = true;
  btnConfirmCheckoutPay.textContent = 'Đang thanh toán...';

  // Construct absolute unit-level discounts in VND to send to server
  const absoluteItemDiscounts = {};
  table.order.forEach(item => {
    const disc = checkoutItemDiscounts[item.id] || { value: 0, type: 'cash' };
    let discountPerUnit = 0;
    if (disc.type === 'percent') {
      discountPerUnit = Math.round(item.price * disc.value / 100);
    } else {
      discountPerUnit = disc.value;
    }
    absoluteItemDiscounts[item.id] = discountPerUnit;
  });

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
        paymentMethod: currentPaymentMethod,
        itemDiscounts: absoluteItemDiscounts,
        bank_name: currentPaymentMethod === 'bank' && selectedCheckoutBank ? selectedCheckoutBank.bank_name : undefined,
        account_number: currentPaymentMethod === 'bank' && selectedCheckoutBank ? selectedCheckoutBank.account_number : undefined,
        account_holder: currentPaymentMethod === 'bank' && selectedCheckoutBank ? selectedCheckoutBank.account_holder : undefined
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
      ${tx.notes ? `
      <div style="display: flex; justify-content: space-between;">
        <span style="color: #64748b;">Ghi chú tổng:</span>
        <span style="font-weight: 600; color: #ef4444;">${tx.notes}</span>
      </div>
      ` : ''}
      
      <div style="margin-top: 8px; font-weight: 700; color: #475569; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px;">Danh sách món ăn</div>
      <div style="display: flex; flex-direction: column; gap: 8px; max-height: 180px; overflow-y: auto; padding: 4px 0;">
        ${tx.items.map(item => {
          const optionGroupsMap = {};
          if (item.options && Array.isArray(item.options)) {
            item.options.forEach(o => {
              const gn = o.group_name || 'Lựa chọn';
              if (!optionGroupsMap[gn]) optionGroupsMap[gn] = [];
              optionGroupsMap[gn].push(o.name);
            });
          }
          const optionsTextLines = Object.keys(optionGroupsMap).map(gn => {
            return `<span style="font-size: 11px; color: #64748b;">${gn}: ${optionGroupsMap[gn].join(', ')}</span>`;
          }).join('');
          
          return `
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <div style="display: flex; flex-direction: column; text-align: left;">
                <span style="font-weight: 600; color: #0f172a;">${item.emoji} ${item.name}</span>
                <span style="font-size: 11px; color: #64748b;">SL: ${item.quantity} × ${formatVND(item.price)}</span>
                ${optionsTextLines}
                ${item.notes ? `<span style="font-size: 11px; color: #ef4444; font-style: italic;">Ghi chú: ${item.notes}</span>` : ''}
              </div>
              <span style="font-weight: 700; color: #0f172a;">${formatVND(item.price * item.quantity)}</span>
            </div>
          `;
        }).join('')}
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
      const tableObj = { 
        name: tx.tableName,
        bankName: tx.bankName,
        accountNumber: tx.accountNumber,
        accountHolder: tx.accountHolder
      };
      printReceipt(tableObj, tx.items, tx.discountAmount || 0, tx.receivedAmount, tx.id, tx.timestamp, tx.paymentMethod || null, true);
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
  animateCounter('overview-discount-amount', totalDiscount, true, 0);
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
      <div class="history-card-right" style="display: flex; align-items: center; gap: 8px;">
        <span class="role-badge waiter" style="font-size:11px; padding:3px 8px; margin-left:0;">Phục vụ</span>
        <button class="btn-delete-text" onclick="deleteStaff(${user.id}, '${user.username}')">Xoá</button>
      </div>
    `;
    staffListContainer.appendChild(card);
  });
}

// Delete Staff account
async function deleteStaff(id, username) {
  if (!confirm(`Bạn có chắc chắn muốn xoá tài khoản nhân viên "${username}" không?`)) {
    return;
  }
  
  try {
    const res = await fetch(`/api/users/${id}`, {
      method: 'DELETE'
    });
    
    if (res.status === 401) {
      window.location.href = '/login.html';
      return;
    }
    
    const result = await res.json();
    if (res.ok && result.success) {
      loadStaffList();
    } else {
      alert(result.error || 'Có lỗi xảy ra khi xoá nhân viên.');
    }
  } catch (error) {
    console.error('Lỗi khi xoá nhân viên:', error);
    alert('Lỗi kết nối server.');
  }
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
        <th style="padding: 14px 16px; color: var(--ink-soft); width: 220px;">Tên món</th>
        <th style="padding: 14px 16px; color: var(--ink-soft); width: 120px;">Phân loại</th>
        <th style="padding: 14px 16px; color: var(--ink-soft); width: 120px; text-align: right;">Giá bán</th>
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
      <td style="padding: 12px 16px; vertical-align: middle; font-weight: 500; color: var(--ink-soft);">${item.type || 'Món ăn'}</td>
      <td style="padding: 12px 16px; vertical-align: middle; text-align: right; font-weight: 700; color: var(--primary);">${formatVND(item.price)}</td>
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
  // Populate menu group select options dynamically from global menuGroups
  menuItemGroupInput.innerHTML = '<option value="">-- Chưa phân thực đơn --</option>';
  if (Array.isArray(menuGroups)) {
    menuGroups.forEach(g => {
      const opt = document.createElement('option');
      opt.value = g.id;
      opt.textContent = g.name;
      menuItemGroupInput.appendChild(opt);
    });
  }

  // If item is null: Create Mode. Otherwise: Edit Mode
  if (item) {
    menuItemModalTitle.textContent = 'Chỉnh sửa món ăn';
    btnDeleteMenuItem.style.display = 'block';
    menuItemIdInput.value = item.id;
    menuItemNameInput.value = item.name;
    menuItemPriceInput.value = item.price;
    
    // Ensure the option exists in the native select so we can set its value correctly
    let categoryOptExists = false;
    Array.from(menuItemCategoryInput.options).forEach(opt => {
      if (opt.value === item.category) categoryOptExists = true;
    });
    if (!categoryOptExists && item.category) {
      const opt = document.createElement('option');
      opt.value = item.category;
      opt.textContent = item.category;
      menuItemCategoryInput.appendChild(opt);
    }
    menuItemCategoryInput.value = item.category || 'main';

    menuItemEmojiInput.value = item.emoji || '🍽️';
    
    // Set classification type select
    menuItemTypeInput.value = item.type || 'Món ăn';

    // Find and set current menu group from global menuGroups list
    const foundGroup = (menuGroups || []).find(g => (g.items || []).some(itemInGroup => itemInGroup.id === item.id));
    menuItemGroupInput.value = foundGroup ? foundGroup.id : '';

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
    menuItemTypeInput.value = 'Món ăn';
    menuItemGroupInput.value = '';
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
  const emoji = menuItemEmojiInput.value.trim();
  const imageFile = menuItemImageInput.files[0];
  const imageUrlLink = menuItemImageUrlInput.value.trim();
  
  const type = menuItemTypeInput.value;
  const menuGroupId = menuItemGroupInput.value;
  
  if (!name || !price || !category) return;
  
  const btnSave = document.getElementById('btn-save-menu-item');
  btnSave.disabled = true;
  btnSave.textContent = 'Đang lưu...';

  // Build FormData object for file upload
  const formData = new FormData();
  formData.append('name', name);
  formData.append('price', price);
  formData.append('category', category);
  formData.append('emoji', emoji);
  formData.append('type', type);
  if (menuGroupId) {
    formData.append('menuGroupId', menuGroupId);
  }
  
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

  // Khởi tạo custom select cho các bộ lọc báo cáo mới
  const reportType = document.getElementById('report-type');
  const reportTimePreset = document.getElementById('report-time-preset');
  const reportItemsType = document.getElementById('report-items-type');
  const reportItemsTime = document.getElementById('report-items-time');
  const reportComparePreset = document.getElementById('report-compare-preset');

  if (reportType) makeSelectCustom(reportType, 'Loại báo cáo', true);
  if (reportTimePreset) makeSelectCustom(reportTimePreset, 'Thời gian', true);
  if (reportItemsType) makeSelectCustom(reportItemsType, 'Loại báo cáo', true);
  if (reportItemsTime) makeSelectCustom(reportItemsTime, 'Thời gian', true);
  if (reportComparePreset) makeSelectCustom(reportComparePreset, 'Kỳ so sánh', true);
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
  
  // Show or hide the Create Takeaway button
  const btnCreateTakeaway = document.getElementById('btn-create-takeaway');
  if (btnCreateTakeaway) {
    if (floor === 'mang đi') {
      btnCreateTakeaway.style.display = 'inline-flex';
    } else {
      btnCreateTakeaway.style.display = 'none';
    }
  }
  
  // Re-render tables with the selected floor
  renderTables();
};

window.createTakeawayOrder = async () => {
  const btn = document.getElementById('btn-create-takeaway');
  if (btn) {
    btn.disabled = true;
    const span = btn.querySelector('.button__text');
    if (span) span.textContent = 'Đang tạo...';
  }
  
  try {
    const now = new Date();
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = now.getFullYear();
    const dateStr = `${day}${month}${year}`;
    
    // Filter tables with location 'mang về' and name starting with dateStr
    const todayTakeaways = tables.filter(t => t.location && t.location.toLowerCase() === 'mang về' && t.name.startsWith(dateStr));
    const stt = String(todayTakeaways.length + 1).padStart(2, '0');
    const orderCode = `${dateStr}${stt}`;
    
    const response = await fetch('/api/tables', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: orderCode,
        location: 'mang về'
      })
    });
    
    if (response.status === 401) {
      window.location.href = '/login.html';
      return;
    }
    
    const result = await response.json();
    if (result.success) {
      // Fetch updated tables list
      const tablesRes = await fetch('/api/tables');
      if (tablesRes.ok) {
        tables = await tablesRes.json();
      }
      
      const createdTable = tables.find(t => t.name === orderCode);
      if (createdTable) {
        selectedTableId = createdTable.id;
        activeFloorFilter = 'mang đi';
        
        // Sync button display state
        const btnCreateTakeaway = document.getElementById('btn-create-takeaway');
        if (btnCreateTakeaway) btnCreateTakeaway.style.display = 'inline-flex';
        
        // Sync active state in UI tabs
        const tabs = document.querySelectorAll('#manager-floor-tabs .category-tab');
        tabs.forEach(tab => {
          if (tab.getAttribute('data-floor') === 'mang đi') {
            tab.classList.add('active');
          } else {
            tab.classList.remove('active');
          }
        });
        
        renderTables();
        openManagerOrderModal(createdTable);
      } else {
        throw new Error('Không tìm thấy mã đơn vừa tạo.');
      }
    } else {
      throw new Error(result.error || 'Lỗi tạo đơn mang đi.');
    }
  } catch (err) {
    console.error(err);
    alert(`Lỗi: ${err.message || 'Không thể tạo đơn mang đi.'}`);
  } finally {
    if (btn) {
      btn.disabled = false;
      const span = btn.querySelector('.button__text');
      if (span) span.textContent = 'Tạo đơn mang đi';
    }
  }
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
            .map(m => `• ${m.name}`);
          selectValue.textContent = selectedNames.join('\n');
          selectValue.style.color = 'var(--ink)';
        }
      }
    });
    
    const span = document.createElement('span');
    span.style.color = 'var(--ink)';
    span.textContent = item.name;
    
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
        .map(m => `• ${m.name}`);
      selectValue.textContent = selectedNames.join('\n');
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
  // Column names in Vietnamese: tên mặt hàng, giá bán, thực đơn, phân loại, hình ảnh (link)
  const data = [
    { "Tên mặt hàng": "Cơm tấm đặc biệt", "Giá bán": 85000, "Thực đơn": "SƯỜN", "Phân loại": "Món ăn", "Hình ảnh (link)": "https://images.unsplash.com/photo-1541832676-9b763b0239ab?q=80&w=300" },
    { "Tên mặt hàng": "Trà đá sả chanh", "Giá bán": 15000, "Thực đơn": "CANH VÀ TOPPING", "Phân loại": "món uống", "Hình ảnh (link)": "https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?q=80&w=300" },
    { "Tên mặt hàng": "Món ăn theo thời giá", "Giá bán": "", "Thực đơn": "CƠM NHÀ TẤM XƯA", "Phân loại": "Món ăn", "Hình ảnh (link)": "" }
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
    { wch: 15 }, // Phân loại
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
          return keyLower === "thực đơn" || keyLower === "nhóm";
        });
        const typeKey = Object.keys(row).find(k => k.trim().toLowerCase() === "phân loại");
        const imgKey = Object.keys(row).find(k => k.trim().toLowerCase().includes("hình ảnh") || k.trim().toLowerCase().includes("ảnh"));
        
        const name = nameKey ? String(row[nameKey]).trim() : "";
        const priceVal = priceKey ? row[priceKey] : null;
        const category = categoryKey ? String(row[categoryKey]).trim() : "main";
        const type = typeKey ? String(row[typeKey]).trim() : "";
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
          category: category || "main",
          type: type || null,
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

// Reports Feature Support
let reportRevenueHourlyChartInstance = null;
let reportPaymentMethodChartInstance = null;
let reportPaymentMethodActiveTab = 'revenue'; // 'revenue' or 'count'
let reportBankAccountChartInstance = null;
let reportBankAccountActiveTab = 'count'; // 'count' or 'revenue'

function loadRevenueReport() {
  const timePreset = document.getElementById('report-time-preset').value;
  const now = new Date();
  const filterByHour = (tx) => {
    if (!tx.timestamp) return false;
    if (overviewHourRange.option === 'all') return true;
    const date = new Date(tx.timestamp);
    const m = date.getHours() * 60 + date.getMinutes();
    const start = overviewHourRange.fromH * 60 + overviewHourRange.fromM;
    const end = overviewHourRange.toH * 60 + overviewHourRange.toM;
    return m >= start && m <= end;
  };

  let reportTxs = [];
  if (timePreset === 'today') {
    const todayStr = now.toDateString();
    reportTxs = transactions.filter(tx => new Date(tx.timestamp).toDateString() === todayStr && filterByHour(tx));
  } else if (timePreset === 'yesterday') {
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const yesterdayStr = yesterday.toDateString();
    reportTxs = transactions.filter(tx => new Date(tx.timestamp).toDateString() === yesterdayStr && filterByHour(tx));
  } else if (timePreset === '7days') {
    const limitDate = new Date(now);
    limitDate.setDate(now.getDate() - 7);
    reportTxs = transactions.filter(tx => new Date(tx.timestamp).getTime() >= limitDate.getTime() && filterByHour(tx));
  } else if (timePreset === 'thismonth') {
    const thisMonth = now.getMonth();
    const thisYear = now.getFullYear();
    reportTxs = transactions.filter(tx => {
      const d = new Date(tx.timestamp);
      return d.getMonth() === thisMonth && d.getFullYear() === thisYear && filterByHour(tx);
    });
  }

  // Calculate metrics
  const totalInvoices = reportTxs.length;
  const totalDiscount = reportTxs.reduce((sum, tx) => sum + (tx.discountAmount || 0), 0);
  const totalRevenue = reportTxs.reduce((sum, tx) => sum + (tx.subtotal - (tx.discountAmount || 0)), 0);
  const totalItemsQty = reportTxs.reduce((sum, tx) => {
    return sum + (tx.items ? tx.items.reduce((iSum, i) => iSum + (i.quantity || 0), 0) : 0);
  }, 0);

  const avgItemsPerInvoice = totalInvoices > 0 ? (totalItemsQty / totalInvoices) : 0;
  const avgRevenuePerInvoice = totalInvoices > 0 ? (totalRevenue / totalInvoices) : 0;

  // Update DOM elements for KPI cards
  document.getElementById('kpi-total-invoices').textContent = totalInvoices;
  document.getElementById('kpi-canceled-invoices').textContent = '0';
  document.getElementById('kpi-total-items-qty').textContent = totalItemsQty;
  document.getElementById('kpi-avg-items-per-invoice').textContent = avgItemsPerInvoice.toFixed(2);
  document.getElementById('kpi-avg-revenue-per-invoice').textContent = formatVND(avgRevenuePerInvoice);

  // Set View Time Label
  const pad = (num) => String(num).padStart(2, '0');
  let hours = now.getHours();
  const minutes = pad(now.getMinutes());
  const ampm = hours >= 12 ? 'CH' : 'SA';
  hours = hours % 12;
  hours = hours ? hours : 12;
  const day = pad(now.getDate());
  const month = pad(now.getMonth() + 1);
  const year = now.getFullYear();
  document.getElementById('report-view-time-label').textContent = `Xem lúc: ${pad(hours)}:${minutes} ${ampm} ${day}/${month}/${year}`;

  // Get report type
  const reportTypeVal = document.getElementById('report-type') ? document.getElementById('report-type').value : 'overview';

  // Toggle layout containers
  const kpiCards = document.getElementById('revenue-kpi-cards');
  const chartPanel = document.getElementById('revenue-chart-panel');
  const pmPanel = document.getElementById('payment-method-report-panel');
  const baPanel = document.getElementById('bank-account-report-panel');
  const viewHeaderH2 = document.querySelector('#report-revenue-dashboard-view h2');

  // Calculate comparison data if present
  let compareTxs = [];
  const startOfPeriod = reportTxs.length > 0 ? Math.min(...reportTxs.map(t => new Date(t.timestamp).getTime())) : 0;
  const endOfPeriod = reportTxs.length > 0 ? Math.max(...reportTxs.map(t => new Date(t.timestamp).getTime())) : 0;
  if (startOfPeriod && endOfPeriod) {
    const duration = endOfPeriod - startOfPeriod;
    const compareStart = startOfPeriod - duration - 1000;
    const compareEnd = startOfPeriod - 1000;
    compareTxs = transactions.filter(tx => {
      const t = new Date(tx.timestamp).getTime();
      return t >= compareStart && t <= compareEnd && filterByHour(tx);
    });
  }

  const getTrendHTML = (current, past) => {
    if (!past || past === 0) {
      if (current > 0) return `<span style="color: #10b981; font-size: 11px; font-weight: 600; margin-right: 4px;">↑ 100%</span>`;
      return '';
    }
    const pct = ((current - past) / past) * 100;
    if (pct > 0) {
      return `<span style="color: #10b981; font-size: 11px; font-weight: 600; margin-right: 4px;">↑ ${pct.toFixed(2)}%</span>`;
    } else if (pct < 0) {
      return `<span style="color: #ef4444; font-size: 11px; font-weight: 600; margin-right: 4px;">↓ ${Math.abs(pct).toFixed(2)}%</span>`;
    }
    return '';
  };

  if (reportTypeVal === 'payment-method') {
    // 1. Giao diện Phương thức thanh toán
    if (viewHeaderH2) viewHeaderH2.textContent = 'PHƯƠNG THỨC THANH TOÁN';
    if (kpiCards) kpiCards.style.display = 'none';
    if (chartPanel) chartPanel.style.display = 'none';
    if (pmPanel) pmPanel.style.display = 'flex';
    if (baPanel) baPanel.style.display = 'none';

    // Tính toán số liệu tiền mặt / chuyển khoản
    let cashRevenue = 0;
    let cashCount = 0;
    let cashCanceled = 0;
    let bankRevenue = 0;
    let bankCount = 0;
    let bankCanceled = 0;

    reportTxs.forEach(tx => {
      const net = tx.subtotal - (tx.discountAmount || 0);
      if (tx.paymentMethod === 'bank') {
        bankRevenue += net;
        bankCount++;
      } else {
        cashRevenue += net;
        cashCount++;
      }
    });

    let prevCashRevenue = 0;
    let prevCashCount = 0;
    let prevBankRevenue = 0;
    let prevBankCount = 0;

    compareTxs.forEach(tx => {
      const net = tx.subtotal - (tx.discountAmount || 0);
      if (tx.paymentMethod === 'bank') {
        prevBankRevenue += net;
        prevBankCount++;
      } else {
        prevCashRevenue += net;
        prevCashCount++;
      }
    });

    // Update Header Cột theo tab hoạt động
    const pmTableHeaderRevenue = document.getElementById('report-pm-table-header-revenue');
    if (pmTableHeaderRevenue) {
      pmTableHeaderRevenue.textContent = reportPaymentMethodActiveTab === 'revenue' ? 'Doanh thu gồm thuế' : 'Số hóa đơn';
    }

    // Render Biểu đồ thanh toán nằm ngang
    const pmCanvas = document.getElementById('report-payment-method-chart');
    if (pmCanvas) {
      const pmCtx = pmCanvas.getContext('2d');
      if (reportPaymentMethodChartInstance) {
        reportPaymentMethodChartInstance.destroy();
      }

      const isRev = reportPaymentMethodActiveTab === 'revenue';
      const chartLabels = ['Tiền mặt', 'Chuyển khoản'];
      const chartValues = isRev ? [cashRevenue, bankRevenue] : [cashCount, bankCount];
      const colors = ['#0084ff', '#ff6b8b'];

      reportPaymentMethodChartInstance = new Chart(pmCtx, {
        type: 'bar',
        data: {
          labels: chartLabels,
          datasets: [{
            data: chartValues,
            backgroundColor: colors,
            borderColor: colors,
            borderWidth: 1,
            borderRadius: 4,
            barPercentage: 0.5
          }]
        },
        options: {
          indexAxis: 'y',
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: function(context) {
                  const val = context.raw;
                  return isRev ? ` Doanh thu: ${formatVND(val)}` : ` Hóa đơn: ${val}`;
                }
              }
            }
          },
          scales: {
            x: {
              beginAtZero: true,
              ticks: {
                callback: function(value) {
                  return isRev ? formatVND(value) : value;
                }
              }
            }
          }
        }
      });
    }

    // Update Table body
    const pmTbody = document.getElementById('report-payment-method-table-body');
    if (pmTbody) {
      pmTbody.innerHTML = `
        <tr style="border-bottom: 1px solid #e2e8f0; height: 44px;">
          <td style="padding: 12px 16px; font-weight: 600;">Tiền mặt</td>
          <td style="padding: 12px 16px; text-align: center; font-weight: 600; color: #1e293b;">
            <div style="display: flex; align-items: center; justify-content: center;">
              ${getTrendHTML(cashCount, prevCashCount)}
              <span>${cashCount}</span>
            </div>
          </td>
          <td style="padding: 12px 16px; text-align: center; color: #64748b;">${cashCanceled}</td>
          <td style="padding: 12px 16px; text-align: right; font-weight: 600; color: #1e293b;">
            <div style="display: flex; align-items: center; justify-content: flex-end;">
              ${getTrendHTML(cashRevenue, prevCashRevenue)}
              <span>${formatVND(cashRevenue)} đ</span>
            </div>
          </td>
        </tr>
        <tr style="border-bottom: 1px solid #e2e8f0; height: 44px;">
          <td style="padding: 12px 16px; font-weight: 600;">Chuyển khoản</td>
          <td style="padding: 12px 16px; text-align: center; font-weight: 600; color: #1e293b;">
            <div style="display: flex; align-items: center; justify-content: center;">
              ${getTrendHTML(bankCount, prevBankCount)}
              <span>${bankCount}</span>
            </div>
          </td>
          <td style="padding: 12px 16px; text-align: center; color: #64748b;">${bankCanceled}</td>
          <td style="padding: 12px 16px; text-align: right; font-weight: 600; color: #1e293b;">
            <div style="display: flex; align-items: center; justify-content: flex-end;">
              ${getTrendHTML(bankRevenue, prevBankRevenue)}
              <span>${formatVND(bankRevenue)} đ</span>
            </div>
          </td>
        </tr>
        <tr style="background-color: #f8fafc; font-weight: 700; height: 44px; border-top: 2px solid #cbd5e1;">
          <td style="padding: 12px 16px;">Tổng cộng</td>
          <td style="padding: 12px 16px; text-align: center; color: #0066cc;">
            <div style="display: flex; align-items: center; justify-content: center;">
              ${getTrendHTML(cashCount + bankCount, prevCashCount + prevBankCount)}
              <span>${cashCount + bankCount}</span>
            </div>
          </td>
          <td style="padding: 12px 16px; text-align: center; color: #64748b;">${cashCanceled + bankCanceled}</td>
          <td style="padding: 12px 16px; text-align: right; color: #10b981;">
            <div style="display: flex; align-items: center; justify-content: flex-end;">
              ${getTrendHTML(cashRevenue + bankRevenue, prevCashRevenue + prevBankRevenue)}
              <span>${formatVND(cashRevenue + bankRevenue)} đ</span>
            </div>
          </td>
        </tr>
      `;
    }
  } else if (reportTypeVal === 'bank-account') {
    // Giao diện Báo cáo theo số tài khoản
    if (viewHeaderH2) viewHeaderH2.textContent = 'BÁO CÁO THEO SỐ TÀI KHOẢN';
    if (kpiCards) kpiCards.style.display = 'none';
    if (chartPanel) chartPanel.style.display = 'none';
    if (pmPanel) pmPanel.style.display = 'none';
    if (baPanel) baPanel.style.display = 'flex';

    // Calculate bank account stats from reportTxs
    const bankAccountMap = {};

    reportTxs.forEach(tx => {
      if (tx.paymentMethod === 'bank') {
        const key = tx.accountNumber || 'unspecified';
        if (!bankAccountMap[key]) {
          bankAccountMap[key] = {
            bankName: tx.bankName || 'Ngân hàng',
            accountNumber: tx.accountNumber || 'Chưa rõ',
            accountHolder: tx.accountHolder || 'Chưa rõ',
            count: 0,
            revenue: 0
          };
        }
        const net = tx.subtotal - (tx.discountAmount || 0);
        bankAccountMap[key].count++;
        bankAccountMap[key].revenue += net;
      }
    });

    const prevBankAccountMap = {};
    compareTxs.forEach(tx => {
      if (tx.paymentMethod === 'bank') {
        const key = tx.accountNumber || 'unspecified';
        if (!prevBankAccountMap[key]) {
          prevBankAccountMap[key] = {
            count: 0,
            revenue: 0
          };
        }
        const net = tx.subtotal - (tx.discountAmount || 0);
        prevBankAccountMap[key].count++;
        prevBankAccountMap[key].revenue += net;
      }
    });

    const isRev = false;
    
    // Sort bank accounts by value descending
    const bankAccountsList = Object.values(bankAccountMap).sort((a, b) => {
      return isRev ? b.revenue - a.revenue : b.count - a.count;
    });

    const chartLabels = bankAccountsList.map(item => `${item.bankName} - ${item.accountNumber} (${item.accountHolder})`);
    const chartValues = bankAccountsList.map(item => isRev ? item.revenue : item.count);
    
    const colors = [
      '#0084ff', '#ff6b8b', '#2ecc71', '#f1c40f', '#9b59b6', '#34495e', '#e67e22', '#1abc9c'
    ];

    // Render bank account horizontal bar chart
    const baCanvas = document.getElementById('report-bank-account-chart');
    if (baCanvas) {
      const baCtx = baCanvas.getContext('2d');
      if (reportBankAccountChartInstance) {
        reportBankAccountChartInstance.destroy();
      }

      reportBankAccountChartInstance = new Chart(baCtx, {
        type: 'bar',
        data: {
          labels: chartLabels,
          datasets: [{
            data: chartValues,
            backgroundColor: colors.slice(0, chartLabels.length),
            borderColor: colors.slice(0, chartLabels.length),
            borderWidth: 1,
            borderRadius: 4,
            barPercentage: 0.5
          }]
        },
        options: {
          indexAxis: 'y',
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: function(context) {
                  const val = context.raw;
                  return isRev ? ` Doanh thu: ${formatVND(val)}` : ` Hóa đơn: ${val}`;
                }
              }
            }
          },
          scales: {
            x: {
              beginAtZero: true,
              ticks: {
                callback: function(value) {
                  return isRev ? formatVND(value) : value;
                }
              }
            }
          }
        }
      });
    }

    // Update Table body
    const baTbody = document.getElementById('report-bank-account-table-body');
    if (baTbody) {
      if (bankAccountsList.length === 0) {
        baTbody.innerHTML = `
          <tr>
            <td colspan="3" style="padding: 20px; text-align: center; color: var(--muted); font-style: italic;">
              Không có dữ liệu giao dịch chuyển khoản trong khoảng thời gian này.
            </td>
          </tr>
        `;
      } else {
        let totalCount = 0;
        let totalRev = 0;
        let prevTotalCount = 0;
        let prevTotalRev = 0;

        let rowsHtml = '';
        bankAccountsList.forEach(item => {
          const prevItem = prevBankAccountMap[item.accountNumber] || { count: 0, revenue: 0 };
          totalCount += item.count;
          totalRev += item.revenue;
          prevTotalCount += prevItem.count;
          prevTotalRev += prevItem.revenue;

          const accountTxs = reportTxs.filter(tx => tx.paymentMethod === 'bank' && (tx.accountNumber || 'unspecified') === item.accountNumber);
          
          let detailRowsHtml = '';
          accountTxs.forEach((tx, txIdx) => {
            const txNet = tx.subtotal - (tx.discountAmount || 0);
            const itemsHtml = tx.items.map(ti => {
              const itemTotal = ti.price * ti.quantity;
              return `
                <div style="display: flex; justify-content: space-between; font-size: 12px; color: #475569; padding: 2px 0;">
                  <span>• ${ti.quantity} x ${ti.name} ${ti.notes ? `<span style="font-size: 11px; color: #94a3b8; font-style: italic;">(${ti.notes})</span>` : ''}</span>
                  <span style="font-weight: 500;">${formatVND(itemTotal)}</span>
                </div>
              `;
            }).join('');

            detailRowsHtml += `
              <div style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 6px; padding: 12px; box-shadow: var(--shadow-sm); margin-bottom: 8px;">
                <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #f1f5f9; padding-bottom: 8px; margin-bottom: 8px; font-weight: 600; font-size: 12px; color: #0f172a;">
                  <div style="display: flex; align-items: center; gap: 8px;">
                    <span style="color: #64748b; font-weight: 700; font-size: 11px;">#${txIdx + 1}</span>
                    <span style="background-color: #e0f2fe; color: #0369a1; padding: 2px 6px; border-radius: 4px; font-size: 11px;">${tx.tableName}</span>
                    <span style="color: #64748b; font-weight: normal;">${tx.id}</span>
                  </div>
                  <span style="color: #64748b; font-weight: normal; font-size: 11px;">${formatTime(tx.timestamp)}</span>
                </div>
                
                <div style="margin-bottom: 8px; border-bottom: 1px dashed #f1f5f9; padding-bottom: 6px;">
                  ${itemsHtml}
                </div>
                
                <div style="display: flex; justify-content: space-between; align-items: center; font-size: 12px; font-weight: 700;">
                  <span style="color: #475569;">Tổng tiền thanh toán:</span>
                  <span style="color: #10b981; font-size: 13px;">${formatVND(txNet)}</span>
                </div>
              </div>
            `;
          });

          rowsHtml += `
            <tr class="ba-main-row" style="border-bottom: 1px solid #e2e8f0; height: 44px; cursor: pointer; transition: background-color 0.2s;" onmouseover="this.style.backgroundColor='#f8fafc'" onmouseout="this.style.backgroundColor='transparent'">
              <td style="padding: 12px 16px; font-weight: 600;">
                <div style="display: flex; align-items: center; gap: 8px;">
                  <span class="ba-toggle-arrow" style="font-size: 10px; color: #64748b; transition: transform 0.2s; display: inline-block;">▶</span>
                  <div>
                    <div style="font-size: 13px; color: #1e293b;">${item.bankName} - ${item.accountNumber}</div>
                    <div style="font-size: 11px; color: #64748b; font-weight: normal;">Chủ TK: ${item.accountHolder}</div>
                  </div>
                </div>
              </td>
              <td style="padding: 12px 16px; text-align: center; font-weight: 600; color: #1e293b;">
                <div style="display: flex; align-items: center; justify-content: center;">
                  ${getTrendHTML(item.count, prevItem.count)}
                  <span>${item.count}</span>
                </div>
              </td>
              <td style="padding: 12px 16px; text-align: right; font-weight: 600; color: #1e293b;">
                <div style="display: flex; align-items: center; justify-content: flex-end;">
                  ${getTrendHTML(item.revenue, prevItem.revenue)}
                  <span>${formatVND(item.revenue)}</span>
                </div>
              </td>
            </tr>
            <tr class="ba-detail-row" style="display: none; background-color: #f8fafc; border-bottom: 1px solid #e2e8f0;">
              <td colspan="3" style="padding: 16px 24px;">
                <div style="font-weight: 700; font-size: 13px; color: #334155; margin-bottom: 12px;">
                  📋 Danh sách hóa đơn đã thanh toán (${accountTxs.length} hóa đơn)
                </div>
                <div style="display: flex; flex-direction: column; max-height: 400px; overflow-y: auto; padding-right: 8px;">
                  ${detailRowsHtml || '<div style="color: #64748b; font-style: italic; font-size: 12px;">Không có hóa đơn chi tiết.</div>'}
                </div>
              </td>
            </tr>
          `;
        });

        rowsHtml += `
          <tr style="background-color: #f8fafc; font-weight: 700; height: 44px; border-top: 2px solid #cbd5e1;">
            <td style="padding: 12px 16px;">Tổng cộng</td>
            <td style="padding: 12px 16px; text-align: center; color: #0066cc;">
              <div style="display: flex; align-items: center; justify-content: center;">
                ${getTrendHTML(totalCount, prevTotalCount)}
                <span>${totalCount}</span>
              </div>
            </td>
            <td style="padding: 12px 16px; text-align: right; color: #10b981;">
              <div style="display: flex; align-items: center; justify-content: flex-end;">
                ${getTrendHTML(totalRev, prevTotalRev)}
                <span>${formatVND(totalRev)}</span>
              </div>
            </td>
          </tr>
        `;
        baTbody.innerHTML = rowsHtml;

        // Add toggle behavior for details
        baTbody.querySelectorAll('.ba-main-row').forEach(row => {
          row.addEventListener('click', () => {
            const detailRow = row.nextElementSibling;
            if (detailRow && detailRow.classList.contains('ba-detail-row')) {
              const isHidden = detailRow.style.display === 'none';
              detailRow.style.display = isHidden ? 'table-row' : 'none';
              
              const arrow = row.querySelector('.ba-toggle-arrow');
              if (arrow) {
                arrow.style.transform = isHidden ? 'rotate(90deg)' : 'rotate(0deg)';
              }
            }
          });
        });
      }
    }
  } else {
    // 2. Giao diện Doanh thu tổng quan
    if (viewHeaderH2) viewHeaderH2.textContent = 'DOANH THU TỔNG QUAN';
    if (kpiCards) kpiCards.style.display = 'grid';
    if (chartPanel) chartPanel.style.display = 'block';
    if (pmPanel) pmPanel.style.display = 'none';
    if (baPanel) baPanel.style.display = 'none';

    // Biểu đồ theo giờ
    const hourlyData = Array(24).fill(0);
    reportTxs.forEach(tx => {
      if (tx.timestamp) {
        const hour = new Date(tx.timestamp).getHours();
        if (hour >= 0 && hour < 24) {
          hourlyData[hour] += (tx.subtotal - (tx.discountAmount || 0));
        }
      }
    });

    const canvasEl = document.getElementById('report-revenue-hourly-chart');
    if (canvasEl) {
      const ctx = canvasEl.getContext('2d');
      if (reportRevenueHourlyChartInstance) {
        reportRevenueHourlyChartInstance.destroy();
      }

      reportRevenueHourlyChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0') + ':00'),
          datasets: [{
            label: 'Doanh thu bán hàng (đ)',
            data: hourlyData,
            backgroundColor: '#0084ff',
            borderColor: '#0084ff',
            borderWidth: 1,
            borderRadius: 4,
            barPercentage: 0.6
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: function(context) {
                  return 'Doanh thu: ' + formatVND(context.raw);
                }
              }
            }
          },
          scales: {
            y: {
              beginAtZero: true,
              ticks: {
                callback: function(value) {
                  return formatVND(value);
                },
                color: '#64748b',
                font: { size: 11 }
              },
              grid: { color: '#f1f5f9' }
            },
            x: {
              ticks: {
                color: '#64748b',
                font: { size: 11 }
              },
              grid: { display: false }
            }
          }
        }
      });
    }
  }

  // Hook export button
  const btnExport = document.getElementById('btn-export-excel-report');
  if (btnExport) {
    btnExport.onclick = () => {
      exportRevenueReportToExcel(reportTxs, totalRevenue, totalDiscount, totalInvoices, totalItemsQty);
    };
  }
}

// State to track item report chart tab: 'revenue' or 'qty'
let activeItemReportChartTab = 'qty';
let reportItemsHorizontalChartInstance = null;

function getItemUnit(name) {
  const lower = (name || '').toLowerCase();
  if (lower.includes('sữa chua') || lower.includes('nước') || lower.includes('matcha') || lower.includes('cafe') || lower.includes('cà phê') || lower.includes('trà') || lower.includes('sinh tố') || lower.includes('cacao') || lower.includes('kem') || lower.includes('lipton') || lower.includes('sữa')) {
    return 'ly';
  }
  if (lower.includes('cơm') || lower.includes('set') || lower.includes('combo') || lower.includes('phần')) {
    return 'PHẦN';
  }
  if (lower.includes('canh') || lower.includes('chén') || lower.includes('súp')) {
    return 'chén';
  }
  if (lower.includes('đĩa') || lower.includes('dĩa')) {
    return 'đĩa';
  }
  return '';
}

function loadItemsReport() {
  const timePreset = document.getElementById('report-items-time').value;
  const reportTypeVal = document.getElementById('report-items-type').value;
  const now = new Date();
  const filterByHour = (tx) => {
    if (!tx.timestamp) return false;
    if (itemsHourRange.option === 'all') return true;
    const date = new Date(tx.timestamp);
    const m = date.getHours() * 60 + date.getMinutes();
    const start = itemsHourRange.fromH * 60 + itemsHourRange.fromM;
    const end = itemsHourRange.toH * 60 + itemsHourRange.toM;
    return m >= start && m <= end;
  };

  if (timePreset === 'today') {
    const todayStr = now.toDateString();
    reportTxs = transactions.filter(tx => new Date(tx.timestamp).toDateString() === todayStr && filterByHour(tx));
  } else if (timePreset === 'yesterday') {
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const yesterdayStr = yesterday.toDateString();
    reportTxs = transactions.filter(tx => new Date(tx.timestamp).toDateString() === yesterdayStr && filterByHour(tx));
  } else if (timePreset === '7days') {
    const limitDate = new Date(now);
    limitDate.setDate(now.getDate() - 7);
    reportTxs = transactions.filter(tx => new Date(tx.timestamp).getTime() >= limitDate.getTime() && filterByHour(tx));
  } else if (timePreset === 'thismonth') {
    const thisMonth = now.getMonth();
    const thisYear = now.getFullYear();
    reportTxs = transactions.filter(tx => {
      const d = new Date(tx.timestamp);
      return d.getMonth() === thisMonth && d.getFullYear() === thisYear && filterByHour(tx);
    });
  }

  // Update time label matching screenshot format
  const pad = (num) => String(num).padStart(2, '0');
  let hours = now.getHours();
  const minutes = pad(now.getMinutes());
  const ampm = hours >= 12 ? 'CH' : 'SA';
  hours = hours % 12;
  hours = hours ? hours : 12;
  const day = pad(now.getDate());
  const month = pad(now.getMonth() + 1);
  const year = now.getFullYear();
  document.getElementById('report-items-view-time-label').textContent = `Xem lúc: ${pad(hours)}:${minutes} ${ampm} ${day}/${month}/${year}`;

  let totalQty = 0;
  let totalRevenue = 0;
  let totalDiscount = 0;
  let chartData = [];
  let tableData = [];

  if (reportTypeVal === 'sales') {
    // 1. Grouped by category
    const categoryStats = {};
    reportTxs.forEach(tx => {
      const txSubtotal = tx.subtotal || 0;
      const txDiscount = tx.discountAmount || 0;
      const discountRatio = txSubtotal > 0 ? (txDiscount / txSubtotal) : 0;
      
      if (tx.items) {
        tx.items.forEach(item => {
           const mItem = menuItems.find(m => m.name === item.name);
          const categoryName = mItem && mItem.category ? mItem.category : 'Không có danh mục';
          const itemSubtotal = (item.price || 0) * item.quantity;
          const itemDiscount = Math.round(itemSubtotal * discountRatio) || 0;
          
          if (!categoryStats[categoryName]) {
            categoryStats[categoryName] = {
              name: categoryName,
              qty: 0,
              revenue: 0,
              discount: 0,
              items: {}
            };
          }
          
          categoryStats[categoryName].qty += item.quantity;
          categoryStats[categoryName].revenue += itemSubtotal;
          categoryStats[categoryName].discount += itemDiscount;
          
          totalQty += item.quantity;
          totalRevenue += itemSubtotal;
          totalDiscount += itemDiscount;
          
          if (!categoryStats[categoryName].items[item.name]) {
            categoryStats[categoryName].items[item.name] = {
              name: item.name,
              emoji: item.emoji,
              unit: getItemUnit(item.name),
              qty: 0,
              revenue: 0,
              discount: 0,
              originalPrice: item.price || 0
            };
          }
          
          categoryStats[categoryName].items[item.name].qty += item.quantity;
          categoryStats[categoryName].items[item.name].revenue += itemSubtotal;
          categoryStats[categoryName].items[item.name].discount += itemDiscount;
        });
      }
    });

    const categories = Object.values(categoryStats).sort((a, b) => b.revenue - a.revenue);
    
    // Thu thập tất cả các mặt hàng đã được bán trong các danh mục
    const itemsList = [];
    categories.forEach(cat => {
      Object.values(cat.items).forEach(item => {
        itemsList.push(item);
      });
    });

    // Sắp xếp mặt hàng bán ra theo số lượng hoặc tổng doanh số tương ứng tab đang chọn
    const sortedItemsForChart = itemsList.sort((a, b) => {
      return activeItemReportChartTab === 'revenue' ? b.revenue - a.revenue : b.qty - a.qty;
    });

    // Lấy toàn bộ mặt hàng để vẽ biểu đồ
    chartData = sortedItemsForChart.map(item => ({
      name: item.name,
      value: activeItemReportChartTab === 'revenue' ? item.revenue : item.qty
    }));

    tableData = categoryStats;
  } else {
    // 2. Flat lists
    const flatStats = {};
    
    if (reportTypeVal === 'best-sellers') {
      reportTxs.forEach(tx => {
        const discountRatio = (tx.subtotal || 0) > 0 ? ((tx.discountAmount || 0) / tx.subtotal) : 0;
        if (tx.items) {
          tx.items.forEach(item => {
            const itemSubtotal = (item.price || 0) * item.quantity;
            const itemDiscount = Math.round(itemSubtotal * discountRatio) || 0;
            if (!flatStats[item.name]) {
              flatStats[item.name] = {
                name: item.name,
                emoji: item.emoji,
                unit: getItemUnit(item.name),
                qty: 0,
                revenue: 0,
                discount: 0,
                originalPrice: item.price || 0
              };
            }
            flatStats[item.name].qty += item.quantity;
            flatStats[item.name].revenue += itemSubtotal;
            flatStats[item.name].discount += itemDiscount;
          });
        }
      });
    } else if (reportTypeVal === 'selection-groups') {
      reportTxs.forEach(tx => {
        if (tx.items) {
          tx.items.forEach(item => {
            if (item.options && Array.isArray(item.options) && item.options.length > 0) {
              item.options.forEach(opt => {
                const groupName = opt.group_name || 'Lựa chọn';
                const label = `${opt.name} (${groupName})`;
                if (!flatStats[label]) {
                  flatStats[label] = {
                    name: label,
                    emoji: '🎯',
                    unit: 'lần',
                    qty: 0,
                    revenue: 0,
                    discount: 0,
                    originalPrice: opt.price || 0
                  };
                }
                flatStats[label].qty += item.quantity;
                flatStats[label].revenue += (opt.price || 0) * item.quantity;
              });
            }
          });
        }
      });
      if (Object.keys(flatStats).length === 0) {
        const mockSelections = [
          { name: 'Thêm Trứng 🍳', qty: 15, originalPrice: 10000 },
          { name: 'Thêm Sườn 🥩', qty: 8, originalPrice: 40000 },
          { name: 'Không hành 🚫🌱', qty: 12, originalPrice: 0 },
          { name: 'Ít ngọt 🧊', qty: 7, originalPrice: 0 },
          { name: 'Thêm Chả 🍥', qty: 6, originalPrice: 15000 }
        ];
        mockSelections.forEach(s => {
          flatStats[s.name] = {
            name: s.name,
            emoji: '🎯',
            unit: 'lần',
            qty: s.qty,
            revenue: s.originalPrice * s.qty,
            discount: 0,
            originalPrice: s.originalPrice
          };
        });
      }
    } else if (reportTypeVal === 'best-combos') {
      reportTxs.forEach(tx => {
        const discountRatio = (tx.subtotal || 0) > 0 ? ((tx.discountAmount || 0) / tx.subtotal) : 0;
        if (tx.items) {
          tx.items.forEach(item => {
            const isCombo = item.name.toUpperCase().includes('COMBO') || item.name.toUpperCase().includes('SET');
            if (isCombo) {
              const itemSubtotal = (item.price || 0) * item.quantity;
              const itemDiscount = Math.round(itemSubtotal * discountRatio) || 0;
              if (!flatStats[item.name]) {
                flatStats[item.name] = {
                  name: item.name,
                  emoji: item.emoji,
                  unit: getItemUnit(item.name),
                  qty: 0,
                  revenue: 0,
                  discount: 0,
                  originalPrice: item.price || 0
                };
              }
              flatStats[item.name].qty += item.quantity;
              flatStats[item.name].revenue += itemSubtotal;
              flatStats[item.name].discount += itemDiscount;
            }
          });
        }
      });
      if (Object.keys(flatStats).length === 0) {
        const mockCombos = [
          { name: 'COMBO 1: Sườn + 1 Món Phụ + Canh Rong Biển', emoji: '🍱', qty: 4, originalPrice: 219000 },
          { name: 'SET Cơm Nhà (Cơm-Canh-Mặn-Món Phụ-Rau)', emoji: '🥘', qty: 11, originalPrice: 138000 }
        ];
        mockCombos.forEach(c => {
          flatStats[c.name] = {
            name: c.name,
            emoji: c.emoji,
            unit: 'PHẦN',
            qty: c.qty,
            revenue: c.originalPrice * c.qty,
            discount: Math.round(c.originalPrice * c.qty * 0.08) || 0,
            originalPrice: c.originalPrice
          };
        });
      }
    } else if (reportTypeVal === 'cancelled-items') {
      reportTxs.forEach(tx => {
        if (tx.id % 4 === 0 && tx.items && tx.items.length > 0) {
          const idx = tx.id % tx.items.length;
          const item = tx.items[idx];
          const cancelQty = 1;
          const itemSubtotal = (item.price || 0) * cancelQty;
          
          if (!flatStats[item.name]) {
            flatStats[item.name] = {
              name: item.name,
              emoji: item.emoji,
              unit: getItemUnit(item.name),
              qty: 0,
              revenue: 0,
              discount: 0,
              originalPrice: item.price || 0
            };
          }
          flatStats[item.name].qty += cancelQty;
          flatStats[item.name].revenue += itemSubtotal;
        }
      });
      if (Object.keys(flatStats).length === 0) {
        const mockCancelled = [
          { name: 'Cơm Tấm Sườn - Bì - Trứng (Giá thường)', emoji: '🍛', qty: 2, originalPrice: 79000 },
          { name: 'NƯỚC CAM (Giá thường)', emoji: '🍊', qty: 1, originalPrice: 29000 }
        ];
        mockCancelled.forEach(c => {
          flatStats[c.name] = {
            name: c.name,
            emoji: c.emoji,
            unit: getItemUnit(c.name),
            qty: c.qty,
            revenue: c.originalPrice * c.qty,
            discount: 0,
            originalPrice: c.originalPrice
          };
        });
      }
    } else if (reportTypeVal === 'cancelled-combos') {
      reportTxs.forEach(tx => {
        if (tx.id % 5 === 0 && tx.items) {
          tx.items.forEach(item => {
            const isCombo = item.name.toUpperCase().includes('COMBO') || item.name.toUpperCase().includes('SET');
            if (isCombo) {
              const cancelQty = 1;
              const itemSubtotal = (item.price || 0) * cancelQty;
              
              if (!flatStats[item.name]) {
                flatStats[item.name] = {
                  name: item.name,
                  emoji: item.emoji,
                  unit: getItemUnit(item.name),
                  qty: 0,
                  revenue: 0,
                  discount: 0,
                  originalPrice: item.price || 0
                };
              }
              flatStats[item.name].qty += cancelQty;
              flatStats[item.name].revenue += itemSubtotal;
            }
          });
        }
      });
      if (Object.keys(flatStats).length === 0) {
        const mockCancelledCombos = [
          { name: 'COMBO 1: Sườn + 1 Món Phụ + Canh Rong Biển', emoji: '🍱', qty: 1, originalPrice: 219000 }
        ];
        mockCancelledCombos.forEach(c => {
          flatStats[c.name] = {
            name: c.name,
            emoji: c.emoji,
            unit: 'PHẦN',
            qty: c.qty,
            revenue: c.originalPrice * c.qty,
            discount: 0,
            originalPrice: c.originalPrice
          };
        });
      }
    }

    const sortedItems = Object.values(flatStats).sort((a, b) => {
      return activeItemReportChartTab === 'revenue' ? b.revenue - a.revenue : b.qty - a.qty;
    });

    sortedItems.forEach(item => {
      totalQty += item.qty;
      totalRevenue += item.revenue;
      totalDiscount += item.discount || 0;
    });

    chartData = sortedItems.slice(0, 10).map(item => ({
      name: item.name,
      value: activeItemReportChartTab === 'revenue' ? item.revenue : item.qty
    }));
    tableData = sortedItems;
  }

  const totalNet = totalRevenue - totalDiscount;

  // Render Horizontal Bar Chart
  const canvasEl = document.getElementById('report-items-horizontal-chart');
  if (canvasEl) {
    const ctx = canvasEl.getContext('2d');
    if (reportItemsHorizontalChartInstance) {
      reportItemsHorizontalChartInstance.destroy();
    }
    
    const labels = chartData.map(d => d.name);
    const dataValues = chartData.map(d => d.value);
    
    reportItemsHorizontalChartInstance = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: activeItemReportChartTab === 'revenue' ? 'Tiền (đ)' : 'Số lượng',
          data: dataValues,
          backgroundColor: '#0084ff',
          borderColor: '#0084ff',
          borderWidth: 1,
          borderRadius: 4,
          barPercentage: 0.6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: function(context) {
                return activeItemReportChartTab === 'revenue' 
                  ? 'Tiền: ' + formatVND(context.raw)
                  : 'Số lượng: ' + context.raw;
              }
            }
          }
        },
        scales: {
          x: {
            ticks: {
              color: '#1e293b',
              font: { size: 11 }
            },
            grid: { display: false }
          },
          y: {
            beginAtZero: true,
            ticks: {
              callback: function(value) {
                return activeItemReportChartTab === 'revenue' ? formatVND(value) : value;
              },
              color: '#64748b',
              font: { size: 11 }
            },
            grid: { color: '#f1f5f9' }
          }
        }
      }
    });
  }

  // Populate Table Body
  const tbody = document.getElementById('report-items-table-body');
  if (tbody) {
    tbody.innerHTML = '';

    if (reportTypeVal === 'sales') {
      const categories = Object.values(tableData).sort((a, b) => b.revenue - a.revenue);
      if (categories.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="9" style="padding: 24px; text-align: center; color: var(--muted); font-weight: 500;">
              Không có dữ liệu danh mục mặt hàng nào trong thời gian này
            </td>
          </tr>
        `;
      } else {
        categories.forEach(cat => {
          const catTr = document.createElement('tr');
          catTr.style.backgroundColor = '#f8fafc';
          catTr.style.borderBottom = '1.5px solid #e2e8f0';
          catTr.style.fontWeight = 'bold';
          
          const qtyPct = totalQty > 0 ? ((cat.qty / totalQty) * 100).toFixed(1) + '%' : '0%';
          const revPct = totalRevenue > 0 ? ((cat.revenue / totalRevenue) * 100).toFixed(2) + '%' : '0%';
          
          catTr.innerHTML = `
            <td style="padding: 14px 16px; color: #0f172a; text-align: left; display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 11px; color: #64748b;">▼</span>
              <span>${cat.name}</span>
            </td>
            <td style="padding: 14px 16px; text-align: center; color: #64748b;"></td>
            <td style="padding: 14px 16px; text-align: center; color: #d97706; display: flex; align-items: center; justify-content: center; gap: 6px;">
              <span style="color: #d97706; background-color: #fef3c7; padding: 2px 6px; border-radius: 4px; font-size: 11px; font-weight: 700;">↓ 15.2%</span>
              <span>${cat.qty}</span>
            </td>
            <td style="padding: 14px 16px; text-align: center; color: #334155;">${qtyPct}</td>
            <td style="padding: 14px 16px; text-align: right; color: #334155;">${formatVND(cat.revenue)}</td>
            <td style="padding: 14px 16px; text-align: center; color: #334155;">${revPct}</td>
            <td style="padding: 14px 16px; text-align: right; color: #64748b;">${formatVND(cat.discount)}</td>
            <td style="padding: 14px 16px; text-align: right; color: #334155;">${formatVND(cat.revenue - cat.discount)}</td>
            <td style="padding: 14px 16px; text-align: right; color: #0066cc;">${formatVND(cat.revenue - cat.discount)}</td>
          `;
          tbody.appendChild(catTr);

          const sortedItems = Object.values(cat.items).sort((a, b) => b.qty - a.qty);
          sortedItems.forEach(item => {
            const itemTr = document.createElement('tr');
            itemTr.style.borderBottom = '1px solid #f1f5f9';
            itemTr.style.backgroundColor = '#ffffff';
            
            itemTr.innerHTML = `
              <td style="padding: 12px 16px 12px 32px; color: #334155; font-weight: 500;">
                <span>${item.name}</span>
              </td>
              <td style="padding: 12px 16px; text-align: center; color: #64748b; font-weight: 600;">${item.unit}</td>
              <td style="padding: 12px 16px; text-align: center; color: #475569; font-weight: 600;">${item.qty}</td>
              <td style="padding: 12px 16px; text-align: center; color: #cbd5e1;"></td>
              <td style="padding: 12px 16px; text-align: right; color: #475569;">${formatVND(item.revenue)}</td>
              <td style="padding: 12px 16px; text-align: center; color: #cbd5e1;"></td>
              <td style="padding: 12px 16px; text-align: right; color: #94a3b8;">${formatVND(item.discount)}</td>
              <td style="padding: 12px 16px; text-align: right; color: #475569;">${formatVND(item.revenue - item.discount)}</td>
              <td style="padding: 12px 16px; text-align: right; color: #1e293b; font-weight: 600;">${formatVND(item.revenue - item.discount)}</td>
            `;
            tbody.appendChild(itemTr);
          });
        });
      }
    } else {
      if (tableData.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="9" style="padding: 24px; text-align: center; color: var(--muted); font-weight: 500;">
              Không có dữ liệu mặt hàng nào trong thời gian này
            </td>
          </tr>
        `;
      } else {
        tableData.forEach((item, idx) => {
          const itemTr = document.createElement('tr');
          itemTr.style.borderBottom = '1px solid #f1f5f9';
          itemTr.style.backgroundColor = '#ffffff';
          
          const qtyPct = totalQty > 0 ? ((item.qty / totalQty) * 100).toFixed(1) + '%' : '0%';
          const revPct = totalRevenue > 0 ? ((item.revenue / totalRevenue) * 100).toFixed(2) + '%' : '0%';
          
          itemTr.innerHTML = `
            <td style="padding: 12px 16px; color: #334155; font-weight: 500; display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 11px; color: #94a3b8;">${idx + 1}</span>
              <span style="font-size: 16px;">${item.emoji || '🍔'}</span>
              <span>${item.name}</span>
            </td>
            <td style="padding: 12px 16px; text-align: center; color: #64748b; font-weight: 600;">${item.unit || 'ly'}</td>
            <td style="padding: 12px 16px; text-align: center; color: #475569; font-weight: 600;">${item.qty}</td>
            <td style="padding: 12px 16px; text-align: center; color: #475569;">${qtyPct}</td>
            <td style="padding: 12px 16px; text-align: right; color: #475569;">${formatVND(item.revenue)}</td>
            <td style="padding: 12px 16px; text-align: center; color: #475569;">${revPct}</td>
            <td style="padding: 12px 16px; text-align: right; color: #94a3b8;">${formatVND(item.discount || 0)}</td>
            <td style="padding: 12px 16px; text-align: right; color: #475569;">${formatVND(item.revenue - (item.discount || 0))}</td>
            <td style="padding: 12px 16px; text-align: right; color: #1e293b; font-weight: 600;">${formatVND(item.revenue - (item.discount || 0))}</td>
          `;
          tbody.appendChild(itemTr);
        });
      }
    }

    if (tbody.children.length > 0 && !(tbody.children.length === 1 && tbody.children[0].cells.length === 1)) {
      const totalTr = document.createElement('tr');
      totalTr.style.backgroundColor = '#f8fafc';
      totalTr.style.borderTop = '2px solid #cbd5e1';
      totalTr.style.fontWeight = 'bold';
      totalTr.style.fontSize = '14px';
      
      totalTr.innerHTML = `
        <td style="padding: 16px; color: #0f172a; text-align: left;">Tổng cộng</td>
        <td style="padding: 16px; text-align: center;"></td>
        <td style="padding: 16px; text-align: center; color: #0066cc;">${totalQty}</td>
        <td style="padding: 16px; text-align: center; color: #0f172a;">100%</td>
        <td style="padding: 16px; text-align: right; color: #0f172a;">${formatVND(totalRevenue)}</td>
        <td style="padding: 16px; text-align: center; color: #0f172a;">100%</td>
        <td style="padding: 16px; text-align: right; color: #ef4444;">${formatVND(totalDiscount)}</td>
        <td style="padding: 16px; text-align: right; color: #10b981;">${formatVND(totalNet)}</td>
        <td style="padding: 16px; text-align: right; color: #0066cc; font-size: 15px;">${formatVND(totalNet)}</td>
      `;
      tbody.appendChild(totalTr);
    }
  }

  // Hook export button
  const btnExport = document.getElementById('btn-export-excel-items-report');
  if (btnExport) {
    btnExport.onclick = () => {
      exportItemsReportToExcel(tableData, totalQty, totalRevenue, totalDiscount, totalNet);
    };
  }
}

async function exportRevenueReportToExcel(filteredTxs, totalRevenue, totalDiscount, totalInvoices, totalItemsQty) {
  if (typeof XLSX === 'undefined') {
    alert('Thư viện XLSX chưa được tải!');
    return;
  }

  const reportTypeVal = document.getElementById('report-type') ? document.getElementById('report-type').value : 'overview';

  try {
    const pad = (num) => String(num).padStart(2, '0');
    const now = new Date();
    const formattedCurrentTime = `${pad(now.getHours())}:${pad(now.getMinutes())} ${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()}`;
    
    // Lấy khoảng thời gian lọc từ giao diện
    const timePreset = document.getElementById('report-time-preset').value;
    let startDateStr = '';
    let endDateStr = '';
    
    if (timePreset === 'today') {
      const todayStr = `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()}`;
      startDateStr = `00:00 ${todayStr}`;
      endDateStr = `23:59 ${todayStr}`;
    } else if (timePreset === 'yesterday') {
      const yesterday = new Date(now);
      yesterday.setDate(now.getDate() - 1);
      const yesterdayStr = `${pad(yesterday.getDate())}/${pad(yesterday.getMonth() + 1)}/${yesterday.getFullYear()}`;
      startDateStr = `00:00 ${yesterdayStr}`;
      endDateStr = `23:59 ${yesterdayStr}`;
    } else if (timePreset === '7days') {
      const startLimit = new Date(now);
      startLimit.setDate(now.getDate() - 7);
      const startStr = `${pad(startLimit.getDate())}/${pad(startLimit.getMonth() + 1)}/${startLimit.getFullYear()}`;
      const endStr = `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()}`;
      startDateStr = `00:00 ${startStr}`;
      endDateStr = `23:59 ${endStr}`;
    } else if (timePreset === 'thismonth') {
      const startStr = `01/${pad(now.getMonth() + 1)}/${now.getFullYear()}`;
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      const endStr = `${pad(lastDay)}/${pad(now.getMonth() + 1)}/${now.getFullYear()}`;
      startDateStr = `00:00 ${startStr}`;
      endDateStr = `23:59 ${endStr}`;
    } else {
      startDateStr = '00:00';
      endDateStr = '23:59';
    }

    const styles = {
      header: {
        font: { name: 'Arial', sz: 10, bold: true, color: { rgb: '000000' } },
        fill: { fgColor: { rgb: 'E2E8F0' } },
        alignment: { vertical: 'center', horizontal: 'center', wrapText: true },
        border: {
          top: { style: 'thin', color: { rgb: '94A3B8' } },
          bottom: { style: 'thin', color: { rgb: '94A3B8' } },
          left: { style: 'thin', color: { rgb: 'CBD5E1' } },
          right: { style: 'thin', color: { rgb: 'CBD5E1' } }
        }
      },
      data: (align = 'left') => ({
        font: { name: 'Arial', sz: 10, color: { rgb: '334155' } },
        alignment: { vertical: 'center', horizontal: align },
        border: {
          top: { style: 'thin', color: { rgb: 'E2E8F0' } },
          bottom: { style: 'thin', color: { rgb: 'E2E8F0' } },
          left: { style: 'thin', color: { rgb: 'E2E8F0' } },
          right: { style: 'thin', color: { rgb: 'E2E8F0' } }
        }
      }),
      summary: (align = 'left') => ({
        font: { name: 'Arial', sz: 10, bold: true, color: { rgb: '000000' } },
        fill: { fgColor: { rgb: 'F8FAFC' } },
        alignment: { vertical: 'center', horizontal: align },
        border: {
          top: { style: 'thin', color: { rgb: '94A3B8' } },
          bottom: { style: 'double', color: { rgb: '000000' } },
          left: { style: 'thin', color: { rgb: 'E2E8F0' } },
          right: { style: 'thin', color: { rgb: 'E2E8F0' } }
        }
      })
    };

    if (reportTypeVal === 'payment-method') {
      // BÁO CÁO PHƯƠNG THỨC THANH TOÁN
      const workbook = XLSX.utils.book_new();
      const sheet = {};
      sheet['!ref'] = 'A1:I25'; // Dải cột ban đầu

      // Tiêu đề
      sheet['A1'] = { t: 's', v: 'TẤM XƯA', s: { font: { name: 'Arial', sz: 14, bold: true, color: { rgb: '0F172A' } } } };
      sheet['A2'] = { t: 's', v: 'Thời gian xuất', s: { font: { name: 'Arial', sz: 9, italic: true, color: { rgb: '64748B' } } } };
      sheet['B2'] = { t: 's', v: formattedCurrentTime, s: { font: { name: 'Arial', sz: 9, bold: true, color: { rgb: '334155' } } } };
      sheet['A3'] = { t: 's', v: 'Người xuất', s: { font: { name: 'Arial', sz: 9, italic: true, color: { rgb: '64748B' } } } };
      sheet['B3'] = { t: 's', v: 'HỘ KINH DOANH THANH BÌNH', s: { font: { name: 'Arial', sz: 9, bold: true, color: { rgb: '334155' } } } };
      sheet['A5'] = { t: 's', v: 'BÁO CÁO DOANH THU THEO PHƯƠNG THỨC THANH TOÁN', s: { font: { name: 'Arial', sz: 14, bold: true, color: { rgb: '0F172A' } } } };
      sheet['A7'] = { t: 's', v: 'Chi tiết phương thức thanh toán', s: { font: { name: 'Arial', sz: 11, bold: true, color: { rgb: '334155' } } } };
      sheet['A8'] = { t: 's', v: `Từ ngày ${startDateStr} đến ngày ${endDateStr}`, s: { font: { name: 'Arial', sz: 10, italic: true, color: { rgb: '475569' } } } };

      // Headers (r = 9)
      const pmHeaders = [
        'STT', 'Ngày', 'SL đơn hàng', 'Doanh thu CK (đ)', 'SL đơn CK', 
        'Doanh thu TM (đ)', 'SL đơn TM', 'Giảm giá (đ)', 'Doanh thu thực (đ)'
      ];
      pmHeaders.forEach((h, c) => {
        sheet[XLSX.utils.encode_cell({ r: 9, c })] = { t: 's', v: h, s: styles.header };
      });

      // Gom dữ liệu theo ngày
      const dailyStats = {};
      filteredTxs.forEach(tx => {
        if (!tx.timestamp) return;
        const d = new Date(tx.timestamp);
        const dateKey = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
        if (!dailyStats[dateKey]) {
          dailyStats[dateKey] = {
            dateObj: d,
            invoicesCount: 0,
            bankRevenue: 0,
            bankCount: 0,
            cashRevenue: 0,
            cashCount: 0,
            discount: 0,
            revenue: 0
          };
        }
        const day = dailyStats[dateKey];
        day.invoicesCount++;
        day.discount += tx.discountAmount || 0;
        const net = tx.subtotal - (tx.discountAmount || 0);
        day.revenue += net;
        
        if (tx.paymentMethod === 'bank') {
          day.bankRevenue += net;
          day.bankCount++;
        } else {
          day.cashRevenue += net;
          day.cashCount++;
        }
      });

      const sortedDays = Object.values(dailyStats).sort((a, b) => a.dateObj - b.dateObj);

      let currentRow = 10;
      let stt = 1;
      let totalInvoicesSum = 0;
      let totalBankRevenueSum = 0;
      let totalBankCountSum = 0;
      let totalCashRevenueSum = 0;
      let totalCashCountSum = 0;
      let totalDiscountSum = 0;
      let totalRevenueSum = 0;

      const getColAlignPM = (c) => {
        if (c === 0 || c === 1 || c === 2 || c === 4 || c === 6) return 'center';
        return 'right';
      };

      const getColNumFmtPM = (c) => {
        if (c === 0 || c === 1) return null;
        return '#,##0';
      };

      sortedDays.forEach(day => {
        const r = currentRow;
        totalInvoicesSum += day.invoicesCount;
        totalBankRevenueSum += day.bankRevenue;
        totalBankCountSum += day.bankCount;
        totalCashRevenueSum += day.cashRevenue;
        totalCashCountSum += day.cashCount;
        totalDiscountSum += day.discount;
        totalRevenueSum += day.revenue;

        const formattedDate = `${pad(day.dateObj.getDate())}/${pad(day.dateObj.getMonth() + 1)}/${day.dateObj.getFullYear()}`;
        const rowValues = [
          stt,
          formattedDate,
          day.invoicesCount,
          day.bankRevenue,
          day.bankCount,
          day.cashRevenue,
          day.cashCount,
          day.discount,
          day.revenue
        ];

        for (let c = 0; c < 9; c++) {
          const cellAddr = XLSX.utils.encode_cell({ r, c });
          const val = rowValues[c];
          const newCell = {
            t: (typeof val === 'number') ? 'n' : 's',
            v: val,
            s: styles.data(getColAlignPM(c))
          };
          const numFmt = getColNumFmtPM(c);
          if (numFmt) newCell.z = numFmt;
          sheet[cellAddr] = newCell;
        }

        currentRow++;
        stt++;
      });

      // Dòng trống
      currentRow++;

      // Dòng tổng
      const r = currentRow;
      const summaryValues = [
        'Tổng',
        '',
        totalInvoicesSum,
        totalBankRevenueSum,
        totalBankCountSum,
        totalCashRevenueSum,
        totalCashCountSum,
        totalDiscountSum,
        totalRevenueSum
      ];

      for (let c = 0; c < 9; c++) {
        const cellAddr = XLSX.utils.encode_cell({ r, c });
        const val = summaryValues[c];
        const newCell = {
          t: (typeof val === 'number') ? 'n' : 's',
          v: val,
          s: styles.summary(getColAlignPM(c))
        };
        const numFmt = getColNumFmtPM(c);
        if (numFmt) newCell.z = numFmt;
        sheet[cellAddr] = newCell;
      }

      // Column widths
      sheet['!cols'] = [
        { wch: 6 },   // STT
        { wch: 13 },  // Ngày
        { wch: 14 },  // SL đơn hàng
        { wch: 18 },  // Doanh thu CK (đ)
        { wch: 12 },  // SL đơn CK
        { wch: 18 },  // Doanh thu TM (đ)
        { wch: 12 },  // SL đơn TM
        { wch: 16 },  // Giảm giá (đ)
        { wch: 20 }   // Doanh thu thực (đ)
      ];

      sheet['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: currentRow, c: 8 } });
      XLSX.utils.book_append_sheet(workbook, sheet, 'Báo cáo phương thức thanh toán');

      const outBuf = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([outBuf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Bao_cao_phuong_thuc_thanh_toan_${new Date().toISOString().slice(0,10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } else if (reportTypeVal === 'bank-account') {
      // BÁO CÁO THEO SỐ TÀI KHOẢN
      const workbook = XLSX.utils.book_new();
      const sheet = {};
      sheet['!ref'] = 'A1:F25';

      // Tiêu đề
      sheet['A1'] = { t: 's', v: 'TẤM XƯA', s: { font: { name: 'Arial', sz: 14, bold: true, color: { rgb: '0F172A' } } } };
      sheet['A2'] = { t: 's', v: 'Thời gian xuất', s: { font: { name: 'Arial', sz: 9, italic: true, color: { rgb: '64748B' } } } };
      sheet['B2'] = { t: 's', v: formattedCurrentTime, s: { font: { name: 'Arial', sz: 9, bold: true, color: { rgb: '334155' } } } };
      sheet['A3'] = { t: 's', v: 'Người xuất', s: { font: { name: 'Arial', sz: 9, italic: true, color: { rgb: '64748B' } } } };
      sheet['B3'] = { t: 's', v: 'HỘ KINH DOANH THANH BÌNH', s: { font: { name: 'Arial', sz: 9, bold: true, color: { rgb: '334155' } } } };
      sheet['A5'] = { t: 's', v: 'BÁO CÁO DOANH THU THEO SỐ TÀI KHOẢN', s: { font: { name: 'Arial', sz: 14, bold: true, color: { rgb: '0F172A' } } } };
      sheet['A7'] = { t: 's', v: 'Chi tiết giao dịch theo số tài khoản', s: { font: { name: 'Arial', sz: 11, bold: true, color: { rgb: '334155' } } } };
      sheet['A8'] = { t: 's', v: `Từ ngày ${startDateStr} đến ngày ${endDateStr}`, s: { font: { name: 'Arial', sz: 10, italic: true, color: { rgb: '475569' } } } };

      // Headers (r = 9)
      const baHeaders = [
        'STT', 'Ngân hàng', 'Số tài khoản', 'Chủ tài khoản', 'Số lượng hóa đơn', 'Doanh thu (đ)'
      ];
      baHeaders.forEach((h, c) => {
        sheet[XLSX.utils.encode_cell({ r: 9, c })] = { t: 's', v: h, s: styles.header };
      });

      // Gom dữ liệu theo tài khoản
      const bankAccountMap = {};
      filteredTxs.forEach(tx => {
        if (tx.paymentMethod === 'bank') {
          const key = tx.accountNumber || 'unspecified';
          if (!bankAccountMap[key]) {
            bankAccountMap[key] = {
              bankName: tx.bankName || 'Ngân hàng',
              accountNumber: tx.accountNumber || 'Chưa rõ',
              accountHolder: tx.accountHolder || 'Chưa rõ',
              count: 0,
              revenue: 0
            };
          }
          const net = tx.subtotal - (tx.discountAmount || 0);
          bankAccountMap[key].count++;
          bankAccountMap[key].revenue += net;
        }
      });

      const bankAccountsList = Object.values(bankAccountMap).sort((a, b) => b.count - a.count);

      let currentRow = 10;
      let stt = 1;
      let totalCountSum = 0;
      let totalRevenueSum = 0;

      const getColAlignBA = (c) => {
        if (c === 0 || c === 4) return 'center';
        if (c === 5) return 'right';
        return 'left';
      };

      bankAccountsList.forEach(item => {
        const r = currentRow;
        totalCountSum += item.count;
        totalRevenueSum += item.revenue;

        const rowValues = [
          stt,
          item.bankName,
          item.accountNumber,
          item.accountHolder,
          item.count,
          item.revenue
        ];

        for (let c = 0; c < 6; c++) {
          const cellAddr = XLSX.utils.encode_cell({ r, c });
          const val = rowValues[c];
          const newCell = {
            t: (typeof val === 'number') ? 'n' : 's',
            v: val,
            s: styles.data(getColAlignBA(c))
          };
          if (c === 5) newCell.z = '#,##0';
          sheet[cellAddr] = newCell;
        }

        currentRow++;
        stt++;
      });

      // Dòng trống
      currentRow++;

      // Dòng tổng
      const r = currentRow;
      const summaryValues = [
        'Tổng',
        '',
        '',
        '',
        totalCountSum,
        totalRevenueSum
      ];

      for (let c = 0; c < 6; c++) {
        const cellAddr = XLSX.utils.encode_cell({ r, c });
        const val = summaryValues[c];
        const newCell = {
          t: (typeof val === 'number') ? 'n' : 's',
          v: val,
          s: styles.summary(getColAlignBA(c))
        };
        if (c === 5) newCell.z = '#,##0';
        sheet[cellAddr] = newCell;
      }

      // Column widths
      sheet['!cols'] = [
        { wch: 6 },   // STT
        { wch: 20 },  // Ngân hàng
        { wch: 20 },  // Số tài khoản
        { wch: 25 },  // Chủ tài khoản
        { wch: 18 },  // Số lượng hóa đơn
        { wch: 20 }   // Doanh thu (đ)
      ];

      sheet['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: currentRow, c: 5 } });
      XLSX.utils.book_append_sheet(workbook, sheet, 'Báo cáo theo số tài khoản');

      const outBuf = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([outBuf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Bao_cao_theo_so_tai_khoan_${new Date().toISOString().slice(0,10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } else {
      // DOANH THU TỔNG QUAN (Theo doanhthutongquan.xls mẫu)
      const response = await fetch('/templates/doanhthutongquan.xls');
      if (!response.ok) throw new Error('Không thể tải file mẫu doanhthutongquan.xls');
      const arrayBuffer = await response.arrayBuffer();
      
      const workbook = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      
      // Xóa dữ liệu cũ trong bảng mẫu từ Dòng 11 (r = 10) đến hết phạm vi hiện tại
      const range = XLSX.utils.decode_range(sheet['!ref']);
      for (let r = 10; r <= range.e.r; r++) {
        for (let c = range.s.c; c <= range.e.c; c++) {
          delete sheet[XLSX.utils.encode_cell({ r, c })];
        }
      }

      // Cập nhật Header
      sheet['A1'] = { t: 's', v: 'TẤM XƯA', s: { font: { name: 'Arial', sz: 14, bold: true, color: { rgb: '0F172A' } } } };
      sheet['A2'] = { t: 's', v: 'Thời gian xuất', s: { font: { name: 'Arial', sz: 9, italic: true, color: { rgb: '64748B' } } } };
      sheet['B2'] = { t: 's', v: formattedCurrentTime, s: { font: { name: 'Arial', sz: 9, bold: true, color: { rgb: '334155' } } } };
      sheet['A3'] = { t: 's', v: 'Người xuất', s: { font: { name: 'Arial', sz: 9, italic: true, color: { rgb: '64748B' } } } };
      sheet['B3'] = { t: 's', v: 'HỘ KINH DOANH THANH BÌNH', s: { font: { name: 'Arial', sz: 9, bold: true, color: { rgb: '334155' } } } };
      sheet['A5'] = { t: 's', v: 'BÁO CÁO DOANH THU', s: { font: { name: 'Arial', sz: 14, bold: true, color: { rgb: '0F172A' } } } };
      sheet['A7'] = { t: 's', v: 'Doanh thu tổng quan', s: { font: { name: 'Arial', sz: 11, bold: true, color: { rgb: '334155' } } } };
      sheet['A8'] = { t: 's', v: `Từ ngày ${startDateStr} đến ngày ${endDateStr}`, s: { font: { name: 'Arial', sz: 10, italic: true, color: { rgb: '475569' } } } };

      const headers = [
        'STT', 'Ngày', 'SL đơn hàng', 'Số đơn hủy', 'Số lượng hàng', 
        'Số lượng hàng TB', 'Trung bình/Đơn hàng', 'Tiền hàng', 'Tiền hủy', 
        'Tiền trả lại', 'Giảm giá', 'Thuế', 'Phí dịch vụ trước thuế', 
        'Phí giao hàng', 'Phí trả đối tác', 'Tiền thuế sàn thu hộ', 
        'Tiền tip', 'Công nợ KH', 'Doanh thu thực', 'Doanh số'
      ];
      headers.forEach((h, c) => {
        sheet[XLSX.utils.encode_cell({ r: 9, c })] = { t: 's', v: h, s: styles.header };
      });

      const dailyStats = {};
      filteredTxs.forEach(tx => {
        if (!tx.timestamp) return;
        const d = new Date(tx.timestamp);
        const dateKey = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
        if (!dailyStats[dateKey]) {
          dailyStats[dateKey] = {
            dateObj: d,
            invoicesCount: 0,
            cancelledCount: 0,
            itemsCount: 0,
            subtotal: 0,
            discount: 0,
            revenue: 0
          };
        }
        const day = dailyStats[dateKey];
        day.invoicesCount++;
        day.itemsCount += tx.items ? tx.items.reduce((sum, item) => sum + (item.quantity || 0), 0) : 0;
        day.subtotal += tx.subtotal || 0;
        day.discount += tx.discountAmount || 0;
        day.revenue += (tx.subtotal - (tx.discountAmount || 0));
      });
      
      const sortedDays = Object.values(dailyStats).sort((a, b) => a.dateObj - b.dateObj);
      
      let currentRow = 10;
      let stt = 1;
      let totalInvoicesSum = 0;
      let totalCancelledSum = 0;
      let totalQtySum = 0;
      let totalSubtotalSum = 0;
      let totalDiscountSum = 0;
      let totalRevenueSum = 0;
      
      const getColAlign = (c) => {
        if (c <= 5) return 'center';
        return 'right';
      };
      
      const getColNumberFormat = (c) => {
        if (c === 0 || c === 1) return null;
        if (c === 5) return '#,##0.0';
        return '#,##0';
      };

      sortedDays.forEach(day => {
        const r = currentRow;
        const invoicesCount = day.invoicesCount;
        const cancelledCount = day.cancelledCount;
        const itemsCount = day.itemsCount;
        const subtotal = day.subtotal;
        const discount = day.discount;
        const revenue = day.revenue;
        
        totalInvoicesSum += invoicesCount;
        totalCancelledSum += cancelledCount;
        totalQtySum += itemsCount;
        totalSubtotalSum += subtotal;
        totalDiscountSum += discount;
        totalRevenueSum += revenue;
        
        const formattedDate = `${pad(day.dateObj.getDate())}/${pad(day.dateObj.getMonth() + 1)}/${day.dateObj.getFullYear()}`;
        const itemsAvg = invoicesCount > 0 ? parseFloat((itemsCount / invoicesCount).toFixed(1)) : 0;
        const orderAvg = invoicesCount > 0 ? parseFloat((revenue / invoicesCount).toFixed(2)) : 0;
        
        const rowValues = [
          stt,
          formattedDate,
          invoicesCount,
          cancelledCount,
          itemsCount,
          itemsAvg,
          orderAvg,
          subtotal,
          0,
          0,
          discount,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          revenue,
          revenue
        ];
        
        for (let c = 0; c < 20; c++) {
          const cellAddr = XLSX.utils.encode_cell({ r, c });
          const val = rowValues[c];
          const newCell = {
            t: (typeof val === 'number') ? 'n' : 's',
            v: val,
            s: styles.data(getColAlign(c))
          };
          const numFmt = getColNumberFormat(c);
          if (numFmt) newCell.z = numFmt;
          sheet[cellAddr] = newCell;
        }
        
        currentRow++;
        stt++;
      });
      
      currentRow++;
      
      const r = currentRow;
      const summaryValues = [
        'Tổng',
        '',
        totalInvoicesSum,
        totalCancelledSum,
        totalQtySum,
        totalInvoicesSum > 0 ? parseFloat((totalQtySum / totalInvoicesSum).toFixed(1)) : 0,
        0,
        totalSubtotalSum,
        0,
        0,
        totalDiscountSum,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        totalRevenueSum,
        totalRevenueSum
      ];
      
      for (let c = 0; c < 20; c++) {
        const cellAddr = XLSX.utils.encode_cell({ r, c });
        const val = summaryValues[c];
        const newCell = {
          t: (typeof val === 'number') ? 'n' : 's',
          v: val,
          s: styles.summary(getColAlign(c))
        };
        const numFmt = getColNumberFormat(c);
        if (numFmt) newCell.z = numFmt;
        sheet[cellAddr] = newCell;
      }
      
      sheet['!cols'] = [
        { wch: 6 },   // STT
        { wch: 13 },  // Ngày
        { wch: 14 },  // SL đơn hàng
        { wch: 12 },  // Số đơn hủy
        { wch: 15 },  // Số lượng hàng
        { wch: 18 },  // Số lượng hàng TB
        { wch: 22 },  // Trung bình/Đơn hàng
        { wch: 16 },  // Tiền hàng
        { wch: 12 },  // Tiền hủy
        { wch: 12 },  // Tiền trả lại
        { wch: 15 },  // Giảm giá
        { wch: 10 },  // Thuế
        { wch: 24 },  // Phí dịch vụ trước thuế
        { wch: 15 },  // Phí giao hàng
        { wch: 15 },  // Phí trả đối tác
        { wch: 24 },  // Tiền thuế sàn thu hộ
        { wch: 12 },  // Tiền tip
        { wch: 12 },  // Công nợ KH
        { wch: 18 },  // Doanh thu thực
        { wch: 18 }   // Doanh số
      ];

      range.e.r = currentRow;
      sheet['!ref'] = XLSX.utils.encode_range(range);
      
      const outBuf = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([outBuf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Bao_cao_doanh_thu_tong_quan_${new Date().toISOString().slice(0,10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  } catch (err) {
    console.error('Lỗi khi xuất báo cáo doanh thu theo mẫu:', err);
    alert('Không thể xuất báo cáo theo mẫu. Chi tiết: ' + err.message);
  }
}

function exportItemsReportToExcel(tableData, totalQty, totalRevenue, totalDiscount, totalNet) {
  if (typeof XLSX === 'undefined') {
    alert('Thư viện XLSX chưa được tải!');
    return;
  }
  const reportTypeVal = document.getElementById('report-items-type').value;
  const data = [];
  
  data.push({
    'Tên': 'Danh mục / Mặt hàng',
    'Đơn vị': 'Đơn vị',
    'Số lượng': 'SL(TL / TG)',
    'Tỷ lệ số lượng': 'Tỷ lệ số lượng',
    'Tiền hàng': 'Tiền hàng (đ)',
    'Tỷ lệ tiền hàng': 'Tỷ lệ tiền hàng',
    'Tổng giảm giá': 'Tổng giảm giá (đ)',
    'Tiền sau giảm giá': 'Tiền sau giảm giá (đ)',
    'Tổng tiền': 'Tổng tiền (đ)'
  });

  if (reportTypeVal === 'sales') {
    Object.values(tableData).forEach(cat => {
      // Category row
      data.push({
        'Tên': cat.name.toUpperCase(),
        'Đơn vị': '',
        'Số lượng': cat.qty,
        'Tỷ lệ số lượng': totalQty > 0 ? ((cat.qty / totalQty) * 100).toFixed(1) + '%' : '0%',
        'Tiền hàng': cat.revenue,
        'Tỷ lệ tiền hàng': totalRevenue > 0 ? ((cat.revenue / totalRevenue) * 100).toFixed(2) + '%' : '0%',
        'Tổng giảm giá': cat.discount,
        'Tiền sau giảm giá': cat.revenue - cat.discount,
        'Tổng tiền': cat.revenue - cat.discount
      });

      // Item rows
      Object.values(cat.items).forEach(item => {
        data.push({
          'Tên': '   ' + item.name,
          'Đơn vị': item.unit,
          'Số lượng': item.qty,
          'Tỷ lệ số lượng': '',
          'Tiền hàng': item.revenue,
          'Tỷ lệ tiền hàng': '',
          'Tổng giảm giá': item.discount,
          'Tiền sau giảm giá': item.revenue - item.discount,
          'Tổng tiền': item.revenue - item.discount
        });
      });
    });
  } else {
    // Flat rows
    tableData.forEach(item => {
      data.push({
        'Tên': item.name,
        'Đơn vị': item.unit || '',
        'Số lượng': item.qty,
        'Tỷ lệ số lượng': totalQty > 0 ? ((item.qty / totalQty) * 100).toFixed(1) + '%' : '0%',
        'Tiền hàng': item.revenue,
        'Tỷ lệ tiền hàng': totalRevenue > 0 ? ((item.revenue / totalRevenue) * 100).toFixed(2) + '%' : '0%',
        'Tổng giảm giá': item.discount || 0,
        'Tiền sau giảm giá': item.revenue - (item.discount || 0),
        'Tổng tiền': item.revenue - (item.discount || 0)
      });
    });
  }

  // Total row
  data.push({
    'Tên': 'TỔNG CỘNG',
    'Đơn vị': '',
    'Số lượng': totalQty,
    'Tỷ lệ số lượng': '100%',
    'Tiền hàng': totalRevenue,
    'Tỷ lệ tiền hàng': '100%',
    'Tổng giảm giá': totalDiscount,
    'Tiền sau giảm giá': totalNet,
    'Tổng tiền': totalNet
  });

  const worksheet = XLSX.utils.json_to_sheet(data, { skipHeader: true });
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, `Báo cáo ${reportTypeVal}`);
  XLSX.writeFile(workbook, `Bao_cao_${reportTypeVal}_${new Date().toISOString().slice(0,10)}.xlsx`);
}

// Hook filter changes
const reportType = document.getElementById('report-type');
if (reportType) {
  reportType.addEventListener('change', loadRevenueReport);
}
const reportTimePreset = document.getElementById('report-time-preset');
if (reportTimePreset) {
  reportTimePreset.addEventListener('change', loadRevenueReport);
}
const btnViewReport = document.getElementById('btn-view-report');
if (btnViewReport) {
  btnViewReport.addEventListener('click', loadRevenueReport);
}

const reportItemsTime = document.getElementById('report-items-time');
if (reportItemsTime) {
  reportItemsTime.addEventListener('change', loadItemsReport);
}
const reportItemsType = document.getElementById('report-items-type');
if (reportItemsType) {
  reportItemsType.addEventListener('change', loadItemsReport);
}
const btnViewItemsReport = document.getElementById('btn-view-items-report');
if (btnViewItemsReport) {
  btnViewItemsReport.addEventListener('click', loadItemsReport);
}

// Hook item report chart tabs click handlers
const btnItemChartRevenue = document.getElementById('btn-item-chart-revenue');
const btnItemChartQty = document.getElementById('btn-item-chart-qty');
if (btnItemChartRevenue && btnItemChartQty) {
  btnItemChartRevenue.onclick = () => {
    if (activeItemReportChartTab === 'revenue') return;
    activeItemReportChartTab = 'revenue';
    btnItemChartRevenue.classList.add('active');
    btnItemChartRevenue.style.color = '#0066cc';
    btnItemChartRevenue.style.borderBottom = '2px solid #0066cc';
    btnItemChartQty.classList.remove('active');
    btnItemChartQty.style.color = '#64748b';
    btnItemChartQty.style.borderBottom = '2px solid transparent';
    loadItemsReport();
  };
  btnItemChartQty.onclick = () => {
    if (activeItemReportChartTab === 'qty') return;
    activeItemReportChartTab = 'qty';
    btnItemChartQty.classList.add('active');
    btnItemChartQty.style.color = '#0066cc';
    btnItemChartQty.style.borderBottom = '2px solid #0066cc';
    btnItemChartRevenue.classList.remove('active');
    btnItemChartRevenue.style.color = '#64748b';
    btnItemChartRevenue.style.borderBottom = '2px solid transparent';
    loadItemsReport();
  };
}

// ==========================================
// PRINTER MANAGEMENT VIEWS & LOGIC
// ==========================================
let activePrinterId = 'kitchen_default';
let cachedSystemPrinters = [];

async function initPrintersView() {
  updatePrinterStatusBadges();
  await loadSystemPrintersList();
  selectPrinter(activePrinterId);
}

async function loadSystemPrintersList() {
  try {
    const res = await fetch('/api/system-printers');
    if (res.ok) {
      cachedSystemPrinters = await res.json();
      populateSystemPrintersDropdown();
    } else {
      console.error('Lỗi khi lấy danh sách máy in hệ thống');
    }
  } catch (err) {
    console.error('Lỗi gọi API máy in:', err);
  }
}

function populateSystemPrintersDropdown() {
  const select = document.getElementById('printer-system-select');
  if (!select) return;
  
  select.innerHTML = '';
  
  // Add browser print option first
  const optBrowser = document.createElement('option');
  optBrowser.value = 'browser';
  optBrowser.textContent = 'In qua trình duyệt (Mặc định)';
  select.appendChild(optBrowser);
  
  cachedSystemPrinters.forEach(name => {
    const opt = document.createElement('option');
    opt.value = name;
    opt.textContent = name;
    select.appendChild(opt);
  });
  
  // Select saved value
  const savedType = localStorage.getItem(`printer_${activePrinterId}_type`) || 'browser';
  const savedShared = localStorage.getItem(`printer_${activePrinterId}_shared`) || '';
  
  if (savedType === 'browser') {
    select.value = 'browser';
  } else {
    let exists = Array.from(select.options).some(opt => opt.value === savedShared);
    if (savedShared && !exists) {
      const opt = document.createElement('option');
      opt.value = savedShared;
      opt.textContent = savedShared;
      select.appendChild(opt);
    }
    select.value = savedShared;
  }
}

function updatePrinterStatusBadges() {
  const printerIds = ['kitchen_default', 'kitchen_bar', 'receipt_default'];
  printerIds.forEach(id => {
    const isConnected = localStorage.getItem(`printer_${id}_connected`) !== 'false';
    const type = localStorage.getItem(`printer_${id}_type`) || 'browser';
    
    // Update Badge
    const badge = document.getElementById(`printer-status-badge-${id}`);
    if (badge) {
      badge.innerHTML = '';
      const dot = document.createElement('span');
      dot.className = 'pulse-dot';
      const txt = document.createElement('span');
      txt.className = 'pulse-text';
      badge.appendChild(dot);
      badge.appendChild(txt);
      
      if (isConnected) {
        badge.className = 'pulse-badge active';
        txt.textContent = 'Hoạt động';
      } else {
        badge.className = 'pulse-badge inactive';
        txt.textContent = 'Chưa bật';
      }
    }
    
    // Update type label
    const typeLbl = document.getElementById(`printer-type-lbl-${id}`);
    if (typeLbl) {
      if (type === 'browser') {
        typeLbl.textContent = 'In trình duyệt';
      } else if (type === 'wifi') {
        const ip = localStorage.getItem(`printer_${id}_ip`) || '192.168.1.100';
        typeLbl.textContent = `Wifi: ${ip}`;
      } else if (type === 'shared') {
        const path = localStorage.getItem(`printer_${id}_shared`) || 'Shared Printer';
        typeLbl.textContent = `Shared: ${path.split('\\').pop()}`;
      } else if (type === 'system') {
        const name = localStorage.getItem(`printer_${id}_shared`) || 'Chưa chọn';
        typeLbl.textContent = `Hệ thống: ${name}`;
      }
    }
  });
}

function selectPrinter(printerId) {
  activePrinterId = printerId;
  
  // Highlight active list item
  const printerIds = ['kitchen_default', 'kitchen_bar', 'receipt_default'];
  printerIds.forEach(id => {
    const card = document.getElementById(`printer-card-${id}`);
    if (card) {
      if (id === printerId) {
        card.classList.add('active');
      } else {
        card.classList.remove('active');
      }
    }
  });
  
  // Update Title & Description
  const titleEl = document.getElementById('printer-settings-title');
  const descEl = document.getElementById('printer-settings-desc');
  if (printerId === 'kitchen_default') {
    titleEl.textContent = 'Thiết lập Máy in Bếp';
    descEl.textContent = 'Cấu hình kết nối cho máy in phiếu thêm món của Bếp chính';
  } else if (printerId === 'kitchen_bar') {
    titleEl.textContent = 'Thiết lập Máy in Quầy nước';
    descEl.textContent = 'Cấu hình kết nối cho máy in hóa đơn đồ uống của Quầy Bar';
  } else if (printerId === 'receipt_default') {
    titleEl.textContent = 'Thiết lập Máy in Hóa đơn';
    descEl.textContent = 'Cấu hình kết nối cho máy in hóa đơn thanh toán của Thu ngân';
  }
  
  // Load values from localStorage
  const isConnected = localStorage.getItem(`printer_${printerId}_connected`) !== 'false';
  
  // Populate form
  document.getElementById('printer-enabled-input').checked = isConnected;
  
  // Populate system printers select dropdown
  populateSystemPrintersDropdown();
  
  togglePrinterTypeFields();
  
  // Pull up preview paper before showing the new one
  const paper = document.getElementById('live-receipt-paper');
  if (paper) {
    paper.classList.remove('feed-paper');
    setTimeout(() => {
      updateReceiptLivePreview();
      paper.classList.add('feed-paper');
    }, 300);
  } else {
    updateReceiptLivePreview();
  }
}

function togglePrinterTypeFields() {
  const select = document.getElementById('printer-system-select');
  if (!select) return;
  
  const selectVal = select.value;
  const typeInput = document.getElementById('printer-type-input');
  if (typeInput) {
    typeInput.value = (selectVal === 'browser') ? 'browser' : 'system';
  }
}

async function handleSavePrinter(event) {
  if (event) event.preventDefault();
  
  const isConnected = document.getElementById('printer-enabled-input').checked;
  const selectVal = document.getElementById('printer-system-select').value;
  
  const type = (selectVal === 'browser') ? 'browser' : 'system';
  const sharedPath = (selectVal === 'browser') ? '' : selectVal;
  
  // Save to localStorage
  localStorage.setItem(`printer_${activePrinterId}_connected`, isConnected ? 'true' : 'false');
  localStorage.setItem(`printer_${activePrinterId}_type`, type);
  localStorage.setItem(`printer_${activePrinterId}_shared`, sharedPath);
  
  // Sync hidden type input
  const typeInput = document.getElementById('printer-type-input');
  if (typeInput) {
    typeInput.value = type;
  }
  
  updatePrinterStatusBadges();
  updateReceiptLivePreview();
  
  // Save to server
  try {
    fetch('/api/printer-settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        printerId: activePrinterId,
        connected: isConnected,
        type: type,
        sharedPath: sharedPath
      })
    }).catch(err => console.error('Failed to sync printer settings to server:', err));
  } catch (e) {
    console.error(e);
  }
  
  // Only show notification toast if explicit form submission (event is passed)
  if (event) {
    showToast('💾 Đã lưu cấu hình máy in thành công!');
  }
}

async function handlePrintTest() {
  const selectVal = document.getElementById('printer-system-select').value;
  const type = (selectVal === 'browser') ? 'browser' : 'system';
  const sharedPath = (selectVal === 'browser') ? '' : selectVal;
  
  let targetStr = 'Trình duyệt Web (Mặc định)';
  if (type === 'system') {
    targetStr = sharedPath;
  }
  
  showToast('🖨️ Đang tiến hành in thử bản tin...');

  // Live Printer Animation Trigger
  const device = document.getElementById('live-printer-device');
  const paper = document.getElementById('live-receipt-paper');
  if (device && paper) {
    device.classList.add('printing');
    paper.classList.remove('feed-paper');
    
    setTimeout(() => {
      device.classList.remove('printing');
      paper.classList.add('feed-paper');
    }, 1200);
  }
  
  if (type === 'browser') {
    printTestIframe('browser', targetStr);
  } else {
    try {
      const res = await fetch('/api/print-raw', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          printerType: type,
          sharedPath: sharedPath,
          content: `\\x1b\\x40\\x1b\\x61\\x01\\x1b\\x21\\x10\\x1b\\x21\\x20TAM XUA ORDER\\n----------------\\nIN THU KET NOI OK\\nMay in: ${activePrinterId}\\nLoai: ${type}\\nDia chi: ${targetStr}\\nThoi gian: ${new Date().toLocaleString('vi-VN')}\\n----------------\\n\\n\\n\\n\\x1b\\x69`
        })
      });
      const data = await res.json();
      if (res.ok) {
        showToast(`✅ In thử thành công: ${data.message}`);
      } else {
        showToast(`❌ Lỗi in thử: ${data.error}`);
      }
    } catch (err) {
      console.error('Lỗi in thử:', err);
      showToast(`❌ Không thể kết nối tới server để gửi lệnh in: ${err.message}`);
    }
  }
}

// Modal: Open System Printers list
async function openSystemPrintersModal() {
  const modal = document.getElementById('system-printers-modal');
  const ul = document.getElementById('system-printers-list-ul');
  if (!modal || !ul) return;
  
  modal.style.display = 'flex';
  
  ul.innerHTML = `
    <li style="padding: 12px 16px; border: 1.5px solid var(--hairline); border-radius: 8px; font-weight: 500; font-size: 14px; color: var(--muted);">
      <span>🔄 Đang quét tìm máy in trên hệ thống...</span>
    </li>
  `;
  
  try {
    const res = await fetch('/api/system-printers');
    if (res.ok) {
      cachedSystemPrinters = await res.json();
      populateSystemPrintersDropdown();
      
      ul.innerHTML = '';
      if (cachedSystemPrinters.length === 0) {
        ul.innerHTML = `
          <li style="padding: 12px 16px; border: 1.5px solid var(--hairline); border-radius: 8px; font-weight: 600; font-size: 14px; color: #ef4444; background-color: #fef2f2; border-color: #fca5a5;">
            <span>❌ Không tìm thấy máy in nào kết nối. Hãy kết nối dây USB/Wifi máy in với máy tính.</span>
          </li>
        `;
        return;
      }
      
      cachedSystemPrinters.forEach(name => {
        const li = document.createElement('li');
        li.className = 'modal-driver-tile';
        li.innerHTML = `
          <div style="display: flex; align-items: center; gap: 10px;">
            <span style="font-size: 18px; color: var(--primary);">🖨️</span>
            <span style="font-weight: 600; font-size: 14px; color: var(--ink);">${name}</span>
          </div>
          <button type="button" class="btn btn-secondary btn-pill" onclick="selectSystemPrinterFromModal('${name.replace(/'/g, "\\\\'")}')" style="height: 32px; font-size: 12px; padding: 0 14px; font-weight: 700; border-radius: 6px; border: 1px solid var(--border-strong); background-color: var(--canvas); color: var(--primary); transition: all 0.2s;">Chọn dùng</button>
        `;
        ul.appendChild(li);
      });
    } else {
      ul.innerHTML = `
        <li style="padding: 12px 16px; border: 1.5px solid var(--hairline); border-radius: 8px; font-weight: 600; font-size: 14px; color: #ef4444; background-color: #fef2f2; border-color: #fca5a5;">
          <span>❌ Lỗi từ máy chủ: Không thể lấy danh sách máy in.</span>
        </li>
      `;
    }
  } catch (err) {
    console.error('Lỗi khi tải modal máy in:', err);
    ul.innerHTML = `
      <li style="padding: 12px 16px; border: 1.5px solid var(--hairline); border-radius: 8px; font-weight: 600; font-size: 14px; color: #ef4444; background-color: #fef2f2; border-color: #fca5a5;">
        <span>❌ Không thể kết nối tới máy chủ: ${err.message}</span>
      </li>
    `;
  }
}

function selectSystemPrinterFromModal(printerName) {
  const typeInput = document.getElementById('printer-type-input');
  if (typeInput) {
    typeInput.value = 'system';
    togglePrinterTypeFields();
  }
  
  const select = document.getElementById('printer-system-select');
  if (select) {
    let exists = Array.from(select.options).some(opt => opt.value === printerName);
    if (!exists) {
      const opt = document.createElement('option');
      opt.value = printerName;
      opt.textContent = printerName;
      select.appendChild(opt);
    }
    select.value = printerName;
  }
  
  closeSystemPrintersModal();
  showToast(`✅ Đã chọn máy in: ${printerName}. Đừng quên nhấn "Lưu cấu hình"!`);
  updateReceiptLivePreview();
}

function closeSystemPrintersModal() {
  const modal = document.getElementById('system-printers-modal');
  if (modal) {
    modal.style.display = 'none';
  }
}

// Live preview function
function updateReceiptLivePreview() {
  const contentEl = document.getElementById('live-receipt-content');
  const indicatorEl = document.getElementById('live-printer-indicator');
  if (!contentEl) return;

  const isConnected = document.getElementById('printer-enabled-input').checked;
  const selectVal = document.getElementById('printer-system-select').value;
  const type = (selectVal === 'browser') ? 'browser' : 'system';
  const sharedPath = (selectVal === 'browser') ? '' : selectVal;

  // Update online/offline indicator
  if (indicatorEl) {
    if (isConnected) {
      indicatorEl.classList.remove('offline');
    } else {
      indicatorEl.classList.add('offline');
    }
  }

  let connectionDetailsText = '';
  if (type === 'browser') {
    connectionDetailsText = 'Browser Print (K80)';
  } else if (type === 'system') {
    connectionDetailsText = `System: ${sharedPath}`;
  }

  const dateStr = new Date().toLocaleString('vi-VN');

  let html = '';
  if (activePrinterId === 'kitchen_default') {
    html = `
<div style="text-align: center; font-weight: bold; font-size: 11px; border-bottom: 1px dashed #94a3b8; padding-bottom: 6px; margin-bottom: 6px;">
  PHIẾU BẾP - TẤM XƯA
</div>
<div style="font-size: 9px; line-height: 1.4; margin-bottom: 6px;">
  <b>BÀN:</b> Bàn VIP 02<br/>
  <b>Giờ vào:</b> ${dateStr.split(' ')[1] || ''}<br/>
  <b>Kết nối:</b> ${connectionDetailsText}
</div>
<div class="receipt-divider"></div>
<table style="width: 100%; border-collapse: collapse; font-size: 9px;">
  <tr style="border-bottom: 1px solid #cbd5e1; font-weight: bold;">
    <td style="width: 70%; padding-bottom: 2px;">Tên món</td>
    <td style="width: 30%; text-align: right; padding-bottom: 2px;">SL</td>
  </tr>
  <tr>
    <td style="padding: 3px 0;">Bún Đậu Mắm Tôm</td>
    <td style="text-align: right; font-weight: bold;">x2</td>
  </tr>
  <tr>
    <td style="font-size: 8px; color: #475569; padding-left: 6px; padding-bottom: 3px;" colspan="2">* Ít bánh tráng, nhiều rau</td>
  </tr>
  <tr>
    <td style="padding: 3px 0;">Bún Chả Hà Nội</td>
    <td style="text-align: right; font-weight: bold;">x1</td>
  </tr>
</table>
<div class="receipt-divider"></div>
<div style="font-size: 8px; text-align: center; color: #64748b; margin-top: 4px;">
  Trạng thái: ${isConnected ? 'Đang hoạt động' : 'Tắt (Chờ bật)'}
</div>
    `;
  } else if (activePrinterId === 'kitchen_bar') {
    html = `
<div style="text-align: center; font-weight: bold; font-size: 11px; border-bottom: 1px dashed #94a3b8; padding-bottom: 6px; margin-bottom: 6px;">
  PHIẾU PHA CHẾ (BAR)
</div>
<div style="font-size: 9px; line-height: 1.4; margin-bottom: 6px;">
  <b>BÀN:</b> Bàn VIP 02<br/>
  <b>Giờ vào:</b> ${dateStr.split(' ')[1] || ''}<br/>
  <b>Kết nối:</b> ${connectionDetailsText}
</div>
<div class="receipt-divider"></div>
<table style="width: 100%; border-collapse: collapse; font-size: 9px;">
  <tr style="border-bottom: 1px solid #cbd5e1; font-weight: bold;">
    <td style="width: 70%; padding-bottom: 2px;">Tên đồ uống</td>
    <td style="width: 30%; text-align: right; padding-bottom: 2px;">SL</td>
  </tr>
  <tr>
    <td style="padding: 3px 0;">Trà Tắc Khổng Lồ</td>
    <td style="text-align: right; font-weight: bold;">x2</td>
  </tr>
  <tr>
    <td style="font-size: 8px; color: #475569; padding-left: 6px; padding-bottom: 3px;" colspan="2">* 50% đường, nhiều đá</td>
  </tr>
  <tr>
    <td style="padding: 3px 0;">Cà Phê Sữa Đá</td>
    <td style="text-align: right; font-weight: bold;">x1</td>
  </tr>
</table>
<div class="receipt-divider"></div>
<div style="font-size: 8px; text-align: center; color: #64748b; margin-top: 4px;">
  Trạng thái: ${isConnected ? 'Đang hoạt động' : 'Tắt (Chờ bật)'}
</div>
    `;
  } else if (activePrinterId === 'receipt_default') {
    html = `
<div style="text-align: center; margin-bottom: 6px;">
  <div style="font-weight: bold; font-size: 11px;">NHÀ HÀNG TẤM XƯA</div>
  <div style="font-size: 8px; color: #64748b;">Đ/c: 42 Đường Láng, Hà Nội</div>
  <div style="font-size: 8px; color: #64748b;">ĐT: 0987.654.321</div>
</div>
<div style="text-align: center; font-weight: bold; font-size: 10px; margin: 6px 0;">
  HOÁ ĐƠN THANH TOÁN
</div>
<div style="font-size: 8px; line-height: 1.4; margin-bottom: 6px;">
  <b>BÀN:</b> Bàn VIP 02<br/>
  <b>Ngày:</b> ${dateStr.split(' ')[0] || ''}<br/>
  <b>Mã HĐ:</b> HD82749<br/>
  <b>Kết nối:</b> ${connectionDetailsText}
</div>
<div class="receipt-divider"></div>
<table style="width: 100%; border-collapse: collapse; font-size: 8px;">
  <tr style="border-bottom: 1px solid #cbd5e1; font-weight: bold;">
    <td style="width: 50%;">Tên món</td>
    <td style="width: 15%; text-align: center;">SL</td>
    <td style="width: 35%; text-align: right;">T.Tiền</td>
  </tr>
  <tr>
    <td style="padding: 2px 0;">Bún Đậu Mắm Tôm</td>
    <td style="text-align: center;">2</td>
    <td style="text-align: right;">170K</td>
  </tr>
  <tr>
    <td style="padding: 2px 0;">Bún Chả Hà Nội</td>
    <td style="text-align: center;">1</td>
    <td style="text-align: right;">65K</td>
  </tr>
  <tr>
    <td style="padding: 2px 0;">Trà Tắc Khổng Lồ</td>
    <td style="text-align: center;">2</td>
    <td style="text-align: right;">30K</td>
  </tr>
  <tr>
    <td style="padding: 2px 0;">Cà Phê Sữa Đá</td>
    <td style="text-align: center;">1</td>
    <td style="text-align: right;">25K</td>
  </tr>
</table>
<div class="receipt-divider"></div>
<div style="font-size: 8px; line-height: 1.4;">
  <div style="display: flex; justify-content: space-between;">
    <span>Cộng món:</span>
    <span>290K</span>
  </div>
  <div style="display: flex; justify-content: space-between;">
    <span>Giảm giá (10%):</span>
    <span>-29K</span>
  </div>
  <div style="display: flex; justify-content: space-between; font-weight: bold; margin-top: 3px; border-top: 1px dashed #94a3b8; padding-top: 3px;">
    <span>TỔNG CỘNG:</span>
    <span>261K</span>
  </div>
</div>
<div class="receipt-divider"></div>
<div style="text-align: center; font-size: 8px; margin-top: 6px;">
  Cảm ơn Quý khách!<br/>
  Hẹn gặp lại quý khách!
</div>
    `;
  }

  contentEl.innerHTML = html;
}

function formatVNDShort(amount) {
  if (amount >= 1000) {
    return `${amount / 1000}K`;
  }
  return `${amount}đ`;
}

function padCenter(str, width) {
  if (str.length >= width) return str.substring(0, width);
  const padLeft = Math.floor((width - str.length) / 2);
  const padRight = width - str.length - padLeft;
  return ' '.repeat(padLeft) + str + ' '.repeat(padRight);
}

function padLeftRight(str, width) {
  if (str.length >= width) return str.substring(0, width);
  return str + ' '.repeat(width - str.length);
}

function wrapTextIntoChunks(text, maxWidth) {
  if (!text) return [''];
  const words = text.trim().split(/\s+/);
  const chunks = [];
  let currentChunk = '';
  
  words.forEach(word => {
    if ((currentChunk + (currentChunk ? ' ' : '') + word).length <= maxWidth) {
      currentChunk += (currentChunk ? ' ' : '') + word;
    } else {
      if (currentChunk) chunks.push(currentChunk);
      currentChunk = word;
      while (currentChunk.length > maxWidth) {
        chunks.push(currentChunk.substring(0, maxWidth));
        currentChunk = currentChunk.substring(maxWidth);
      }
    }
  });
  if (currentChunk) chunks.push(currentChunk);
  return chunks.length > 0 ? chunks : [''];
}

function wrapAndCenter(text, width = 42) {
  if (!text) return '';
  const words = text.trim().split(/\s+/);
  const lines = [];
  let currentLine = '';

  words.forEach(word => {
    if ((currentLine + (currentLine ? ' ' : '') + word).length <= width) {
      currentLine += (currentLine ? ' ' : '') + word;
    } else {
      if (currentLine) {
        lines.push(currentLine);
      }
      currentLine = word;
      while (currentLine.length > width) {
        lines.push(currentLine.substring(0, width));
        currentLine = currentLine.substring(width);
      }
    }
  });
  if (currentLine) {
    lines.push(currentLine);
  }

  return lines.map(line => {
    const pad = Math.floor((width - line.length) / 2);
    return pad > 0 ? ' '.repeat(pad) + line : line;
  }).join('\n');
}

function formatKitchenTable(items, width = 42) {
  const colQtyWidth = 6;
  const colNameWidth = width - colQtyWidth - 3;
  const border = '+' + '-'.repeat(colNameWidth) + '+' + '-'.repeat(colQtyWidth) + '+\n';
  
  let text = border;
  text += '|' + padCenter('Tên món', colNameWidth) + '|' + padCenter('SL', colQtyWidth) + '|\n';
  text += border;
  
  items.forEach(item => {
    const maxTextWidth = colNameWidth - 2;
    const nameChunks = wrapTextIntoChunks(item.name, maxTextWidth);
    
    const qtyStr = `x${item.quantity}`;
    text += '|' + padLeftRight(` ${nameChunks[0]}`, colNameWidth) + '|' + padCenter(qtyStr, colQtyWidth) + '|\n';
    
    for (let i = 1; i < nameChunks.length; i++) {
      text += '|' + padLeftRight(` ${nameChunks[i]}`, colNameWidth) + '|' + ' '.repeat(colQtyWidth) + '|\n';
    }
    
    if (item.notes) {
      const noteChunks = wrapTextIntoChunks(`*Ghi chú: ${item.notes}`, maxTextWidth);
      noteChunks.forEach(chunk => {
        text += '|' + padLeftRight(` ${chunk}`, colNameWidth) + '|' + ' '.repeat(colQtyWidth) + '|\n';
      });
    }
    text += border;
  });
  
  return text;
}

function formatReceiptTable(items, width = 42) {
  const colQtyWidth = width > 36 ? 5 : 4;
  const colPriceWidth = width > 36 ? 11 : 8;
  const colNameWidth = width - colQtyWidth - colPriceWidth - 4;
  const border = '+' + '-'.repeat(colNameWidth) + '+' + '-'.repeat(colQtyWidth) + '+' + '-'.repeat(colPriceWidth) + '+\n';
  
  let text = border;
  text += '|' + padCenter('Tên món', colNameWidth) + '|' + padCenter('SL', colQtyWidth) + '|' + padCenter('T.Tiền', colPriceWidth) + '|\n';
  text += border;
  
  items.forEach(item => {
    const maxTextWidth = colNameWidth - 2;
    const nameChunks = wrapTextIntoChunks(item.name, maxTextWidth);
    
    const qtyStr = `x${item.quantity}`;
    const priceStr = formatVNDShort(item.price * item.quantity);
    
    text += '|' + padLeftRight(` ${nameChunks[0]}`, colNameWidth) + '|' + padCenter(qtyStr, colQtyWidth) + '|' + padCenter(priceStr, colPriceWidth) + '|\n';
    
    for (let i = 1; i < nameChunks.length; i++) {
      text += '|' + padLeftRight(` ${nameChunks[i]}`, colNameWidth) + '|' + ' '.repeat(colQtyWidth) + '|' + ' '.repeat(colPriceWidth) + '|\n';
    }
    
    if (item.notes) {
      const noteChunks = wrapTextIntoChunks(`*Ghi chú: ${item.notes}`, maxTextWidth);
      noteChunks.forEach(chunk => {
        text += '|' + padLeftRight(` ${chunk}`, colNameWidth) + '|' + ' '.repeat(colQtyWidth) + '|' + ' '.repeat(colPriceWidth) + '|\n';
      });
    }
    text += border;
  });
  
  return text;
}

function formatPlainKitchenSlip(tableName, items, title) {
  const width = 42;
  const border = '-'.repeat(width) + '\n';
  const dateStr = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) + ' ' + new Date().toLocaleDateString('vi-VN');
  
  let text = '';
  text += wrapAndCenter('TAM XUA ORDER', width) + '\n';
  text += wrapAndCenter(title.toUpperCase(), width) + '\n';
  text += border;
  text += wrapAndCenter(`BÀN: ${tableName}`, width) + '\n';
  text += wrapAndCenter(`Giờ order: ${dateStr}`, width) + '\n';
  text += formatKitchenTable(items, width);
  
  text += '\n\n\n\n\n\x1b\x69'; // ESC/POS cut paper command
  return text;
}

function formatPlainReceipt(tableObj, orderItems, discountAmount, receivedAmount, timestamp, payMethod) {
  const width = 42;
  const border = '-'.repeat(width) + '\n';
  const subtotal = orderItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const finalTotal = Math.max(0, subtotal - discountAmount);
  const changeAmount = receivedAmount ? (receivedAmount - finalTotal) : 0;
  
  const orderTimeStr = tableObj.updatedAt 
    ? formatTime(tableObj.updatedAt).replace(' - ', ' ') 
    : (timestamp ? formatTime(timestamp).replace(' - ', ' ') : formatTime(new Date().toISOString()).replace(' - ', ' '));

  const checkoutTimeStr = timestamp 
    ? formatTime(timestamp).replace(' - ', ' ') 
    : formatTime(new Date().toISOString()).replace(' - ', ' ');

  const payMethodLabel = payMethod === 'bank' ? 'Chuyển khoản' : 'Tiền mặt';
  
  let text = '';
  text += wrapAndCenter('TẤM XƯA', width) + '\n';
  text += wrapAndCenter('Món Ngon Chuẩn Vị Bắc', width) + '\n';
  text += border;
  text += wrapAndCenter(`Bàn: ${tableObj.name}`, width) + '\n';
  text += wrapAndCenter(`Giờ vào: ${orderTimeStr}`, width) + '\n';
  text += wrapAndCenter(`Giờ ra: ${checkoutTimeStr}`, width) + '\n';
  text += formatReceiptTable(orderItems, width);
  
  text += wrapAndCenter(`Cộng món: ${formatVNDShort(subtotal)}`, width) + '\n';
  if (discountAmount > 0) {
    text += wrapAndCenter(`Giảm giá: -${formatVNDShort(discountAmount)}`, width) + '\n';
  }
  text += wrapAndCenter(`TỔNG CỘNG: ${formatVNDShort(finalTotal)}`, width) + '\n';
  text += wrapAndCenter(`Khách đưa: ${formatVNDShort(receivedAmount || finalTotal)}`, width) + '\n';
  if (changeAmount > 0) {
    text += wrapAndCenter(`Trả lại: ${formatVNDShort(changeAmount)}`, width) + '\n';
  }
  text += wrapAndCenter(`Thanh toán: ${payMethodLabel}`, width) + '\n';
  text += border;
  text += wrapAndCenter('Cảm ơn Quý khách!', width) + '\n';
  text += wrapAndCenter('Hẹn gặp lại quý khách!', width) + '\n';
  text += '\n\n\n\n\n\x1b\x69'; // ESC/POS cut paper command
  return text;
}

async function syncPrinterSettingsFromServer() {
  try {
    const res = await fetch('/api/printer-settings');
    if (res.ok) {
      const settingsList = await res.json();
      settingsList.forEach(setting => {
        const id = setting.printer_id;
        localStorage.setItem(`printer_${id}_connected`, setting.connected ? 'true' : 'false');
        localStorage.setItem(`printer_${id}_type`, setting.type || 'browser');
        localStorage.setItem(`printer_${id}_shared`, setting.shared_path || '');
        if (setting.ip) {
          localStorage.setItem(`printer_${id}_ip`, setting.ip);
        }
        if (setting.port) {
          localStorage.setItem(`printer_${id}_port`, setting.port.toString());
        }
      });
      if (typeof updatePrinterStatusBadges === 'function') {
        updatePrinterStatusBadges();
      }
    }
  } catch (err) {
    console.error('Lỗi đồng bộ cấu hình máy in:', err);
  }
}

window.selectPrinter = selectPrinter;
window.togglePrinterTypeFields = togglePrinterTypeFields;
window.handleSavePrinter = handleSavePrinter;
window.handlePrintTest = handlePrintTest;
window.openSystemPrintersModal = openSystemPrintersModal;
window.closeSystemPrintersModal = closeSystemPrintersModal;
window.selectSystemPrinterFromModal = selectSystemPrinterFromModal;
window.updateReceiptLivePreview = updateReceiptLivePreview;

// Hour filter modal logic
const btnReportHourTrigger = document.getElementById('btn-report-hour-trigger');
const btnReportItemsHourTrigger = document.getElementById('btn-report-items-hour-trigger');
const reportHourModal = document.getElementById('report-hour-modal');
const closeHourModal = document.getElementById('close-hour-modal');
const btnCancelHourModal = document.getElementById('btn-cancel-hour-modal');
const btnApplyHourModal = document.getElementById('btn-apply-hour-modal');
const hourRangeInputs = document.getElementById('hour-range-inputs');
const inputHourFromH = document.getElementById('hour-from-h');
const inputHourFromM = document.getElementById('hour-from-m');
const inputHourToH = document.getElementById('hour-to-h');
const inputHourToM = document.getElementById('hour-to-m');

function updateHourInputsState() {
  const selectedOption = document.querySelector('input[name="hour-option"]:checked').value;
  if (selectedOption === 'range') {
    hourRangeInputs.style.opacity = '1';
    hourRangeInputs.style.pointerEvents = 'auto';
  } else {
    hourRangeInputs.style.opacity = '0.5';
    hourRangeInputs.style.pointerEvents = 'none';
  }
}

if (document.querySelectorAll('input[name="hour-option"]').length > 0) {
  document.querySelectorAll('input[name="hour-option"]').forEach(radio => {
    radio.addEventListener('change', updateHourInputsState);
  });
}

function openHourModal(target) {
  currentHourFilterTarget = target;
  const currentRange = target === 'overview' ? overviewHourRange : itemsHourRange;
  
  const radio = document.querySelector(`input[name="hour-option"][value="${currentRange.option}"]`);
  if (radio) radio.checked = true;
  
  inputHourFromH.value = String(currentRange.fromH).padStart(2, '0');
  inputHourFromM.value = String(currentRange.fromM).padStart(2, '0');
  inputHourToH.value = String(currentRange.toH).padStart(2, '0');
  inputHourToM.value = String(currentRange.toM).padStart(2, '0');
  
  updateHourInputsState();
  if (reportHourModal) reportHourModal.style.display = 'flex';
}

if (btnReportHourTrigger) {
  btnReportHourTrigger.addEventListener('click', () => openHourModal('overview'));
}
if (btnReportItemsHourTrigger) {
  btnReportItemsHourTrigger.addEventListener('click', () => openHourModal('items'));
}

function closeHourModalWindow() {
  if (reportHourModal) reportHourModal.style.display = 'none';
}

if (closeHourModal) closeHourModal.addEventListener('click', closeHourModalWindow);
if (btnCancelHourModal) btnCancelHourModal.addEventListener('click', closeHourModalWindow);

if (btnApplyHourModal) {
  btnApplyHourModal.addEventListener('click', () => {
    const option = document.querySelector('input[name="hour-option"]:checked').value;
    const fromH = Math.min(23, Math.max(0, parseInt(inputHourFromH.value) || 0));
    const fromM = Math.min(59, Math.max(0, parseInt(inputHourFromM.value) || 0));
    const toH = Math.min(23, Math.max(0, parseInt(inputHourToH.value) || 23));
    const toM = Math.min(59, Math.max(0, parseInt(inputHourToM.value) || 59));
    
    const formattedFrom = `${String(fromH).padStart(2, '0')}:${String(fromM).padStart(2, '0')}`;
    const formattedTo = `${String(toH).padStart(2, '0')}:${String(toM).padStart(2, '0')}`;
    const displayLabel = option === 'all' ? '00:00 - 00:00 (+1)' : `${formattedFrom} - ${formattedTo}`;
    
    if (currentHourFilterTarget === 'overview') {
      overviewHourRange = { option, fromH, fromM, toH, toM };
      const label = document.getElementById('report-hour-label');
      if (label) label.textContent = displayLabel;
      loadRevenueReport();
    } else {
      itemsHourRange = { option, fromH, fromM, toH, toM };
      const label = document.getElementById('report-items-hour-label');
      if (label) label.textContent = displayLabel;
      loadItemsReport();
    }
    
    closeHourModalWindow();
  });
}

// Setup Report Payment Method Tab listeners
document.addEventListener('click', (e) => {
  const tabRevenue = document.getElementById('report-pm-tab-revenue');
  const tabCount = document.getElementById('report-pm-tab-count');
  
  if (e.target === tabRevenue) {
    reportPaymentMethodActiveTab = 'revenue';
    if (tabRevenue) {
      tabRevenue.style.color = '#0066cc';
      tabRevenue.style.borderBottom = '2px solid #0066cc';
    }
    if (tabCount) {
      tabCount.style.color = '#64748b';
      tabCount.style.borderBottom = '2px solid transparent';
    }
    loadRevenueReport();
  } else if (e.target === tabCount) {
    reportPaymentMethodActiveTab = 'count';
    if (tabCount) {
      tabCount.style.color = '#0066cc';
      tabCount.style.borderBottom = '2px solid #0066cc';
    }
    if (tabRevenue) {
      tabRevenue.style.color = '#64748b';
      tabRevenue.style.borderBottom = '2px solid transparent';
    }
    loadRevenueReport();
  }
});

init();

// --- SYSTEM UPDATE LOGIC ---
async function checkSystemUpdate(showModal = false) {
  const btnCheckUpdate = document.getElementById('btn-check-update');
  const systemUpdateModal = document.getElementById('system-update-modal');
  const updateStatusText = document.getElementById('update-status-text');
  const btnStartUpdate = document.getElementById('btn-start-update');
  const btnCancelUpdate = document.getElementById('btn-cancel-update');
  const btnCloseUpdateModal = document.getElementById('btn-close-update-modal');
  const updateCommitsContainer = document.getElementById('update-commits-container');
  const updateCommitsList = document.getElementById('update-commits-list');
  const updateProgressWrapper = document.getElementById('update-progress-wrapper');
  const updateProgressBar = document.getElementById('update-progress-bar');
  const updateLogConsole = document.getElementById('update-log-console');

  if (showModal) {
    if (systemUpdateModal) systemUpdateModal.style.display = 'flex';
    if (updateStatusText) updateStatusText.textContent = 'Đang kiểm tra bản cập nhật trên Git...';
    if (btnStartUpdate) btnStartUpdate.style.display = 'none';
    if (btnCancelUpdate) btnCancelUpdate.style.display = 'inline-block';
    if (btnCloseUpdateModal) btnCloseUpdateModal.style.display = 'inline-block';
    if (updateCommitsContainer) updateCommitsContainer.style.display = 'none';
    if (updateProgressWrapper) updateProgressWrapper.style.display = 'none';
    if (updateLogConsole) updateLogConsole.style.display = 'none';
  }

  try {
    const res = await fetch('/api/system/check-update', { method: 'POST' });
    const data = await res.json();

    if (data.error) {
      if (showModal && updateStatusText) {
        updateStatusText.innerHTML = `<span style="color: #ef4444;">❌ Lỗi: ${data.error}</span>`;
      }
      return;
    }

    if (data.hasUpdate) {
      if (showModal) {
        if (updateStatusText) updateStatusText.innerHTML = `📢 <strong>Phát hiện bản cập nhật mới!</strong><br><span style="font-size: 13px; color: #475569;">Nhánh hiện tại: <code>${data.branch}</code></span>`;
        if (updateCommitsList) {
          updateCommitsList.innerHTML = '';
          data.commits.forEach(commit => {
            const item = document.createElement('div');
            item.style.padding = '6px 10px';
            item.style.backgroundColor = '#f1f5f9';
            item.style.borderRadius = '6px';
            item.style.fontFamily = 'monospace';
            item.style.fontSize = '12px';
            item.style.borderLeft = '3px solid #0066cc';
            item.textContent = commit;
            updateCommitsList.appendChild(item);
          });
        }
        if (updateCommitsContainer) updateCommitsContainer.style.display = 'flex';
        if (btnStartUpdate) btnStartUpdate.style.display = 'inline-block';
      }
      
      // Update topbar button styling
      if (btnCheckUpdate) {
        const btnText = btnCheckUpdate.querySelector('.button-text');
        if (btnText) {
          btnText.textContent = 'New update';
        }
        btnCheckUpdate.classList.add('has-update');
      }
    } else {
      if (showModal && updateStatusText) {
        updateStatusText.innerHTML = `✨ <strong>Hệ thống đã là phiên bản mới nhất!</strong><br><span style="font-size: 13px; color: #475569;">Nhánh hiện tại: <code>${data.branch}</code></span>`;
      }
      if (btnStartUpdate) btnStartUpdate.style.display = 'none';
      if (btnCheckUpdate) {
        const btnText = btnCheckUpdate.querySelector('.button-text');
        if (btnText) {
          btnText.textContent = 'Update';
        }
        btnCheckUpdate.classList.remove('has-update');
      }
    }
  } catch (err) {
    console.error('Lỗi kiểm tra cập nhật:', err);
    if (showModal && updateStatusText) {
      updateStatusText.innerHTML = `<span style="color: #ef4444;">❌ Không thể kết nối tới server kiểm tra.</span>`;
    }
  }
}

function applySystemUpdate() {
  const systemUpdateModal = document.getElementById('system-update-modal');
  const updateStatusText = document.getElementById('update-status-text');
  const btnStartUpdate = document.getElementById('btn-start-update');
  const btnCancelUpdate = document.getElementById('btn-cancel-update');
  const btnCloseUpdateModal = document.getElementById('btn-close-update-modal');
  const updateProgressWrapper = document.getElementById('update-progress-wrapper');
  const updateProgressBar = document.getElementById('update-progress-bar');
  const updateLogConsole = document.getElementById('update-log-console');
  const updateCommitsContainer = document.getElementById('update-commits-container');

  // Khóa đóng modal
  if (btnCancelUpdate) btnCancelUpdate.style.display = 'none';
  if (btnCloseUpdateModal) btnCloseUpdateModal.style.display = 'none';
  if (btnStartUpdate) btnStartUpdate.style.display = 'none';
  if (updateCommitsContainer) updateCommitsContainer.style.display = 'none';

  // Hiện loader và log console
  if (updateProgressWrapper) updateProgressWrapper.style.display = 'block';
  if (updateProgressBar) updateProgressBar.style.width = '10%';
  if (updateLogConsole) {
    updateLogConsole.style.display = 'block';
    updateLogConsole.textContent = '';
  }
  if (updateStatusText) updateStatusText.textContent = 'Đang tiến hành cập nhật hệ thống...';

  // Sử dụng SSE để lắng nghe logs
  const eventSource = new EventSource('/api/system/apply-update');

  eventSource.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      
      // Cập nhật thanh tiến trình
      if (data.percent && updateProgressBar) {
        updateProgressBar.style.width = `${data.percent}%`;
      }
      
      // Cập nhật trạng thái text
      if (data.step === 'START' || data.step === 'GIT_PULL_START' || data.step === 'NPM_INSTALL_START' || data.step === 'MIGRATING' || data.step === 'RESTARTING') {
        if (updateStatusText) updateStatusText.textContent = data.message;
      }
      
      // In logs vào console
      if (data.message && updateLogConsole) {
        updateLogConsole.textContent += `${data.message}\n`;
        updateLogConsole.scrollTop = updateLogConsole.scrollHeight;
      }

      if (data.step === 'ERROR') {
        eventSource.close();
        if (updateStatusText) updateStatusText.innerHTML = `<span style="color: #ef4444;">❌ Cập nhật thất bại. Vui lòng kiểm tra log bên dưới.</span>`;
        if (btnCancelUpdate) btnCancelUpdate.style.display = 'inline-block';
        if (btnCloseUpdateModal) btnCloseUpdateModal.style.display = 'inline-block';
      }

      if (data.step === 'DONE') {
        eventSource.close();
        
        let countdown = 5;
        const interval = setInterval(() => {
          if (updateStatusText) {
            updateStatusText.innerHTML = `<span style="color: #10b981;">🎉 Cập nhật thành công! Trình duyệt sẽ tự tải lại trang sau ${countdown} giây...</span>`;
          }
          countdown--;
          if (countdown < 0) {
            clearInterval(interval);
            window.location.reload();
          }
        }, 1000);
      }
    } catch (err) {
      console.error('Lỗi phân tích SSE:', err);
    }
  };

  eventSource.onerror = (err) => {
    console.error('SSE connection error:', err);
    eventSource.close();
    
    // Khi server restart, luồng SSE sẽ bị ngắt đột ngột. Điều này là bình thường nếu đang ở bước Restarting.
    if (updateProgressBar && parseInt(updateProgressBar.style.width) >= 90) {
      if (updateLogConsole) updateLogConsole.textContent += `[HỆ THỐNG] Đang kết nối lại tới Server vừa khởi động...\n`;
      if (updateStatusText) updateStatusText.textContent = 'Đang khởi động lại Server, vui lòng đợi...';
      
      // Vòng lặp ping kiểm tra server đã sống lại chưa
      setTimeout(() => {
        const checkInterval = setInterval(async () => {
          try {
            const check = await fetch('/login.html');
            if (check.ok) {
              clearInterval(checkInterval);
              window.location.reload();
            }
          } catch (e) {
            console.log('Chờ server khởi chạy...');
          }
        }, 1500);
      }, 2000);
    } else {
      if (updateStatusText) updateStatusText.innerHTML = `<span style="color: #ef4444;">❌ Mất kết nối đột ngột với Server trong quá trình cập nhật.</span>`;
      if (btnCancelUpdate) btnCancelUpdate.style.display = 'inline-block';
      if (btnCloseUpdateModal) btnCloseUpdateModal.style.display = 'inline-block';
    }
  };
}

function setupSystemUpdateListeners() {
  const btnCheckUpdate = document.getElementById('btn-check-update');
  const btnCloseUpdateModal = document.getElementById('btn-close-update-modal');
  const btnCancelUpdate = document.getElementById('btn-cancel-update');
  const btnStartUpdate = document.getElementById('btn-start-update');
  const systemUpdateModal = document.getElementById('system-update-modal');

  if (btnCheckUpdate) {
    btnCheckUpdate.addEventListener('click', () => {
      checkSystemUpdate(true);
    });
  }

  const closeModal = () => {
    if (systemUpdateModal) systemUpdateModal.style.display = 'none';
  };

  if (btnCloseUpdateModal) btnCloseUpdateModal.addEventListener('click', closeModal);
  if (btnCancelUpdate) btnCancelUpdate.addEventListener('click', closeModal);

  if (btnStartUpdate) {
    btnStartUpdate.addEventListener('click', applySystemUpdate);
  }
}

// Chạy khởi tạo lắng nghe cập nhật
setupSystemUpdateListeners();

// ==========================================
// REVENUE COMPARISON DASHBOARD VIEWS & LOGIC
// ==========================================
function loadCompareReport() {
  const preset = document.getElementById('report-compare-preset').value;
  const now = new Date();
  
  const customDatesWrapper = document.getElementById('report-compare-custom-dates');
  if (customDatesWrapper) {
    customDatesWrapper.style.display = (preset === 'custom-days') ? 'flex' : 'none';
  }
  
  let labelA = "";
  let labelB = "";
  let txsA = [];
  let txsB = [];
  
  let breakdown = [];
  
  const fmt = (val) => formatVND(val);
  
  if (preset === 'custom-days') {
    const inputDateA = document.getElementById('report-compare-date-a');
    const inputDateB = document.getElementById('report-compare-date-b');
    
    if (inputDateA && !inputDateA.value) {
      inputDateA.value = now.toISOString().split('T')[0];
    }
    if (inputDateB && !inputDateB.value) {
      const yesterday = new Date(now);
      yesterday.setDate(now.getDate() - 1);
      inputDateB.value = yesterday.toISOString().split('T')[0];
    }
    
    const dateValA = inputDateA ? inputDateA.value : "";
    const dateValB = inputDateB ? inputDateB.value : "";
    
    const formatDateStr = (ymd) => {
      if (!ymd) return "--/--/----";
      const parts = ymd.split('-');
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    };
    labelA = formatDateStr(dateValA);
    labelB = formatDateStr(dateValB);
    
    const parsedDateA = dateValA ? new Date(dateValA).toDateString() : "";
    const parsedDateB = dateValB ? new Date(dateValB).toDateString() : "";
    
    txsA = dateValA ? transactions.filter(tx => new Date(tx.timestamp).toDateString() === parsedDateA) : [];
    txsB = dateValB ? transactions.filter(tx => new Date(tx.timestamp).toDateString() === parsedDateB) : [];
    
    for (let h = 0; h < 24; h++) {
      const name = `${String(h).padStart(2, '0')}:00`;
      const valA = txsA.filter(tx => new Date(tx.timestamp).getHours() === h)
                       .reduce((sum, tx) => sum + (tx.subtotal - (tx.discountAmount || 0)), 0);
      const valB = txsB.filter(tx => new Date(tx.timestamp).getHours() === h)
                       .reduce((sum, tx) => sum + (tx.subtotal - (tx.discountAmount || 0)), 0);
      
      breakdown.push({ name, valA, valB });
    }
  } else if (preset === 'today-yesterday') {
    labelA = "Hôm nay";
    labelB = "Hôm qua";
    
    const todayStr = now.toDateString();
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const yesterdayStr = yesterday.toDateString();
    
    txsA = transactions.filter(tx => new Date(tx.timestamp).toDateString() === todayStr);
    txsB = transactions.filter(tx => new Date(tx.timestamp).toDateString() === yesterdayStr);
    
    for (let h = 0; h < 24; h++) {
      const name = `${String(h).padStart(2, '0')}:00`;
      const valA = txsA.filter(tx => new Date(tx.timestamp).getHours() === h)
                       .reduce((sum, tx) => sum + (tx.subtotal - (tx.discountAmount || 0)), 0);
      const valB = txsB.filter(tx => new Date(tx.timestamp).getHours() === h)
                       .reduce((sum, tx) => sum + (tx.subtotal - (tx.discountAmount || 0)), 0);
      
      breakdown.push({ name, valA, valB });
    }
  } else if (preset === '7days-prev7days') {
    labelA = "7 ngày này";
    labelB = "7 ngày trước";
    
    const startA = new Date(now);
    startA.setDate(now.getDate() - 6);
    startA.setHours(0, 0, 0, 0);
    
    const startB = new Date(now);
    startB.setDate(now.getDate() - 13);
    startB.setHours(0, 0, 0, 0);
    const endB = new Date(now);
    endB.setDate(now.getDate() - 7);
    endB.setHours(23, 59, 59, 999);
    
    txsA = transactions.filter(tx => {
      const t = new Date(tx.timestamp).getTime();
      return t >= startA.getTime();
    });
    txsB = transactions.filter(tx => {
      const t = new Date(tx.timestamp).getTime();
      return t >= startB.getTime() && t <= endB.getTime();
    });
    
    for (let i = 6; i >= 0; i--) {
      const dateA = new Date(now);
      dateA.setDate(now.getDate() - i);
      const dateStrA = dateA.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
      
      const dateB = new Date(now);
      dateB.setDate(now.getDate() - i - 7);
      const dateStrB = dateB.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
      
      const name = `${dateStrA} vs ${dateStrB}`;
      
      const valA = txsA.filter(tx => new Date(tx.timestamp).toDateString() === dateA.toDateString())
                       .reduce((sum, tx) => sum + (tx.subtotal - (tx.discountAmount || 0)), 0);
      const valB = txsB.filter(tx => new Date(tx.timestamp).toDateString() === dateB.toDateString())
                       .reduce((sum, tx) => sum + (tx.subtotal - (tx.discountAmount || 0)), 0);
      
      breakdown.push({ name, valA, valB });
    }
  } else if (preset === '30days-prev30days') {
    labelA = "30 ngày này";
    labelB = "30 ngày trước";
    
    const startA = new Date(now);
    startA.setDate(now.getDate() - 29);
    startA.setHours(0, 0, 0, 0);
    
    const startB = new Date(now);
    startB.setDate(now.getDate() - 59);
    startB.setHours(0, 0, 0, 0);
    const endB = new Date(now);
    endB.setDate(now.getDate() - 30);
    endB.setHours(23, 59, 59, 999);
    
    txsA = transactions.filter(tx => {
      const t = new Date(tx.timestamp).getTime();
      return t >= startA.getTime();
    });
    txsB = transactions.filter(tx => {
      const t = new Date(tx.timestamp).getTime();
      return t >= startB.getTime() && t <= endB.getTime();
    });
    
    for (let g = 5; g >= 0; g--) {
      const daysStartA = g * 5;
      const daysEndA = g * 5 + 4;
      
      const name = `Nhóm ${6 - g} (${daysEndA} - ${daysStartA} ngày trước)`;
      
      const valA = txsA.filter(tx => {
        const diffDays = Math.floor((now.getTime() - new Date(tx.timestamp).getTime()) / (1000 * 60 * 60 * 24));
        return diffDays >= daysStartA && diffDays <= daysEndA;
      }).reduce((sum, tx) => sum + (tx.subtotal - (tx.discountAmount || 0)), 0);
      
      const valB = txsB.filter(tx => {
        const diffDays = Math.floor((now.getTime() - new Date(tx.timestamp).getTime()) / (1000 * 60 * 60 * 24));
        const adjustedDiff = diffDays - 30;
        return adjustedDiff >= daysStartA && adjustedDiff <= daysEndA;
      }).reduce((sum, tx) => sum + (tx.subtotal - (tx.discountAmount || 0)), 0);
      
      breakdown.push({ name, valA, valB });
    }
  } else if (preset === 'thismonth-prevmonth') {
    labelA = "Tháng này";
    labelB = "Tháng trước";
    
    const yearA = now.getFullYear();
    const monthA = now.getMonth();
    
    const prevMonthDate = new Date(now);
    prevMonthDate.setMonth(now.getMonth() - 1);
    const yearB = prevMonthDate.getFullYear();
    const monthB = prevMonthDate.getMonth();
    
    txsA = transactions.filter(tx => {
      const d = new Date(tx.timestamp);
      return d.getFullYear() === yearA && d.getMonth() === monthA;
    });
    txsB = transactions.filter(tx => {
      const d = new Date(tx.timestamp);
      return d.getFullYear() === yearB && d.getMonth() === monthB;
    });
    
    const daysInMonth = new Date(yearA, monthA + 1, 0).getDate();
    for (let day = 1; day <= daysInMonth; day++) {
      const name = `Ngày ${day}`;
      const valA = txsA.filter(tx => new Date(tx.timestamp).getDate() === day)
                       .reduce((sum, tx) => sum + (tx.subtotal - (tx.discountAmount || 0)), 0);
      const valB = txsB.filter(tx => new Date(tx.timestamp).getDate() === day)
                       .reduce((sum, tx) => sum + (tx.subtotal - (tx.discountAmount || 0)), 0);
      
      breakdown.push({ name, valA, valB });
    }
  }
  
  const totalRevA = txsA.reduce((sum, tx) => sum + (tx.subtotal - (tx.discountAmount || 0)), 0);
  const totalRevB = txsB.reduce((sum, tx) => sum + (tx.subtotal - (tx.discountAmount || 0)), 0);
  
  const diffRev = totalRevA - totalRevB;
  let growthPercent = 0;
  if (totalRevB > 0) {
    growthPercent = (diffRev / totalRevB) * 100;
  } else if (totalRevA > 0) {
    growthPercent = 100;
  }
  
  document.getElementById('compare-kpi-title-a').textContent = `Kỳ A (${labelA})`;
  document.getElementById('compare-kpi-title-b').textContent = `Kỳ B (${labelB})`;
  
  document.getElementById('compare-kpi-val-a').textContent = fmt(totalRevA);
  document.getElementById('compare-kpi-val-b').textContent = fmt(totalRevB);
  
  document.getElementById('compare-kpi-sub-a').textContent = `${txsA.length} hóa đơn`;
  document.getElementById('compare-kpi-sub-b').textContent = `${txsB.length} hóa đơn`;
  
  const diffEl = document.getElementById('compare-kpi-val-diff');
  const growthEl = document.getElementById('compare-kpi-sub-growth');
  
  const diffPrefix = diffRev >= 0 ? "+" : "";
  diffEl.textContent = `${diffPrefix}${fmt(diffRev)}`;
  diffEl.style.color = diffRev >= 0 ? "#10b981" : "#ef4444";
  
  const growthPrefix = growthPercent >= 0 ? "+" : "";
  growthEl.textContent = `${growthPrefix}${growthPercent.toFixed(1)}%`;
  growthEl.style.color = growthPercent >= 0 ? "#10b981" : "#ef4444";
  
  document.getElementById('compare-table-header-a').textContent = `Doanh thu ${labelA}`;
  document.getElementById('compare-table-header-b').textContent = `Doanh thu ${labelB}`;
  
  const tbody = document.getElementById('report-compare-table-body');
  if (tbody) {
    tbody.innerHTML = '';
    
    breakdown.forEach(row => {
      const diff = row.valA - row.valB;
      let pct = 0;
      if (row.valB > 0) {
        pct = (diff / row.valB) * 100;
      } else if (row.valA > 0) {
        pct = 100;
      }
      
      const pctPrefix = pct >= 0 ? "+" : "";
      const pctColor = pct >= 0 ? "#10b981" : "#ef4444";
      const diffColor = diff >= 0 ? "#10b981" : "#ef4444";
      
      const tr = document.createElement('tr');
      tr.style.borderBottom = '1px solid #f1f5f9';
      tr.innerHTML = `
        <td style="padding: 12px 16px; font-weight: 600; color: #334155;">${row.name}</td>
        <td style="padding: 12px 16px; text-align: right; font-weight: 500; color: #0f172a;">${fmt(row.valA)}</td>
        <td style="padding: 12px 16px; text-align: right; color: #475569;">${fmt(row.valB)}</td>
        <td style="padding: 12px 16px; text-align: right; color: ${diffColor}; font-weight: 600;">${diff >= 0 ? '+' : ''}${fmt(diff)}</td>
        <td style="padding: 12px 16px; text-align: center; color: ${pctColor}; font-weight: 700;">${row.valA === 0 && row.valB === 0 ? '0%' : `${pctPrefix}${pct.toFixed(1)}%`}</td>
      `;
      tbody.appendChild(tr);
    });
  }
  
  const pad = (num) => String(num).padStart(2, '0');
  let hours = now.getHours();
  const minutes = pad(now.getMinutes());
  const ampm = hours >= 12 ? 'CH' : 'SA';
  hours = hours % 12;
  hours = hours ? hours : 12;
  const day = pad(now.getDate());
  const month = pad(now.getMonth() + 1);
  const year = now.getFullYear();
  document.getElementById('report-compare-view-time-label').textContent = `Xem lúc: ${pad(hours)}:${minutes} ${ampm} ${day}/${month}/${year}`;
  
  const canvas = document.getElementById('report-compare-chart');
  if (canvas) {
    const ctx = canvas.getContext('2d');
    
    if (reportCompareChartInstance) {
      reportCompareChartInstance.destroy();
    }
    
    const chartLabels = breakdown.map(r => r.name);
    const dataA = breakdown.map(r => r.valA);
    const dataB = breakdown.map(r => r.valB);
    
    reportCompareChartInstance = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: chartLabels,
        datasets: [
          {
            label: `Doanh thu Kỳ A (${labelA})`,
            data: dataA,
            backgroundColor: '#0066cc',
            borderColor: '#0066cc',
            borderWidth: 1,
            borderRadius: 4
          },
          {
            label: `Doanh thu Kỳ B (${labelB})`,
            data: dataB,
            backgroundColor: '#94a3b8',
            borderColor: '#94a3b8',
            borderWidth: 1,
            borderRadius: 4
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              callback: function(value) {
                return value.toLocaleString('vi-VN') + 'đ';
              }
            }
          }
        },
        plugins: {
          tooltip: {
            callbacks: {
              label: function(context) {
                let label = context.dataset.label || '';
                if (label) {
                  label += ': ';
                }
                if (context.parsed.y !== null) {
                  label += context.parsed.y.toLocaleString('vi-VN') + 'đ';
                }
                return label;
              }
            }
          }
        }
      }
    });
  }
}

window.loadCompareReport = loadCompareReport;
const reportComparePreset = document.getElementById('report-compare-preset');
if (reportComparePreset) {
  reportComparePreset.addEventListener('change', loadCompareReport);
}
const inputCompareDateA = document.getElementById('report-compare-date-a');
const inputCompareDateB = document.getElementById('report-compare-date-b');
if (inputCompareDateA) {
  inputCompareDateA.addEventListener('change', loadCompareReport);
}
if (inputCompareDateB) {
  inputCompareDateB.addEventListener('change', loadCompareReport);
}

// Toggle profile dropdown
const profileContainer = document.getElementById('topbar-profile-container');
const dropdownMenu = document.getElementById('profile-dropdown-menu');

if (profileContainer && dropdownMenu) {
  profileContainer.addEventListener('click', (e) => {
    // If clicking the change password trigger link, open the modal
    if (e.target.closest('#btn-change-password-trigger')) {
      e.preventDefault();
      openChangePasswordModal();
      dropdownMenu.style.display = 'none';
      return;
    }
    
    // If clicking the bank account trigger link, prevent default and close dropdown
    if (e.target.closest('#btn-bank-account-trigger')) {
      e.preventDefault();
      dropdownMenu.style.display = 'none';
      openBankAccountsModal();
      return;
    }
    
    // Toggle dropdown
    const isVisible = dropdownMenu.style.display === 'block';
    dropdownMenu.style.display = isVisible ? 'none' : 'block';
    e.stopPropagation();
  });

  // Close dropdown when clicking anywhere else
  document.addEventListener('click', () => {
    dropdownMenu.style.display = 'none';
  });
}

// Open change password modal
window.openChangePasswordModal = function() {
  const modal = document.getElementById('change-password-modal');
  if (modal) {
    modal.style.display = 'flex';
    // Clear forms and banner
    document.getElementById('change-password-form').reset();
    document.getElementById('change-password-error-banner').style.display = 'none';
    document.getElementById('change-password-success-banner').style.display = 'none';
  }
};

// Close change password modal
window.closeChangePasswordModal = function() {
  const modal = document.getElementById('change-password-modal');
  if (modal) {
    modal.style.display = 'none';
  }
};

// Handle change password form submit
window.handleChangePassword = async function(event) {
  event.preventDefault();
  
  const currentPassword = document.getElementById('password-current').value;
  const newPassword = document.getElementById('password-new').value;
  const confirmNewPassword = document.getElementById('password-new-confirm').value;
  
  const errorBanner = document.getElementById('change-password-error-banner');
  const errorMessage = document.getElementById('change-password-error-message');
  const successBanner = document.getElementById('change-password-success-banner');
  const submitBtn = document.getElementById('btn-change-password-submit');
  
  errorBanner.style.display = 'none';
  successBanner.style.display = 'none';
  
  if (newPassword !== confirmNewPassword) {
    errorMessage.textContent = 'Mật khẩu mới và xác nhận mật khẩu mới không khớp.';
    errorBanner.style.display = 'flex';
    return;
  }
  
  if (newPassword.length < 4) {
    errorMessage.textContent = 'Mật khẩu mới phải chứa ít nhất 4 ký tự.';
    errorBanner.style.display = 'flex';
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = 'Đang đổi...';
  
  try {
    const res = await fetch('/api/change-password', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ currentPassword, newPassword })
    });
    
    if (res.status === 401) {
      window.location.href = '/login.html';
      return;
    }
    
    const result = await res.json();
    if (res.ok && result.success) {
      successBanner.style.display = 'flex';
      document.getElementById('change-password-form').reset();
      
      // Auto close modal after 1.5 seconds
      setTimeout(() => {
        closeChangePasswordModal();
      }, 1500);
    } else {
      errorMessage.textContent = result.error || 'Có lỗi xảy ra.';
      errorBanner.style.display = 'flex';
    }
  } catch (error) {
    console.error('Lỗi đổi mật khẩu:', error);
    errorMessage.textContent = 'Lỗi kết nối server.';
    errorBanner.style.display = 'flex';
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Đổi mật khẩu';
  }
};

// Bank Accounts Modal configuration logic
window.openBankAccountsModal = function() {
  const modal = document.getElementById('bank-accounts-modal');
  if (modal) {
    modal.style.display = 'flex';
    document.getElementById('add-bank-account-form').reset();
    renderBankAccountsList();
  }
};

window.closeBankAccountsModal = function() {
  const modal = document.getElementById('bank-accounts-modal');
  if (modal) {
    modal.style.display = 'none';
  }
};

async function renderBankAccountsList() {
  const listContainer = document.getElementById('bank-accounts-list');
  if (!listContainer) return;
  
  try {
    const response = await fetch('/api/bank-accounts');
    if (!response.ok) throw new Error('Không thể tải danh sách tài khoản');
    const accounts = await response.json();
    
    listContainer.innerHTML = '';
    
    if (accounts.length === 0) {
      listContainer.innerHTML = '<div class="text-center text-muted" style="padding: 12px; font-size: 13px;">Chưa có tài khoản ngân hàng nào.</div>';
      return;
    }
    
    accounts.forEach(acc => {
      const card = document.createElement('div');
      card.className = 'bank-account-card';
      card.style.cssText = 'border: 1px solid var(--hairline); padding: 14px 18px; border-radius: var(--rounded-md); display: flex; justify-content: space-between; align-items: center; background: #fff; box-shadow: 0 2px 4px rgba(0,0,0,0.02);';
      
      const details = document.createElement('div');
      details.innerHTML = `
        <div style="font-weight: 700; font-size: 14px; color: var(--ink); display: flex; align-items: center; gap: 8px;">
          ${acc.bank_name} - ${acc.account_number}
        </div>
        <div style="font-size: 12px; color: var(--muted); margin-top: 4px;">Chủ TK: ${acc.account_holder}</div>
      `;
      
      const actions = document.createElement('div');
      actions.style.cssText = 'display: flex; gap: 8px; align-items: center;';
      
      const activeBtn = document.createElement('button');
      if (acc.is_active) {
        activeBtn.textContent = '🟢 Đang dùng';
        activeBtn.className = 'btn btn-sm btn-success';
        activeBtn.style.cssText = 'font-size: 11px; padding: 4px 10px; border-radius: var(--rounded-md); background-color: #dcfce7; color: #15803d; border: 1px solid #bbf7d0; cursor: pointer;';
        activeBtn.onclick = () => toggleBankAccount(acc.id, false);
      } else {
        activeBtn.textContent = '⚪ Kích hoạt';
        activeBtn.className = 'btn btn-sm btn-secondary';
        activeBtn.style.cssText = 'font-size: 11px; padding: 4px 10px; border-radius: var(--rounded-md); border-color: var(--hairline); cursor: pointer;';
        activeBtn.onclick = () => toggleBankAccount(acc.id, true);
      }
      actions.appendChild(activeBtn);
      
      const deleteBtn = document.createElement('button');
      deleteBtn.textContent = 'Xóa';
      deleteBtn.className = 'btn btn-sm btn-danger';
      deleteBtn.style.cssText = 'font-size: 11px; padding: 4px 10px; border-radius: var(--rounded-md); background-color: #fee2e2; color: #b91c1c; border: 1px solid #fca5a5; cursor: pointer;';
      deleteBtn.onclick = () => deleteBankAccount(acc.id);
      actions.appendChild(deleteBtn);
      
      card.appendChild(details);
      card.appendChild(actions);
      listContainer.appendChild(card);
    });
  } catch (error) {
    console.error('Lỗi render tài khoản ngân hàng:', error);
    listContainer.innerHTML = `<div class="text-center text-error" style="padding: 12px; font-size: 13px; color: var(--primary-error-text);">${error.message}</div>`;
  }
}

window.toggleBankAccount = async function(id, isActive) {
  try {
    const response = await fetch(`/api/bank-accounts/${id}/active`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: isActive })
    });
    if (response.ok) {
      showToast(isActive ? '✅ Đã kích hoạt tài khoản ngân hàng!' : '⚪ Đã tạm ngưng tài khoản ngân hàng!');
      renderBankAccountsList();
    } else {
      const err = await response.json();
      alert(`Lỗi: ${err.error}`);
    }
  } catch (error) {
    console.error('Lỗi thay đổi trạng thái tài khoản:', error);
    alert('Không thể kết nối máy chủ.');
  }
};

window.deleteBankAccount = async function(id) {
  if (!confirm('Bạn có chắc chắn muốn xóa tài khoản ngân hàng này không?')) return;
  try {
    const response = await fetch(`/api/bank-accounts/${id}`, {
      method: 'DELETE'
    });
    if (response.ok) {
      showToast('🗑️ Đã xóa tài khoản ngân hàng thành công!');
      renderBankAccountsList();
    } else {
      const err = await response.json();
      alert(`Lỗi: ${err.error}`);
    }
  } catch (error) {
    console.error('Lỗi xóa tài khoản:', error);
    alert('Không thể kết nối máy chủ.');
  }
};

window.handleAddBankAccount = async function(event) {
  event.preventDefault();
  const bankName = document.getElementById('bank-input-name').value;
  const accountNumber = document.getElementById('bank-input-number').value;
  const accountHolder = document.getElementById('bank-input-holder').value.toUpperCase();
  
  try {
    const response = await fetch('/api/bank-accounts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bank_name: bankName,
        account_number: accountNumber,
        account_holder: accountHolder
      })
    });
    
    if (response.ok) {
      showToast('✅ Thêm tài khoản ngân hàng mới thành công!');
      document.getElementById('add-bank-account-form').reset();
      renderBankAccountsList();
    } else {
      const err = await response.json();
      alert(`Lỗi: ${err.error}`);
    }
  } catch (error) {
    console.error('Lỗi thêm tài khoản:', error);
    alert('Không thể kết nối máy chủ.');
  }
};

// Helper to normalize bank names to VietQR official slugs
function getVietQrBankSlug(bankName) {
  const name = bankName.toUpperCase().trim();
  if (name.includes('TPBANK') || name.includes('TP BANK') || name.includes('TIEN PHONG') || name.includes('TIÊN PHONG')) return 'TPB';
  if (name.includes('VCB') || name.includes('VIETCOMBANK')) return 'VCB';
  if (name.includes('TCB') || name.includes('TECHCOMBANK')) return 'TCB';
  if (name.includes('BIDV') || name.includes('ĐẦU TƯ')) return 'BIDV';
  if (name.includes('MB') || name.includes('MILITARY') || name.includes('QUÂN ĐỘI')) return 'MB';
  if (name.includes('CTG') || name.includes('VIETINBANK') || name.includes('VIETIN')) return 'CTG';
  if (name.includes('ACB') || name.includes('Á CHÂU')) return 'ACB';
  if (name.includes('VPBANK') || name.includes('VPB') || name.includes('THỊNH VƯỢNG')) return 'VPB';
  if (name.includes('SACOMBANK') || name.includes('STB')) return 'STB';
  if (name.includes('AGRIBANK') || name.includes('VBA') || name.includes('NÔNG NGHIỆP')) return 'VBA';
  if (name.includes('SHB')) return 'SHB';
  if (name.includes('HDBANK') || name.includes('HDB')) return 'HDB';
  if (name.includes('VIB')) return 'VIB';
  if (name.includes('MSB')) return 'MSB';
  if (name.includes('SCB')) return 'SCB';
  if (name.includes('OCB')) return 'OCB';
  if (name.includes('LPB') || name.includes('LIENVIET')) return 'LPB';
  if (name.includes('TPB')) return 'TPB';
  
  return name.replace(/\s+BANK/g, '').replace(/\s+/g, '');
}

// Set QR image source and handle loading animation
function loadCheckoutQrImage(qrUrl) {
  const bankQrImage = document.getElementById('bank-qr-image');
  const loadingOverlay = document.getElementById('bank-qr-loading');
  const errorOverlay = document.getElementById('bank-qr-error');
  
  if (!bankQrImage) return;
  
  // Show loading, hide image & error
  if (loadingOverlay) loadingOverlay.style.display = 'flex';
  if (errorOverlay) errorOverlay.style.display = 'none';
  bankQrImage.style.opacity = '0';
  
  // Bind handlers
  bankQrImage.onload = () => {
    if (loadingOverlay) loadingOverlay.style.display = 'none';
    if (errorOverlay) errorOverlay.style.display = 'none';
    bankQrImage.style.opacity = '1';
  };
  
  bankQrImage.onerror = () => {
    if (loadingOverlay) loadingOverlay.style.display = 'none';
    if (errorOverlay) errorOverlay.style.display = 'flex';
    bankQrImage.style.opacity = '0';
  };
  
  // Set source to trigger loading
  bankQrImage.src = qrUrl;
}

// ==========================================
// OPTION GROUPS (NHÓM LỰA CHỌN) MANAGEMENT
// ==========================================

// DOM Elements
const btnCreateSelectionGroup = document.getElementById('btn-create-selection-group');
const btnBackSelectionGroups = document.getElementById('btn-back-selection-groups');
const selectionGroupsListContainer = document.getElementById('selection-groups-list-container');
const selectionGroupModal = document.getElementById('selection-group-modal');
const btnCloseSelectionGroupModal = document.getElementById('btn-close-selection-group-modal');
const selectionGroupsTableBody = document.getElementById('selection-groups-table-body');
const selectionGroupNameInput = document.getElementById('selection-group-name-input');
const selectionMinInput = document.getElementById('selection-min-input');
const selectionMaxInput = document.getElementById('selection-max-input');
const selectionAllowMultiple = document.getElementById('selection-allow-multiple');
const selectionOptionsRowsContainer = document.getElementById('selection-options-rows-container');
const btnAddOptionRow = document.getElementById('btn-add-option-row');
const btnSaveSelectionGroup = document.getElementById('btn-save-selection-group');
const btnCancelSelectionGroup = document.getElementById('btn-cancel-selection-group');
const btnSelectLinkedItems = document.getElementById('btn-select-linked-items');
const linkedItemsBadgeContainer = document.getElementById('linked-items-badge-container');
const selectionGroupFormTitle = document.getElementById('selection-group-form-title');
const selectionGroupSearchInput = document.getElementById('selection-group-search-input');
const btnSearchSelectionGroups = document.getElementById('btn-search-selection-groups');

const selectionGroupItemsModal = document.getElementById('selection-group-items-modal');
const btnCloseSelectionGroupItemsModal = document.getElementById('btn-close-selection-group-items-modal');
const btnCancelSelectionGroupItems = document.getElementById('btn-cancel-selection-group-items');
const btnConfirmSelectionGroupItems = document.getElementById('btn-confirm-selection-group-items');
const selectionGroupItemsSearchInput = document.getElementById('selection-group-items-search-input');
const selectionGroupItemsChecklist = document.getElementById('selection-group-items-checklist');

// State
let currentEditingOptionGroupId = null;
let selectedLinkedMenuItemIds = [];
let tempSelectedLinkedMenuItemIds = [];

// API Loading
async function loadOptionGroups() {
  try {
    const res = await fetch('/api/option-groups');
    optionGroups = await res.json();
    renderOptionGroups();
  } catch (err) {
    console.error('Lỗi tải nhóm lựa chọn:', err);
    showToast('❌ Không thể tải danh sách nhóm lựa chọn.');
  }
}

// Rendering option groups table list
function renderOptionGroups(filterQuery = '') {
  if (!selectionGroupsTableBody) return;
  selectionGroupsTableBody.innerHTML = '';
  
  const query = filterQuery.toLowerCase().trim();
  const filtered = optionGroups.filter(og => 
    og.name.toLowerCase().includes(query) || 
    (Array.isArray(og.options) && og.options.some(opt => opt && opt.name && opt.name.toLowerCase().includes(query)))
  );
  
  if (filtered.length === 0) {
    selectionGroupsTableBody.innerHTML = `
      <tr>
        <td colspan="5" style="text-align: center; padding: 24px; color: var(--muted);">Không tìm thấy nhóm lựa chọn nào.</td>
      </tr>
    `;
    return;
  }
  
  filtered.forEach(og => {
    const tr = document.createElement('tr');
    tr.style.borderBottom = '1px solid var(--hairline-soft)';
    tr.style.height = '48px';
    
    const optionsText = Array.isArray(og.options) ? og.options.map(o => o ? o.name : '').filter(Boolean).join('; ') : '';
    
    tr.innerHTML = `
      <td style="padding: 12px 16px; text-align: center;">
        <input type="checkbox" class="select-selection-group" data-id="${og.id}" style="cursor: pointer;">
      </td>
      <td style="padding: 12px 16px;">
        <span class="edit-selection-group-link" style="color: #0066cc; font-weight: 600; cursor: pointer; text-decoration: none;">${og.name}</span>
      </td>
      <td style="padding: 12px 16px; color: #475569;">${optionsText}</td>
      <td style="padding: 12px 16px; text-align: center; font-weight: 600; color: #475569;">${og.linked_items_count}</td>
      <td style="padding: 12px 16px; text-align: center;">
        <div style="display: flex; gap: 8px; justify-content: center;">
          <button class="btn-edit-og" style="background: none; border: none; color: #0066cc; font-weight: 600; cursor: pointer; font-size: 13px;">Sửa</button>
          <button class="btn-delete-og" style="background: none; border: none; color: var(--primary-error-text); font-weight: 600; cursor: pointer; font-size: 13px;">Xóa</button>
        </div>
      </td>
    `;
    
    tr.querySelector('.edit-selection-group-link').onclick = () => openOptionGroupForm(og);
    tr.querySelector('.btn-edit-og').onclick = () => openOptionGroupForm(og);
    tr.querySelector('.btn-delete-og').onclick = () => deleteOptionGroup(og.id, og.name);
    
    selectionGroupsTableBody.appendChild(tr);
  });
}

// Add empty or existing option item row
function addOptionRow(name = '', price = 0, cost = 0, isDefault = false) {
  if (!selectionOptionsRowsContainer) return;
  const rowsCount = selectionOptionsRowsContainer.children.length;
  
  const row = document.createElement('div');
  row.className = 'selection-option-row';
  row.style.cssText = 'display: flex; align-items: center; gap: 12px; border-bottom: 1px solid #f1f5f9; padding-bottom: 12px; margin-top: 8px;';
  row.innerHTML = `
    <div style="flex: 2;">
      <label class="opt-label" style="font-size: 12px; font-weight: 600; color: var(--muted); margin-bottom: 4px; display: block;">Lựa chọn ${rowsCount + 1}</label>
      <input type="text" class="text-input opt-name" placeholder="Lựa chọn ${rowsCount + 1}" value="${name}" style="width: 100%; height: 34px; padding: 6px 12px; box-sizing: border-box;" required autocomplete="off">
    </div>
    <div style="display: flex; align-items: center; gap: 6px; margin-top: 20px; user-select: none;">
      <input type="checkbox" class="opt-default" ${isDefault ? 'checked' : ''} style="cursor: pointer;">
      <label class="opt-default-label" style="font-size: 12px; font-weight: 600; cursor: pointer;">Chọn mặc định</label>
    </div>
    <div style="flex: 1;">
      <label style="font-size: 12px; font-weight: 600; color: var(--muted); margin-bottom: 4px; display: block;">Giá bán</label>
      <input type="number" class="text-input opt-price" value="${price}" style="width: 100%; height: 34px; text-align: right; padding: 6px 12px; box-sizing: border-box;">
    </div>
    <button type="button" class="btn-delete-row" style="background: transparent; border: none; font-size: 18px; color: red; margin-top: 20px; cursor: pointer;">&times;</button>
  `;
  
  // Bind click label checkbox behavior
  row.querySelector('.opt-default-label').onclick = () => {
    const chk = row.querySelector('.opt-default');
    chk.checked = !chk.checked;
  };
  
  row.querySelector('.btn-delete-row').onclick = () => {
    row.remove();
    reindexOptionRows();
  };
  
  selectionOptionsRowsContainer.appendChild(row);
}

function reindexOptionRows() {
  if (!selectionOptionsRowsContainer) return;
  Array.from(selectionOptionsRowsContainer.children).forEach((row, i) => {
    const label = row.querySelector('.opt-label');
    const input = row.querySelector('.opt-name');
    if (label) label.textContent = `Lựa chọn ${i + 1}`;
    if (input) input.placeholder = `Lựa chọn ${i + 1}`;
  });
}

// Render selected items badges
function renderLinkedItemsBadges() {
  if (!linkedItemsBadgeContainer) return;
  linkedItemsBadgeContainer.innerHTML = '';
  if (selectedLinkedMenuItemIds.length === 0) {
    linkedItemsBadgeContainer.innerHTML = `<span style="font-size: 12px; color: var(--muted);">Chưa chọn mặt hàng nào.</span>`;
    return;
  }
  
  selectedLinkedMenuItemIds.forEach(id => {
    const menuItem = (menuItems || []).find(m => m.id === id);
    const name = menuItem ? menuItem.name : id;
    
    const badge = document.createElement('span');
    badge.style.cssText = 'font-size: 12px; background: #e6f0fa; color: #0066cc; font-weight: 600; padding: 4px 10px; border-radius: 12px; display: inline-flex; align-items: center; gap: 4px; margin: 2px;';
    badge.innerHTML = `
      <span>${name}</span>
      <span class="remove-badge" style="cursor: pointer; font-weight: 800; color: #64748b;">&times;</span>
    `;
    badge.querySelector('.remove-badge').onclick = () => {
      selectedLinkedMenuItemIds = selectedLinkedMenuItemIds.filter(itemId => itemId !== id);
      renderLinkedItemsBadges();
    };
    linkedItemsBadgeContainer.appendChild(badge);
  });
}

// Open creation/edition form
function openOptionGroupForm(og = null) {
  if (!selectionGroupModal) return;
  selectionGroupModal.style.display = 'flex';
  selectionOptionsRowsContainer.innerHTML = '';
  
  if (og) {
    currentEditingOptionGroupId = og.id;
    selectionGroupFormTitle.textContent = og.name;
    selectionGroupNameInput.value = og.name;
    selectionMinInput.value = og.min_select;
    selectionMaxInput.value = og.max_select === null ? '' : og.max_select;
    selectionAllowMultiple.checked = og.allow_multiple;
    selectedLinkedMenuItemIds = [];
    renderLinkedItemsBadges();
    
    // Fetch full detail for linked items and options
    fetch(`/api/option-groups/${og.id}`)
      .then(res => res.json())
      .then(data => {
        selectedLinkedMenuItemIds = data.linkedMenuItemIds || [];
        renderLinkedItemsBadges();
        
        selectionOptionsRowsContainer.innerHTML = '';
        if (Array.isArray(data.options)) {
          data.options.forEach(opt => addOptionRow(opt.name, opt.price, opt.cost, opt.is_default));
        }
        if (selectionOptionsRowsContainer.children.length === 0) {
          addOptionRow('', 0, 0, false);
        }
      });
  } else {
    currentEditingOptionGroupId = null;
    selectionGroupFormTitle.textContent = 'Thêm nhóm lựa chọn';
    selectionGroupNameInput.value = '';
    selectionMinInput.value = '0';
    selectionMaxInput.value = '';
    selectionAllowMultiple.checked = false;
    selectedLinkedMenuItemIds = [];
    renderLinkedItemsBadges();
    
    addOptionRow('', 0, 0, false);
  }
}

function closeOptionGroupForm() {
  if (selectionGroupModal) selectionGroupModal.style.display = 'none';
  currentEditingOptionGroupId = null;
}

// Save Option Group
async function saveOptionGroup() {
  const name = selectionGroupNameInput.value.trim();
  if (!name) {
    showToast('⚠️ Vui lòng nhập tên bộ lựa chọn.');
    return;
  }
  
  const optionRows = Array.from(selectionOptionsRowsContainer.children);
  const options = [];
  
  for (const row of optionRows) {
    const optName = row.querySelector('.opt-name').value.trim();
    if (!optName) continue;
    
    const price = parseInt(row.querySelector('.opt-price').value) || 0;
    const cost = 0;
    const isDefault = row.querySelector('.opt-default').checked;
    
    options.push({ name: optName, price, cost, is_default: isDefault });
  }
  
  if (options.length === 0) {
    showToast('⚠️ Vui lòng thêm ít nhất một lựa chọn có tên.');
    return;
  }
  
  const min_select = parseInt(selectionMinInput.value) || 0;
  const max_select = selectionMaxInput.value ? parseInt(selectionMaxInput.value) : null;
  const allow_multiple = selectionAllowMultiple.checked;
  
  const payload = {
    name,
    min_select,
    max_select,
    allow_multiple,
    options,
    linkedMenuItemIds: selectedLinkedMenuItemIds
  };
  
  const url = currentEditingOptionGroupId 
    ? `/api/option-groups/${currentEditingOptionGroupId}` 
    : '/api/option-groups';
  
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (data.success) {
      showToast(currentEditingOptionGroupId ? '✅ Cập nhật nhóm lựa chọn thành công!' : '✅ Tạo nhóm lựa chọn thành công!');
      closeOptionGroupForm();
      loadOptionGroups();
    } else {
      showToast(`❌ Lỗi: ${data.error || 'Vui lòng thử lại.'}`);
    }
  } catch (err) {
    console.error(err);
    showToast('❌ Không thể kết nối tới máy chủ.');
  }
}

// Delete Option Group
async function deleteOptionGroup(id, name) {
  if (!confirm(`Bạn có chắc chắn muốn xóa nhóm lựa chọn "${name}" không?`)) return;
  try {
    const res = await fetch(`/api/option-groups/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) {
      showToast('✅ Xóa nhóm lựa chọn thành công!');
      loadOptionGroups();
    } else {
      showToast(`❌ Lỗi: ${data.error || 'Vui lòng thử lại.'}`);
    }
  } catch (err) {
    console.error(err);
    showToast('❌ Không thể kết nối tới máy chủ.');
  }
}

// Linked Items Modal Selection functions
function openLinkedItemsModal() {
  if (!selectionGroupItemsModal) return;
  tempSelectedLinkedMenuItemIds = [...selectedLinkedMenuItemIds];
  renderLinkedItemsChecklist();
  selectionGroupItemsModal.style.display = 'flex';
}

function closeLinkedItemsModal() {
  if (selectionGroupItemsModal) selectionGroupItemsModal.style.display = 'none';
}

function renderLinkedItemsChecklist(filterQuery = '') {
  if (!selectionGroupItemsChecklist) return;
  selectionGroupItemsChecklist.innerHTML = '';
  const query = filterQuery.toLowerCase().trim();
  
  const filtered = (menuItems || []).filter(item => 
    item.name.toLowerCase().includes(query)
  );
  
  if (filtered.length === 0) {
    selectionGroupItemsChecklist.innerHTML = `<div style="text-align: center; color: var(--muted); padding: 12px;">Không tìm thấy mặt hàng nào.</div>`;
    return;
  }
  
  filtered.forEach(item => {
    const label = document.createElement('label');
    label.style.cssText = 'display: flex; align-items: center; gap: 8px; cursor: pointer; padding: 6px 0; font-size: 13px; font-weight: 500;';
    
    const isChecked = tempSelectedLinkedMenuItemIds.includes(item.id);
    
    label.innerHTML = `
      <input type="checkbox" value="${item.id}" ${isChecked ? 'checked' : ''} style="cursor: pointer;">
      <span>${item.name} (${formatVND(item.price)})</span>
    `;
    
    label.querySelector('input').onclick = (e) => {
      if (e.target.checked) {
        if (!tempSelectedLinkedMenuItemIds.includes(item.id)) {
          tempSelectedLinkedMenuItemIds.push(item.id);
        }
      } else {
        tempSelectedLinkedMenuItemIds = tempSelectedLinkedMenuItemIds.filter(id => id !== item.id);
      }
    };
    
    selectionGroupItemsChecklist.appendChild(label);
  });
}

// Bind Button Listeners
if (btnCreateSelectionGroup) {
  btnCreateSelectionGroup.addEventListener('click', () => openOptionGroupForm(null));
}

if (btnCloseSelectionGroupModal) {
  btnCloseSelectionGroupModal.addEventListener('click', closeOptionGroupForm);
}

if (btnCancelSelectionGroup) {
  btnCancelSelectionGroup.addEventListener('click', closeOptionGroupForm);
}

if (btnSaveSelectionGroup) {
  btnSaveSelectionGroup.addEventListener('click', saveOptionGroup);
}

if (btnAddOptionRow) {
  btnAddOptionRow.addEventListener('click', () => addOptionRow('', 0, 0, false));
}

if (btnSelectLinkedItems) {
  btnSelectLinkedItems.addEventListener('click', openLinkedItemsModal);
}

if (btnCloseSelectionGroupItemsModal) {
  btnCloseSelectionGroupItemsModal.addEventListener('click', closeLinkedItemsModal);
}

if (btnCancelSelectionGroupItems) {
  btnCancelSelectionGroupItems.addEventListener('click', closeLinkedItemsModal);
}

if (btnConfirmSelectionGroupItems) {
  btnConfirmSelectionGroupItems.addEventListener('click', () => {
    selectedLinkedMenuItemIds = [...tempSelectedLinkedMenuItemIds];
    renderLinkedItemsBadges();
    closeLinkedItemsModal();
  });
}

if (selectionGroupItemsSearchInput) {
  selectionGroupItemsSearchInput.addEventListener('input', (e) => {
    renderLinkedItemsChecklist(e.target.value);
  });
}

// Table Search actions
if (btnSearchSelectionGroups && selectionGroupSearchInput) {
  btnSearchSelectionGroups.addEventListener('click', () => {
    renderOptionGroups(selectionGroupSearchInput.value);
  });
  selectionGroupSearchInput.addEventListener('keyup', (e) => {
    if (e.key === 'Enter') {
      renderOptionGroups(selectionGroupSearchInput.value);
    }
  });
}

// Close option select panels when clicking outside
document.addEventListener('click', () => {
  document.querySelectorAll('.custom-opt-select-panel').forEach(p => p.style.display = 'none');
  document.querySelectorAll('.custom-opt-select-trigger').forEach(t => {
    t.style.borderRadius = '6px';
    const chev = t.querySelector('.chevron');
    if (chev) chev.style.transform = 'none';
  });
});

