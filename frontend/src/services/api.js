const API_ORIGIN = import.meta.env.VITE_API_URL || `${window.location.protocol}//${window.location.hostname}:5000`;
const BASE_URL = `${API_ORIGIN}/api`;

const readResponse = async (response) => {
    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.message || `Request failed (${response.status})`);
    }
    return data;
};

const getAuthHeader = (token = null) => {
    const adminToken = token || localStorage.getItem('admin_token');
    return {
        'Content-Type': 'application/json',
        ...(adminToken && { 'Authorization': `Bearer ${adminToken}` })
    };
};

export const api = {
    // --- Student ---
    loginStudent: async (roll_number) => {
        const res = await fetch(`${BASE_URL}/student/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ roll_number })
        });
        return res.json();
    },
    getStudentProducts: async () => {
        const res = await fetch(`${BASE_URL}/products`);
        const data = await readResponse(res);
        return (data.items || []).map(product => ({ ...product, id: product._id }));
    },
    placeOrder: async (roll_number, items) => {
        const res = await fetch(`${BASE_URL}/student/order`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ roll_number, items })
        });
        return res.json();
    },
    getStudentOrders: async (roll_number) => {
        const res = await fetch(`${BASE_URL}/student/orders/${roll_number}`);
        return res.json();
    },
    getStudentNotifications: async (studentId) => {
        const res = await fetch(`${BASE_URL}/notifications?recipientId=${studentId}&recipientType=Student`, {
            headers: getAuthHeader()
        });
        return res.json();
    },
    markNotificationAsRead: async (notificationId) => {
        const res = await fetch(`${BASE_URL}/notifications/${notificationId}/read`, {
            method: 'PUT',
            headers: getAuthHeader()
        });
        return res.json();
    },

    // --- Manager ---
    getManagerOrders: async () => {
        const res = await fetch(`${BASE_URL}/manager/orders`);
        return res.json();
    },
    updateOrderStatus: async (id, status) => {
        const res = await fetch(`${BASE_URL}/manager/order/${id}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status })
        });
        return res.json();
    },
    getManagerProducts: async () => {
        const res = await fetch(`${BASE_URL}/manager/products`);
        return res.json();
    },
    addManagerProduct: async (product) => {
        const res = await fetch(`${BASE_URL}/manager/product`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(product)
        });
        return res.json();
    },
    updateManagerProduct: async (id, product) => {
        const res = await fetch(`${BASE_URL}/manager/product/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(product)
        });
        return res.json();
    },
    deleteManagerProduct: async (id) => {
        const res = await fetch(`${BASE_URL}/manager/product/${id}`, {
            method: 'DELETE'
        });
        return res.json();
    },
    getManagerAnalytics: async () => {
        const res = await fetch(`${BASE_URL}/manager/analytics`);
        return res.json();
    },

    // --- Admin ---
    // Dashboard
    getAdminStats: async () => {
        const res = await fetch(`${BASE_URL}/admin/stats`, {
            headers: getAuthHeader()
        });
        return readResponse(res);
    },

    // Orders
    getAdminOrders: async (filters = {}) => {
        const params = new URLSearchParams();
        if (filters.status) params.append('status', filters.status);
        if (filters.studentName) params.append('studentName', filters.studentName);
        if (filters.studentId) params.append('studentId', filters.studentId);
        if (filters.orderId) params.append('orderId', filters.orderId);
        if (filters.paymentStatus) params.append('paymentStatus', filters.paymentStatus);
        
        const query = params.toString() ? `?${params.toString()}` : '';
        const res = await fetch(`${BASE_URL}/admin/orders${query}`, {
            headers: getAuthHeader()
        });
        return readResponse(res);
    },
    getAdminOrderDetail: async (orderId) => {
        const res = await fetch(`${BASE_URL}/admin/orders/${orderId}`, {
            headers: getAuthHeader()
        });
        return readResponse(res);
    },
    updateAdminOrderStatus: async (orderId, status, remarks = '') => {
        const res = await fetch(`${BASE_URL}/admin/orders/${orderId}/status`, {
            method: 'PUT',
            headers: getAuthHeader(),
            body: JSON.stringify({ status, remarks })
        });
        return readResponse(res);
    },
    updateAdminPaymentStatus: async (orderId, paymentStatus) => {
        const res = await fetch(`${BASE_URL}/admin/orders/${orderId}/payment-status`, {
            method: 'PUT',
            headers: getAuthHeader(),
            body: JSON.stringify({ paymentStatus })
        });
        return readResponse(res);
    },

    // Inventory/Stock
    getAdminInventory: async (filters = {}) => {
        const params = new URLSearchParams();
        if (filters.category) params.append('category', filters.category);
        if (filters.sortBy) params.append('sortBy', filters.sortBy);
        
        const query = params.toString() ? `?${params.toString()}` : '';
        const res = await fetch(`${BASE_URL}/admin/inventory${query}`, {
            headers: getAuthHeader()
        });
        return readResponse(res);
    },
    getStockAnalytics: async () => {
        const res = await fetch(`${BASE_URL}/admin/inventory/analytics`, {
            headers: getAuthHeader()
        });
        return readResponse(res);
    },
    updateAdminStock: async (productId, quantity, action = 'set') => {
        const res = await fetch(`${BASE_URL}/admin/inventory/${productId}`, {
            method: 'PUT',
            headers: getAuthHeader(),
            body: JSON.stringify({ quantity, action })
        });
        return readResponse(res);
    },

    // Notifications
    getAdminNotifications: async () => {
        const res = await fetch(`${BASE_URL}/admin/notifications`, {
            headers: getAuthHeader()
        });
        return readResponse(res);
    },
    markNotificationRead: async (notificationId) => {
        const res = await fetch(`${BASE_URL}/admin/notifications/${notificationId}/read`, {
            method: 'PUT',
            headers: getAuthHeader()
        });
        return readResponse(res);
    },
    markAllNotificationsRead: async () => {
        const res = await fetch(`${BASE_URL}/admin/notifications/mark-all-read`, {
            method: 'PUT',
            headers: getAuthHeader(),
            body: JSON.stringify({ recipientType: 'Admin' })
        });
        return readResponse(res);
    },
    getUnreadCount: async () => {
        const res = await fetch(`${BASE_URL}/admin/notifications/unread-count`, {
            headers: getAuthHeader()
        });
        return readResponse(res);
    },
    deleteNotification: async (notificationId) => {
        const res = await fetch(`${BASE_URL}/admin/notifications/${notificationId}`, {
            method: 'DELETE',
            headers: getAuthHeader()
        });
        return readResponse(res);
    },

    // Products (Admin)
    getAdminProducts: async (filters = {}) => {
        const params = new URLSearchParams();
        if (filters.search) params.append('search', filters.search);
        if (filters.category) params.append('category', filters.category);
        if (filters.sort) params.append('sort', filters.sort);
        
        const query = params.toString() ? `?${params.toString()}` : '';
        const res = await fetch(`${BASE_URL}/products${query}`);
        return readResponse(res);
    },
    createAdminProduct: async (productData) => {
        const res = await fetch(`${BASE_URL}/products`, {
            method: 'POST',
            headers: getAuthHeader(),
            body: JSON.stringify(productData)
        });
        return readResponse(res);
    },
    updateAdminProduct: async (productId, productData) => {
        const res = await fetch(`${BASE_URL}/products/${productId}`, {
            method: 'PUT',
            headers: getAuthHeader(),
            body: JSON.stringify(productData)
        });
        return readResponse(res);
    },
    deleteAdminProduct: async (productId) => {
        const res = await fetch(`${BASE_URL}/products/${productId}`, {
            method: 'DELETE',
            headers: getAuthHeader()
        });
        return readResponse(res);
    },

    // Reports
    getDailySalesData: async (dateRange = 'month') => {
        const res = await fetch(`${BASE_URL}/admin/reports/daily-sales?dateRange=${dateRange}`, {
            headers: getAuthHeader()
        });
        return readResponse(res);
    },
    getTopSellingItems: async (limit = 5) => {
        const res = await fetch(`${BASE_URL}/admin/reports/top-items?limit=${limit}`, {
            headers: getAuthHeader()
        });
        return readResponse(res);
    },
    getAdminReport: async (type, dateRange = 'month') => {
        const params = new URLSearchParams({ type, dateRange });
        const res = await fetch(`${BASE_URL}/admin/reports/data?${params}`, {
            headers: getAuthHeader()
        });
        return readResponse(res);
    }
};
