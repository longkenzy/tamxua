// Waiter App Logic
let socket = null;
let isPollingMode = false;
const isVercel = window.location.hostname.endsWith('vercel.app');

// State variables
let menu = [];
let tables = [];
let activeTableId = null;
let cart = [];
let activeItem = null;
let currentQuantity = 1;
let activeCategory = 'all';
let searchQuery = '';
let activeTab = 'orders'; // Default tab
let menuGroups = [];
let optionGroups = [];
let activeGroupIndex = 0;
let isScrollingFromClick = false;
let scrollTimeout = null;
let isMenuFiltered = false;
let tableDiscountPercent = 0;

// DOM Elements
const connectionDot = document.getElementById('connection-dot');
const menuOrderingView = document.getElementById('menu-ordering-view');
const activeTableName = document.getElementById('active-table-name');
const activeTableStatusSubtitle = document.getElementById('active-table-status-subtitle');
const btnBackTables = document.getElementById('btn-back-tables');
const menuItemsContainer = document.getElementById('menu-items-container');
const categoryStripContainer = document.getElementById('category-strip-container');
const menuSearchInput = document.getElementById('menu-search-input');

// Floating Cart Bar Elements
const floatingCartBar = document.getElementById('floating-cart-bar');
const cartSummaryQty = document.getElementById('cart-summary-qty');
const cartSummaryTotal = document.getElementById('cart-summary-total');
const btnViewCart = document.getElementById('btn-view-cart');

// Customization Modal Elements
const customItemModal = document.getElementById('custom-item-modal');
const customModalTitle = document.getElementById('custom-modal-title');
const customModalEmoji = document.getElementById('custom-modal-emoji');
const customModalPrice = document.getElementById('custom-modal-price');
const customModalDesc = document.getElementById('custom-modal-desc');
const btnStepperMinus = document.getElementById('btn-stepper-minus');
const btnStepperPlus = document.getElementById('btn-stepper-plus');
const stepperValue = document.getElementById('stepper-value');
const customItemNotes = document.getElementById('custom-item-notes');
const btnCancelCustomModal = document.getElementById('btn-cancel-custom-modal');
const btnCloseCustomModal = document.getElementById('btn-close-custom-modal');
const btnAddToCartConfirm = document.getElementById('btn-add-to-cart-confirm');

// Cart Modal Elements
const cartModal = document.getElementById('cart-modal');
const cartModalTitle = document.getElementById('cart-modal-title');
const cartItemsListContainer = document.getElementById('cart-items-list-container');
const cartTotalPriceLarge = document.getElementById('cart-total-price-large');
const btnCloseCartModal = document.getElementById('btn-close-cart-modal');
const btnCloseCartModalFoot = document.getElementById('btn-close-cart-modal-foot');
const btnSubmitOrder = document.getElementById('btn-submit-order');



// Format Currency
function formatVND(amount) {
  return amount.toLocaleString('vi-VN') + 'đ';
}

