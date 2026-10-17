import React, { useCallback, useEffect, useState } from 'react';
import { BarChart3, TrendingUp, Download, Calendar, AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { api } from '../../../services/api';

function AdminReports({ socketEvents = {} }) {
    const [reportType, setReportType] = useState('sales');
    const [dateRange, setDateRange] = useState('month');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    
    // Sales data state
    const [salesData, setSalesData] = useState([]);
    const [topItems, setTopItems] = useState([]);
    const [reportData, setReportData] = useState({ items: [], summary: {} });
    
    // Computed metrics
    const [totalRevenue, setTotalRevenue] = useState(0);
    const [totalOrders, setTotalOrders] = useState(0);
    const [averageOrderValue, setAverageOrderValue] = useState(0);

    // Fetch sales data from API
    const fetchSalesData = useCallback(async () => {
        try {
            setLoading(true);
            const response = await api.getDailySalesData(dateRange);
            if (response && Array.isArray(response)) {
                setSalesData(response);
                
                // Compute metrics
                const revenue = response.reduce((sum, day) => sum + day.revenue, 0);
                const orders = response.reduce((sum, day) => sum + day.orders, 0);
                
                setTotalRevenue(revenue);
                setTotalOrders(orders);
                setAverageOrderValue(orders > 0 ? Math.round(revenue / orders) : 0);
            }
            setError(null);
        } catch (err) {
            console.error('Error fetching sales data:', err);
            setError('Failed to load sales data');
        } finally {
            setLoading(false);
        }
    }, [dateRange]);

    // Fetch top items data from API
    const fetchTopItems = useCallback(async () => {
        try {
            const response = await api.getTopSellingItems(5);
            if (response && response.items) {
                setTopItems(response.items);
            }
            setError(null);
        } catch (err) {
            console.error('Error fetching top items:', err);
            setError('Failed to load top items');
        }
    }, []);

    const fetchGeneralReport = useCallback(async () => {
        try {
            setLoading(true);
            setReportData(await api.getAdminReport(reportType, dateRange));
            setError(null);
        } catch (err) {
            console.error(`Error fetching ${reportType} report:`, err);
            setError(`Failed to load ${reportType} report`);
        } finally {
            setLoading(false);
        }
    }, [dateRange, reportType]);

    useEffect(() => {
        if (reportType === 'sales') {
            fetchSalesData();
            fetchTopItems();
        } else {
            fetchGeneralReport();
        }
    }, [reportType, dateRange, fetchSalesData, fetchTopItems, fetchGeneralReport]);

    // Real-time updates when orders change
    useEffect(() => {
        if (socketEvents?.newOrder || socketEvents?.orderStatusChanged || socketEvents?.orderCancelled) {
            console.log('Order event detected, refreshing reports...');
            // Debounce the refresh to avoid multiple calls
            const timer = setTimeout(() => {
                if (reportType === 'sales') {
                    fetchSalesData();
                    fetchTopItems();
                } else {
                    fetchGeneralReport();
                }
            }, 500);
            return () => clearTimeout(timer);
        }
    }, [socketEvents?.newOrder, socketEvents?.orderStatusChanged, socketEvents?.orderCancelled, reportType, dateRange, fetchSalesData, fetchTopItems, fetchGeneralReport]);

    const handleExportReport = () => {
        const rowsToExport = reportType === 'sales'
            ? salesData.map(day => [day.date, day.orders, day.revenue, day.avgOrderValue])
            : reportData.items || [];
        const headers = reportType === 'sales'
            ? ['Date', 'Orders', 'Revenue', 'Avg Order Value']
            : Object.keys(rowsToExport[0] || reportData.summary || {});
        
        const csvRows = rowsToExport.length
            ? rowsToExport.map(row => headers.map(header => JSON.stringify(row[header] ?? '')).join(','))
            : Object.entries(reportData.summary || {}).map(([key, value]) => `${JSON.stringify(key)},${JSON.stringify(value)}`);
        const csv = [headers.join(','), ...csvRows].join('\n');

        // Download
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${reportType}-report-${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
    };

    if (error) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div className="card" style={{
                    padding: '2rem',
                    border: '1px solid #EF4444',
                    background: '#FEE2E2',
                    borderRadius: '0.5rem'
                }}>
                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                        <AlertCircle size={24} color="#EF4444" style={{ flexShrink: 0 }} />
                        <div>
                            <h4 style={{ margin: 0, marginBottom: '0.5rem', color: '#DC2626' }}>Error Loading Reports</h4>
                            <p style={{ margin: 0, color: '#991B1B', fontSize: '0.9rem' }}>{error}</p>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* Report Controls */}
            <div className="card" style={{ padding: '1.5rem' }}>
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                    gap: '1rem'
                }}>
                    <div>
                        <label className="input-label">Report Type</label>
                        <select
                            className="input"
                            value={reportType}
                            onChange={(e) => setReportType(e.target.value)}
                        >
                            <option value="sales">Sales Report</option>
                            <option value="inventory">Inventory Report</option>
                            <option value="students">Students Report</option>
                            <option value="payments">Payments Report</option>
                        </select>
                    </div>

                    <div>
                        <label className="input-label">Date Range</label>
                        <select
                            className="input"
                            value={dateRange}
                            onChange={(e) => setDateRange(e.target.value)}
                        >
                            <option value="week">This Week</option>
                            <option value="month">This Month</option>
                            <option value="quarter">This Quarter</option>
                            <option value="year">This Year</option>
                        </select>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                        <button 
                            className="btn btn-primary" 
                            onClick={handleExportReport}
                            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
                        >
                            <Download size={18} /> Export Report
                        </button>
                    </div>
                </div>
            </div>

            {reportType === 'sales' ? (
            <>
            {/* Key Metrics */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '1.5rem'
            }}>
                <motion.div
                    className="card"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    style={{
                        padding: '1.5rem',
                        borderTop: '4px solid #3B82F6',
                        textAlign: 'center'
                    }}
                >
                    <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.875rem' }}>Total Revenue</p>
                    <p style={{ margin: '0.75rem 0 0 0', fontSize: '2rem', fontWeight: 'bold', color: '#3B82F6' }}>
                        {loading ? '...' : `₹${totalRevenue.toLocaleString()}`}
                    </p>
                </motion.div>

                <motion.div
                    className="card"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    style={{
                        padding: '1.5rem',
                        borderTop: '4px solid #10B981',
                        textAlign: 'center'
                    }}
                >
                    <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.875rem' }}>Total Orders</p>
                    <p style={{ margin: '0.75rem 0 0 0', fontSize: '2rem', fontWeight: 'bold', color: '#10B981' }}>
                        {loading ? '...' : totalOrders}
                    </p>
                </motion.div>

                <motion.div
                    className="card"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    style={{
                        padding: '1.5rem',
                        borderTop: '4px solid #F59E0B',
                        textAlign: 'center'
                    }}
                >
                    <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.875rem' }}>Average Order Value</p>
                    <p style={{ margin: '0.75rem 0 0 0', fontSize: '2rem', fontWeight: 'bold', color: '#F59E0B' }}>
                        {loading ? '...' : `₹${averageOrderValue}`}
                    </p>
                </motion.div>
            </div>

            {/* Sales Chart */}
            <div className="card" style={{ padding: '1.5rem' }}>
                <h3 style={{ marginTop: 0 }}>Daily Sales Trend</h3>
                {loading && salesData.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                        Loading sales data...
                    </div>
                ) : (
                    <div style={{
                        display: 'flex',
                        alignItems: 'flex-end',
                        gap: '0.75rem',
                        height: '200px',
                        padding: '1rem 0'
                    }}>
                        {salesData.length === 0 ? (
                            <div style={{ flex: 1, textAlign: 'center', color: 'var(--text-muted)' }}>
                                No data available for this period
                            </div>
                        ) : (
                            salesData.map((day, index) => {
                                const maxRevenue = Math.max(...salesData.map(d => d.revenue), 1);
                                return (
                                    <motion.div
                                        key={index}
                                        initial={{ height: 0 }}
                                        animate={{ height: `${(day.revenue / maxRevenue) * 100}%` }}
                                        transition={{ delay: index * 0.05 }}
                                        style={{
                                            flex: 1,
                                            background: '#3B82F6',
                                            borderRadius: '0.5rem 0.5rem 0 0',
                                            position: 'relative',
                                            cursor: 'pointer',
                                            transition: 'background 0.3s'
                                        }}
                                        onMouseEnter={(e) => e.currentTarget.style.background = '#1D4ED8'}
                                        onMouseLeave={(e) => e.currentTarget.style.background = '#3B82F6'}
                                        title={`${day.date}: ₹${day.revenue}`}
                                    />
                                );
                            })
                        )}
                    </div>
                )}
                {salesData.length > 0 && (
                    <div style={{
                        display: 'flex',
                        justifyContent: 'space-around',
                        fontSize: '0.75rem',
                        color: 'var(--text-muted)',
                        marginTop: '1rem',
                        flexWrap: 'wrap'
                    }}>
                        {salesData.map((day, index) => (
                            <span key={index}>{day.date}</span>
                        ))}
                    </div>
                )}
            </div>

            {/* Top Selling Items */}
            <div className="card" style={{ padding: '1.5rem' }}>
                <h3 style={{ marginTop: 0 }}>Top Selling Items</h3>
                {loading && topItems.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                        Loading top items...
                    </div>
                ) : topItems.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                        No order data available yet
                    </div>
                ) : (
                    <table style={{
                        width: '100%',
                        borderCollapse: 'collapse',
                        fontSize: '0.875rem'
                    }}>
                        <thead>
                            <tr style={{ borderBottom: '2px solid var(--border)' }}>
                                <th style={{ textAlign: 'left', padding: '0.75rem', fontWeight: '600' }}>Item</th>
                                <th style={{ textAlign: 'left', padding: '0.75rem', fontWeight: '600' }}>Units Sold</th>
                                <th style={{ textAlign: 'left', padding: '0.75rem', fontWeight: '600' }}>Revenue</th>
                                <th style={{ textAlign: 'left', padding: '0.75rem', fontWeight: '600' }}>Market Share</th>
                            </tr>
                        </thead>
                        <tbody>
                            {topItems.map((item, index) => (
                                <motion.tr
                                    key={item.productId}
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: index * 0.05 }}
                                    style={{ borderBottom: '1px solid var(--border)' }}
                                >
                                    <td style={{ padding: '0.75rem', fontWeight: '500' }}>{item.name}</td>
                                    <td style={{ padding: '0.75rem' }}>{item.unitsSold}</td>
                                    <td style={{ padding: '0.75rem', fontWeight: '500', color: '#10B981' }}>₹{item.revenue.toLocaleString()}</td>
                                    <td style={{ padding: '0.75rem' }}>
                                        <div style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.5rem'
                                        }}>
                                            <div style={{
                                                width: '60px',
                                                height: '6px',
                                                background: 'var(--border)',
                                                borderRadius: '3px',
                                                overflow: 'hidden'
                                            }}>
                                                <div style={{
                                                    width: `${item.marketShare}%`,
                                                    height: '100%',
                                                    background: '#3B82F6'
                                                }}></div>
                                            </div>
                                            <span style={{ fontSize: '0.75rem' }}>{item.marketShare}%</span>
                                        </div>
                                    </td>
                                </motion.tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
            </>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                        gap: '1rem'
                    }}>
                        {Object.entries(reportData.summary || {}).map(([label, value]) => (
                            <div className="card" key={label} style={{ padding: '1.25rem' }}>
                                <p style={{ margin: 0, color: 'var(--text-muted)', textTransform: 'capitalize' }}>
                                    {label.replace(/([A-Z])/g, ' $1')}
                                </p>
                                <strong style={{ display: 'block', marginTop: '0.5rem', fontSize: '1.5rem' }}>
                                    {typeof value === 'number' ? value.toLocaleString() : value}
                                </strong>
                            </div>
                        ))}
                    </div>
                    <div className="card" style={{ padding: '1.5rem', overflowX: 'auto' }}>
                        <h3 style={{ marginTop: 0, textTransform: 'capitalize' }}>{reportType} Details</h3>
                        {loading ? (
                            <p style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Loading report...</p>
                        ) : !reportData.items?.length ? (
                            <p style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No data available for this report.</p>
                        ) : (
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                                <thead>
                                    <tr style={{ borderBottom: '2px solid var(--border)' }}>
                                        {Object.keys(reportData.items[0]).map(key => (
                                            <th key={key} style={{ textAlign: 'left', padding: '0.75rem', textTransform: 'capitalize' }}>
                                                {key.replace(/([A-Z])/g, ' $1')}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {reportData.items.map((item, index) => (
                                        <tr key={item._id || item.rollNo || index} style={{ borderBottom: '1px solid var(--border)' }}>
                                            {Object.entries(item).map(([key, value]) => (
                                                <td key={key} style={{ padding: '0.75rem' }}>
                                                    {typeof value === 'number' ? value.toLocaleString() : String(value ?? '')}
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

export default AdminReports;
