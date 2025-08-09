import React, { useEffect, useState } from 'react';
import Header from './Header';
import DeviceStatus from './DeviceStatus';
import ManualControl from './ManualControl';
import ScheduleManager from './ScheduleManager';
import SystemStatus from './SystemStatus';
import NotificationCenter from './NotificationCenter';
import { useDevice } from '../context/DeviceContext';
import { useWebSocket } from '../context/WebSocketContext';
import { useNotification } from '../context/NotificationContext';

interface DashboardProps {
  deviceId: string;
  onLogout: () => void;
}

const Dashboard: React.FC<DashboardProps> = ({ deviceId, onLogout }) => {
  const { device, fetchDevice, updateDevice } = useDevice();
  const { 
    isConnected, 
    connect, 
    sendMessage, 
    lastMessage 
  } = useWebSocket();
  const { addNotification } = useNotification();
  
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize dashboard
  useEffect(() => {
    const initializeDashboard = async () => {
      try {
        // Fetch device data first
        await fetchDevice(deviceId);
        
        // Connect to WebSocket
        connect();
        
        setIsInitialized(true);
        addNotification('Dashboard initialized successfully', 'success');
      } catch (error) {
        console.error('Dashboard initialization error:', error);
        addNotification('Failed to initialize dashboard', 'error');
      }
    };

    initializeDashboard();
  }, [deviceId]);

  // Handle WebSocket messages
  useEffect(() => {
    if (lastMessage) {
      handleWebSocketMessage(lastMessage);
    }
  }, [lastMessage]);

  const handleWebSocketMessage = (message: any) => {
    const { type, data } = message;

    switch (type) {
      case 'device_connected':
        if (data.deviceId === deviceId) {
          updateDevice({ status: 'online' });
          addNotification(`Device ${deviceId} connected`, 'success');
        }
        break;
        
      case 'device_disconnected':
        if (data.deviceId === deviceId) {
          updateDevice({ status: 'offline', pumpStatus: 'idle' });
          addNotification(`Device ${deviceId} disconnected`, 'warning');
        }
        break;
        
      case 'pump_status_update':
        if (data.deviceId === deviceId) {
          updateDevice({ pumpStatus: data.status });
          addNotification(`Pump ${data.status}`, data.status === 'running' ? 'info' : 'success');
        }
        break;
        
      case 'schedule_executed':
        if (data.deviceId === deviceId) {
          addNotification(`Schedule executed (${(data.duration / 1000).toFixed(1)}s)`, 'success');
        }
        break;
        
      default:
        console.log('Unhandled message type:', type);
    }
  };

  if (!isInitialized) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <div className="text-xl font-semibold text-gray-700">Initializing Dashboard...</div>
          <div className="text-gray-500 mt-2">Connecting to device {deviceId}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50">
      <Header 
        deviceId={deviceId} 
        isOnline={device?.status === 'online'} 
        isWebSocketConnected={isConnected}
        onLogout={onLogout}
      />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <NotificationCenter />
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <DeviceStatus device={device} />
          <ManualControl 
            deviceId={deviceId} 
            isOnline={device?.status === 'online'}
            currentStatus={device?.pumpStatus || 'idle'}
          />
          <SystemStatus isConnected={isConnected} />
        </div>

        <ScheduleManager 
          deviceId={deviceId} 
          isOnline={device?.status === 'online'} 
        />
      </div>
    </div>
  );
};

export default Dashboard;