// Initial Fetch
async function init() {
  try {
    const [menuRes, tablesRes, groupsRes, optionGroupsRes] = await Promise.all([
      fetch('/api/menu'),
      fetch('/api/tables'),
      fetch('/api/menu-groups').catch(() => null),
      fetch('/api/option-groups').catch(() => null)
    ]);
    
    if (menuRes.status === 401 || tablesRes.status === 401) {
      window.location.href = '/login.html';
      return;
    }
    
    menu = await menuRes.json();
    tables = await tablesRes.json();
    
    if (groupsRes && groupsRes.ok) {
      menuGroups = await groupsRes.json();
    } else {
      menuGroups = [];
    }
    
    if (optionGroupsRes && optionGroupsRes.ok) {
      optionGroups = await optionGroupsRes.json();
    } else {
      optionGroups = [];
    }
    
    // Pre-render menu items so they are ready instantly on order click
    renderMenuItems();
    
    // Switch to default tab and render
    switchTab('orders');
    
    // Sync printer settings from server
    await syncPrinterSettingsFromServer().catch(err => console.error(err));

    // Initialize WebSockets or Polling fallback
    loadSocketScript(() => {
      initConnection();
    });
  } catch (error) {
    console.error('Lỗi khi tải dữ liệu ban đầu:', error);
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
        if (menuOrderingView.style.display === 'none') {
          if (activeTab === 'orders') renderOrders();
          else if (activeTab === 'tables') renderTables();
          else if (activeTab === 'checkout') renderCheckoutOrders();
        } else {
          const currentTable = tables.find(t => t.id === activeTableId);
          if (currentTable) {
            updateActiveTableSubtitle(currentTable);
          }
        }
      });
      
      socket.on('menu_updated', (updatedMenu) => {
        menu = updatedMenu;
        if (menuOrderingView.style.display !== 'none') {
          renderMenuItems();
        }
      });
      
      socket.on('menu_groups_updated', async () => {
        try {
          const res = await fetch('/api/menu-groups');
          if (res.ok) {
            menuGroups = await res.json();
            if (menuOrderingView.style.display !== 'none') {
              renderMenuItems();
            }
          }
        } catch (err) {
          console.error(err);
        }
      });
      
      socket.on('print_kitchen_slip', (data) => {
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        if (!isMobile) {
          if (data.printedByServer) {
            if (typeof showSuccessToast === 'function') {
              showSuccessToast(`✅ Đã tự động in ngầm ${data.title} tại ${data.printerId === 'kitchen_default' ? 'Bếp chính' : 'Quầy nước'} cho ${data.tableName}!`);
            }
          } else {
            printDocxSlip(data.printerId, data.tableName, data.items, data.title);
          }
        }
      });

      socket.on('print_receipt', (data) => {
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        if (!isMobile) {
          if (data.printedByServer) {
            if (typeof showSuccessToast === 'function') {
              showSuccessToast(`✅ Đã tự động in ngầm hóa đơn thanh toán cho ${data.tableObj.name} thành công!`);
            }
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
    const [menuRes, tablesRes] = await Promise.all([
      fetch('/api/menu'),
      fetch('/api/tables')
    ]);
    
    if (menuRes.ok && tablesRes.ok) {
      const newMenu = await menuRes.json();
      const newTables = await tablesRes.json();
      
      const menuChanged = JSON.stringify(newMenu) !== JSON.stringify(menu);
      const tablesChanged = JSON.stringify(newTables) !== JSON.stringify(tables);
      
      if (menuChanged || tablesChanged) {
        menu = newMenu;
        tables = newTables;
        
        if (menuOrderingView.style.display === 'none') {
          if (activeTab === 'orders') renderOrders();
          else if (activeTab === 'tables') renderTables();
          else if (activeTab === 'checkout') renderCheckoutOrders();
        } else {
          const currentTable = tables.find(t => t.id === activeTableId);
          if (currentTable) {
            updateActiveTableSubtitle(currentTable);
          }
          if (menuChanged) {
            renderMenuItems();
          }
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
                await printDocxSlip(payload.printerId, payload.tableName, payload.items, payload.title);
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

// Format Elapsed Time since creation/update
function getElapsedTimeText(updatedAtStr) {
  if (!updatedAtStr) return 'vừa xong';
  const updatedTime = new Date(updatedAtStr);
  const now = new Date();
  const diffMs = now - updatedTime;
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'vừa xong';
  if (diffMins < 60) return `${diffMins} phút`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours} giờ`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} ngày`;
}

// TAB NAVIGATION LOGIC
function switchTab(tabId) {
  activeTab = tabId;
  
  // Show top header
  const topNav = document.querySelector('.top-nav');
  if (topNav) topNav.style.display = 'flex';
  
  // Hide all view panels
  const panels = ['orders-view', 'tables-view', 'checkout-view'];
  panels.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
  menuOrderingView.style.display = 'none';
  floatingCartBar.style.display = 'none';
  
  // Show selected panel
  const selectedPanel = document.getElementById(`${tabId}-view`);
  if (selectedPanel) selectedPanel.style.display = 'flex';
  
  // Apply active style to tab bar
  document.querySelectorAll('.bottom-tab-bar .tab-item').forEach(item => {
    if (item.getAttribute('data-tab') === tabId) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });
  
  // Load tab data
  if (tabId === 'orders') {
    renderOrders();
  } else if (tabId === 'tables') {
    renderTables();
  } else if (tabId === 'checkout') {
    renderCheckoutOrders();
  }
}

// Bind Bottom navigation buttons
document.querySelectorAll('.bottom-tab-bar .tab-item').forEach(item => {
  item.addEventListener('click', () => {
    const tab = item.getAttribute('data-tab');
    switchTab(tab);
  });
});

// Render Orders list (TAB 1)
function renderOrders() {
  const activeOrdersContainer = document.getElementById('active-orders-container');
  if (!activeOrdersContainer) return;
  activeOrdersContainer.innerHTML = '';
  
  const eatingTables = tables.filter(t => t.status === 'eating');
  
  // Get active filter inside sidebar
  const activeSidebarItem = document.querySelector('.orders-sidebar .sidebar-item.active');
  const currentFilter = activeSidebarItem ? activeSidebarItem.getAttribute('data-sidebar') : 'all';
  
  // Filter active tables by type
  const filtered = eatingTables.filter(t => {
    if (currentFilter === 'all') return true;
    const loc = (t.location || '').toLowerCase();
    if (currentFilter === 'takeaway') return loc === 'mang về';
    if (currentFilter === 'delivery') return loc === 'giao hàng';
    if (currentFilter === 'partner') return loc === 'đối tác';
    if (currentFilter === 'table') return ['trệt', 'lầu', 'máy lạnh'].includes(loc);
    return true;
  });
  
  // Update sidebar category counts
  updateSidebarBadges(eatingTables);
  
  if (filtered.length === 0) {
    activeOrdersContainer.innerHTML = `
      <div class="empty-state">
        <span class="empty-state-icon">🛍️</span>
        <span class="empty-state-text">Không có đơn hàng hoạt động nào.</span>
      </div>
    `;
    return;
  }
  
  filtered.forEach(table => {
    const loc = (table.location || '').toLowerCase();
    let typeText = 'Tại bàn';
    let icon = '🍲';
    let color = 'var(--sapo-primary)';
    
    if (loc === 'mang về') {
      typeText = 'Mang đi';
      icon = '🛍️';
      color = 'var(--sapo-orange)';
    } else if (loc === 'giao hàng') {
      typeText = 'Giao hàng';
      icon = '🚚';
      color = 'var(--sapo-purple)';
    } else if (loc === 'đối tác') {
      typeText = 'Đối tác';
      icon = '🤝';
      color = 'var(--sapo-green)';
    }
    
    const totalAmount = table.order.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const timeText = getElapsedTimeText(table.updatedAt);
    
    const card = document.createElement('div');
    card.className = 'order-card';
    card.innerHTML = `
      <div class="order-card-accent" style="background-color: ${color};"></div>
      <div class="order-card-header">
        <span class="order-card-icon" style="color: ${color};">${icon}</span>
        <span class="order-card-type">${typeText}</span>
      </div>
      <div class="order-card-body">
        <div class="order-card-code">${table.name}</div>
        <div class="order-card-divider"></div>
        <div class="order-card-details">
          <div class="detail-row">
            <span class="detail-icon">🕒</span>
            <span class="detail-text">${timeText}</span>
          </div>
          <div class="detail-row">
            <span class="detail-icon">💰</span>
            <span class="detail-text price">${formatVND(totalAmount)}</span>
          </div>
        </div>
      </div>
    `;
    card.addEventListener('click', () => selectTable(table.id));
    activeOrdersContainer.appendChild(card);
  });
}

// Update Sidebar badges count
function updateSidebarBadges(eatingTables) {
  const counts = {
    all: eatingTables.length,
    table: eatingTables.filter(t => ['trệt', 'lầu', 'máy lạnh'].includes((t.location || '').toLowerCase())).length,
    takeaway: eatingTables.filter(t => (t.location || '').toLowerCase() === 'mang về').length,
    delivery: eatingTables.filter(t => (t.location || '').toLowerCase() === 'giao hàng').length,
    partner: eatingTables.filter(t => (t.location || '').toLowerCase() === 'đối tác').length
  };
  
  const badgeAll = document.getElementById('badge-count-all');
  const badgeTable = document.getElementById('badge-count-table');
  const badgeTakeaway = document.getElementById('badge-count-takeaway');
  const badgeDelivery = document.getElementById('badge-count-delivery');
  const badgePartner = document.getElementById('badge-count-partner');
  
  if (badgeAll) {
    badgeAll.textContent = counts.all;
    badgeAll.style.display = counts.all > 0 ? 'inline-block' : 'none';
  }
  if (badgeTable) {
    badgeTable.textContent = counts.table;
    badgeTable.style.display = counts.table > 0 ? 'inline-block' : 'none';
  }
  if (badgeTakeaway) {
    badgeTakeaway.textContent = counts.takeaway;
    badgeTakeaway.style.display = counts.takeaway > 0 ? 'inline-block' : 'none';
  }
  if (badgeDelivery) {
    badgeDelivery.textContent = counts.delivery;
    badgeDelivery.style.display = counts.delivery > 0 ? 'inline-block' : 'none';
  }
  if (badgePartner) {
    badgePartner.textContent = counts.partner;
    badgePartner.style.display = counts.partner > 0 ? 'inline-block' : 'none';
  }
}

// Bind Sidebar Item Filters click (specifically for Orders Tab sidebar)
document.querySelectorAll('#orders-sidebar-container .sidebar-item').forEach(item => {
  item.addEventListener('click', (e) => {
    document.querySelectorAll('#orders-sidebar-container .sidebar-item').forEach(i => i.classList.remove('active'));
    item.classList.add('active');
    renderOrders();
  });
});

// Bind Floor Sidebar click (specifically for Tables Tab floor sidebar)
document.querySelectorAll('#floor-sidebar-container .sidebar-item').forEach(item => {
  item.addEventListener('click', (e) => {
    document.querySelectorAll('#floor-sidebar-container .sidebar-item').forEach(i => i.classList.remove('active'));
    item.classList.add('active');
    renderTables();
  });
});

// Render Table Selection Grid (TAB 2)
function renderTables() {
  const container = document.getElementById('tables-container');
  if (!container) return;
  container.innerHTML = '';
  
  // Get active floor selection
  const activeFloorItem = document.querySelector('#floor-sidebar-container .sidebar-item.active');
  const activeFloor = activeFloorItem ? activeFloorItem.getAttribute('data-floor') : 'trệt';
  
  // Filter tables belonging to this floor
  const floorTables = tables.filter(t => {
    const tableId = parseInt(t.id);
    if (activeFloor === 'trệt') {
      return tableId >= 1 && tableId <= 20;
    } else if (activeFloor === 'lầu') {
      return tableId >= 21 && tableId <= 40;
    }
    return (t.location || '').toLowerCase() === activeFloor;
  });
  
  // Render Stats Bar values
  const eatingTables = tables.filter(t => t.status === 'eating');
  const emptyFloorTables = floorTables.filter(t => t.status !== 'eating');
  
  const statsTotalOrders = document.getElementById('stats-total-orders');
  const statsEmptyTables = document.getElementById('stats-empty-tables');
  
  if (statsTotalOrders) {
    statsTotalOrders.textContent = `Tổng số đơn: ${eatingTables.length}`;
  }
  if (statsEmptyTables) {
    statsEmptyTables.textContent = `Bàn trống: ${emptyFloorTables.length}/${floorTables.length}`;
  }
  
  floorTables.forEach(table => {
    const isOccupied = table.status === 'eating';
    const card = document.createElement('div');
    card.className = `table-card-sapo ${isOccupied ? 'occupied' : ''}`;
    
    // Strip prefix like "Bàn ", "Bàn L", "Bàn Lầu " to get clean display number/suffix
    const displayName = table.name.replace(/^(Bàn L|Bàn\s+)/i, '');
    const statusText = isOccupied ? 'Đang dùng' : 'Bàn trống';

    card.innerHTML = `
      <div class="table-card-sapo-top">${displayName}</div>
      <div class="table-card-sapo-divider"></div>
      <div class="table-card-sapo-bottom">${statusText}</div>
    `;
    
    card.addEventListener('click', () => selectTable(table.id));
    container.appendChild(card);
  });
}

function updateActiveTableSubtitle(table) {
  if (!activeTableStatusSubtitle) return;
  if (table.status === 'eating' && table.order.length > 0) {
    const totalAmount = table.order.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    activeTableStatusSubtitle.innerHTML = `Đang có order hoạt động (${formatVND(totalAmount)}) • Thêm món mới bên dưới`;
  } else {
    activeTableStatusSubtitle.innerHTML = `Trống • Gọi món mới bên dưới`;
  }
}

// Select a table to order (triggers Menu view)
function selectTable(tableId) {
  activeTableId = tableId;
  const table = tables.find(t => t.id === tableId);
  activeTableName.textContent = table.name;
  updateActiveTableSubtitle(table);

  // Reset filter state
  activeCategory = 'all';
  searchQuery = '';
  if (menuSearchInput) menuSearchInput.value = '';
  renderMenuItems();
  isMenuFiltered = false;
  updateCategoryTabs();
  
  isScrollingFromClick = false;
  if (scrollTimeout) {
    clearTimeout(scrollTimeout);
    scrollTimeout = null;
  }
  const scrollContainerElement = document.getElementById('menu-items-scroll-container');
  if (scrollContainerElement) {
    scrollContainerElement.scrollTop = 0;
  }
  
  // Check if occupied or new table
  if (table.status === 'eating') {
    cart = JSON.parse(JSON.stringify(table.order || []));
    tableDiscountPercent = 0;
    openOrderDetailsView(table);
  } else {
    cart = [];
    
    // Hide all tabs
    const tabIds = ['orders-view', 'tables-view', 'checkout-view'];
    tabIds.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.display = 'none';
    });
    
    // Hide top header
    const topNav = document.querySelector('.top-nav');
    if (topNav) topNav.style.display = 'none';
    
    // Show ordering view
    menuOrderingView.style.display = 'flex';
    menuOrderingView.classList.remove('slide-out');
    menuOrderingView.classList.add('slide-in');
    updateFloatingCartBar();

    // Hide bottom tab bar
    const bottomTabBar = document.querySelector('.bottom-tab-bar');
    if (bottomTabBar) bottomTabBar.style.display = 'none';
  }
}

// Render Menu Items based on category and search filter
function renderMenuItems() {
  const sidebar = document.getElementById('menu-groups-sidebar');
  const scrollContainer = document.getElementById('menu-items-scroll-container');
  if (!sidebar || !scrollContainer) return;
  
  sidebar.innerHTML = '';
  
  // Clear scroll container but keep the compat wrapper hidden
  scrollContainer.innerHTML = '';
  const compatWrapper = document.createElement('div');
  compatWrapper.id = 'menu-items-container';
  compatWrapper.style.display = 'none';
  scrollContainer.appendChild(compatWrapper);

  let groupsToRender = menuGroups;
  if (!groupsToRender || groupsToRender.length === 0) {
    const uniqueCategories = [...new Set(menu.map(i => i.category || 'Khác'))];
    groupsToRender = uniqueCategories.map((cat, idx) => ({
      id: idx,
      name: cat,
      items: menu.filter(i => i.category === cat)
    }));
  }

  // Filter items in each group by search query
  const searchLower = searchQuery.toLowerCase();
  const activeGroups = groupsToRender.map(g => {
    const filteredItems = g.items.filter(item => {
      return item.name.toLowerCase().includes(searchLower) || 
             (item.description && item.description.toLowerCase().includes(searchLower));
    });
    return {
      ...g,
      items: filteredItems
    };
  }).filter(g => g.items.length > 0);

  if (activeGroups.length === 0) {
    scrollContainer.innerHTML = `
      <div class="text-center text-muted p-md" style="font-size: 13px; margin-top: 40px; color: #64748b;">
        Không tìm thấy món ăn nào khớp với yêu cầu.
      </div>
    `;
    return;
  }

  // Render Sidebar
  activeGroups.forEach((group, idx) => {
    const item = document.createElement('div');
    item.className = `menu-group-sidebar-item ${idx === activeGroupIndex ? 'active' : ''}`;
    item.setAttribute('data-group-id', group.id || idx);
    item.setAttribute('data-group-idx', idx);
    
    item.innerHTML = `
      <div class="menu-group-sidebar-item-icon">⊞</div>
      <div style="font-size: 10px; font-weight: 700; text-transform: uppercase;">${group.name}</div>
    `;
    
    item.addEventListener('click', () => {
      activeGroupIndex = idx;
      document.querySelectorAll('#menu-groups-sidebar .menu-group-sidebar-item').forEach(i => i.classList.remove('active'));
      item.classList.add('active');
      
      const targetHeader = document.getElementById(`group-section-${group.id || idx}`);
      if (targetHeader) {
        isScrollingFromClick = true;
        targetHeader.scrollIntoView({ behavior: 'smooth', block: 'start' });
        
        if (scrollTimeout) clearTimeout(scrollTimeout);
        scrollTimeout = setTimeout(() => {
          isScrollingFromClick = false;
        }, 850);
      }
    });
    
    sidebar.appendChild(item);
  });

  // Render Main scrollable content
  activeGroups.forEach((group, idx) => {
    // Group section header
    const titleDiv = document.createElement('div');
    titleDiv.className = 'menu-ordering-group-title';
    titleDiv.id = `group-section-${group.id || idx}`;
    titleDiv.textContent = group.name.toUpperCase();
    scrollContainer.appendChild(titleDiv);
    
    // Grid of cards
    const gridDiv = document.createElement('div');
    gridDiv.className = 'sapo-food-grid';
    
    group.items.forEach(item => {
      const card = document.createElement('div');
      card.className = 'sapo-food-card';
      
      let imgHtml = '';
      if (item.image_url) {
        imgHtml = `<img src="${item.image_url}">`;
      } else {
        imgHtml = `<img src="images/logo.png" style="object-fit: cover;">`;
      }
      
      let fontSize = '11px';
      if (item.name.length > 45) {
        fontSize = '8px';
      } else if (item.name.length > 30) {
        fontSize = '9.5px';
      }

      const priceText = item.price === 0 ? 'Tự nhập giá' : formatVND(item.price);

      card.innerHTML = `
        <div class="sapo-food-card-img">
          ${imgHtml}
        </div>
        <div class="sapo-food-card-price-bar">${priceText}</div>
        <div class="sapo-food-card-name-bar" style="font-size: ${fontSize};">${item.name}</div>
      `;
      
      card.addEventListener('click', () => openCustomModal(item));
      gridDiv.appendChild(card);
    });
    
    scrollContainer.appendChild(gridDiv);
  });
}

// Open Item Customization Modal
function openCustomModal(item) {
  activeItem = item;
  currentQuantity = 1;
  stepperValue.textContent = currentQuantity;
  customItemNotes.value = '';
  
  customModalTitle.textContent = item.name;
  if (item.image_url) {
    customModalEmoji.innerHTML = `<img src="${item.image_url}" style="width:72px; height:72px; object-fit:cover; border-radius:var(--rounded-full);">`;
  } else {
    customModalEmoji.innerHTML = `<img src="images/logo.png" style="width:72px; height:72px; object-fit:cover; border-radius:var(--rounded-full);">`;
  }
  if (item.price === 0) {
    customModalPrice.textContent = 'Giá: Tự nhập khi thêm';
  } else {
    customModalPrice.textContent = formatVND(item.price);
  }
  customModalDesc.textContent = item.description || '';
  
  // Render linked option groups
  const optionsContainer = document.getElementById('custom-item-options-container');
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
        
        const defaultOpts = og.options.filter(o => o.is_default);
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
        
        groupDiv.appendChild(panel);
        
        // Toggle action
        trigger.addEventListener('click', (e) => {
          e.stopPropagation();
          const isOpen = panel.style.display === 'block';
          
          document.querySelectorAll('.custom-opt-select-panel').forEach(p => p.style.display = 'none');
          document.querySelectorAll('.custom-opt-select-trigger').forEach(t => {
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

function closeCustomModal() {
  customItemModal.style.display = 'none';
  activeItem = null;
}

// Open Cart Details Modal
function openCartModal() {
  const table = tables.find(t => t.id === activeTableId);
  cartModalTitle.textContent = activeTableId ? `Giỏ hàng - ${table ? table.name : ''}` : 'Tạo hóa đơn';

  const serviceTypeSelect = document.getElementById('cart-service-type');
  const tableSelectContainer = document.getElementById('cart-table-select-container');
  const displayLabel = document.getElementById('cart-table-display-label');
  
  if (activeTableId) {
    // Ordering for a pre-selected table (from the "Bàn" tab or an active order)
    const tableObj = tables.find(t => t.id === activeTableId);
    if (tableObj && tableObj.location === 'mang về') {
      if (serviceTypeSelect) {
        serviceTypeSelect.value = 'takeaway';
        serviceTypeSelect.disabled = true;
      }
      if (tableSelectContainer) tableSelectContainer.style.display = 'none';
    } else {
      if (serviceTypeSelect) {
        serviceTypeSelect.value = 'table';
        serviceTypeSelect.disabled = true;
      }
      if (tableSelectContainer) {
        tableSelectContainer.style.display = 'flex';
        if (displayLabel) {
          displayLabel.textContent = tableObj ? tableObj.name : 'Chọn bàn';
          displayLabel.style.color = '#0066cc';
        }
        pickerSelectedTableId = activeTableId;
      }
    }
  } else {
    // New quick order from "Tất cả" tab
    let isTakeawayTab = false;
    if (serviceTypeSelect) {
      const activeSidebarItem = document.querySelector('.orders-sidebar .sidebar-item.active');
      const currentSidebarFilter = activeSidebarItem ? activeSidebarItem.getAttribute('data-sidebar') : 'all';
      if (currentSidebarFilter === 'takeaway') {
        serviceTypeSelect.value = 'takeaway';
        isTakeawayTab = true;
      } else {
        serviceTypeSelect.value = 'table'; // Default choice
      }
      serviceTypeSelect.disabled = false;
    }
    if (tableSelectContainer) {
      tableSelectContainer.style.display = isTakeawayTab ? 'none' : 'flex';
      if (displayLabel) {
        if (pickerSelectedTableId && !isTakeawayTab) {
          const tbl = tables.find(t => t.id === pickerSelectedTableId);
          displayLabel.textContent = tbl ? tbl.name : 'Chọn bàn';
          displayLabel.style.color = '#0066cc';
        } else {
          displayLabel.textContent = 'Chọn bàn';
          displayLabel.style.color = '#475569';
        }
      }
    }
  }

  // Attach change listener for service type if not already attached
  if (serviceTypeSelect && !serviceTypeSelect.dataset.listenerAttached) {
    serviceTypeSelect.addEventListener('change', () => {
      if (serviceTypeSelect.value === 'takeaway') {
        if (tableSelectContainer) tableSelectContainer.style.display = 'none';
      } else {
        if (tableSelectContainer) tableSelectContainer.style.display = 'flex';
      }
    });
    serviceTypeSelect.dataset.listenerAttached = 'true';
  }

  renderCartItems();
  cartModal.style.display = 'flex';
}

function closeCartModal() {
  cartModal.style.display = 'none';
}

// Render Items inside Cart Modal
function renderCartItems() {
  cartItemsListContainer.innerHTML = '';
  
  if (cart.length === 0) {
    cartItemsListContainer.innerHTML = `
      <div class="text-center text-muted p-md" style="font-size: 13px;">
        Giỏ hàng rỗng. Hãy chọn món ăn trước nhé!
      </div>
    `;
    const cartSubtotalEl = document.getElementById('cart-subtotal-price');
    if (cartSubtotalEl) cartSubtotalEl.textContent = '0đ';
    const summaryTotalQtyEl = document.getElementById('cart-summary-total-qty');
    if (summaryTotalQtyEl) summaryTotalQtyEl.textContent = 'SL: 0';
    cartTotalPriceLarge.textContent = 'TỔNG: 0đ';
    return;
  }

  let total = 0;
  let totalQty = 0;
  cart.forEach((item, index) => {
    const subtotal = item.price * item.quantity;
    total += subtotal;
    totalQty += item.quantity;
    
    const div = document.createElement('div');
    div.style.display = 'flex';
    div.style.justifyContent = 'space-between';
    div.style.alignItems = 'flex-start';
    div.style.padding = '8px 0';
    div.style.borderBottom = '1px dashed #cbd5e1';
    
    const optionsText = item.options && item.options.length > 0
      ? item.options.map(o => `+ ${o.name}`).join(', ')
      : '';
      
    div.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 4px; max-width: 60%; text-align: left;">
        <span style="font-weight: 700; color: #1e293b; font-size: 14px;">${item.name}</span>
        ${optionsText ? `<span style="font-size: 12px; color: #64748b; font-weight: 500;">${optionsText}</span>` : ''}
        ${item.notes ? `<span style="font-size: 11px; color: #ef4444; font-style: italic;">* Ghi chú: ${item.notes}</span>` : ''}
      </div>
      <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 8px;">
        <span style="font-weight: 700; color: #1e293b; font-size: 14px;">${formatVND(subtotal)}</span>
        <div style="display: flex; align-items: center; gap: 12px; user-select: none;">
          <button class="btn-qty-minus" data-index="${index}" style="width: 28px; height: 28px; border-radius: 50%; border: 1px solid #cbd5e1; background-color: #f8fafc; color: #64748b; font-size: 16px; font-weight: 700; display: flex; align-items: center; justify-content: center; cursor: pointer; outline: none; padding: 0;">-</button>
          <span style="font-size: 14px; font-weight: 600; color: #1e293b; min-width: 14px; text-align: center;">${item.quantity}</span>
          <button class="btn-qty-plus" data-index="${index}" style="width: 28px; height: 28px; border-radius: 50%; border: 1px solid #0066cc; background-color: #ffffff; color: #0066cc; font-size: 16px; font-weight: 700; display: flex; align-items: center; justify-content: center; cursor: pointer; outline: none; padding: 0;">+</button>
        </div>
      </div>
    `;
    
    div.querySelector('.btn-qty-minus').addEventListener('click', (e) => {
      const idx = parseInt(e.currentTarget.getAttribute('data-index'));
      if (cart[idx].quantity > 1) {
        cart[idx].quantity--;
      } else {
        cart.splice(idx, 1);
      }
      renderCartItems();
      updateFloatingCartBar();
    });
    
    div.querySelector('.btn-qty-plus').addEventListener('click', (e) => {
      const idx = parseInt(e.currentTarget.getAttribute('data-index'));
      cart[idx].quantity++;
      renderCartItems();
      updateFloatingCartBar();
    });
    
    cartItemsListContainer.appendChild(div);
  });
  
  const cartSubtotalEl = document.getElementById('cart-subtotal-price');
  if (cartSubtotalEl) cartSubtotalEl.textContent = formatVND(total);
  const summaryTotalQtyEl = document.getElementById('cart-summary-total-qty');
  if (summaryTotalQtyEl) summaryTotalQtyEl.textContent = `SL: ${totalQty}`;
  
  cartTotalPriceLarge.textContent = 'TỔNG: ' + formatVND(total);
}

// Update Floating Cart Bar (Bottom Sheet Drawer)
let isCartDrawerOpen = false;

function updateFloatingCartBar() {
  const totalQty = cart.reduce((sum, item) => sum + item.quantity, 0);
  const totalPrice = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  
  const drawerContainer = document.getElementById('cart-drawer-container');
  const drawerItemsList = document.getElementById('cart-drawer-items-list');
  const drawerCartTotal = document.getElementById('drawer-cart-total');
  const drawerCartQty = document.getElementById('drawer-cart-qty');
  const subtotalVal = document.getElementById('cart-drawer-subtotal-val');
  const drawerHeader = document.getElementById('cart-drawer-header');
  const subtotalRow = document.getElementById('cart-drawer-subtotal-row');
  const chevron = document.getElementById('cart-drawer-chevron');

  if (drawerContainer) {
    if (cart.length === 0) {
      drawerContainer.style.display = 'none';
      isCartDrawerOpen = false;
    } else {
      drawerContainer.style.display = 'flex';
      
      // Update values
      if (drawerCartTotal) drawerCartTotal.textContent = `Thành tiền: ${formatVND(totalPrice)}`;
      if (drawerCartQty) drawerCartQty.textContent = `Mặt hàng: ${totalQty}`;
      if (subtotalVal) subtotalVal.textContent = formatVND(totalPrice);

      // Handle expanded vs collapsed states
      if (isCartDrawerOpen) {
        if (drawerHeader) drawerHeader.style.display = 'flex';
        if (subtotalRow) subtotalRow.style.display = 'flex';
        if (chevron) {
          chevron.style.transform = 'rotate(180deg)';
          chevron.innerHTML = '<polyline points="6 9 12 15 18 9"></polyline><polyline points="6 4 12 10 18 4" style="opacity:0.5;"></polyline>';
        }
        
        if (drawerItemsList) {
          drawerItemsList.style.display = 'flex';
          drawerItemsList.innerHTML = '';
          
          cart.forEach((item, index) => {
            const itemCard = document.createElement('div');
            itemCard.style.display = 'flex';
            itemCard.style.alignItems = 'center';
            itemCard.style.gap = '12px';
            itemCard.style.paddingBottom = '12px';
            itemCard.style.borderBottom = '1px solid #f1f5f9';

            const itemImg = item.image ? `images/${item.image}` : (item.emoji ? `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='40' height='40' viewBox='0 0 100 100'><text y='0.9em' font-size='90'>${item.emoji}</text></svg>` : 'images/default-food.png');

            const optionsText = item.options && item.options.length > 0
              ? item.options.map(o => `+ ${o.name}`).join(', ')
              : '';

            itemCard.innerHTML = `
              <img src="${itemImg}" style="width: 52px; height: 52px; object-fit: cover; border-radius: 8px; background-color: #f1f5f9;" onerror="this.src='images/default-food.png'">
              <div style="flex: 1; display: flex; flex-direction: column; text-align: left;">
                <span style="font-size: 13px; font-weight: 700; color: #1e293b; line-height: 1.3;">${item.name}</span>
                ${optionsText ? `<span style="font-size: 12px; color: #64748b; font-weight: 500;">${optionsText}</span>` : ''}
                <span style="font-size: 13px; font-weight: 700; color: #024ad8; margin-top: 4px;">${formatVND(item.price)}</span>
                <span style="font-size: 12px; color: #0066cc; cursor: pointer; text-decoration: underline; margin-top: 4px; display: inline-block; width: fit-content;" onclick="openItemNotesEdit(${index})">${item.notes ? `Ghi chú: ${item.notes}` : 'Ghi chú'}</span>
              </div>
              <div style="display: flex; align-items: center; user-select: none;">
                <button onclick="changeDrawerItemQty(${index}, -1)" style="border: 1px solid #cbd5e1; background: #ffffff; width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 16px; color: #64748b; cursor: pointer; padding: 0;">−</button>
                <span style="border: 1px solid #cbd5e1; width: 36px; height: 28px; display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 600; color: #1e293b; border-radius: 4px; margin: 0 4px; background: #ffffff;">${item.quantity}</span>
                <button onclick="changeDrawerItemQty(${index}, 1)" style="border: 1px solid #0088ff; background: #ffffff; width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 16px; color: #0088ff; cursor: pointer; padding: 0;">+</button>
              </div>
            `;
            drawerItemsList.appendChild(itemCard);
          });
        }
      } else {
        if (drawerHeader) drawerHeader.style.display = 'none';
        if (drawerItemsList) drawerItemsList.style.display = 'none';
        if (subtotalRow) subtotalRow.style.display = 'none';
      }
    }
  }

  // Keep references to original floating-cart-bar invisible to avoid reference errors
  if (floatingCartBar) {
    floatingCartBar.style.display = 'none';
  }
}

function toggleCartDrawerHeader(e) {
  e.stopPropagation();
  isCartDrawerOpen = false;
  updateFloatingCartBar();
}

function toggleCartDrawerFooter(e) {
  if (e.target.closest('#btn-drawer-checkout')) return;
  isCartDrawerOpen = !isCartDrawerOpen;
  updateFloatingCartBar();
}

function handleDrawerCheckout(e) {
  e.stopPropagation();
  const table = tables.find(t => t.id === activeTableId);
  if (table && table.status === 'eating') {
    // Hide ordering view
    menuOrderingView.style.display = 'none';
    menuOrderingView.classList.remove('slide-in');
    
    // Open order details view
    openOrderDetailsView(table);
  } else {
    openCartModal();
  }
}

function changeDrawerItemQty(index, amount) {
  const item = cart[index];
  if (!item) return;
  
  item.quantity += amount;
  if (item.quantity <= 0) {
    cart.splice(index, 1);
  }
  
  renderCartItems();
  updateFloatingCartBar();
}

function openItemNotesEdit(index) {
  const item = cart[index];
  if (!item) return;
  
  const note = prompt("Nhập ghi chú cho món ăn:", item.notes || "");
  if (note !== null) {
    item.notes = note.trim();
    renderCartItems();
    updateFloatingCartBar();
  }
}

// Bind to window
window.toggleCartDrawerHeader = toggleCartDrawerHeader;
window.toggleCartDrawerFooter = toggleCartDrawerFooter;
window.handleDrawerCheckout = handleDrawerCheckout;
window.changeDrawerItemQty = changeDrawerItemQty;
window.openItemNotesEdit = openItemNotesEdit;

// Handle Category filter clicking
function updateCategoryTabs() {
  if (!categoryStripContainer) return;
  const tabs = categoryStripContainer.querySelectorAll('.category-tab');
  tabs.forEach(tab => {
    if (tab.getAttribute('data-category') === activeCategory) {
      tab.classList.add('active');
    } else {
      tab.classList.remove('active');
    }
  });
}

// Back button on Ordering menu
btnBackTables.addEventListener('click', () => {
  activeTableId = null;
  
  // Play slide-out animation
  menuOrderingView.classList.remove('slide-in');
  menuOrderingView.classList.add('slide-out');
  
  // Show bottom tab bar and header immediately for better UX
  const bottomTabBar = document.querySelector('.bottom-tab-bar');
  if (bottomTabBar) bottomTabBar.style.display = 'flex';
  const topNav = document.querySelector('.top-nav');
  if (topNav) topNav.style.display = 'flex';
  
  // Show the underlying tab view immediately so it is visible during transition
  const selectedPanel = document.getElementById(`${activeTab}-view`);
  if (selectedPanel) selectedPanel.style.display = 'flex';
  
  // Pre-render the active tab data immediately so the content is loaded as the overlay slides out
  if (activeTab === 'orders') {
    renderOrders();
  } else if (activeTab === 'tables') {
    renderTables();
  } else if (activeTab === 'checkout') {
    renderCheckoutOrders();
  }
  
  setTimeout(() => {
    menuOrderingView.style.display = 'none';
    menuOrderingView.classList.remove('slide-out');
    if (floatingCartBar) floatingCartBar.style.display = 'none';
    cart = [];
    
    // Return to the previous tab view
    switchTab(activeTab);
  }, 250);
});

// Category Click
if (categoryStripContainer) {
  categoryStripContainer.querySelectorAll('.category-tab').forEach(tab => {
    tab.addEventListener('click', (e) => {
      const target = e.currentTarget;
      activeCategory = target.getAttribute('data-category');
      updateCategoryTabs();
      renderMenuItems();
    });
  });
}

// Search input with clear button
const btnClearMenuSearch = document.getElementById('btn-clear-menu-search');

if (menuSearchInput) {
  menuSearchInput.addEventListener('input', (e) => {
    searchQuery = e.target.value;
    isMenuFiltered = searchQuery.trim().length > 0;
    renderMenuItems();
    
    if (btnClearMenuSearch) {
      btnClearMenuSearch.style.display = searchQuery.length > 0 ? 'block' : 'none';
    }
  });
}

if (btnClearMenuSearch && menuSearchInput) {
  btnClearMenuSearch.addEventListener('click', () => {
    menuSearchInput.value = '';
    searchQuery = '';
    isMenuFiltered = false;
    renderMenuItems();
    btnClearMenuSearch.style.display = 'none';
    menuSearchInput.focus();
  });
}

// Bind view cart buttons to original view cart logic
const btnViewCartHeader = document.getElementById('btn-view-cart-header');
const btnViewCartFooter = document.getElementById('btn-view-cart-footer');

if (btnViewCartHeader) {
  btnViewCartHeader.addEventListener('click', () => {
    if (cart.length > 0) {
      openCartModal();
    } else {
      showSuccessToast('⚠️ Giỏ hàng đang trống!');
    }
  });
}

if (btnViewCartFooter) {
  btnViewCartFooter.addEventListener('click', () => {
    if (cart.length > 0) {
      openCartModal();
    } else {
      showSuccessToast('⚠️ Giỏ hàng đang trống! Vui lòng chọn món.');
    }
  });
}

// Customization Modal stepper actions
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

btnAddToCartConfirm.addEventListener('click', () => {
  if (!activeItem) return;
  
  const notes = customItemNotes.value.trim();
  
  // Collect selected options
  const selectedOptions = [];
  let optionPriceSum = 0;
  
  const inputs = document.querySelectorAll('.select-option-input:checked');
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
  const existingIndex = cart.findIndex(item => {
    if (item.id !== activeItem.id || item.notes !== notes || item.price !== price) return false;
    
    const o1 = item.options || [];
    const o2 = selectedOptions;
    if (o1.length !== o2.length) return false;
    
    const o1Ids = o1.map(o => o.id).sort().join(',');
    const o2Ids = o2.map(o => o.id).sort().join(',');
    return o1Ids === o2Ids;
  });
  
  if (existingIndex !== -1) {
    cart[existingIndex].quantity += currentQuantity;
  } else {
    cart.push({
      id: activeItem.id,
      name: activeItem.name,
      price: price,
      emoji: activeItem.emoji || '🍽️',
      quantity: currentQuantity,
      notes: notes,
      options: selectedOptions
    });
  }
  
  closeCustomModal();
  updateFloatingCartBar();
});

// Cart modal triggers
btnViewCart.addEventListener('click', openCartModal);
btnCloseCartModal.addEventListener('click', closeCartModal);
btnCloseCartModalFoot.addEventListener('click', closeCartModal);

// Helper to remove Vietnamese accents for clean raw thermal printing
function removeAccents(str) {
  if (!str) return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, char => char === 'đ' ? 'd' : 'D');
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
async function printDocxSlip(printerId, tableName, items, title = 'HOÁ ĐƠN BẾP') {
  if (items.length === 0) return;
  
  if (socket && socket.connected) {
    socket.emit('request_print_kitchen_slip', {
      printerId: printerId,
      tableName: tableName,
      items: items,
      title: title
    });
    if (typeof showSuccessToast === 'function') {
      showSuccessToast(`📤 Đã gửi lệnh in ${title} cho ${tableName} tới máy chủ.`);
    }
  } else {
    // Fallback: Enqueue print job in the database for polling cashier to print
    try {
      const response = await fetch('/api/print-jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          printerId: printerId,
          type: 'kitchen',
          payload: { printerId, tableName, items, title }
        })
      });
      if (response.ok) {
        if (typeof showSuccessToast === 'function') {
          showSuccessToast(`📤 Đã gửi lệnh in ${title} cho ${tableName} tới hàng đợi in.`);
        }
      } else {
        throw new Error('Server error');
      }
    } catch (err) {
      console.error('Failed to queue print job:', err);
      alert('Không thể chuyển lệnh in (Socket offline và hàng đợi in lỗi).');
    }
  }
}

// Helper to format isoString into readable time
function formatTime(isoString) {
  if (!isoString) return '';
  const date = new Date(isoString);
  const pad = (n) => String(n).padStart(2, '0');
  const hh = pad(date.getHours());
  const mm = pad(date.getMinutes());
  const ss = pad(date.getSeconds());
  const DD = pad(date.getDate());
  const MM = pad(date.getMonth() + 1);
  const YYYY = date.getFullYear();
  return `${hh}:${mm}:${ss} - ${DD}/${MM}/${YYYY}`;
}

// Global Print Receipt Function
async function printReceipt(tableObj, orderItems, discountAmount, receivedAmount, transactionId = null, timestamp = null, payMethod = 'cash') {
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
    if (typeof showSuccessToast === 'function') {
      showSuccessToast(`📤 Đã gửi yêu cầu in hóa đơn ${tableObj.name} tới quầy thu ngân.`);
    }
  } else {
    // Fallback: Enqueue print job in the database
    try {
      const response = await fetch('/api/print-jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          printerId: 'receipt',
          type: 'receipt',
          payload: { tableObj, orderItems, discountAmount, receivedAmount, transactionId, timestamp, payMethod }
        })
      });
      if (response.ok) {
        if (typeof showSuccessToast === 'function') {
          showSuccessToast(`📤 Đã gửi yêu cầu in hóa đơn ${tableObj.name} tới hàng đợi in.`);
        }
      } else {
        throw new Error('Server error');
      }
    } catch (err) {
      console.error('Failed to queue print job:', err);
      alert('Không thể chuyển lệnh in (Socket offline và hàng đợi in lỗi).');
    }
  }
}

// Submit Order to backend
btnSubmitOrder.addEventListener('click', async () => {
  if (cart.length === 0) {
    showSuccessToast('⚠️ Giỏ hàng đang trống!');
    return;
  }
  
  const serviceTypeSelect = document.getElementById('cart-service-type');
  
  let targetTableId = activeTableId;
  
  if (!targetTableId) {
    // No pre-selected table (created from "Tất cả" FAB)
    if (serviceTypeSelect.value === 'table') {
      // Must choose a table
      if (!pickerSelectedTableId) {
        showSuccessToast('⚠️ Vui lòng chọn số bàn!');
        return;
      }
      targetTableId = pickerSelectedTableId;
    } else {
      // Mang đi selected: auto-generate takeaway order code
      // Format: DDMMYYYY + STT
      const now = new Date();
      const day = String(now.getDate()).padStart(2, '0');
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const year = now.getFullYear();
      const dateStr = `${day}${month}${year}`;
      
      // Calculate STT based on location === 'mang về' and name starting with dateStr
      const todayTakeaways = tables.filter(t => t.location && t.location.toLowerCase() === 'mang về' && t.name.startsWith(dateStr));
      const stt = String(todayTakeaways.length + 1).padStart(2, '0');
      const orderCode = `${dateStr}${stt}`;
      
      btnSubmitOrder.disabled = true;
      btnSubmitOrder.textContent = 'Đang tạo...';
      
      try {
        // Create table dynamically
        const createRes = await fetch('/api/tables', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: orderCode, location: 'mang về' })
        });
        
        if (createRes.status === 401) {
          window.location.href = '/login.html';
          return;
        }
        
        const createResult = await createRes.json();
        if (createResult.success) {
          // Fetch updated tables to find the new table's ID
          const tablesRes = await fetch('/api/tables');
          if (tablesRes.ok) {
            tables = await tablesRes.json();
          }
          const createdTable = tables.find(t => t.name === orderCode);
          if (createdTable) {
            targetTableId = createdTable.id;
          } else {
            throw new Error('Không tìm thấy mã đơn vừa tạo');
          }
        } else {
          throw new Error(createResult.error || 'Lỗi tạo đơn mang đi');
        }
      } catch (err) {
        console.error(err);
        alert(`Lỗi: ${err.message || 'Không thể tạo đơn mang đi.'}`);
        btnSubmitOrder.disabled = false;
        btnSubmitOrder.textContent = 'Lưu';
        return;
      }
    }
  }

  // Submit order for targetTableId
  btnSubmitOrder.disabled = true;
  btnSubmitOrder.textContent = 'Đang gửi...';
  
  const tableBeforeSave = tables.find(t => t.id === targetTableId);
  const oldOrder = tableBeforeSave ? JSON.parse(JSON.stringify(tableBeforeSave.order || [])) : [];
  const tableName = tableBeforeSave ? tableBeforeSave.name : 'Mang đi';
  
  try {
    const response = await fetch('/api/order', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        tableId: targetTableId,
        items: cart
      })
    });
    
    if (response.status === 401) {
      window.location.href = '/login.html';
      return;
    }
    
    const result = await response.json();
    if (result.success) {
      const diffItems = getOrderDifference(oldOrder, cart);
      
      if (diffItems.length > 0) {
        const isAdd = (oldOrder && oldOrder.length > 0);
        const kitchenTitle = isAdd ? 'PHIẾU THÊM MÓN' : 'HOÁ ĐƠN BẾP';
        const drinkTitle = isAdd ? 'PHIẾU THÊM NƯỚC' : 'HOÁ ĐƠN NƯỚC';
        
        // Separate items in the cart
        const drinkItems = diffItems.filter(item => isDrinkItem(item, menu));
        const kitchenItems = diffItems.filter(item => !drinkItems.includes(item));

        // Trigger automatic printing for connected printers using docx templates
        printDocxSlip('kitchen_default', tableName, kitchenItems, kitchenTitle);
        printDocxSlip('kitchen_bar', tableName, drinkItems, drinkTitle);
      }

      showSuccessToast(`Đã gửi Order thành công cho ${tableName}!`);
      
      closeCartModal();
      
      // Play slide-out animation
      menuOrderingView.classList.remove('slide-in');
      menuOrderingView.classList.add('slide-out');
      
      // Show bottom tab bar and header immediately for better UX
      const bottomTabBar = document.querySelector('.bottom-tab-bar');
      if (bottomTabBar) bottomTabBar.style.display = 'flex';
      const topNav = document.querySelector('.top-nav');
      if (topNav) topNav.style.display = 'flex';
      
      // Show the underlying tab view immediately so it is visible during transition
      const selectedPanel = document.getElementById(`${activeTab}-view`);
      if (selectedPanel) selectedPanel.style.display = 'flex';
      
      // Pre-render the active tab data immediately so the content is loaded as the overlay slides out
      if (activeTab === 'orders') {
        renderOrders();
      } else if (activeTab === 'tables') {
        renderTables();
      } else if (activeTab === 'checkout') {
        renderCheckoutOrders();
      }
      
      setTimeout(async () => {
        menuOrderingView.style.display = 'none';
        menuOrderingView.classList.remove('slide-out');
        cart = [];
        activeTableId = null;
        pickerSelectedTableId = null; // Reset picker selection
        floatingCartBar.style.display = 'none';
        
        // Fetch latest and go back to orders
        const tablesRes = await fetch('/api/tables');
        if (tablesRes.ok) {
          tables = await tablesRes.json();
        }
        switchTab(activeTab);
      }, 250);
    } else {
      alert(`Lỗi khi đặt món: ${result.error || 'Vui lòng thử lại.'}`);
    }
  } catch (error) {
    console.error('Lỗi khi gửi order:', error);
    alert('Không thể kết nối đến máy chủ. Vui lòng kiểm tra mạng.');
  } finally {
    btnSubmitOrder.disabled = false;
    btnSubmitOrder.textContent = 'Lưu';
  }
});

// Show success toast notification
function showSuccessToast(message) {
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
  
  setTimeout(() => {
    toast.remove();
  }, 3500);
}




// QUICK ORDER CREATION FLOW (FAB BUTTON)
const btnCreateOrderFab = document.getElementById('btn-create-order-fab');

let pickerActiveFloor = 'trệt';
let tempSelectedTableId = null;
let pickerSelectedTableId = null;

function openTablePicker() {
  if (activeTableId) {
    // If table is pre-locked, don't allow picking
    return;
  }
  
  // Set temporary selected table to the currently confirmed one (if any)
  tempSelectedTableId = pickerSelectedTableId;
  
  // Reset floor to 'trệt' or the floor of the selected table
  if (tempSelectedTableId) {
    const tbl = tables.find(t => t.id === tempSelectedTableId);
    if (tbl) {
      // Table 1-20 is 'trệt', 21-40 is 'lầu'
      const idVal = parseInt(tbl.id);
      pickerActiveFloor = (idVal >= 1 && idVal <= 20) ? 'trệt' : 'lầu';
    }
  } else {
    pickerActiveFloor = 'trệt';
  }
  
  // Render sidebar active states
  const sidebarItems = document.querySelectorAll('#picker-floor-sidebar .sidebar-item');
  sidebarItems.forEach(item => {
    if (item.getAttribute('data-picker-floor') === pickerActiveFloor) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });

  // Calculate stats
  // Total orders = count of tables with status === 'eating'
  const totalOrders = tables.filter(t => t.status === 'eating' && parseInt(t.id) >= 1 && parseInt(t.id) <= 40).length;
  // Empty tables for the current floor
  const floorTablesList = tables.filter(t => {
    const idVal = parseInt(t.id);
    if (pickerActiveFloor === 'trệt') {
      return idVal >= 1 && idVal <= 20;
    } else {
      return idVal >= 21 && idVal <= 40;
    }
  });
  const emptyFloorTables = floorTablesList.filter(t => t.status !== 'eating').length;
  const totalFloorTables = floorTablesList.length || 20;
  
  const statsOrdersEl = document.getElementById('picker-stats-orders');
  if (statsOrdersEl) statsOrdersEl.textContent = `Tổng số đơn: ${totalOrders}`;
  
  const statsEmptyEl = document.getElementById('picker-stats-empty');
  if (statsEmptyEl) statsEmptyEl.textContent = `Bàn trống: ${emptyFloorTables}/${totalFloorTables}`;

  renderPickerTables();
  updatePickerFooter();

  const pickerModal = document.getElementById('table-picker-modal');
  if (pickerModal) pickerModal.style.display = 'flex';
}

function closeTablePicker() {
  const pickerModal = document.getElementById('table-picker-modal');
  if (pickerModal) pickerModal.style.display = 'none';
}

function confirmTablePicker() {
  if (!tempSelectedTableId) return;
  pickerSelectedTableId = tempSelectedTableId;
  
  const tbl = tables.find(t => t.id === pickerSelectedTableId);
  const displayLabel = document.getElementById('cart-table-display-label');
  if (displayLabel && tbl) {
    displayLabel.textContent = tbl.name;
    displayLabel.style.color = '#0066cc'; // Make it look active
  }
  
  closeTablePicker();
}

function switchPickerFloor(floor) {
  pickerActiveFloor = floor;
  
  const sidebarItems = document.querySelectorAll('#picker-floor-sidebar .sidebar-item');
  sidebarItems.forEach(item => {
    if (item.getAttribute('data-picker-floor') === floor) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });

  // Re-calculate stats empty count for the switched floor
  const floorTablesList = tables.filter(t => {
    const idVal = parseInt(t.id);
    if (pickerActiveFloor === 'trệt') {
      return idVal >= 1 && idVal <= 20;
    } else {
      return idVal >= 21 && idVal <= 40;
    }
  });
  const emptyFloorTables = floorTablesList.filter(t => t.status !== 'eating').length;
  const totalFloorTables = floorTablesList.length || 20;
  const statsEmptyEl = document.getElementById('picker-stats-empty');
  if (statsEmptyEl) statsEmptyEl.textContent = `Bàn trống: ${emptyFloorTables}/${totalFloorTables}`;

  renderPickerTables();
}

function renderPickerTables() {
  const grid = document.getElementById('picker-tables-grid');
  if (!grid) return;
  grid.innerHTML = '';
  
  // Filter tables by floor and ID range
  const filtered = tables.filter(t => {
    const idVal = parseInt(t.id);
    if (pickerActiveFloor === 'trệt') {
      return idVal >= 1 && idVal <= 20;
    } else {
      return idVal >= 21 && idVal <= 40;
    }
  }).sort((a, b) => parseInt(a.id) - parseInt(b.id));

  filtered.forEach(t => {
    const isOccupied = t.status === 'eating';
    const isTempSelected = tempSelectedTableId === t.id;
    
    const card = document.createElement('div');
    card.style.backgroundColor = '#ffffff';
    card.style.borderRadius = '8px';
    card.style.padding = '12px 8px';
    card.style.textAlign = 'center';
    card.style.cursor = 'pointer';
    card.style.boxShadow = '0 2px 4px rgba(0,0,0,0.05)';
    card.style.boxSizing = 'border-box';
    card.style.display = 'flex';
    card.style.flexDirection = 'column';
    card.style.justifyContent = 'center';
    
    // Highlight if selected
    if (isTempSelected) {
      card.style.border = '2px solid #0099ff';
    } else {
      card.style.border = '1px solid #e2e8f0';
    }

    card.innerHTML = `
      <div style="font-weight: 700; font-size: 16px; color: ${isTempSelected ? '#0099ff' : '#1e3a8a'}; margin-bottom: 6px; padding-bottom: 6px; border-bottom: 1px solid #f1f5f9;">
        ${t.name}
      </div>
      <div style="font-size: 11px; font-weight: 600; color: ${isOccupied ? '#ef4444' : '#64748b'};">
        ${isOccupied ? 'Đang dùng' : 'Bàn trống'}
      </div>
    `;

    card.addEventListener('click', () => {
      tempSelectedTableId = t.id;
      renderPickerTables();
      updatePickerFooter();
    });

    grid.appendChild(card);
  });
}

function updatePickerFooter() {
  const confirmBtn = document.getElementById('btn-confirm-table-picker');
  const selectedLabel = document.getElementById('picker-selected-label');
  
  if (tempSelectedTableId) {
    const tbl = tables.find(t => t.id === tempSelectedTableId);
    if (selectedLabel && tbl) {
      selectedLabel.textContent = tbl.name;
    }
    if (confirmBtn) {
      confirmBtn.disabled = false;
      confirmBtn.style.cursor = 'pointer';
      confirmBtn.style.backgroundColor = '#0099ff';
    }
  } else {
    if (selectedLabel) {
      selectedLabel.textContent = '0 bàn';
    }
    if (confirmBtn) {
      confirmBtn.disabled = true;
      confirmBtn.style.cursor = 'not-allowed';
      confirmBtn.style.backgroundColor = '#cbd5e1';
    }
  }
}

// Bind picker functions to global scope
window.openTablePicker = openTablePicker;
window.closeTablePicker = closeTablePicker;
window.confirmTablePicker = confirmTablePicker;
window.switchPickerFloor = switchPickerFloor;

if (btnCreateOrderFab) {
  btnCreateOrderFab.addEventListener('click', () => {
    // Reset cart and filter state
    cart = [];
    activeTableId = null;
    activeCategory = 'all';
    
    // Set activeTableName display
    activeTableName.textContent = 'Tạo đơn';
    activeTableName.style.display = 'inline-block';
    
    if (searchQuery !== '' || isMenuFiltered) {
      searchQuery = '';
      menuSearchInput.value = '';
      renderMenuItems();
      isMenuFiltered = false;
    } else {
      activeGroupIndex = 0;
      const sidebarItems = document.querySelectorAll('#menu-groups-sidebar .menu-group-sidebar-item');
      sidebarItems.forEach((item, idx) => {
        if (idx === 0) {
          item.classList.add('active');
        } else {
          item.classList.remove('active');
        }
      });
    }
    updateCategoryTabs();
    
    isScrollingFromClick = false;
    if (scrollTimeout) {
      clearTimeout(scrollTimeout);
      scrollTimeout = null;
    }
    const scrollContainerElement = document.getElementById('menu-items-scroll-container');
    if (scrollContainerElement) {
      scrollContainerElement.scrollTop = 0;
    }
    
    // Hide all tabs
    const tabIds = ['orders-view', 'tables-view', 'checkout-view'];
    tabIds.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.display = 'none';
    });
    
    // Hide top header
    const topNav = document.querySelector('.top-nav');
    if (topNav) topNav.style.display = 'none';
    
    // Show ordering view
    menuOrderingView.style.display = 'flex';
    menuOrderingView.classList.remove('slide-out');
    menuOrderingView.classList.add('slide-in');
    updateFloatingCartBar();
    
    // Hide bottom tab bar
    const bottomTabBar = document.querySelector('.bottom-tab-bar');
    if (bottomTabBar) bottomTabBar.style.display = 'none';
  });
}





// QUICK CHECKOUT PAYMENT LOGIC (TAB 4)
let activeCheckoutTableId = null;
const checkoutModal = document.getElementById('checkout-modal');
const btnConfirmCheckout = document.getElementById('btn-confirm-checkout');

function renderCheckoutOrders() {
  const container = document.getElementById('checkout-orders-list');
  if (!container) return;
  container.innerHTML = '';
  
  const eatingTables = tables.filter(t => t.status === 'eating');
  
  if (eatingTables.length === 0) {
    container.innerHTML = `<div class="text-center text-muted p-md" style="font-size: 13px;">Chưa có đơn hàng nào cần thanh toán.</div>`;
    return;
  }
  
  eatingTables.forEach(table => {
    const totalAmount = table.order.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const itemsCount = table.order.reduce((sum, item) => sum + item.quantity, 0);
    
    const card = document.createElement('div');
    card.className = 'order-card';
    card.style.padding = '12px';
    card.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <div>
          <div style="font-size: 15px; font-weight: 700; color: #0f172a;">${table.name}</div>
          <div style="font-size: 12px; color: #64748b; margin-top: 2px;">
            ${itemsCount} món • Tạm tính: <span style="font-weight:700; color:var(--sapo-orange);">${formatVND(totalAmount)}</span>
          </div>
        </div>
        <button class="btn btn-secondary" style="height: 30px; padding: 0 12px; font-size: 12px; font-weight: 700; border-radius: 8px; background: #f1f5f9; color: #475569; border: 1px solid #e2e8f0; cursor: pointer;" onclick="openOrderDetailsViewFromCard(${table.id})">Chi tiết</button>
      </div>
    `;
    container.appendChild(card);
  });
}

window.openOrderDetailsViewFromCard = (tableId) => {
  const table = tables.find(t => t.id === tableId);
  if (table) {
    openOrderDetailsView(table);
  }
};

window.openCheckoutModal = (tableId) => {
  activeCheckoutTableId = tableId;
  const table = tables.find(t => t.id === tableId);
  if (!table) return;
  
  const modalTitle = document.getElementById('checkout-modal-title-val') || document.getElementById('checkout-modal-title');
  if (modalTitle) modalTitle.textContent = `Thanh toán - ${table.name}`;
  
  const itemsContainer = document.getElementById('checkout-modal-items-list');
  itemsContainer.innerHTML = '';
  
  let subtotal = 0;
  table.order.forEach(item => {
    const itemSubtotal = item.price * item.quantity;
    subtotal += itemSubtotal;
    const div = document.createElement('div');
    div.style.display = 'flex';
    div.style.justifyContent = 'space-between';
    div.style.fontSize = '12px';
    div.style.padding = '4px 0';
    div.innerHTML = `
      <span style="color: #475569;">${item.emoji} ${item.name} x${item.quantity}</span>
      <span style="font-weight: 600; color: #0f172a;">${formatVND(itemSubtotal)}</span>
    `;
    itemsContainer.appendChild(div);
  });
  
  document.getElementById('checkout-subtotal-val').textContent = formatVND(subtotal);
  
  const discountInput = document.getElementById('checkout-discount-input');
  const discountTypeSelect = document.getElementById('checkout-discount-type');
  const receivedInput = document.getElementById('checkout-received-input');
  
  if (discountInput) discountInput.value = 0;
  if (discountTypeSelect) discountTypeSelect.value = 'amount';
  if (receivedInput) receivedInput.value = subtotal;
  
  updateCheckoutCalculations(subtotal);
  
  if (discountInput) discountInput.oninput = () => updateCheckoutCalculations(subtotal);
  if (discountTypeSelect) discountTypeSelect.onchange = () => updateCheckoutCalculations(subtotal);
  if (receivedInput) receivedInput.oninput = () => updateCheckoutCalculations(subtotal);
  
  checkoutModal.style.display = 'flex';
};

window.closeCheckoutModal = () => {
  checkoutModal.style.display = 'none';
  activeCheckoutTableId = null;
};

function updateCheckoutCalculations(subtotal) {
  const discountInput = document.getElementById('checkout-discount-input');
  const discountTypeSelect = document.getElementById('checkout-discount-type');
  
  const discountInputValue = parseInt(discountInput ? discountInput.value : 0) || 0;
  const discountType = discountTypeSelect ? discountTypeSelect.value : 'amount';
  
  let discountAmount = 0;
  if (discountType === 'percent') {
    discountAmount = Math.round(subtotal * (discountInputValue / 100));
  } else {
    discountAmount = discountInputValue;
  }
  
  const total = Math.max(0, subtotal - discountAmount);
  document.getElementById('checkout-total-val').textContent = formatVND(total);
  
  const receivedInput = document.getElementById('checkout-received-input');
  const receivedVal = parseInt(receivedInput ? receivedInput.value : 0) || 0;
  const change = Math.max(0, receivedVal - total);
  document.getElementById('checkout-change-val').textContent = formatVND(change);
}


if (btnConfirmCheckout) {
  btnConfirmCheckout.addEventListener('click', async () => {
    if (!activeCheckoutTableId) return;
    
    const discountInput = document.getElementById('checkout-discount-input');
    const discountTypeSelect = document.getElementById('checkout-discount-type');
    const discountInputValue = parseInt(discountInput ? discountInput.value : 0) || 0;
    const discountType = discountTypeSelect ? discountTypeSelect.value : 'amount';
    
    const table = tables.find(t => t.id === activeCheckoutTableId);
    const subtotal = table.order.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    
    let discountAmount = 0;
    if (discountType === 'percent') {
      discountAmount = Math.round(subtotal * (discountInputValue / 100));
    } else {
      discountAmount = discountInputValue;
    }
    
    const receivedAmount = parseInt(document.getElementById('checkout-received-input').value || 0);
    const total = Math.max(0, subtotal - discountAmount);

    if (receivedAmount < total) {
      alert('Số tiền khách đưa không đủ thanh toán!');
      return;
    }

    const paymentMethodChecked = document.querySelector('input[name="checkout-payment-method"]:checked');
    const paymentMethod = paymentMethodChecked ? paymentMethodChecked.value : 'cash';

    try {
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tableId: activeCheckoutTableId,
          receivedAmount,
          discountAmount,
          paymentMethod
        })
      });
      
      if (response.status === 401) {
        window.location.href = '/login.html';
        return;
      }
      
      const result = await response.json();
      if (result.success) {
        showSuccessToast(`✅ Thanh toán thành công cho ${table.name}!`);
        closeCheckoutModal();
        
        // Print receipt if cashier printer is connected
        const isCashierConnected = localStorage.getItem('printer_cashier_connected') === 'true';
        if (isCashierConnected) {
          const txId = result.transaction ? result.transaction.id : null;
          printReceipt(table, table.order, discountAmount, receivedAmount, txId, new Date().toISOString(), paymentMethod);
        }
        
        // Refresh tables data
        const tablesRes = await fetch('/api/tables');
        if (tablesRes.ok) {
          tables = await tablesRes.json();
          renderCheckoutOrders();
          renderOrders();
        }
      } else {
        alert(`Lỗi thanh toán: ${result.error}`);
      }
    } catch (err) {
      console.error(err);
      alert('Không thể kết nối đến máy chủ.');
    }
  });
}


// Logout Handling
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

// Header & Menu Logo image loading error fallback logic
const headerLogoImg = document.getElementById('header-logo-img');
const headerLogoEmoji = document.getElementById('header-logo-emoji');
if (headerLogoImg && headerLogoEmoji) {
  headerLogoImg.onerror = function() {
    headerLogoImg.style.display = 'none';
    headerLogoEmoji.style.display = 'inline-block';
  };
}

const menuLogoImg = document.getElementById('menu-logo-img');
const menuLogoEmoji = document.getElementById('menu-logo-emoji');
if (menuLogoImg && menuLogoEmoji) {
  menuLogoImg.onerror = function() {
    menuLogoImg.style.display = 'none';
    menuLogoEmoji.style.display = 'inline-block';
  };
}

// Scroll Spy: Synchronize scrolling of right items list with left category sidebar
const menuItemsScrollContainer = document.getElementById('menu-items-scroll-container');
if (menuItemsScrollContainer) {
  menuItemsScrollContainer.addEventListener('scroll', () => {
    if (isScrollingFromClick) return;

    const headerElements = menuItemsScrollContainer.querySelectorAll('.menu-ordering-group-title');
    let activeIndex = 0;

    headerElements.forEach((header, idx) => {
      const top = header.offsetTop;
      if (menuItemsScrollContainer.scrollTop >= top - 15) {
        activeIndex = idx;
      }
    });

    if (activeGroupIndex !== activeIndex) {
      activeGroupIndex = activeIndex;
      const sidebarItems = document.querySelectorAll('#menu-groups-sidebar .menu-group-sidebar-item');
      sidebarItems.forEach((item, idx) => {
        if (idx === activeIndex) {
          item.classList.add('active');
          item.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        } else {
          item.classList.remove('active');
        }
      });
    }
  });
}

// --- Order Details View ("Chi tiết hóa đơn") Elements & Logic ---
const orderDetailsView = document.getElementById('order-details-view');
const orderDetailsItemsList = document.getElementById('order-details-items-list');
const btnBackOrderDetails = document.getElementById('btn-back-order-details');
const btnOrderDetailsMore = document.getElementById('btn-order-details-more');
const orderDetailsMoreMenu = document.getElementById('order-details-more-menu');
const btnOrderDetailsDeleteAll = document.getElementById('btn-order-details-delete-all');
const orderDetailsLocIcon = document.getElementById('order-details-loc-icon');
const orderDetailsLocText = document.getElementById('order-details-loc-text');
const orderDetailsTableName = document.getElementById('order-details-table-name');
const orderDetailsSubtotal = document.getElementById('order-details-subtotal');
const orderDetailsTotalQty = document.getElementById('order-details-total-qty');
const orderDetailsTotalPrice = document.getElementById('order-details-total-price');

const btnOrderDetailsAdd = document.getElementById('btn-order-details-add');
const btnOrderDetailsSave = document.getElementById('btn-order-details-save');
const btnOrderDetailsCheckout = document.getElementById('btn-order-details-checkout');

function openOrderDetailsView(table) {
  activeTableId = table.id;
  
  // Set subheader info
  const loc = (table.location || '').toLowerCase();
  let typeText = 'Dùng tại bàn';
  let icon = '🍲';
  if (loc === 'mang về') {
    typeText = 'Mang đi';
    icon = '🛍️';
  } else if (loc === 'giao hàng') {
    typeText = 'Giao hàng';
    icon = '🚚';
  } else if (loc === 'đối tác') {
    typeText = 'Đối tác';
    icon = '🤝';
  }
  
  if (orderDetailsLocIcon) orderDetailsLocIcon.textContent = icon;
  if (orderDetailsLocText) orderDetailsLocText.textContent = typeText;
  if (orderDetailsTableName) orderDetailsTableName.textContent = table.name;
  
  // Render order details list
  renderOrderDetailsItems();
  
  // Hide main tabs
  const tabIds = ['orders-view', 'tables-view', 'checkout-view'];
  tabIds.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
  
  // Hide top header
  const topNav = document.querySelector('.top-nav');
  if (topNav) topNav.style.display = 'none';
  
  // Hide bottom tab bar
  const bottomTabBar = document.querySelector('.bottom-tab-bar');
  if (bottomTabBar) bottomTabBar.style.display = 'none';
  
  // Show details view
  if (orderDetailsView) orderDetailsView.style.display = 'flex';
}

function renderOrderDetailsItems() {
  if (!orderDetailsItemsList) return;
  orderDetailsItemsList.innerHTML = '';
  
  if (cart.length === 0) {
    orderDetailsItemsList.innerHTML = `
      <div style="text-align: center; color: var(--muted); padding: 40px 0; font-size: 14px;">
        Chưa có món ăn nào trong đơn hàng.
      </div>
    `;
    updateOrderDetailsSummary();
    return;
  }

  // Find original order items
  const table = tables.find(t => t.id === activeTableId);
  const oldItems = table ? (table.order || []) : [];

  const oldItemsToRender = [];
  const newItemsToRender = [];
  
  cart.forEach((item, originalIndex) => {
    const oldItem = oldItems.find(o => o.name === item.name);
    const oldQty = oldItem ? oldItem.quantity : 0;
    
    if (oldQty === 0) {
      newItemsToRender.push({
        item: item,
        originalIndex: originalIndex,
        displayQty: item.quantity,
        isNew: true
      });
    } else {
      oldItemsToRender.push({
        item: item,
        originalIndex: originalIndex,
        displayQty: Math.min(item.quantity, oldQty),
        isNew: false
      });
      
      if (item.quantity > oldQty) {
        newItemsToRender.push({
          item: item,
          originalIndex: originalIndex,
          displayQty: item.quantity - oldQty,
          isNew: true
        });
      }
    }
  });

  // Inject styles if not present
  if (!document.getElementById('rgb-flow-style')) {
    const style = document.createElement('style');
    style.id = 'rgb-flow-style';
    style.innerHTML = `
      @keyframes rgbFlow {
        0% { background-position: 0% 50%; }
        50% { background-position: 100% 50%; }
        100% { background-position: 0% 50%; }
      }
      .rgb-divider-container {
        margin: 24px 0;
        text-align: center;
        position: relative;
      }
      .rgb-divider-line {
        height: 3px;
        background: linear-gradient(90deg, #ff007f, #7f00ff, #00f0ff, #ff007f);
        background-size: 300% 100%;
        animation: rgbFlow 2s linear infinite;
        border-radius: 9999px;
      }
      .rgb-divider-text {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: #f8fafc;
        padding: 2px 12px;
        font-size: 10px;
        font-weight: 700;
        color: #7f00ff;
        border-radius: 9999px;
        border: 1px solid #e2e8f0;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }
    `;
    document.head.appendChild(style);
  }

  // Render function helper
  function renderItemRow(renderObj) {
    const item = renderObj.item;
    const index = renderObj.originalIndex;
    const qty = renderObj.displayQty;
    
    const itemRow = document.createElement('div');
    itemRow.style.cssText = 'border-bottom: 1px dashed #cbd5e1; padding-bottom: 12px; display: flex; flex-direction: column; gap: 8px;';
    
    const topRow = document.createElement('div');
    topRow.style.cssText = 'display: flex; justify-content: space-between; align-items: flex-start;';
    
    const optionsText = item.options && item.options.length > 0
      ? item.options.map(o => `+ ${o.name}`).join(', ')
      : '';
      
    let detailHtml = '';
    if (optionsText) {
      detailHtml += `<div style="font-size: 12px; color: #64748b; margin-top: 2px;">Lựa chọn: ${optionsText}</div>`;
    }
    if (item.notes) {
      detailHtml += `<div style="font-size: 12px; color: #ef4444; margin-top: 2px; font-style: italic;">* Ghi chú: ${item.notes}</div>`;
    }
    
    // Add badge for added items
    let badgeHtml = '';
    if (renderObj.isNew) {
      badgeHtml = `<span style="font-size: 10px; font-weight: 700; color: #ffffff; background: linear-gradient(45deg, #ff007f, #7f00ff); padding: 1px 6px; border-radius: 4px; margin-left: 6px; text-transform: uppercase;">Mới</span>`;
    }
    
    topRow.innerHTML = `
      <div style="flex: 1; padding-right: 12px;">
        <div style="font-size: 14px; font-weight: 600; color: #1e293b; display: flex; align-items: center;">
          <span>${item.emoji || '🍽️'} ${item.name}</span>
          ${badgeHtml}
        </div>
        ${detailHtml}
      </div>
      <div style="font-size: 14px; font-weight: 700; color: #0f172a; text-align: right;">${formatVND(item.price * qty)}</div>
    `;
    
    const bottomRow = document.createElement('div');
    bottomRow.style.cssText = 'display: flex; justify-content: space-between; align-items: center;';
    
    // Qty Selector controls
    const qtySelector = document.createElement('div');
    qtySelector.style.cssText = 'display: flex; align-items: center; gap: 16px; border: 1.5px solid #cbd5e1; border-radius: 9999px; padding: 2px 12px; background-color: #ffffff;';
    qtySelector.innerHTML = `
      <button style="border: none; background: transparent; font-size: 18px; font-weight: 700; color: #0088ff; padding: 0 4px; cursor: pointer; user-select: none;">−</button>
      <span style="font-size: 14px; font-weight: 700; color: #1e293b; min-width: 16px; text-align: center;">${qty}</span>
      <button style="border: none; background: transparent; font-size: 18px; font-weight: 700; color: #0088ff; padding: 0 4px; cursor: pointer; user-select: none;">+</button>
    `;
    
    // Minus action
    qtySelector.children[0].onclick = () => {
      if (item.quantity > 1) {
        item.quantity--;
      } else {
        if (confirm(`Bạn có muốn xóa món "${item.name}" khỏi đơn hàng không?`)) {
          cart.splice(index, 1);
        }
      }
      renderOrderDetailsItems();
    };
    
    // Plus action
    qtySelector.children[2].onclick = () => {
      item.quantity++;
      renderOrderDetailsItems();
    };
    
    bottomRow.appendChild(qtySelector);
    itemRow.appendChild(topRow);
    itemRow.appendChild(bottomRow);
    orderDetailsItemsList.appendChild(itemRow);
  }

  // 1. Render old items
  oldItemsToRender.forEach(renderObj => renderItemRow(renderObj));

  // 2. Render RGB Divider if both lists are present
  if (oldItemsToRender.length > 0 && newItemsToRender.length > 0) {
    const dividerContainer = document.createElement('div');
    dividerContainer.className = 'rgb-divider-container';
    dividerContainer.innerHTML = `
      <div class="rgb-divider-line"></div>
      <div class="rgb-divider-text">Món gọi thêm</div>
    `;
    orderDetailsItemsList.appendChild(dividerContainer);
  }

  // 3. Render new items
  newItemsToRender.forEach(renderObj => renderItemRow(renderObj));
  
  updateOrderDetailsSummary();
}

function updateOrderDetailsSummary() {
  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const totalQty = cart.reduce((sum, item) => sum + item.quantity, 0);
  
  if (orderDetailsSubtotal) orderDetailsSubtotal.textContent = formatVND(subtotal);
  if (orderDetailsTotalQty) orderDetailsTotalQty.textContent = `SL: ${totalQty}`;
  if (orderDetailsTotalPrice) orderDetailsTotalPrice.textContent = `TỔNG: ${formatVND(subtotal)}`;
}

function closeOrderDetailsView() {
  if (orderDetailsView) orderDetailsView.style.display = 'none';
  
  // Show bottom tab bar and header
  const bottomTabBar = document.querySelector('.bottom-tab-bar');
  if (bottomTabBar) bottomTabBar.style.display = 'flex';
  const topNav = document.querySelector('.top-nav');
  if (topNav) topNav.style.display = 'flex';
  
  // Show active tab view
  const selectedPanel = document.getElementById(`${activeTab}-view`);
  if (selectedPanel) selectedPanel.style.display = 'flex';
}


if (btnBackOrderDetails) {
  btnBackOrderDetails.addEventListener('click', closeOrderDetailsView);
}

if (btnOrderDetailsMore) {
  btnOrderDetailsMore.addEventListener('click', (e) => {
    e.stopPropagation();
    if (orderDetailsMoreMenu) {
      const show = orderDetailsMoreMenu.style.display === 'block';
      orderDetailsMoreMenu.style.display = show ? 'none' : 'block';
    }
  });
}

document.addEventListener('click', () => {
  if (orderDetailsMoreMenu) {
    orderDetailsMoreMenu.style.display = 'none';
  }
});

if (btnOrderDetailsDeleteAll) {
  btnOrderDetailsDeleteAll.addEventListener('click', async () => {
    if (confirm('⚠️ Bạn có chắc chắn muốn hủy đơn hàng này? Tất cả các món ăn đã gọi của bàn này sẽ bị xóa.')) {
      try {
        const res = await fetch('/api/order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tableId: activeTableId,
            items: []
          })
        });
        
        const result = await res.json();
        if (result.success) {
          showSuccessToast('Đã hủy đơn hàng thành công!');
          closeOrderDetailsView();
          
          // Refresh tables data
          const tablesRes = await fetch('/api/tables');
          if (tablesRes.ok) {
            tables = await tablesRes.json();
            renderOrders();
            renderTables();
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

if (btnOrderDetailsAdd) {
  btnOrderDetailsAdd.addEventListener('click', () => {
    if (orderDetailsView) orderDetailsView.style.display = 'none';
    
    // Configure menu ordering view for this table
    const table = tables.find(t => t.id === activeTableId);
    if (table) {
      activeTableName.textContent = table.name;
      updateActiveTableSubtitle(table);
    }
    
    if (menuOrderingView) {
      menuOrderingView.style.display = 'flex';
      menuOrderingView.classList.remove('slide-out');
      menuOrderingView.classList.add('slide-in');
    }
    
    updateFloatingCartBar();
  });
}

if (btnOrderDetailsSave) {
  btnOrderDetailsSave.addEventListener('click', async () => {
    btnOrderDetailsSave.disabled = true;
    btnOrderDetailsSave.textContent = 'Đang lưu...';
    
    const tableBeforeSave = tables.find(t => t.id === activeTableId);
    const oldOrder = tableBeforeSave ? JSON.parse(JSON.stringify(tableBeforeSave.order || [])) : [];
    const tableName = tableBeforeSave ? tableBeforeSave.name : 'Bàn';
    
    try {
      const res = await fetch('/api/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tableId: activeTableId,
          items: cart
        })
      });
      
      if (res.status === 401) {
        window.location.href = '/login.html';
        return;
      }
      
      const result = await res.json();
      if (result.success) {
        const diffItems = getOrderDifference(oldOrder, cart);
        
        if (diffItems.length > 0) {
          const isAdd = (oldOrder && oldOrder.length > 0);
          const kitchenTitle = isAdd ? 'PHIẾU THÊM MÓN' : 'HOÁ ĐƠN BẾP';
          const drinkTitle = isAdd ? 'PHIẾU THÊM NƯỚC' : 'HOÁ ĐƠN NƯỚC';
          
          // Separate items in the cart
          const drinkItems = diffItems.filter(item => isDrinkItem(item, menu));
          const kitchenItems = diffItems.filter(item => !drinkItems.includes(item));

          // Trigger automatic printing for connected printers using docx templates
          printDocxSlip('kitchen_default', tableName, kitchenItems, kitchenTitle);
          printDocxSlip('kitchen_bar', tableName, drinkItems, drinkTitle);
        }

        showSuccessToast('Đã lưu thay đổi hóa đơn thành công!');
        closeOrderDetailsView();
        
        // Refresh tables data
        const tablesRes = await fetch('/api/tables');
        if (tablesRes.ok) {
          tables = await tablesRes.json();
          renderOrders();
          renderTables();
        }
      } else {
        alert(`Lỗi: ${result.error}`);
      }
    } catch (err) {
      console.error(err);
      alert('Không thể kết nối đến máy chủ.');
    } finally {
      btnOrderDetailsSave.disabled = false;
      btnOrderDetailsSave.textContent = 'Lưu';
    }
  });
}

if (btnOrderDetailsCheckout) {
  btnOrderDetailsCheckout.addEventListener('click', () => {
    closeOrderDetailsView();
    openCheckoutModal(activeTableId);
  });
}

// Sidebar Drawer Elements
const btnHamburger = document.getElementById('btn-hamburger');
const sidebarDrawer = document.getElementById('sidebar-drawer');
const sidebarDrawerBackdrop = document.getElementById('sidebar-drawer-backdrop');
const drawerUserName = document.getElementById('drawer-user-name');
const drawerUserAvatar = document.getElementById('drawer-user-avatar');
const drawerMenuPrinter = document.getElementById('drawer-menu-printer');
const drawerMenuLogout = document.getElementById('drawer-menu-logout');

// Printer Screen Elements
const printerMainOverlay = document.getElementById('printer-main-overlay');
const printerListScreen = document.getElementById('printer-list-screen');
const printerDetailScreen = document.getElementById('printer-detail-screen');

const btnPrinterListBack = document.getElementById('btn-printer-list-back');
const btnPrinterDetailBack = document.getElementById('btn-printer-detail-back');

const itemPrinterCashier = document.getElementById('item-printer-cashier');
const itemPrinterKitchenDefault = document.getElementById('item-printer-kitchen-default');
const itemPrinterKitchenBar = document.getElementById('item-printer-kitchen-bar');

const statusPrinterCashier = document.getElementById('status-printer-cashier');
const statusPrinterKitchenDefault = document.getElementById('status-printer-kitchen-default');
const statusPrinterKitchenBar = document.getElementById('status-printer-kitchen-bar');

const printerDetailTitle = document.getElementById('printer-detail-title');
const detailPrinterName = document.getElementById('detail-printer-name');
const detailPrinterIp = document.getElementById('detail-printer-ip');
const detailPrinterPort = document.getElementById('detail-printer-port');
const btnPrinterConnect = document.getElementById('btn-printer-connect');
const btnPrinterDisconnect = document.getElementById('btn-printer-disconnect');
const btnPrinterTest = document.getElementById('btn-printer-test');
const btnFindPrinterIp = document.getElementById('btn-find-printer-ip');

const tabWifiLan = document.getElementById('tab-wifi-lan');
const tabPcShare = document.getElementById('tab-pc-share');
const groupWifiFields = document.getElementById('group-wifi-fields');
const groupPcShareFields = document.getElementById('group-pc-share-fields');
const detailPrinterSharedPath = document.getElementById('detail-printer-shared-path');

const printerScannerModal = document.getElementById('printer-scanner-modal');
const btnCloseScannerModal = document.getElementById('btn-close-scanner-modal');
const scannerModalBody = document.getElementById('scanner-modal-body');

// Load employee profile
async function loadEmployeeProfile() {
  try {
    const res = await fetch('/api/me');
    if (res.ok) {
      const data = await res.json();
      if (data.success) {
        if (drawerUserName) drawerUserName.textContent = data.username;
        if (drawerUserAvatar && data.username) {
          // Take the first two letters, convert to uppercase
          const initials = data.username.slice(0, 2).toUpperCase();
          drawerUserAvatar.textContent = initials;
        }
      }
    }
  } catch (err) {
    console.error('Lỗi khi tải thông tin nhân viên:', err);
  }
}

// Sidebar Drawer Control
function openSidebarDrawer() {
  if (sidebarDrawer) sidebarDrawer.classList.add('open');
  if (sidebarDrawerBackdrop) sidebarDrawerBackdrop.classList.add('open');
}

function closeSidebarDrawer() {
  if (sidebarDrawer) sidebarDrawer.classList.remove('open');
  if (sidebarDrawerBackdrop) sidebarDrawerBackdrop.classList.remove('open');
}

if (btnHamburger) {
  btnHamburger.addEventListener('click', (e) => {
    e.stopPropagation();
    openSidebarDrawer();
  });
}

if (sidebarDrawerBackdrop) {
  sidebarDrawerBackdrop.addEventListener('click', closeSidebarDrawer);
}

// Printer Screen Toggles & Controls
let activeConfigPrinterId = '';

// Update connection status label on screen 1 list
function updatePrinterListStatus() {
  const printers = ['cashier', 'kitchen_default', 'kitchen_bar'];
  printers.forEach(pId => {
    const savedType = localStorage.getItem(`printer_${pId}_type`) || 'wifi';
    const savedIp = localStorage.getItem(`printer_${pId}_ip`) || '';
    const savedSharedPath = localStorage.getItem(`printer_${pId}_shared_path`) || '';
    const isConnected = localStorage.getItem(`printer_${pId}_connected`) === 'true';
    const statusEl = document.getElementById(`status-printer-${pId.replace('_', '-')}`);
    
    if (statusEl) {
      if (isConnected) {
        if (savedType === 'shared' && savedSharedPath) {
          statusEl.textContent = savedSharedPath;
          statusEl.className = 'printer-item-status ip-info';
        } else if (savedType === 'wifi' && savedIp) {
          statusEl.textContent = savedIp;
          statusEl.className = 'printer-item-status ip-info';
        } else {
          statusEl.textContent = 'Chưa kết nối';
          statusEl.className = 'printer-item-status disconnected';
        }
      } else {
        statusEl.textContent = 'Chưa kết nối';
        statusEl.className = 'printer-item-status disconnected';
      }
    }
  });
}

function openPrinterOverlay() {
  closeSidebarDrawer();
  updatePrinterListStatus();
  if (printerMainOverlay) printerMainOverlay.style.display = 'flex';
  if (printerListScreen) printerListScreen.style.display = 'flex';
  if (printerDetailScreen) printerDetailScreen.style.display = 'none';
}

function closePrinterOverlay() {
  if (printerMainOverlay) printerMainOverlay.style.display = 'none';
}

function openPrinterDetail(pId) {
  activeConfigPrinterId = pId;
  
  let defaultName = '';
  
  if (pId === 'cashier') {
    defaultName = 'Máy in tại quầy';
  } else if (pId === 'kitchen_default') {
    defaultName = 'Bếp mặc định';
  } else if (pId === 'kitchen_bar') {
    defaultName = 'Quầy nước';
  }
  
  if (printerDetailTitle) printerDetailTitle.textContent = defaultName;
  
  // Load saved printer values
  const savedName = localStorage.getItem(`printer_${pId}_name`) || defaultName;
  const savedSize = localStorage.getItem(`printer_${pId}_size`) || 'K80';
  const savedType = localStorage.getItem(`printer_${pId}_type`) || 'wifi';
  const savedIp = localStorage.getItem(`printer_${pId}_ip`) || '';
  const savedPort = localStorage.getItem(`printer_${pId}_port`) || '9100';
  const savedSharedPath = localStorage.getItem(`printer_${pId}_shared_path`) || '';
  
  if (detailPrinterName) detailPrinterName.value = savedName;
  if (detailPrinterIp) detailPrinterIp.value = savedIp;
  if (detailPrinterPort) detailPrinterPort.value = savedPort;
  if (detailPrinterSharedPath) detailPrinterSharedPath.value = savedSharedPath;
  
  // Set paper size radio checked
  const radioK80 = document.querySelector('input[name="printer-paper-size"][value="K80"]');
  const radioK58 = document.querySelector('input[name="printer-paper-size"][value="K58"]');
  if (radioK80 && radioK58) {
    if (savedSize === 'K58') {
      radioK58.checked = true;
    } else {
      radioK80.checked = true;
    }
  }

  // Trigger tab layout visibility
  if (savedType === 'shared') {
    activePrinterType = 'shared';
    if (tabPcShare) {
      tabPcShare.classList.add('active');
    }
    if (tabWifiLan) {
      tabWifiLan.classList.remove('active');
    }
    if (groupWifiFields) groupWifiFields.style.display = 'none';
    if (groupPcShareFields) groupPcShareFields.style.display = 'flex';
  } else {
    activePrinterType = 'wifi';
    if (tabWifiLan) {
      tabWifiLan.classList.add('active');
    }
    if (tabPcShare) {
      tabPcShare.classList.remove('active');
    }
    if (groupWifiFields) groupWifiFields.style.display = 'flex';
    if (groupPcShareFields) groupPcShareFields.style.display = 'none';
  }
  
  const isConnected = localStorage.getItem(`printer_${pId}_connected`) === 'true';
  if (btnPrinterDisconnect) {
    btnPrinterDisconnect.style.display = isConnected ? 'flex' : 'none';
  }
  
  if (printerListScreen) printerListScreen.style.display = 'none';
  if (printerDetailScreen) printerDetailScreen.style.display = 'flex';
}

function backToPrinterList() {
  updatePrinterListStatus();
  if (printerDetailScreen) printerDetailScreen.style.display = 'none';
  if (printerListScreen) printerListScreen.style.display = 'flex';
}

if (drawerMenuPrinter) {
  drawerMenuPrinter.addEventListener('click', openPrinterOverlay);
}

if (btnPrinterListBack) {
  btnPrinterListBack.addEventListener('click', closePrinterOverlay);
}

if (btnPrinterDetailBack) {
  btnPrinterDetailBack.addEventListener('click', backToPrinterList);
}

if (itemPrinterCashier) {
  itemPrinterCashier.addEventListener('click', () => openPrinterDetail('cashier'));
}

if (itemPrinterKitchenDefault) {
  itemPrinterKitchenDefault.addEventListener('click', () => openPrinterDetail('kitchen_default'));
}

if (itemPrinterKitchenBar) {
  itemPrinterKitchenBar.addEventListener('click', () => openPrinterDetail('kitchen_bar'));
}

// Printer Screen Toggles & Controls
let activePrinterType = 'wifi'; // 'wifi' | 'shared'

if (tabWifiLan) {
  tabWifiLan.addEventListener('click', () => {
    activePrinterType = 'wifi';
    tabWifiLan.classList.add('active');
    if (tabPcShare) tabPcShare.classList.remove('active');
    if (groupWifiFields) groupWifiFields.style.display = 'flex';
    if (groupPcShareFields) groupPcShareFields.style.display = 'none';
  });
}

if (tabPcShare) {
  tabPcShare.addEventListener('click', () => {
    activePrinterType = 'shared';
    tabPcShare.classList.add('active');
    if (tabWifiLan) tabWifiLan.classList.remove('active');
    if (groupWifiFields) groupWifiFields.style.display = 'none';
    if (groupPcShareFields) groupPcShareFields.style.display = 'flex';
  });
}

// Helper to detect client's local subnet using hostname and WebRTC fallback
async function detectLocalSubnet() {
  // 1. Try to extract from window.location.hostname (if it is a local IP)
  const hostname = window.location.hostname;
  const ipPattern = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
  if (ipPattern.test(hostname)) {
    const parts = hostname.split('.');
    if (parts[0] === '192' || parts[0] === '10' || (parts[0] === '172' && parseInt(parts[1]) >= 16 && parseInt(parts[1]) <= 31)) {
      return parts.slice(0, 3).join('.');
    }
  }

  // 2. Try to use WebRTC to discover candidate local IP
  try {
    const localIp = await new Promise((resolve) => {
      const rtc = new RTCPeerConnection({ iceServers: [] });
      rtc.createDataChannel('');
      rtc.createOffer()
        .then(offer => rtc.setLocalDescription(offer))
        .catch(() => resolve(null));
      
      rtc.onicecandidate = (event) => {
        if (event && event.candidate && event.candidate.candidate) {
          const candidate = event.candidate.candidate;
          const ipRegex = /([0-9]{1,3}(\.[0-9]{1,3}){3})/;
          const match = candidate.match(ipRegex);
          if (match) {
            resolve(match[1]);
            rtc.close();
          }
        }
      };
      // Timeout after 800ms
      setTimeout(() => {
        resolve(null);
        rtc.close();
      }, 800);
    });

    if (localIp) {
      const parts = localIp.split('.');
      if (parts.length === 4) {
        return parts.slice(0, 3).join('.');
      }
    }
  } catch (e) {
    console.warn('WebRTC local IP discovery failed/blocked:', e);
  }

  return null;
}

// Scanner Modal Control
async function openScannerModal() {
  if (printerScannerModal) printerScannerModal.style.display = 'flex';
  if (scannerModalBody) {
    scannerModalBody.innerHTML = `
      <div style="text-align: center; color: #64748b; font-size: 13px; padding: 16px 0;" id="scanner-loading-text">
        <span style="display: inline-block; width: 18px; height: 18px; border: 2px solid #cbd5e1; border-top-color: #0088ff; border-radius: 50%; animation: spin 0.8s linear infinite; margin-right: 8px; vertical-align: middle; box-sizing: border-box;"></span>
        Đang quét mạng nội bộ...
      </div>
    `;
  }
  
  const subnet = await detectLocalSubnet();
  const scanUrl = subnet ? `/api/scan-printers?subnet=${subnet}` : '/api/scan-printers';
  
  fetch(scanUrl)
    .then(res => {
      if (res.status === 401) {
        window.location.href = '/login.html';
        return null;
      }
      if (!res.ok) {
        throw new Error(`HTTP error status ${res.status}`);
      }
      return res.json();
    })
    .then(data => {
      if (!data) return;
      if (scannerModalBody) {
        scannerModalBody.innerHTML = ''; // clear loading spinner
        
        if (data.success && data.printers && data.printers.length > 0) {
          data.printers.forEach(pr => {
            const prItem = document.createElement('div');
            prItem.className = 'scanner-printer-item';
            prItem.innerHTML = `
              <svg viewBox="0 0 24 24" width="20" height="20" stroke="#0088ff" stroke-width="2" fill="none" style="flex-shrink:0;">
                <polyline points="6 9 6 2 18 2 18 9"></polyline>
                <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
                <rect x="6" y="14" width="12" height="8"></rect>
              </svg>
              <div style="display: flex; flex-direction: column; gap: 2px; text-align: left;">
                <span style="font-size: 13px; font-weight: 700; color: #1e293b;">${pr.name}</span>
                <span style="font-size: 11px; color: #64748b;">IP: ${pr.ip}:${pr.port}</span>
              </div>
            `;
            prItem.addEventListener('click', () => {
              if (detailPrinterIp) detailPrinterIp.value = pr.ip;
              if (detailPrinterPort) detailPrinterPort.value = pr.port;
              closeScannerModal();
              showSuccessToast(`Đã chọn máy in tại ${pr.ip}`);
            });
            scannerModalBody.appendChild(prItem);
          });
        } else {
          scannerModalBody.innerHTML = `
            <div style="text-align: center; color: #64748b; font-size: 13.5px; padding: 24px 12px; line-height: 1.6;">
              <div style="font-weight: 700; margin-bottom: 8px;">Không tìm thấy máy in nào.</div>
              <div style="font-size: 12px; color: #64748b;">
                Nếu bạn đang chạy ứng dụng trực tuyến (Cloud) hoặc máy in khác dải mạng, vui lòng <strong>tự nhập địa chỉ IP thủ công</strong> (ví dụ: 192.168.1.100) và nhấn kết nối.
              </div>
            </div>
          `;
        }
      }
    })
    .catch(err => {
      console.error(err);
      if (scannerModalBody) {
        scannerModalBody.innerHTML = `
          <div style="text-align: center; color: #ef4444; font-size: 13px; padding: 24px 0;">
            Lỗi kết nối máy chủ quét mạng.
          </div>
        `;
      }
    });
}

function closeScannerModal() {
  if (printerScannerModal) printerScannerModal.style.display = 'none';
}

if (btnFindPrinterIp) {
  btnFindPrinterIp.addEventListener('click', openScannerModal);
}

if (btnCloseScannerModal) {
  btnCloseScannerModal.addEventListener('click', closeScannerModal);
}

if (printerScannerModal) {
  printerScannerModal.addEventListener('click', (e) => {
    if (e.target === printerScannerModal) {
      closeScannerModal();
    }
  });
}

// Save/Connect Printer action
if (btnPrinterConnect) {
  btnPrinterConnect.addEventListener('click', () => {
    const pId = activeConfigPrinterId;
    if (!pId) return;
    
    const nameVal = detailPrinterName ? detailPrinterName.value.trim() : '';
    const ipVal = detailPrinterIp ? detailPrinterIp.value.trim() : '';
    const portVal = detailPrinterPort ? detailPrinterPort.value.trim() : '9100';
    const sharedPathVal = detailPrinterSharedPath ? detailPrinterSharedPath.value.trim() : '';
    
    const paperRadio = document.querySelector('input[name="printer-paper-size"]:checked');
    const sizeVal = paperRadio ? paperRadio.value : 'K80';
    
    if (!nameVal) {
      alert('Vui lòng nhập tên máy in.');
      return;
    }
    
    if (activePrinterType === 'wifi') {
      if (!ipVal) {
        alert('Vui lòng nhập địa chỉ IP máy in.');
        return;
      }
    } else {
      if (!sharedPathVal) {
        alert('Vui lòng nhập đường dẫn máy in chia sẻ (Shared Path).');
        return;
      }
    }
    
    btnPrinterConnect.disabled = true;
    btnPrinterConnect.textContent = 'Đang kết nối...';
    
    // Simulate test connection in 1.2s
    setTimeout(() => {
      // Save configuration to localStorage
      localStorage.setItem(`printer_${pId}_name`, nameVal);
      localStorage.setItem(`printer_${pId}_type`, activePrinterType);
      localStorage.setItem(`printer_${pId}_ip`, ipVal);
      localStorage.setItem(`printer_${pId}_port`, portVal);
      localStorage.setItem(`printer_${pId}_shared_path`, sharedPathVal);
      localStorage.setItem(`printer_${pId}_size`, sizeVal);
      localStorage.setItem(`printer_${pId}_connected`, 'true');
      
      const targetStr = activePrinterType === 'wifi' ? ipVal : sharedPathVal;
      showSuccessToast(`⚡ Kết nối thành công đến máy in tại ${targetStr}!`);
      btnPrinterConnect.disabled = false;
      btnPrinterConnect.textContent = 'Kết nối';
      
      // Return to printer list
      backToPrinterList();
    }, 1200);
  });
}

// Disconnect Printer action
if (btnPrinterDisconnect) {
  btnPrinterDisconnect.addEventListener('click', () => {
    const pId = activeConfigPrinterId;
    if (!pId) return;
    
    localStorage.setItem(`printer_${pId}_connected`, 'false');
    showSuccessToast('⚡ Đã ngắt kết nối máy in thành công!');
    
    // Return to printer list
    backToPrinterList();
  });
}

// Test Print action
if (btnPrinterTest) {
  btnPrinterTest.addEventListener('click', async () => {
    const ipVal = detailPrinterIp ? detailPrinterIp.value.trim() : '';
    const portVal = detailPrinterPort ? detailPrinterPort.value.trim() : '9100';
    const sharedPathVal = detailPrinterSharedPath ? detailPrinterSharedPath.value.trim() : '';
    
    if (activePrinterType === 'wifi') {
      if (!ipVal) {
        alert('Vui lòng nhập địa chỉ IP máy in để in thử.');
        return;
      }
    } else {
      if (!sharedPathVal) {
        alert('Vui lòng nhập đường dẫn máy in chia sẻ (Shared Path) để in thử.');
        return;
      }
    }
    
    const targetStr = activePrinterType === 'wifi' ? ipVal : sharedPathVal;
    const isCloud = window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1' && !window.location.hostname.startsWith('192.168.');

    if (isCloud) {
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      if (isMobile) {
        if (socket && socket.connected) {
          socket.emit('request_print_test', {
            printerType: activePrinterType,
            targetStr: targetStr
          });
          showSuccessToast('📤 Đã gửi yêu cầu in thử tới quầy thu ngân.');
        } else {
          // Fallback: Enqueue print job in database
          try {
            const response = await fetch('/api/print-jobs', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                printerId: 'test',
                type: 'test',
                payload: { printerType: activePrinterType, targetStr: targetStr }
              })
            });
            if (response.ok) {
              showSuccessToast('📤 Đã gửi yêu cầu in thử tới hàng đợi in.');
            } else {
              throw new Error('Server error');
            }
          } catch (err) {
            console.error('Failed to queue print job:', err);
            alert('Không thể gửi yêu cầu in thử (Socket offline và hàng đợi in lỗi).');
          }
        }
      } else {
        printTestIframe(activePrinterType, targetStr);
      }
      return;
    }

    btnPrinterTest.disabled = true;
    btnPrinterTest.textContent = 'Đang in...';
    
    // Construct raw test print text
    const textData = `--------------------------------\n` + 
                     `        IN THU MAY IN           \n` +
                     `       Nha hang: TAM XUA        \n` +
                     `--------------------------------\n` +
                     `Loai may in: ${activePrinterType === 'wifi' ? 'Wifi / LAN' : 'PC Shared'}\n` +
                     `Dia chi    : ${targetStr}\n` +
                     `Thoi gian  : ${new Date().toLocaleString()}\n` +
                     `Trang thai : Ket noi OK\n` +
                     `--------------------------------\n\n\n\n`;
                     
    fetch('/api/print-raw', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        printerType: activePrinterType,
        ip: ipVal,
        port: portVal,
        sharedPath: sharedPathVal,
        content: textData
      })
    })
    .then(res => {
      if (!res.ok) {
        return res.json().then(data => { throw new Error(data.error || 'Server error'); });
      }
      return res.json();
    })
    .then(data => {
      showSuccessToast('⚡ Đã gửi lệnh in thử thành công!');
    })
    .catch(err => {
      console.error(err);
      alert(`Lỗi in thử: ${err.message}`);
    })
    .finally(() => {
      btnPrinterTest.disabled = false;
      btnPrinterTest.textContent = 'In thử';
    });
  });
}

if (drawerMenuLogout) {
  drawerMenuLogout.addEventListener('click', async () => {
    try {
      await fetch('/api/logout', { method: 'POST' });
      window.location.href = '/login.html';
    } catch (err) {
      console.error('Logout error:', err);
    }
  });
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
    }
  } catch (err) {
    console.error('Lỗi đồng bộ cấu hình máy in:', err);
  }
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

// App initialization
loadEmployeeProfile();
init();


