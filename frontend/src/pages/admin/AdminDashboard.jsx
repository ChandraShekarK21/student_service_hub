import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, LayoutDashboard, Package, Bell, Warehouse, FileText, Settings } from 'lucide-react';
import { motion } from 'framer-motion';
import useSocket from '../../hooks/useSocket';
import { api } from '../../services/api';
import AdminDashboardHome from './sections/DashboardHome';
import AdminOrders from './sections/Orders';
import AdminNotifications from './sections/Notifications';
import AdminStock from './sections/Stock';
import AdminReports from './sections/Reports';
import AdminSettings from './sections/Settings';

function AdminDashboard() {
    const [adminUsername, setAdminUsername] = useState('');
    const [activeSection, setActiveSection] = useState('dashboard');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [unreadOrdersCount, setUnreadOrdersCount] = useState(0);
    const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0);
    const [lowStockCount, setLowStockCount] = useState(0);
    const navigate = useNavigate();
    const { isConnected, events } = useSocket();

    useEffect(() => {
        try {
            const token = localStorage.getItem('admin_token');
            const username = localStorage.getItem('admin_username');
            
            console.log('AdminDashboard - Token:', token ? 'exists' : 'missing');
            console.log('AdminDashboard - Username:', username);
            
            if (!token) {
                console.log('No token found, redirecting to login');
                navigate('/login');
                return;
            }
            
            setAdminUsername(username || 'Admin');
            setLoading(false);
        } catch (err) {
            console.error('Error in AdminDashboard useEffect:', err);
            setError(err.message);
        }
    }, [navigate]);

    useEffect(() => {
        let active = true;
        const refreshAdminBadges = async () => {
            try {
                const [notifications, stock] = await Promise.all([
                    api.getUnreadCount(),
                    api.getStockAnalytics()
                ]);
                if (!active) return;
                setUnreadNotificationsCount(notifications.unreadCount || 0);
                setLowStockCount((stock.lowStockItems?.length || 0) + (stock.outOfStockItems?.length || 0));
            } catch (err) {
                console.error('Error refreshing admin badges:', err);
            }
        };
        refreshAdminBadges();
        return () => { active = false; };
    }, [events.newOrder, events.lowStockAlert, events.stockUpdated]);

    // Log real-time events
    useEffect(() => {
        if (events.newOrder) {
            console.log('🆕 New order received in dashboard:', events.newOrder);
            setUnreadOrdersCount(prev => prev + 1);
        }
        if (events.orderStatusChanged) {
            console.log('📞 Order status changed:', events.orderStatusChanged);
        }
        if (events.stockUpdated) {
            console.log('📦 Stock updated:', events.stockUpdated);
        }
        if (events.lowStockAlert) {
            console.log('⚠️ Low stock alert:', events.lowStockAlert);
        }
    }, [events]);

    const handleLogout = () => {
        localStorage.removeItem('admin_token');
        localStorage.removeItem('admin_username');
        localStorage.removeItem('admin_auth');
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.assign('/');
    };

    if (error) {
        return (
            <div className="page" style={{ justifyContent: 'center', alignItems: 'center', background: '#ffbaba' }}>
                <div className="card" style={{ maxWidth: '500px', padding: '2rem', background: 'white' }}>
                    <h2 style={{ color: '#c1272d', marginBottom: '1rem' }}>Error</h2>
                    <p style={{ color: '#666', marginBottom: '1rem' }}>{error}</p>
                    <button className="btn btn-primary" onClick={() => window.location.href = '/login'}>
                        Go to Login
                    </button>
                </div>
            </div>
        );
    }

    if (loading) {
        return <div className="page" style={{ justifyContent: 'center', alignItems: 'center' }}><h2>Loading Admin Dashboard...</h2></div>;
    }

    const sections = [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { id: 'orders', label: 'Orders', icon: Package },
        { id: 'notifications', label: 'Notifications', icon: Bell },
        { id: 'stock', label: 'Stock', icon: Warehouse },
        { id: 'reports', label: 'Reports', icon: FileText },
        { id: 'settings', label: 'Settings', icon: Settings }
    ];

    const renderSection = () => {
        try {
            switch(activeSection) {
                case 'dashboard':
                    return <AdminDashboardHome socketEvents={events} />;
                case 'orders':
                    return <AdminOrders socketEvents={events} />;
                case 'notifications':
                    return <AdminNotifications socketEvents={events} onUnreadCountChange={setUnreadNotificationsCount} />;
                case 'stock':
                    return <AdminStock socketEvents={events} />;
                case 'reports':
                    return <AdminReports socketEvents={events} />;
                case 'settings':
                    return <AdminSettings socketEvents={events} />;
                default:
                    return <AdminDashboardHome socketEvents={events} />;
            }
        } catch (err) {
            console.error('Error rendering section:', err);
            return <div style={{ padding: '2rem', color: 'red' }}>Error loading section: {err.message}</div>;
        }
    };

    return (
        <div style={{ display: 'flex', height: '100vh', background: 'var(--surface)' }}>
            {/* Sidebar */}
            <motion.div
                initial={{ x: -250 }}
                animate={{ x: 0 }}
                style={{
                    width: '250px',
                    background: 'var(--primary)',
                    color: 'white',
                    padding: '2rem 1rem',
                    overflowY: 'auto',
                    boxShadow: '2px 0 10px rgba(0,0,0,0.1)',
                    display: 'flex',
                    flexDirection: 'column'
                }}
            >
                <h2 style={{ marginBottom: '2rem', fontSize: '1.2rem', fontWeight: 'bold' }}>Campus Admin</h2>
                
                <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>
                    {sections.map((section) => {
                        const IconComponent = section.icon;
                        let badge = 0;
                        if (section.id === 'orders') badge = unreadOrdersCount;
                        if (section.id === 'notifications') badge = unreadNotificationsCount;
                        if (section.id === 'stock') badge = lowStockCount;

                        return (
                            <button
                                key={section.id}
                                onClick={() => {
                                    setActiveSection(section.id);
                                    if (section.id === 'orders') setUnreadOrdersCount(0);
                                }}
                                style={{
                                    background: activeSection === section.id ? 'rgba(255,255,255,0.2)' : 'transparent',
                                    border: 'none',
                                    color: 'white',
                                    padding: '0.75rem 1rem',
                                    borderRadius: '0.5rem',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.75rem',
                                    fontSize: '0.9rem',
                                    transition: 'all 0.3s ease',
                                    textAlign: 'left',
                                    position: 'relative'
                                }}
                                className="btn"
                            >
                                <IconComponent size={20} />
                                <span style={{ flex: 1 }}>{section.label}</span>
                                {badge > 0 && (
                                    <span style={{
                                        background: '#EF4444',
                                        color: 'white',
                                        borderRadius: '50%',
                                        width: '24px',
                                        height: '24px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontSize: '0.75rem',
                                        fontWeight: 'bold'
                                    }}>
                                        {badge}
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </nav>

                {/* Logout Button */}
                <button
                    onClick={handleLogout}
                    style={{
                        background: 'rgba(255,255,255,0.2)',
                        border: 'none',
                        color: 'white',
                        padding: '0.75rem 1rem',
                        borderRadius: '0.5rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem',
                        fontSize: '0.9rem',
                        marginTop: 'auto',
                        width: '100%',
                        transition: 'all 0.3s ease'
                    }}
                    className="btn"
                >
                    <LogOut size={20} />
                    Logout
                </button>
            </motion.div>

            {/* Main Content */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '2rem', display: 'flex', flexDirection: 'column' }}>
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                    <h1 style={{ fontSize: '1.8rem', fontWeight: 'bold', color: 'var(--text)', margin: 0 }}>
                        {sections.find(s => s.id === activeSection)?.label || 'Dashboard'}
                    </h1>
                    <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                        Welcome, <strong>{adminUsername}</strong>
                    </div>
                </div>

                {/* Content Section */}
                <motion.div
                    key={activeSection}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.3 }}
                    style={{ flex: 1 }}
                >
                    {renderSection()}
                </motion.div>
            </div>
        </div>
    );
}

export default AdminDashboard;
