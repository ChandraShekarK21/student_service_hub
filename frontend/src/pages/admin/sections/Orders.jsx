import React, { useEffect, useState } from 'react';
import { Search, Filter, Eye, ChevronDown, AlertCircle, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '../../../services/api';

function AdminOrders({ socketEvents = {} }) {
    const [orders, setOrders] = useState([]);
    const [filteredOrders, setFilteredOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    
    // Search and Filter States
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState('all');
    const [filterPayment, setFilterPayment] = useState('all');
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [showStatusDropdown, setShowStatusDropdown] = useState(null);
    
    // Status Update State
    const [updatingStatus, setUpdatingStatus] = useState(false);

    useEffect(() => {
        fetchOrders();
        const interval = setInterval(fetchOrders, 30000);
        return () => clearInterval(interval);
    }, []);

    // Refresh when real-time events occur
    useEffect(() => {
        if (socketEvents.newOrder || socketEvents.orderStatusChanged) {
            console.log('Order event detected, refreshing orders list');
            fetchOrders();
        }
    }, [socketEvents.newOrder, socketEvents.orderStatusChanged]);

    useEffect(() => {
        filterOrders();
    }, [orders, searchTerm, filterStatus, filterPayment]);

    const fetchOrders = async () => {
        try {
            setLoading(true);
            const data = await api.getAdminOrders();
            setOrders(data);
            setError(null);
        } catch (err) {
            console.error('Error fetching orders:', err);
            setError('Failed to load orders');
        } finally {
            setLoading(false);
        }
    };

    const filterOrders = () => {
        let filtered = orders;

        // Search filter
        if (searchTerm.trim()) {
            const term = searchTerm.toLowerCase();
            filtered = filtered.filter(order =>
                order.studentName?.toLowerCase().includes(term) ||
                order.studentId?.toLowerCase().includes(term) ||
                order.orderNumber?.toLowerCase().includes(term)
            );
        }

        // Status filter
        if (filterStatus !== 'all') {
            filtered = filtered.filter(order => order.status === filterStatus);
        }

        // Payment filter
        if (filterPayment !== 'all') {
            filtered = filtered.filter(order => order.paymentStatus === filterPayment);
        }

        setFilteredOrders(filtered);
    };

    const handleStatusUpdate = async (orderId, newStatus) => {
        try {
            setUpdatingStatus(true);
            
            const result = await api.updateAdminOrderStatus(orderId, newStatus);
            
            if (result.message) {
                // Update local state
                setOrders(orders.map(order =>
                    order.id === orderId ? { ...order, status: newStatus } : order
                ));
                setShowStatusDropdown(null);
                alert(`Order status updated to ${newStatus}`);
            }
        } catch (err) {
            console.error('Error updating status:', err);
            alert('Failed to update order status');
        } finally {
            setUpdatingStatus(false);
        }
    };

    const handleViewDetails = async (order) => {
        try {
            const details = await api.getAdminOrderDetail(order.id);
            setSelectedOrder({ ...order, ...details });
            setShowDetailModal(true);
        } catch (err) {
            console.error('Error fetching order details:', err);
            alert('Failed to load order details');
        }
    };

    const statusOptions = [
        'Order placed',
        'In queue',
        'Reviewed',
        'Processing',
        'Packed successfully',
        'Ready to collect',
        'Delivered',
        'Cancelled',
        'Cancelled by User'
    ];

    const paymentStatusOptions = ['Pending', 'Paid', 'Failed'];

    const getStatusColor = (status) => {
        const colors = {
            'Order placed': '#3B82F6',
            'In queue': '#F59E0B',
            'Reviewed': '#8B5CF6',
            'Processing': '#8B5CF6',
            'Packed successfully': '#10B981',
            'Ready to collect': '#06B6D4',
            'Ready to Collect': '#06B6D4',
            'Delivered': '#10B981',
            'Cancelled': '#EF4444',
            'Cancelled by User': '#EF4444'
        };
        return colors[status] || '#6B7280';
    };

    const getPaymentColor = (status) => {
        const colors = {
            'Paid': '#10B981',
            'Pending': '#F59E0B',
            'Failed': '#EF4444'
        };
        return colors[status] || '#6B7280';
    };

    if (loading && orders.length === 0) {
        return (
            <div className="card" style={{ padding: '2rem', textAlign: 'center' }}>
                <p style={{ color: 'var(--text-muted)' }}>Loading orders...</p>
            </div>
        );
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {error && (
                <div className="card" style={{
                    padding: '1rem',
                    background: '#FEE2E2',
                    border: '1px solid #FCA5A5',
                    borderRadius: '0.5rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem'
                }}>
                    <AlertCircle size={20} color="#DC2626" />
                    <p style={{ margin: 0, color: '#DC2626' }}>{error}</p>
                    <button className="btn btn-sm" onClick={fetchOrders} style={{ marginLeft: 'auto' }}>
                        Retry
                    </button>
                </div>
            )}

            {/* Search and Filter Section */}
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="card"
                style={{ padding: '1.5rem' }}
            >
                <h3 style={{ marginTop: 0, marginBottom: '1.5rem' }}>Search & Filters</h3>
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                    gap: '1rem'
                }}>
                    {/* Search Input */}
                    <div style={{ position: 'relative' }}>
                        <Search size={18} style={{
                            position: 'absolute',
                            left: '0.75rem',
                            top: '50%',
                            transform: 'translateY(-50%)',
                            color: 'var(--text-muted)'
                        }} />
                        <input
                            type="text"
                            className="input"
                            placeholder="Search by name, ID, or order #..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            style={{ paddingLeft: '2.5rem', width: '100%' }}
                        />
                    </div>

                    {/* Status Filter */}
                    <div style={{ position: 'relative' }}>
                        <Filter size={18} style={{
                            position: 'absolute',
                            left: '0.75rem',
                            top: '50%',
                            transform: 'translateY(-50%)',
                            color: 'var(--text-muted)'
                        }} />
                        <select
                            className="input"
                            value={filterStatus}
                            onChange={(e) => setFilterStatus(e.target.value)}
                            style={{ paddingLeft: '2.5rem', width: '100%' }}
                        >
                            <option value="all">All Status</option>
                            <option value="Order placed">Order Placed</option>
                            <option value="In queue">In Queue</option>
                            <option value="Reviewed">Reviewed</option>
                            <option value="Processing">Processing</option>
                            <option value="Packed successfully">Packed</option>
                            <option value="Ready to collect">Ready to Collect</option>
                            <option value="Delivered">Delivered</option>
                            <option value="Cancelled">Cancelled</option>
                        </select>
                    </div>

                    {/* Payment Filter */}
                    <div style={{ position: 'relative' }}>
                        <Filter size={18} style={{
                            position: 'absolute',
                            left: '0.75rem',
                            top: '50%',
                            transform: 'translateY(-50%)',
                            color: 'var(--text-muted)'
                        }} />
                        <select
                            className="input"
                            value={filterPayment}
                            onChange={(e) => setFilterPayment(e.target.value)}
                            style={{ paddingLeft: '2.5rem', width: '100%' }}
                        >
                            <option value="all">All Payments</option>
                            <option value="Paid">Paid</option>
                            <option value="Pending">Pending</option>
                            <option value="Failed">Failed</option>
                        </select>
                    </div>
                </div>
                <p style={{
                    margin: '1rem 0 0 0',
                    fontSize: '0.875rem',
                    color: 'var(--text-muted)'
                }}>
                    Showing {filteredOrders.length} of {orders.length} orders
                </p>
            </motion.div>

            {/* Orders Table */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="card"
                style={{ padding: '1.5rem', overflowX: 'auto' }}
            >
                <h3 style={{ marginTop: 0, marginBottom: '1.5rem' }}>Orders List</h3>
                
                {filteredOrders.length === 0 ? (
                    <div style={{
                        textAlign: 'center',
                        padding: '2rem',
                        color: 'var(--text-muted)'
                    }}>
                        <Clock size={32} style={{ margin: '0 auto 0.5rem', opacity: 0.5 }} />
                        <p>No orders found</p>
                    </div>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{
                            width: '100%',
                            borderCollapse: 'collapse',
                            fontSize: '0.9rem'
                        }}>
                            <thead>
                                <tr style={{
                                    borderBottom: '2px solid var(--border)',
                                    background: 'var(--surface)'
                                }}>
                                    <th style={{ textAlign: 'left', padding: '0.75rem', fontWeight: '600' }}>Order ID</th>
                                    <th style={{ textAlign: 'left', padding: '0.75rem', fontWeight: '600' }}>Student</th>
                                    <th style={{ textAlign: 'left', padding: '0.75rem', fontWeight: '600' }}>Items</th>
                                    <th style={{ textAlign: 'left', padding: '0.75rem', fontWeight: '600' }}>Amount</th>
                                    <th style={{ textAlign: 'left', padding: '0.75rem', fontWeight: '600' }}>Payment</th>
                                    <th style={{ textAlign: 'left', padding: '0.75rem', fontWeight: '600' }}>Status</th>
                                    <th style={{ textAlign: 'left', padding: '0.75rem', fontWeight: '600' }}>Date</th>
                                    <th style={{ textAlign: 'center', padding: '0.75rem', fontWeight: '600' }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredOrders.map((order, idx) => (
                                    <motion.tr
                                        key={order.id}
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        transition={{ delay: idx * 0.05 }}
                                        style={{
                                            borderBottom: '1px solid var(--border)',
                                            '&:hover': { background: 'var(--surface)' }
                                        }}
                                    >
                                        <td style={{ padding: '0.75rem', fontWeight: '500' }}>
                                            {order.orderNumber}
                                        </td>
                                        <td style={{ padding: '0.75rem' }}>
                                            <div>
                                                <p style={{ margin: 0, fontWeight: '500' }}>
                                                    {order.studentName}
                                                </p>
                                                <p style={{
                                                    margin: '0.25rem 0 0 0',
                                                    fontSize: '0.8rem',
                                                    color: 'var(--text-muted)'
                                                }}>
                                                    {order.studentId}
                                                </p>
                                            </div>
                                        </td>
                                        <td style={{ padding: '0.75rem' }}>
                                            <span style={{
                                                display: 'inline-block',
                                                background: 'var(--surface)',
                                                padding: '0.25rem 0.5rem',
                                                borderRadius: '0.25rem',
                                                fontSize: '0.85rem'
                                            }}>
                                                {order.itemCount} items
                                            </span>
                                        </td>
                                        <td style={{ padding: '0.75rem', fontWeight: '600' }}>
                                            ₹{(order.totalAmount || 0).toLocaleString()}
                                        </td>
                                        <td style={{ padding: '0.75rem' }}>
                                            <span style={{
                                                display: 'inline-block',
                                                padding: '0.25rem 0.75rem',
                                                borderRadius: '0.25rem',
                                                background: `${getPaymentColor(order.paymentStatus)}20`,
                                                color: getPaymentColor(order.paymentStatus),
                                                fontSize: '0.8rem',
                                                fontWeight: '600'
                                            }}>
                                                {order.paymentStatus}
                                            </span>
                                        </td>
                                        <td style={{ padding: '0.75rem' }}>
                                            <div style={{ position: 'relative' }}>
                                                <button
                                                    onClick={() => setShowStatusDropdown(
                                                        showStatusDropdown === order.id ? null : order.id
                                                    )}
                                                    style={{
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '0.5rem',
                                                        padding: '0.25rem 0.75rem',
                                                        borderRadius: '0.25rem',
                                                        background: `${getStatusColor(order.status)}20`,
                                                        color: getStatusColor(order.status),
                                                        border: 'none',
                                                        cursor: 'pointer',
                                                        fontSize: '0.8rem',
                                                        fontWeight: '600'
                                                    }}
                                                >
                                                    {order.status}
                                                    <ChevronDown size={14} />
                                                </button>

                                                <AnimatePresence>
                                                    {showStatusDropdown === order.id && (
                                                        <motion.div
                                                            initial={{ opacity: 0, y: -10 }}
                                                            animate={{ opacity: 1, y: 0 }}
                                                            exit={{ opacity: 0, y: -10 }}
                                                            style={{
                                                                position: 'absolute',
                                                                top: '100%',
                                                                left: 0,
                                                                background: 'var(--surface)',
                                                                border: '1px solid var(--border)',
                                                                borderRadius: '0.5rem',
                                                                zIndex: 10,
                                                                minWidth: '150px',
                                                                marginTop: '0.25rem',
                                                                boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                                                            }}
                                                        >
                                                            {statusOptions.map((status) => (
                                                                <button
                                                                    key={status}
                                                                    onClick={() => handleStatusUpdate(order.id, status)}
                                                                    disabled={updatingStatus}
                                                                    style={{
                                                                        display: 'block',
                                                                        width: '100%',
                                                                        padding: '0.5rem 1rem',
                                                                        textAlign: 'left',
                                                                        border: 'none',
                                                                        background: order.status === status ? 'var(--primary)20' : 'transparent',
                                                                        cursor: updatingStatus ? 'not-allowed' : 'pointer',
                                                                        fontSize: '0.85rem',
                                                                        opacity: updatingStatus ? 0.6 : 1,
                                                                        transition: 'all 0.2s'
                                                                    }}
                                                                    onMouseEnter={(e) => e.target.style.background = 'var(--primary)20'}
                                                                    onMouseLeave={(e) => e.target.style.background = order.status === status ? 'var(--primary)20' : 'transparent'}
                                                                >
                                                                    {status} {order.status === status && '✓'}
                                                                </button>
                                                            ))}
                                                        </motion.div>
                                                    )}
                                                </AnimatePresence>
                                            </div>
                                        </td>
                                        <td style={{
                                            padding: '0.75rem',
                                            fontSize: '0.85rem',
                                            color: 'var(--text-muted)'
                                        }}>
                                            {new Date(order.orderDate).toLocaleDateString()}
                                        </td>
                                        <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                                            <button
                                                onClick={() => handleViewDetails(order)}
                                                style={{
                                                    background: 'transparent',
                                                    border: 'none',
                                                    cursor: 'pointer',
                                                    color: 'var(--primary)',
                                                    padding: '0.5rem'
                                                }}
                                                title="View Details"
                                            >
                                                <Eye size={18} />
                                            </button>
                                        </td>
                                    </motion.tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </motion.div>

            {/* Order Detail Modal */}
            <AnimatePresence>
                {showDetailModal && selectedOrder && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setShowDetailModal(false)}
                        style={{
                            position: 'fixed',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            background: 'rgba(0,0,0,0.5)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            zIndex: 100
                        }}
                    >
                        <motion.div
                            initial={{ scale: 0.95 }}
                            animate={{ scale: 1 }}
                            exit={{ scale: 0.95 }}
                            onClick={(e) => e.stopPropagation()}
                            className="card"
                            style={{
                                maxWidth: '600px',
                                width: '90%',
                                maxHeight: '80vh',
                                overflowY: 'auto',
                                padding: '2rem'
                            }}
                        >
                            <h2 style={{ marginTop: 0, marginBottom: '1.5rem' }}>
                                Order Details
                            </h2>

                            {/* Order Header */}
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: '1fr 1fr',
                                gap: '1rem',
                                marginBottom: '2rem',
                                paddingBottom: '1.5rem',
                                borderBottom: '1px solid var(--border)'
                            }}>
                                <div>
                                    <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                                        Order Number
                                    </p>
                                    <p style={{ margin: '0.5rem 0 0 0', fontWeight: '600' }}>
                                        {selectedOrder.orderNumber}
                                    </p>
                                </div>
                                <div>
                                    <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                                        Order Date
                                    </p>
                                    <p style={{ margin: '0.5rem 0 0 0', fontWeight: '600' }}>
                                        {new Date(selectedOrder.createdAt).toLocaleString()}
                                    </p>
                                </div>
                            </div>

                            {/* Student Info */}
                            <div style={{ marginBottom: '2rem' }}>
                                <h3 style={{ margin: '0 0 1rem 0', fontSize: '1rem' }}>Student Information</h3>
                                {selectedOrder.student && (
                                    <div style={{
                                        background: 'var(--surface)',
                                        padding: '1rem',
                                        borderRadius: '0.5rem'
                                    }}>
                                        <p style={{ margin: '0.5rem 0', fontSize: '0.9rem' }}>
                                            <strong>Name:</strong> {selectedOrder.student.name}
                                        </p>
                                        <p style={{ margin: '0.5rem 0', fontSize: '0.9rem' }}>
                                            <strong>Roll No:</strong> {selectedOrder.student.rollNo}
                                        </p>
                                        <p style={{ margin: '0.5rem 0', fontSize: '0.9rem' }}>
                                            <strong>Email:</strong> {selectedOrder.student.email}
                                        </p>
                                        <p style={{ margin: '0.5rem 0', fontSize: '0.9rem' }}>
                                            <strong>Department:</strong> {selectedOrder.student.department}
                                        </p>
                                    </div>
                                )}
                            </div>

                            {/* Items */}
                            <div style={{ marginBottom: '2rem' }}>
                                <h3 style={{ margin: '0 0 1rem 0', fontSize: '1rem' }}>Items Ordered</h3>
                                {selectedOrder.items && selectedOrder.items.length > 0 ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                        {selectedOrder.items.map((item, idx) => (
                                            <div
                                                key={idx}
                                                style={{
                                                    display: 'flex',
                                                    justifyContent: 'space-between',
                                                    padding: '0.75rem',
                                                    background: 'var(--surface)',
                                                    borderRadius: '0.5rem'
                                                }}
                                            >
                                                <div>
                                                    <p style={{ margin: 0, fontWeight: '500' }}>
                                                        {item.productName}
                                                    </p>
                                                    <p style={{
                                                        margin: '0.25rem 0 0 0',
                                                        fontSize: '0.85rem',
                                                        color: 'var(--text-muted)'
                                                    }}>
                                                        Qty: {item.quantity} × ₹{item.price}
                                                    </p>
                                                </div>
                                                <p style={{
                                                    margin: 0,
                                                    fontWeight: '600',
                                                    color: 'var(--primary)'
                                                }}>
                                                    ₹{(item.subtotal || 0).toLocaleString()}
                                                </p>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p style={{ color: 'var(--text-muted)' }}>No items</p>
                                )}
                            </div>

                            {/* Order Summary */}
                            <div style={{
                                background: 'var(--surface)',
                                padding: '1rem',
                                borderRadius: '0.5rem',
                                marginBottom: '2rem'
                            }}>
                                <div style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    marginBottom: '0.75rem'
                                }}>
                                    <span>Subtotal:</span>
                                    <span>₹{(selectedOrder.totalAmount || 0).toLocaleString()}</span>
                                </div>
                                <div style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    paddingTop: '0.75rem',
                                    borderTop: '1px solid var(--border)',
                                    fontWeight: '600'
                                }}>
                                    <span>Total:</span>
                                    <span>₹{(selectedOrder.totalAmount || 0).toLocaleString()}</span>
                                </div>
                            </div>

                            {/* Status & Payment */}
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: '1fr 1fr',
                                gap: '1rem',
                                marginBottom: '2rem'
                            }}>
                                <div>
                                    <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                                        Order Status
                                    </p>
                                    <p style={{
                                        margin: '0.5rem 0',
                                        padding: '0.5rem 0.75rem',
                                        background: `${getStatusColor(selectedOrder.status)}20`,
                                        color: getStatusColor(selectedOrder.status),
                                        borderRadius: '0.25rem',
                                        fontWeight: '600',
                                        fontSize: '0.9rem'
                                    }}>
                                        {selectedOrder.status}
                                    </p>
                                </div>
                                <div>
                                    <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                                        Payment Status
                                    </p>
                                    <p style={{
                                        margin: '0.5rem 0',
                                        padding: '0.5rem 0.75rem',
                                        background: `${getPaymentColor(selectedOrder.paymentStatus)}20`,
                                        color: getPaymentColor(selectedOrder.paymentStatus),
                                        borderRadius: '0.25rem',
                                        fontWeight: '600',
                                        fontSize: '0.9rem'
                                    }}>
                                        {selectedOrder.paymentStatus}
                                    </p>
                                </div>
                            </div>

                            {/* Remarks */}
                            {selectedOrder.remarks && (
                                <div style={{
                                    background: '#FEF3C7',
                                    padding: '1rem',
                                    borderRadius: '0.5rem',
                                    marginBottom: '2rem',
                                    borderLeft: '4px solid #F59E0B'
                                }}>
                                    <p style={{ margin: '0 0 0.5rem 0', fontWeight: '600', color: '#92400E' }}>
                                        Remarks
                                    </p>
                                    <p style={{ margin: 0, fontSize: '0.9rem', color: '#92400E' }}>
                                        {selectedOrder.remarks}
                                    </p>
                                </div>
                            )}

                            {/* Close Button */}
                            <button
                                onClick={() => setShowDetailModal(false)}
                                className="btn btn-primary"
                                style={{ width: '100%' }}
                            >
                                Close
                            </button>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

export default AdminOrders;
