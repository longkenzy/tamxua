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

// DOM Elements
const connectionDot = document.getElementById('connection-dot');
const tableSelectionView = document.getElementById('table-selection-view');
const menuOrderingView = document.getElementById('menu-ordering-view');
const tablesContainer = document.getElementById('tables-container');
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
    const [menuRes, tablesRes] = await Promise.all([
      fetch('/api/menu'),
      fetch('/api/tables')
    ]);
    
    if (menuRes.status === 401 || tablesRes.status === 401) {
      window.location.href = '/login.html';
      return;
    }
    
    menu = await menuRes.json();
    tables = await tablesRes.json();
    
    renderTables();
    
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
        if (tableSelectionView.style.display !== 'none') {
          renderTables();
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
      menu = await menuRes.json();
      tables = await tablesRes.json();
      
      if (tableSelectionView.style.display !== 'none') {
        renderTables();
      } else {
        const currentTable = tables.find(t => t.id === activeTableId);
        if (currentTable) {
          updateActiveTableSubtitle(currentTable);
        }
      }
      
      if (menuOrderingView.style.display !== 'none') {
        renderMenuItems();
      }
    }
  } catch (err) {
    console.error('Polling error:', err);
  }
}

// Render Table List
function renderTables() {
  tablesContainer.innerHTML = '';
  tables.forEach(table => {
    const isOccupied = table.status === 'eating';
    const card = document.createElement('div');
    card.className = `table-card ${isOccupied ? 'occupied' : ''}`;
    
    let activeOrderPreviewHtml = '';
    if (isOccupied && table.order.length > 0) {
      const itemsCount = table.order.reduce((sum, item) => sum + item.quantity, 0);
      const totalAmount = table.order.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      activeOrderPreviewHtml = `
        <div class="table-order-preview">
          Đang ăn: <span class="bold">${itemsCount} món</span><br>
          Tạm tính: <span class="bold text-rausch">${formatVND(totalAmount)}</span>
        </div>
      `;
    } else {
      activeOrderPreviewHtml = '<div class="table-order-preview">Bàn trống</div>';
    }

    card.innerHTML = `
      <div class="table-icon">${isOccupied ? '🍽️' : '🪑'}</div>
      <div class="table-name">${table.name}</div>
      <span class="table-status ${isOccupied ? 'occupied' : 'empty'}">
        ${isOccupied ? 'Đang dùng' : 'Trống'}
      </span>
      ${activeOrderPreviewHtml}
    `;

    card.addEventListener('click', () => selectTable(table.id));
    tablesContainer.appendChild(card);
  });
}

function updateActiveTableSubtitle(table) {
  if (table.status === 'eating' && table.order.length > 0) {
    const totalAmount = table.order.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    activeTableStatusSubtitle.innerHTML = `Đang có order hoạt động (${formatVND(totalAmount)}) • Thêm món mới bên dưới`;
  } else {
    activeTableStatusSubtitle.innerHTML = `Trống • Gọi món mới bên dưới`;
  }
}

// Select a table to order
function selectTable(tableId) {
  activeTableId = tableId;
  const table = tables.find(t => t.id === tableId);
  activeTableName.textContent = table.name;
  updateActiveTableSubtitle(table);

  // Reset cart and filter state
  cart = [];
  activeCategory = 'all';
  searchQuery = '';
  menuSearchInput.value = '';
  updateCategoryTabs();
  
  // Switch Views
  tableSelectionView.style.display = 'none';
  menuOrderingView.style.display = 'block';
  updateFloatingCartBar();

  // Render items
  renderMenuItems();
}

