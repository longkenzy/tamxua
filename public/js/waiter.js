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
    const [menuRes, tablesRes, groupsRes] = await Promise.all([
      fetch('/api/menu'),
      fetch('/api/tables'),
      fetch('/api/menu-groups').catch(() => null)
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
    
    // Pre-render menu items so they are ready instantly on order click
    renderMenuItems();
    
    // Switch to default tab and render
    switchTab('orders');
    
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

      card.innerHTML = `
        <div class="sapo-food-card-img">
          ${imgHtml}
        </div>
        <div class="sapo-food-card-price-bar">${formatVND(item.price)}</div>
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
  customModalPrice.textContent = formatVND(item.price);
  customModalDesc.textContent = item.description || '';
  
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
    if (serviceTypeSelect) {
      serviceTypeSelect.value = 'table'; // Default choice
      serviceTypeSelect.disabled = false;
    }
    if (tableSelectContainer) {
      tableSelectContainer.style.display = 'flex';
      if (displayLabel) {
        if (pickerSelectedTableId) {
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
    
    div.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 4px; max-width: 60%; text-align: left;">
        <span style="font-weight: 700; color: #1e293b; font-size: 14px;">${item.name}</span>
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

            itemCard.innerHTML = `
              <img src="${itemImg}" style="width: 52px; height: 52px; object-fit: cover; border-radius: 8px; background-color: #f1f5f9;" onerror="this.src='images/default-food.png'">
              <div style="flex: 1; display: flex; flex-direction: column; text-align: left;">
                <span style="font-size: 13px; font-weight: 700; color: #1e293b; line-height: 1.3;">${item.name}</span>
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

// Search input
menuSearchInput.addEventListener('input', (e) => {
  searchQuery = e.target.value;
  isMenuFiltered = true;
  renderMenuItems();
});

// Search Drawer Toggle
const btnSearchMenuToggle = document.getElementById('btn-search-menu-toggle');
const menuSearchDrawer = document.getElementById('menu-search-drawer');
if (btnSearchMenuToggle && menuSearchDrawer) {
  btnSearchMenuToggle.addEventListener('click', () => {
    const isHidden = menuSearchDrawer.style.display === 'none';
    menuSearchDrawer.style.display = isHidden ? 'block' : 'none';
    if (isHidden) {
      menuSearchInput.focus();
    } else {
      menuSearchInput.value = '';
      searchQuery = '';
      isMenuFiltered = false;
      renderMenuItems();
    }
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
  
  // Check if item with same ID and notes already exists in cart
  const existingIndex = cart.findIndex(
    item => item.id === activeItem.id && item.notes === notes
  );
  
  if (existingIndex !== -1) {
    cart[existingIndex].quantity += currentQuantity;
  } else {
    cart.push({
      id: activeItem.id,
      name: activeItem.name,
      price: activeItem.price,
      emoji: activeItem.emoji || '🍽️',
      quantity: currentQuantity,
      notes: notes
    });
  }
  
  closeCustomModal();
  updateFloatingCartBar();
});

// Cart modal triggers
btnViewCart.addEventListener('click', openCartModal);
btnCloseCartModal.addEventListener('click', closeCartModal);
btnCloseCartModalFoot.addEventListener('click', closeCartModal);

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
      const table = tables.find(t => t.id === targetTableId);
      showSuccessToast(`Đã gửi Order thành công cho ${table ? table.name : ''}!`);
      
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
        <button class="btn btn-primary" style="height: 30px; padding: 0 12px; font-size: 12px; font-weight: 700; border-radius: 8px;" onclick="openCheckoutModal(${table.id})">Thanh toán</button>
      </div>
    `;
    container.appendChild(card);
  });
}

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
  const receivedInput = document.getElementById('checkout-received-input');
  
  discountInput.value = 0;
  receivedInput.value = subtotal;
  
  updateCheckoutCalculations(subtotal);
  
  discountInput.oninput = () => updateCheckoutCalculations(subtotal);
  receivedInput.oninput = () => updateCheckoutCalculations(subtotal);
  
  checkoutModal.style.display = 'flex';
};

window.closeCheckoutModal = () => {
  checkoutModal.style.display = 'none';
  activeCheckoutTableId = null;
};

function updateCheckoutCalculations(subtotal) {
  const discountVal = parseInt(document.getElementById('checkout-discount-input').value || 0);
  const total = Math.max(0, subtotal - discountVal);
  document.getElementById('checkout-total-val').textContent = formatVND(total);
  
  const receivedVal = parseInt(document.getElementById('checkout-received-input').value || 0);
  const change = Math.max(0, receivedVal - total);
  document.getElementById('checkout-change-val').textContent = formatVND(change);
}

if (btnConfirmCheckout) {
  btnConfirmCheckout.addEventListener('click', async () => {
    if (!activeCheckoutTableId) return;
    
    const discountAmount = parseInt(document.getElementById('checkout-discount-input').value || 0);
    const receivedAmount = parseInt(document.getElementById('checkout-received-input').value || 0);
    
    const paymentMethodChecked = document.querySelector('input[name="checkout-payment-method"]:checked');
    const paymentMethod = paymentMethodChecked ? paymentMethodChecked.value : 'cash';
    
    const table = tables.find(t => t.id === activeCheckoutTableId);
    const subtotal = table.order.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const total = Math.max(0, subtotal - discountAmount);
    
    if (receivedAmount < total) {
      alert('Số tiền khách đưa không đủ thanh toán!');
      return;
    }
    
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
  
  cart.forEach((item, index) => {
    const itemRow = document.createElement('div');
    itemRow.style.cssText = 'border-bottom: 1px dashed #cbd5e1; padding-bottom: 12px; display: flex; flex-direction: column; gap: 8px;';
    
    const topRow = document.createElement('div');
    topRow.style.cssText = 'display: flex; justify-content: space-between; align-items: flex-start;';
    
    let detailHtml = '';
    if (item.notes) {
      detailHtml = `<div style="font-size: 12px; color: #64748b; margin-top: 2px;">Ghi chú: ${item.notes}</div>`;
    }
    
    topRow.innerHTML = `
      <div style="flex: 1; padding-right: 12px;">
        <div style="font-size: 14px; font-weight: 600; color: #1e293b;">${item.emoji || '🍽️'} ${item.name}</div>
        ${detailHtml}
      </div>
      <div style="font-size: 14px; font-weight: 700; color: #0f172a; text-align: right;">${formatVND(item.price * item.quantity)}</div>
    `;
    
    const bottomRow = document.createElement('div');
    bottomRow.style.cssText = 'display: flex; justify-content: space-between; align-items: center;';
    
    // Qty Selector controls
    const qtySelector = document.createElement('div');
    qtySelector.style.cssText = 'display: flex; align-items: center; gap: 16px; border: 1.5px solid #cbd5e1; border-radius: 9999px; padding: 2px 12px; background-color: #ffffff;';
    qtySelector.innerHTML = `
      <button style="border: none; background: transparent; font-size: 18px; font-weight: 700; color: #0088ff; padding: 0 4px; cursor: pointer; user-select: none;">−</button>
      <span style="font-size: 14px; font-weight: 700; color: #1e293b; min-width: 16px; text-align: center;">${item.quantity}</span>
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
  });
  
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

// App initialization
init();
