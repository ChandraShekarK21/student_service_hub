// Socket.io real-time communication for student portal
let socket = null;

// Notification management system
const notificationManager = {
  notifications: [], // Store notifications in memory
  
  add: (notification) => {
    notificationManager.notifications.unshift({
      id: Date.now(),
      seen: false,
      createdAt: new Date(),
      ...notification
    });
    // Keep only last 50 notifications
    if (notificationManager.notifications.length > 50) {
      notificationManager.notifications.pop();
    }
  },
  
  markAllAsSeen: () => {
    notificationManager.notifications.forEach(n => n.seen = true);
  },
  
  getUnseenCount: () => {
    return notificationManager.notifications.filter(n => !n.seen).length;
  },
  
  getAll: () => {
    return notificationManager.notifications;
  },
  
  clear: () => {
    notificationManager.notifications = [];
  }
};

const badgeManager = {
  notifications: 0,
  cart: 0,
  
  increment: (type) => {
    if (badgeManager[type] !== undefined) {
      badgeManager[type]++;
      badgeManager.updateBadgeUI(type);
    }
  },
  
  set: (type, value) => {
    if (badgeManager[type] !== undefined) {
      badgeManager[type] = Math.max(0, value);
      badgeManager.updateBadgeUI(type);
    }
  },
  
  reset: (type) => {
    if (badgeManager[type] !== undefined) {
      badgeManager[type] = 0;
      badgeManager.updateBadgeUI(type);
    }
  },
  
  updateBadgeUI: (type) => {
    const badgeEl = document.getElementById(`${type}-badge`);
    if (badgeEl) {
      const count = badgeManager[type];
      badgeEl.textContent = count;
      badgeEl.style.display = count > 0 ? 'flex' : 'none';
    }
  },
  
  get: (type) => {
    return badgeManager[type] || 0;
  }
};

const initSocket = (studentId) => {
  if (socket) return; // Already initialized

  // Import socket.io from CDN
  const script = document.createElement('script');
  script.src = 'https://cdn.socket.io/4.5.4/socket.io.min.js';
  
  script.onload = () => {
    const socketIOUrl = `${window.location.protocol}//${window.location.hostname}:5000`;
    socket = window.io(socketIOUrl, {
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5
    });

    socket.on('connect', () => {
      console.log('✅ Connected to server via Socket.io');
      
      // Join student room for personal notifications
      if (studentId) {
        socket.emit('join-student-room', studentId);
        loadStudentNotifications();
      }
    });

    // Listen for order status updates
    socket.on('order-status-updated', (data) => {
      console.log('📞 Order status updated:', data);
      loadStudentNotifications();
      updateOrderStatusUI(data);
      if (document.getElementById('ordersContainer')) window.refreshStudentOrders?.();
      showAlert(`Order ${data.orderNumber} status updated to: ${data.status}`, 'info');
      // Update notification panel if visible
      renderNotificationPanel();
    });

    // Listen for new order confirmation
    socket.on('order-placed', (data) => {
      console.log('✅ Order confirmed:', data);
      loadStudentNotifications();
      showAlert(`Order ${data.orderNumber} placed successfully!`, 'success');
      renderNotificationPanel();
    });

    // Listen for stock updates (product quantity changes)
    socket.on('stock-updated', (data) => {
      console.log('📦 Stock updated:', data);
      updateProductStockUI(data);
    });

    // Listen for new products added
    socket.on('product-created', (data) => {
      console.log('✨ New product added:', data);
      updateProductListUI(data, 'add');
      showAlert(`New product available: ${data.name}`, 'success');
    });

    // Listen for product deleted
    socket.on('product-deleted', (data) => {
      console.log('🗑️ Product deleted:', data);
      updateProductListUI(data, 'remove');
      showAlert(`Product removed: ${data.productName}`, 'info');
    });

    socket.on('disconnect', () => {
      console.log('❌ Disconnected from server');
    });

    socket.on('error', (error) => {
      console.error('Socket error:', error);
    });
  };
  
  document.head.appendChild(script);
};