// Render Menu Items based on category and search filter
function renderMenuItems() {
  menuItemsContainer.innerHTML = '';
  
  const filtered = menu.filter(item => {
    const matchesCategory = activeCategory === 'all' || item.category === activeCategory;
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          item.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  if (filtered.length === 0) {
    menuItemsContainer.innerHTML = `
      <div class="text-center text-muted p-md">
        Không tìm thấy món ăn nào khớp với yêu cầu.
      </div>
    `;
    return;
  }

  filtered.forEach(item => {
    const card = document.createElement('div');
    card.className = 'menu-item-card';
    
    let imgHtml = '';
    if (item.image_url) {
      imgHtml = `<img src="${item.image_url}" style="width:100%; height:100%; object-fit:cover;">`;
    } else {
      imgHtml = item.emoji || '🍽️';
    }
    
    card.innerHTML = `
      <div class="menu-item-img" style="overflow:hidden;">${imgHtml}</div>
      <div class="menu-item-details">
        <div class="menu-item-info">
          <div class="menu-item-name">${item.name}</div>
          <div class="menu-item-price">${formatVND(item.price)}</div>
          <div class="menu-item-desc">${item.description}</div>
        </div>
        <button class="btn btn-primary btn-add-item">Chọn</button>
      </div>
    `;
    
    card.querySelector('.btn-add-item').addEventListener('click', () => openCustomModal(item));
    menuItemsContainer.appendChild(card);
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
    customModalEmoji.textContent = item.emoji || '🍽️';
  }
  customModalPrice.textContent = formatVND(item.price);
  customModalDesc.textContent = item.description;
  
  customItemModal.style.display = 'flex';
}

function closeCustomModal() {
  customItemModal.style.display = 'none';
  activeItem = null;
}

// Open Cart Details Modal
function openCartModal() {
  cartModalTitle.textContent = `Giỏ hàng - ${tables.find(t => t.id === activeTableId).name}`;
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
      <div class="text-center text-muted p-md">
        Giỏ hàng rỗng. Hãy chọn món ăn trước nhé!
      </div>
    `;
    cartTotalPriceLarge.textContent = '0đ';
    return;
  }

  let total = 0;
  cart.forEach((item, index) => {
    const subtotal = item.price * item.quantity;
    total += subtotal;
    
    const div = document.createElement('div');
    div.className = 'cart-item';
    div.innerHTML = `
      <div class="cart-item-info">
        <div class="cart-item-name">${item.emoji} ${item.name}</div>
        ${item.notes ? `<div class="cart-item-notes">Ghi chú: ${item.notes}</div>` : ''}
        <div class="cart-item-qty-price">Số lượng: ${item.quantity} × ${formatVND(item.price)}</div>
      </div>
      <div class="cart-item-actions">
        <div class="cart-item-subtotal">${formatVND(subtotal)}</div>
        <button class="btn-remove-cart" data-index="${index}">Xóa</button>
      </div>
    `;
    
    div.querySelector('.btn-remove-cart').addEventListener('click', (e) => {
      const idx = parseInt(e.target.getAttribute('data-index'));
      cart.splice(idx, 1);
      renderCartItems();
      updateFloatingCartBar();
    });
    
    cartItemsListContainer.appendChild(div);
  });
  
  cartTotalPriceLarge.textContent = formatVND(total);
}

// Update Floating Cart Bar
function updateFloatingCartBar() {
  if (cart.length === 0) {
    floatingCartBar.style.display = 'none';
    return;
  }
  
  const totalQty = cart.reduce((sum, item) => sum + item.quantity, 0);
  const totalPrice = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  
  cartSummaryQty.textContent = `${totalQty} món đã chọn`;
  cartSummaryTotal.textContent = `Tạm tính: ${formatVND(totalPrice)}`;
  floatingCartBar.style.display = 'flex';
}

// Handle Category filter clicking
function updateCategoryTabs() {
  const tabs = categoryStripContainer.querySelectorAll('.category-tab');
  tabs.forEach(tab => {
    if (tab.getAttribute('data-category') === activeCategory) {
      tab.classList.add('active');
    } else {
      tab.classList.remove('active');
    }
  });
}

// Event Listeners setup
btnBackTables.addEventListener('click', () => {
  activeTableId = null;
  menuOrderingView.style.display = 'none';
  tableSelectionView.style.display = 'block';
  floatingCartBar.style.display = 'none';
  cart = [];
  renderTables();
});

// Category Click
categoryStripContainer.querySelectorAll('.category-tab').forEach(tab => {
  tab.addEventListener('click', (e) => {
    const target = e.currentTarget;
    activeCategory = target.getAttribute('data-category');
    updateCategoryTabs();
    renderMenuItems();
  });
});

// Search input
menuSearchInput.addEventListener('input', (e) => {
  searchQuery = e.target.value;
  renderMenuItems();
});

// Customization Modal actions
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
      emoji: activeItem.emoji,
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
  if (cart.length === 0 || !activeTableId) return;
  
  btnSubmitOrder.disabled = true;
  btnSubmitOrder.textContent = 'Đang gửi...';
  
  try {
    const response = await fetch('/api/order', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        tableId: activeTableId,
        items: cart
      })
    });
    
    if (response.status === 401) {
      window.location.href = '/login.html';
      return;
    }
    
    const result = await response.json();
    if (result.success) {
      showSuccessToast(`Đã gửi Order thành công cho ${tables.find(t => t.id === activeTableId).name}!`);
      
      // Reset view to tables selection
      closeCartModal();
      cart = [];
      activeTableId = null;
      menuOrderingView.style.display = 'none';
      tableSelectionView.style.display = 'block';
      floatingCartBar.style.display = 'none';
      renderTables();
    } else {
      alert(`Lỗi khi đặt món: ${result.error || 'Vui lòng thử lại.'}`);
    }
  } catch (error) {
    console.error('Lỗi khi gửi order:', error);
    alert('Không thể kết nối đến máy chủ. Vui lòng kiểm tra mạng.');
  } finally {
    btnSubmitOrder.disabled = false;
    btnSubmitOrder.textContent = 'Gửi Yêu Cầu Order';
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

// App initialization
init();
