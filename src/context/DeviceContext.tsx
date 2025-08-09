import React, { createContext, useContext, useState, ReactNode } from 'react';

interface Device {
  deviceId: string;
  status: string;
  pumpStatus: string;
  lastSeen: string;
  lastHeartbeat?: string;
  wsConnections?: number;
  ip?: string;
}

interface DeviceContextType {
  device: Device | null;
  fetchDevice: (deviceId: string) => Promise<void>;
  updateDevice: (updates: Partial<Device>) => void;
}

const DeviceContext = createContext<DeviceContextType | undefined>(undefined);

export const useDevice = () => {
  const context = useContext(DeviceContext);
  if (!context) {
    throw new Error('useDevice must be used within a DeviceProvider');
  }
  return context;
};

interface DeviceProviderProps {
  children: ReactNode;
}

export const DeviceProvider: React.FC<DeviceProviderProps> = ({ children }) => {
  const [device, setDevice] = useState<Device | null>(null);

  const fetchDevice = async (deviceId: string) => {
    try {
      const response = await fetch(`https://rws-backend-v2.onrender.com/api/devices/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          deviceId,
          ip: 'dashboard',
          timestamp: new Date().toISOString()
        })
      });

      const data = await response.json();
      
      if (data.success && data.device) {
        setDevice(data.device);
      } else {
        throw new Error(data.error || 'Failed to fetch device');
      }
    } catch (error) {
      console.error('Failed to fetch device:', error);
      throw error;
    }
  };

  const updateDevice = (updates: Partial<Device>) => {
    setDevice(prev => prev ? { ...prev, ...updates } : null);
  };

  return (
    <DeviceContext.Provider value={{ device, fetchDevice, updateDevice }}>
      {children}
    </DeviceContext.Provider>
  );
};