const updateOrderStatusUI = (orderData) => {
  // Update order in the UI if student is viewing orders
  const orderElements = document.querySelectorAll('[data-order-id]');
  
  orderElements.forEach((element) => {
    if (element.getAttribute('data-order-id') === orderData.orderId) {
      // Update status display
      const statusElement = element.querySelector('[data-order-status]');
      if (statusElement) {
        statusElement.textContent = orderData.status;
        statusElement.className = `status-badge status-${orderData.status.toLowerCase().replace(/\s+/g, '-')}`;
      }
      
      // Update remarks if present
      const remarksElement = element.querySelector('[data-order-remarks]');
      if (remarksElement && orderData.remarks) {
        remarksElement.textContent = orderData.remarks;
      }
    }
  });

  // If there's an orders table, refresh it
  if (window.state && window.state.currentPage === 'student-orders') {
    // Trigger a refresh of the orders page
    const pageComponent = document.querySelector('[data-page="student-orders"]');
    if (pageComponent && pageComponent.refreshOrders) {
      pageComponent.refreshOrders();
    }
  }
};

const updateProductStockUI = (productData) => {
  // Update product stock in the product listings
  const productElements = document.querySelectorAll(`[data-product-id="${productData.productId}"]`);
  
  productElements.forEach((element) => {
    // Update stock display
    const stockElement = element.querySelector('[data-product-stock]');
    if (stockElement) {
      stockElement.textContent = `Stock: ${productData.newStock}`;
      
      // Update availability class
      if (productData.newStock <= 0) {
        element.classList.add('out-of-stock');
        element.classList.remove('in-stock');
      } else {
        element.classList.add('in-stock');
        element.classList.remove('out-of-stock');
      }
    }

    // Update add to cart button availability
    const addBtn = element.querySelector('[data-add-to-cart]');
    if (addBtn) {
      addBtn.disabled = productData.newStock <= 0;
      addBtn.textContent = productData.newStock <= 0 ? 'Out of Stock' : 'Add to Cart';
    }
  });

  // Show notification for low stock
  if (productData.newStock <= 5 && productData.newStock > 0) {
    showAlert(`${productData.productName} inventory is low (${productData.newStock} left)`, 'warning');
  } else if (productData.newStock <= 0) {
    showAlert(`${productData.productName} is now out of stock`, 'error');
  }
};

const updateProductListUI = (productData, action) => {
  // This function handles adding/removing products from the shop display
  // Since the shop fetches products dynamically, we'll trigger a refresh
  // by simulating a search/filter action
  
  if (action === 'add') {
    // New product added - show notification and optionally refresh products
    console.log('New product:', productData.name, '- Consider refreshing product list');
    
    // If user is viewing the shop, they should refresh to see the new product
    if (window.state && window.state.currentPage === 'stationery/shop') {
      // Note: This depends on your shop implementation
      // You may need to trigger a product fetch here
      setTimeout(() => {
        // Try to find and trigger a refresh button or function
        const refreshBtn = document.querySelector('[data-action="refresh-products"]');
        if (refreshBtn) refreshBtn.click();
      }, 500);
    }
  } else if (action === 'remove') {
    // Product deleted - remove it from all product lists
    const productCards = document.querySelectorAll(`[data-product-id="${productData.productId}"]`);
    productCards.forEach(card => {
      card.style.opacity = '0.5';
      card.style.pointerEvents = 'none';
      // Optionally animate it out
      setTimeout(() => {
        if (card.parentNode) {
          card.parentNode.removeChild(card);
        }
      }, 300);
    });
  }
};

const emitEvent = (eventName, data) => {
  if (socket && socket.connected) {
    socket.emit(eventName, data);
  } else {
    console.warn('Socket not connected, cannot emit event:', eventName);
  }
};

/**
 * Open notification panel and mark all as seen
 */
const openNotificationPanel = () => {
  const modal = document.getElementById('notification-modal');
  if (modal) {
    modal.style.display = 'flex';
    loadStudentNotifications({ markRead: true });
  }
};

