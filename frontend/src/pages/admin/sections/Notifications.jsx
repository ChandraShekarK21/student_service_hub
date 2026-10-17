import React, { useEffect, useState } from 'react';
import { Bell, Trash2, CheckCircle, BarChart3, Package, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '../../../services/api';

function AdminNotifications({ socketEvents = {}, onUnreadCountChange = () => {} }) {
    const [notifications, setNotifications] = useState([]);
    const [filteredNotifications, setFilteredNotifications] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [filter, setFilter] = useState('all');
    const [unreadCount, setUnreadCount] = useState(0);

    useEffect(() => {
        fetchNotifications();
    }, []);

    useEffect(() => {
        applyFilter();
    }, [notifications, filter]);

    // Real-time socket.io event listeners
    useEffect(() => {
        if (socketEvents.newOrder) {
            // New order received - increment unread count
            setUnreadCount(prev => Math.max(0, prev + 1));
            fetchNotifications();
        }
    }, [socketEvents.newOrder]);

    useEffect(() => {
        if (socketEvents.lowStockAlert) {
            // Low stock alert - increment unread count
            setUnreadCount(prev => Math.max(0, prev + 1));
            fetchNotifications();
        }
    }, [socketEvents.lowStockAlert]);

    const fetchNotifications = async () => {
        try {
            setLoading(true);
            const data = await api.getAdminNotifications();
            setNotifications(Array.isArray(data) ? data : []);
            
            // Count unread
            const unread = (Array.isArray(data) ? data : []).filter(n => !n.read).length;
            setUnreadCount(unread);
            onUnreadCountChange(unread);
            setError(null);
        } catch (err) {
            console.error('Error fetching notifications:', err);
            setNotifications([]);
            setError('Failed to load notifications. Please retry.');
        } finally {
            setLoading(false);
        }
    };

    const applyFilter = () => {
        let filtered = notifications;

        if (filter === 'unread') {
            filtered = filtered.filter(n => !n.read);
        } else if (filter === 'orders') {
            filtered = filtered.filter(n => n.type?.includes('order'));
        } else if (filter === 'stock') {
            filtered = filtered.filter(n => n.type?.includes('stock'));
        }

        setFilteredNotifications([...filtered].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
    };

    const handleMarkAsRead = async (notificationId) => {
        try {
            await api.markNotificationRead(notificationId);
            setNotifications(notifications.map(n =>
                n._id === notificationId ? { ...n, read: true, readAt: new Date() } : n
            ));
            const nextUnread = Math.max(0, unreadCount - 1);
            setUnreadCount(nextUnread);
            onUnreadCountChange(nextUnread);
        } catch (err) {
            console.error('Error marking notification:', err);
        }
    };

    const handleMarkAllAsRead = async () => {
        try {
            await api.markAllNotificationsRead();
            setNotifications(notifications.map(n => ({ ...n, read: true, readAt: new Date() })));
            setUnreadCount(0);
            onUnreadCountChange(0);
        } catch (err) {
            console.error('Error marking all notifications:', err);
        }
    };

    const handleDelete = async (notificationId) => {
        try {
            const removedNotification = notifications.find(n => n._id === notificationId);
            await api.deleteNotification(notificationId);
            const remaining = notifications.filter(n => n._id !== notificationId);
            setNotifications(remaining);
            if (removedNotification && !removedNotification.read) {
                const nextUnread = Math.max(0, unreadCount - 1);
                setUnreadCount(nextUnread);
                onUnreadCountChange(nextUnread);
            }
        } catch (err) {
            console.error('Error deleting notification:', err);
        }
    };  

    const getNotificationIcon = (type) => {
        if (type?.includes('order')) return <Package size={20} color="#3B82F6" />;
        if (type?.includes('stock')) return <AlertCircle size={20} color="#F59E0B" />;
        return <Bell size={20} color="#6B7280" />;
    };

    const getNotificationColor = (type) => {
        if (type?.includes('order')) return '#DBEAFE';
        if (type?.includes('stock')) return '#FEF3C7';
        return '#F3F4F6';
    };

    const getNotificationBorderColor = (type) => {
        if (type?.includes('order')) return '#3B82F6';
        if (type?.includes('stock')) return '#F59E0B';
        return '#D1D5DB';
    };

    if (loading && notifications.length === 0) {
        return (
            <div className="card" style={{ padding: '2rem', textAlign: 'center' }}>
                <p style={{ color: 'var(--text-muted)' }}>Loading notifications...</p>
            </div>
        );
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* Header with Actions */}
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="card"
                style={{ padding: '1.5rem' }}
            >
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '1rem'
                }}>
                    <div>
                        <h3 style={{ margin: 0, marginBottom: '0.25rem' }}>Notifications</h3>
                        <p style={{
                            margin: 0,
                            fontSize: '0.875rem',
                            color: 'var(--text-muted)'
                        }}>
                            {unreadCount} unread • {notifications.length} total
                        </p>
                    </div>

                    {unreadCount > 0 && (
                        <button
                            onClick={handleMarkAllAsRead}
                            className="btn btn-sm"
                            style={{
                                background: 'var(--primary)',
                                color: 'white',
                                border: 'none'
                            }}
                        >
                            Mark all as read
                        </button>
                    )}
                </div>
            </motion.div>

            {/* Filters */}
            {error && (
                <div className="card" role="alert" style={{ padding: '1rem', color: '#B91C1C', background: '#FEE2E2' }}>
                    <AlertCircle size={18} style={{ verticalAlign: 'middle', marginRight: '0.5rem' }} />
                    {error}
                    <button className="btn btn-sm" onClick={fetchNotifications} style={{ marginLeft: '1rem' }}>Retry</button>
                </div>
            )}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                style={{
                    display: 'flex',
                    gap: '0.75rem',
                    flexWrap: 'wrap'
                }}
            >
                {[
                    { value: 'all', label: 'All', icon: Bell },
                    { value: 'unread', label: 'Unread', icon: AlertCircle },
                    { value: 'orders', label: 'Orders', icon: Package },
                    { value: 'stock', label: 'Stock', icon: BarChart3 }
                ].map(item => (
                    <button
                        key={item.value}
                        onClick={() => setFilter(item.value)}
                        style={{
                            padding: '0.5rem 1rem',
                            border: filter === item.value ? '2px solid var(--primary)' : '1px solid var(--border)',
                            background: filter === item.value ? 'var(--primary)15' : 'transparent',
                            color: filter === item.value ? 'var(--primary)' : 'var(--text)',
                            borderRadius: '0.5rem',
                            cursor: 'pointer',
                            fontWeight: '500',
                            fontSize: '0.9rem',
                            transition: 'all 0.2s'
                        }}
                    >
                        <item.icon size={16} style={{ display: 'inline-block', marginRight: '0.5rem' }} />
                        {item.label}
                    </button>
                ))}
            </motion.div>

            {/* Notifications List with Categories */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
            >
                {filteredNotifications.length === 0 ? (
                    <div className="card" style={{
                        padding: '3rem',
                        textAlign: 'center'
                    }}>
                        <Bell size={48} style={{
                            margin: '0 auto 1rem',
                            color: 'var(--text-muted)',
                            opacity: 0.3
                        }} />
                        <p style={{
                            margin: 0,
                            fontSize: '1.1rem',
                            color: 'var(--text-muted)'
                        }}>
                            No notifications
                        </p>
                        {filter !== 'all' && (
                            <button
                                onClick={() => setFilter('all')}
                                className="btn btn-sm"
                                style={{
                                    marginTop: '1rem',
                                    background: 'var(--primary)',
                                    color: 'white',
                                    border: 'none'
                                }}
                            >
                                View all notifications
                            </button>
                        )}
                    </div>
                ) : (
                    <div>
                        {/* Order Notifications Section */}
                        {filteredNotifications.some(n => n.type?.includes('order')) && (
                            <div style={{ marginBottom: '2rem' }}>
                                <h3 style={{ margin: '0 0 1rem 0', color: '#3B82F6', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <Package size={20} /> Order Notifications
                                </h3>
                                <AnimatePresence>
                                    {filteredNotifications.filter(n => n.type?.includes('order')).map((notification, index) => (
                                        <motion.div
                                            key={notification._id}
                                            initial={{ opacity: 0, x: -20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            exit={{ opacity: 0, x: -20 }}
                                            transition={{ delay: index * 0.05 }}
                                            className="card"
                                            style={{
                                                padding: '1.5rem',
                                                marginBottom: '1rem',
                                                borderLeft: '4px solid #3B82F6',
                                                background: '#DBEAFE',
                                                opacity: notification.read ? 0.7 : 1
                                            }}
                                        >
                                            <div style={{
                                                display: 'flex',
                                                alignItems: 'flex-start',
                                                gap: '1rem'
                                            }}>
                                                <div style={{ flexShrink: 0, marginTop: '0.25rem' }}>
                                                    <Package size={20} color="#3B82F6" />
                                                </div>
                                                <div style={{ flex: 1 }}>
                                                    <h4 style={{
                                                        margin: 0,
                                                        marginBottom: '0.25rem',
                                                        fontSize: '1rem',
                                                        fontWeight: '600'
                                                    }}>
                                                        {notification.title}
                                                    </h4>
                                                    <p style={{
                                                        margin: '0.5rem 0 0 0',
                                                        fontSize: '0.9rem',
                                                        color: 'var(--text)',
                                                        lineHeight: '1.5'
                                                    }}>
                                                        {notification.message}
                                                    </p>
                                                    <p style={{
                                                        margin: '0.75rem 0 0 0',
                                                        fontSize: '0.8rem',
                                                        color: 'var(--text-muted)'
                                                    }}>
                                                        {new Date(notification.createdAt).toLocaleString()}
                                                    </p>
                                                </div>
                                                <div style={{
                                                    display: 'flex',
                                                    gap: '0.5rem',
                                                    flexShrink: 0
                                                }}>
                                                    {!notification.read && (
                                                        <button
                                                            onClick={() => handleMarkAsRead(notification._id)}
                                                            style={{
                                                                background: 'transparent',
                                                                border: 'none',
                                                                cursor: 'pointer',
                                                                color: 'var(--primary)',
                                                                padding: '0.5rem',
                                                                borderRadius: '0.25rem',
                                                                transition: 'all 0.2s'
                                                            }}
                                                            onMouseEnter={(e) => e.target.style.background = 'var(--primary)20'}
                                                            onMouseLeave={(e) => e.target.style.background = 'transparent'}
                                                            title="Mark as read"
                                                        >
                                                            <CheckCircle size={20} />
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={() => handleDelete(notification._id)}
                                                        style={{
                                                            background: 'transparent',
                                                            border: 'none',
                                                            cursor: 'pointer',
                                                            color: '#EF4444',
                                                            padding: '0.5rem',
                                                            borderRadius: '0.25rem',
                                                            transition: 'all 0.2s'
                                                        }}
                                                        onMouseEnter={(e) => e.target.style.background = '#EF444420'}
                                                        onMouseLeave={(e) => e.target.style.background = 'transparent'}
                                                        title="Delete"
                                                    >
                                                        <Trash2 size={20} />
                                                    </button>
                                                </div>
                                            </div>
                                        </motion.div>
                                    ))}
                                </AnimatePresence>
                            </div>
                        )}

                        {/* Stock Alerts Section */}
                        {filteredNotifications.some(n => n.type?.includes('stock')) && (
                            <div>
                                <h3 style={{ margin: '0 0 1rem 0', color: '#F59E0B', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <BarChart3 size={20} /> Stock Alerts
                                </h3>
                                <AnimatePresence>
                                    {filteredNotifications.filter(n => n.type?.includes('stock')).map((notification, index) => (
                                        <motion.div
                                            key={notification._id}
                                            initial={{ opacity: 0, x: -20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            exit={{ opacity: 0, x: -20 }}
                                            transition={{ delay: index * 0.05 }}
                                            className="card"
                                            style={{
                                                padding: '1.5rem',
                                                marginBottom: '1rem',
                                                borderLeft: '4px solid #F59E0B',
                                                background: '#FEF3C7',
                                                opacity: notification.read ? 0.7 : 1
                                            }}
                                        >
                                            <div style={{
                                                display: 'flex',
                                                alignItems: 'flex-start',
                                                gap: '1rem'
                                            }}>
                                                <div style={{ flexShrink: 0, marginTop: '0.25rem' }}>
                                                    <AlertCircle size={20} color="#F59E0B" />
                                                </div>
                                                <div style={{ flex: 1 }}>
                                                    <h4 style={{
                                                        margin: 0,
                                                        marginBottom: '0.25rem',
                                                        fontSize: '1rem',
                                                        fontWeight: '600'
                                                    }}>
                                                        {notification.title}
                                                    </h4>
                                                    <p style={{
                                                        margin: '0.5rem 0 0 0',
                                                        fontSize: '0.9rem',
                                                        color: 'var(--text)',
                                                        lineHeight: '1.5'
                                                    }}>
                                                        {notification.message}
                                                    </p>
                                                    <p style={{
                                                        margin: '0.75rem 0 0 0',
                                                        fontSize: '0.8rem',
                                                        color: 'var(--text-muted)'
                                                    }}>
                                                        {new Date(notification.createdAt).toLocaleString()}
                                                    </p>
                                                </div>
                                                <div style={{
                                                    display: 'flex',
                                                    gap: '0.5rem',
                                                    flexShrink: 0
                                                }}>
                                                    {!notification.read && (
                                                        <button
                                                            onClick={() => handleMarkAsRead(notification._id)}
                                                            style={{
                                                                background: 'transparent',
                                                                border: 'none',
                                                                cursor: 'pointer',
                                                                color: 'var(--primary)',
                                                                padding: '0.5rem',
                                                                borderRadius: '0.25rem',
                                                                transition: 'all 0.2s'
                                                            }}
                                                            onMouseEnter={(e) => e.target.style.background = 'var(--primary)20'}
                                                            onMouseLeave={(e) => e.target.style.background = 'transparent'}
                                                            title="Mark as read"
                                                        >
                                                            <CheckCircle size={20} />
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={() => handleDelete(notification._id)}
                                                        style={{
                                                            background: 'transparent',
                                                            border: 'none',
                                                            cursor: 'pointer',
                                                            color: '#EF4444',
                                                            padding: '0.5rem',
                                                            borderRadius: '0.25rem',
                                                            transition: 'all 0.2s'
                                                        }}
                                                        onMouseEnter={(e) => e.target.style.background = '#EF444420'}
                                                        onMouseLeave={(e) => e.target.style.background = 'transparent'}
                                                        title="Delete"
                                                    >
                                                        <Trash2 size={20} />
                                                    </button>
                                                </div>
                                            </div>
                                        </motion.div>
                                    ))}
                                </AnimatePresence>
                            </div>
                        )}
                    </div>
                )}
            </motion.div>
        </div>
    );
}

export default AdminNotifications;
