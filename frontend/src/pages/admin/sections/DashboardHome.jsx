import React, { useEffect, useState } from 'react';
import { PackageOpen, AlertCircle, CheckCircle, TrendingUp, AlertTriangle, Users, XCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { api } from '../../../services/api';

function AdminDashboardHome({ socketEvents = {} }) {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        fetchStats();
        const interval = setInterval(fetchStats, 30000); // Refresh every 30 seconds
        return () => clearInterval(interval);
    }, []);

    // Refresh stats when real-time events occur
    useEffect(() => {
        if (socketEvents.newOrder || socketEvents.orderStatusChanged || socketEvents.stockUpdated) {
            console.log('Real-time event detected, refreshing dashboard stats');
            fetchStats();
        }
    }, [socketEvents.newOrder, socketEvents.orderStatusChanged, socketEvents.stockUpdated]);

    const fetchStats = async () => {
        try {
            setLoading(true);
            const data = await api.getAdminStats();
            setStats(data);
            setError(null);
        } catch (err) {
            console.error('Error fetching stats:', err);
            setError('Failed to load dashboard statistics');
        } finally {
            setLoading(false);
        }
    };

    if (loading && !stats) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '300px' }}>
                <div style={{ textAlign: 'center' }}>
                    <p style={{ color: 'var(--text-muted)' }}>Loading dashboard...</p>
                </div>
            </div>
        );
    }

    if (error && !stats) {
        return (
            <div className="card" style={{ padding: '2rem', textAlign: 'center' }}>
                <AlertCircle size={32} color="#EF4444" style={{ marginBottom: '1rem' }} />
                <p style={{ color: 'var(--text-muted)' }}>{error}</p>
                <button className="btn btn-primary" onClick={fetchStats} style={{ marginTop: '1rem' }}>
                    Retry
                </button>
            </div>
        );
    }

    const summary = stats?.summary || {};
    const lowStockItems = stats?.lowStockItems || [];
    const topProducts = stats?.topProducts || [];
    const recentOrders = stats?.recentOrders || [];

    const statCards = [
        { label: 'Total Orders', value: summary.totalOrders, icon: PackageOpen, color: '#3B82F6' },
        { label: 'Pending Orders', value: summary.pendingOrders, icon: AlertCircle, color: '#F59E0B', subtext: 'Awaiting review' },
        { label: 'Processing', value: summary.processingOrders, icon: TrendingUp, color: '#8B5CF6', subtext: 'Being packed' },
        { label: 'Ready to Collect', value: summary.readyToCollect, icon: CheckCircle, color: '#10B981', subtext: 'Waiting pickup' },
        { label: 'Delivered', value: summary.deliveredOrders, icon: CheckCircle, color: '#06B6D4' },
        { label: 'Cancelled by User', value: summary.cancelledByUserOrders, icon: XCircle, color: '#EF4444' },
        { label: 'Total Revenue', value: `₹${(summary.totalRevenue || 0).toLocaleString()}`, icon: TrendingUp, color: '#EC4899', subtext: `Pending: ₹${(summary.pendingRevenue || 0).toLocaleString()}` }
    ];

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            {/* Summary Cards Grid */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: '1.5rem'
            }}>
                {statCards.map((card, index) => {
                    const IconComponent = card.icon;
                    return (
                        <motion.div
                            key={index}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.08 }}
                            className="card"
                            style={{
                                padding: '1.5rem',
                                borderTop: `4px solid ${card.color}`,
                                cursor: 'pointer'
                            }}
                            whileHover={{ translateY: -5 }}
                        >
                            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                                <div style={{ flex: 1 }}>
                                    <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                                        {card.label}
                                    </p>
                                    <p style={{
                                        margin: '0.5rem 0 0 0',
                                        fontSize: '1.875rem',
                                        fontWeight: 'bold',
                                        color: card.color
                                    }}>
                                        {card.value}
                                    </p>
                                    {card.subtext && (
                                        <p style={{
                                            margin: '0.5rem 0 0 0',
                                            fontSize: '0.75rem',
                                            color: 'var(--text-muted)'
                                        }}>
                                            {card.subtext}
                                        </p>
                                    )}
                                </div>
                                <div style={{
                                    width: '45px',
                                    height: '45px',
                                    borderRadius: '50%',
                                    background: `${card.color}15`,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    flexShrink: 0
                                }}>
                                    <IconComponent size={20} color={card.color} />
                                </div>
                            </div>
                        </motion.div>
                    );
                })}
            </div>

            {/* Two Column Layout */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                gap: '2rem'
            }}>
                {/* Top Products */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                    className="card"
                    style={{ padding: '1.5rem' }}
                >
                    <h3 style={{ marginTop: 0, marginBottom: '1.5rem', color: 'var(--text)' }}>
                        Top Products
                    </h3>
                    {topProducts.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            {topProducts.map((product, index) => (
                                <div
                                    key={index}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        padding: '1rem',
                                        background: 'var(--surface)',
                                        borderRadius: '0.5rem'
                                    }}
                                >
                                    <div
                                        style={{
                                            width: '35px',
                                            height: '35px',
                                            borderRadius: '50%',
                                            background: '#3B82F6',
                                            color: 'white',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            fontWeight: 'bold',
                                            marginRight: '1rem',
                                            flexShrink: 0
                                        }}
                                    >
                                        {index + 1}
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <p style={{ margin: 0, fontWeight: '500' }}>{product.productName}</p>
                                        <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                                            {product.sold} units sold
                                        </p>
                                    </div>
                                    <span style={{
                                        fontSize: '0.875rem',
                                        fontWeight: '600',
                                        color: '#10B981'
                                    }}>
                                        ₹{(product.totalRevenue || 0).toLocaleString()}
                                    </span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No sales data yet</p>
                    )}
                </motion.div>

                {/* Alerts & Notifications */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                    className="card"
                    style={{ padding: '1.5rem' }}
                >
                    <h3 style={{ marginTop: 0, marginBottom: '1.5rem', color: 'var(--text)' }}>
                        Alerts & Notifications
                    </h3>
                    {lowStockItems.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            {lowStockItems.map((item, index) => (
                                <div
                                    key={index}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        padding: '1rem',
                                        background: '#FEF3C7',
                                        borderRadius: '0.5rem',
                                        borderLeft: '4px solid #F59E0B'
                                    }}
                                >
                                    <AlertTriangle size={20} color="#F59E0B" style={{ marginRight: '0.75rem', flexShrink: 0 }} />
                                    <div style={{ flex: 1 }}>
                                        <p style={{ margin: 0, fontWeight: '500', fontSize: '0.9rem' }}>
                                            {item.name}
                                        </p>
                                        <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.8rem', color: '#92400E' }}>
                                            Only {item.stock} units in stock
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div style={{
                            padding: '1.5rem',
                            background: '#DBEAFE',
                            borderRadius: '0.5rem',
                            textAlign: 'center'
                        }}>
                            <CheckCircle size={32} color="#3B82F6" style={{ margin: '0 auto 0.5rem' }} />
                            <p style={{ margin: 0, fontWeight: '500', color: '#1E40AF' }}>
                                All stock levels are good!
                            </p>
                        </div>
                    )}
                </motion.div>
            </div>

            {/* Recent Orders */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
                className="card"
                style={{ padding: '1.5rem' }}
            >
                <h3 style={{ marginTop: 0, marginBottom: '1.5rem', color: 'var(--text)' }}>
                    Recent Orders
                </h3>
                {recentOrders.length > 0 ? (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{
                            width: '100%',
                            borderCollapse: 'collapse',
                            fontSize: '0.9rem'
                        }}>
                            <thead>
                                <tr style={{ borderBottom: '2px solid var(--border)' }}>
                                    <th style={{ textAlign: 'left', padding: '0.75rem', fontWeight: '600' }}>Order ID</th>
                                    <th style={{ textAlign: 'left', padding: '0.75rem', fontWeight: '600' }}>Student</th>
                                    <th style={{ textAlign: 'left', padding: '0.75rem', fontWeight: '600' }}>Amount</th>
                                    <th style={{ textAlign: 'left', padding: '0.75rem', fontWeight: '600' }}>Status</th>
                                    <th style={{ textAlign: 'left', padding: '0.75rem', fontWeight: '600' }}>Date</th>
                                </tr>
                            </thead>
                            <tbody>
                                {recentOrders.slice(0, 5).map((order) => (
                                    <tr key={order._id} style={{ borderBottom: '1px solid var(--border)' }}>
                                        <td style={{ padding: '0.75rem', fontWeight: '500' }}>
                                            {order.orderNumber}
                                        </td>
                                        <td style={{ padding: '0.75rem' }}>
                                            {order.studentId?.name || 'N/A'}
                                        </td>
                                        <td style={{ padding: '0.75rem', fontWeight: '500' }}>
                                            ₹{(order.totalPrice || 0).toLocaleString()}
                                        </td>
                                        <td style={{ padding: '0.75rem' }}>
                                            <span style={{
                                                display: 'inline-block',
                                                padding: '0.25rem 0.75rem',
                                                background: '#DBEAFE',
                                                color: '#1E40AF',
                                                borderRadius: '0.25rem',
                                                fontSize: '0.75rem',
                                                fontWeight: '600'
                                            }}>
                                                {order.status}
                                            </span>
                                        </td>
                                        <td style={{ padding: '0.75rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                                            {new Date(order.createdAt).toLocaleDateString()}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <p style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No recent orders</p>
                )}
            </motion.div>
        </div>
    );
}

export default AdminDashboardHome;