const loadStudentNotifications = async ({
  markRead = false,
  module = window.portalModule || 'stationery'
} = {}) => {
  const token = localStorage.getItem('token');
  if (!token) return;

  const isShareLearnNotification = (notification) =>
    ['upload_created', 'upload_downloaded', 'upload_rated'].includes(notification.type);
  notificationManager.notifications = notificationManager.notifications.filter((notification) =>
    module === 'sharelearn'
      ? isShareLearnNotification(notification)
      : !isShareLearnNotification(notification)
  );
  badgeManager.set('notifications', notificationManager.getUnseenCount());
  renderNotificationPanel();

  const apiBase = `${window.location.protocol}//${window.location.hostname}:5000/api`;
  try {
    const moduleQuery = `?module=${encodeURIComponent(module)}`;
    const response = await fetch(`${apiBase}/notifications${moduleQuery}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!response.ok) {
      throw new Error(`Unable to load notifications (${response.status})`);
    }

    const notifications = await response.json();
    notificationManager.notifications = notifications.map((notification) => ({
      ...notification,
      id: notification._id,
      seen: notification.read
    }));
    badgeManager.set('notifications', notifications.filter((notification) => !notification.read).length);
    renderNotificationPanel();

    if (markRead && notifications.some((notification) => !notification.read)) {
      const markReadResponse = await fetch(`${apiBase}/notifications/mark-all-read${moduleQuery}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!markReadResponse.ok) {
        throw new Error(`Unable to mark notifications as read (${markReadResponse.status})`);
      }
      notificationManager.markAllAsSeen();
      badgeManager.reset('notifications');
      renderNotificationPanel();
    }
  } catch (error) {
    console.error('Notification sync failed:', error);
  }
};

/**
 * Close notification panel
 */
const closeNotificationPanel = () => {
  const modal = document.getElementById('notification-modal');
  if (modal) {
    modal.style.display = 'none';
  }
};

/**
 * Render notifications in the panel
 */
const renderNotificationPanel = () => {
  const container = document.getElementById('notifications-list');
  if (!container) return;
  
  const notifs = notificationManager.getAll();
  
  if (notifs.length === 0) {
    container.innerHTML = '<p style="padding: 2rem; text-align: center; color: var(--text-muted);">No notifications</p>';
    return;
  }
  
  container.innerHTML = notifs.map(notif => `
    <div style="padding: 1rem; border: 1px solid var(--border); border-radius: 0.5rem; margin-bottom: 0.75rem; background: ${notif.seen ? 'transparent' : 'rgba(59, 130, 246, 0.05)'};">
      <div style="display: flex; justify-content: space-between; align-items: start;">
        <div>
          <h4 style="margin: 0 0 0.25rem 0; font-weight: 600;">
            ${notif.title || (notif.type === 'orderStatusUpdated' ? '📦 Order Update' : '✅ Order Placed')}
          </h4>
          <p style="margin: 0.25rem 0; color: var(--text); font-size: 0.9rem;">${notif.message}</p>
          <time style="display: block; margin-top: 0.5rem; font-size: 0.75rem; color: var(--text-muted);">
            ${new Date(notif.createdAt).toLocaleString()}
          </time>
        </div>
        ${!notif.seen ? '<span style="display: inline-block; width: 8px; height: 8px; background: #3B82F6; border-radius: 50%; flex-shrink: 0; margin-left: 1rem; margin-top: 0.25rem;"></span>' : ''}
      </div>
    </div>
  `).join('');
};

/**
 * Update cart badge count
 */
const updateCartBadge = (count) => {
  badgeManager.set('cart', count);
};

/**
 * Add new cart item and update badge
 */
const addCartItem = (productId, productName, quantity = 1) => {
  // This would be called when user clicks "Add to Cart"
  // Just increment the "new items" badge
  badgeManager.increment('cart');
};

/**
 * Reset cart badge (e.g., when user places order or opens cart)
 */
const resetCartBadge = () => {
  badgeManager.reset('cart');
};

// Gracefully close socket when page unloads
window.addEventListener('beforeunload', () => {
  if (socket) {
    socket.disconnect();
  }
});

// Public API
window.badgeManager = badgeManager;
window.notificationManager = notificationManager;
window.loadStudentNotifications = loadStudentNotifications;
window.openNotificationPanel = openNotificationPanel;
window.closeNotificationPanel = closeNotificationPanel;
window.updateCartBadge = updateCartBadge;
window.addCartItem = addCartItem;
window.resetCartBadge = resetCartBadge;
