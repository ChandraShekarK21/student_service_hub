import { useEffect, useState, useCallback, useRef } from 'react';
import io from 'socket.io-client';

const useSocket = () => {
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef(null);
  const [events, setEvents] = useState({
    newOrder: null,
    orderStatusChanged: null,
    stockUpdated: null,
    lowStockAlert: null
  });

  useEffect(() => {
    // Connect to socket.io server
    const socketUrl = import.meta.env.VITE_SOCKET_URL ||
      `${window.location.protocol}//${window.location.hostname}:5000`;
    const newSocket = io(socketUrl, {
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5
    });

    socketRef.current = newSocket;

    newSocket.on('connect', () => {
      console.log('✅ Admin connected to Socket.io');
      setIsConnected(true);
      // Join admin room
      newSocket.emit('join-admin-room');
    });

    // Listen for new orders
    newSocket.on('new-order', (data) => {
      console.log('🆕 New order received:', data);
      setEvents(prev => ({ ...prev, newOrder: data }));
    });

    // Listen for order status changes
    newSocket.on('order-status-changed', (data) => {
      console.log('📞 Order status changed:', data);
      setEvents(prev => ({ ...prev, orderStatusChanged: data }));
    });

    // Listen for stock updates
    newSocket.on('stock-updated', (data) => {
      console.log('📦 Stock updated:', data);
      setEvents(prev => ({ ...prev, stockUpdated: data }));
      
      // Emit low stock alert if inventory is below minimum
      if (data.isLowStock) {
        setEvents(prev => ({ ...prev, lowStockAlert: data }));
      }
    });

    // Listen for low stock alerts
    newSocket.on('low-stock-alert', (data) => {
      console.log('⚠️ Low stock alert:', data);
      setEvents(prev => ({ ...prev, lowStockAlert: data }));
    });

    newSocket.on('disconnect', () => {
      console.log('❌ Admin disconnected');
      setIsConnected(false);
    });

    newSocket.on('error', (error) => {
      console.error('Socket error:', error);
    });

    return () => {
      newSocket.disconnect();
    };
  }, []);

  return {
    socket: socketRef.current,
    isConnected,
    events,
    clearEvent: useCallback((eventName) => {
      setEvents(prev => ({ ...prev, [eventName]: null }));
    }, [])
  };
};

export default useSocket;
