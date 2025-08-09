import React from 'react';
import { Activity, Clock, Wifi, HardDrive, Signal } from 'lucide-react';

interface Device {
  deviceId: string;
  status: string;
  pumpStatus: string;
  lastSeen: string;
  lastHeartbeat?: string;
  wsConnections?: number;
  ip?: string;
}

interface DeviceStatusProps {
  device: Device | null;
}

const DeviceStatus: React.FC<DeviceStatusProps> = ({ device }) => {
  const formatTimestamp = (timestamp: string) => {
    if (!timestamp) return 'Never';
    return new Date(timestamp).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online':
        return 'text-green-600 bg-green-100';
      case 'offline':
        return 'text-red-600 bg-red-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const getPumpStatusColor = (status: string) => {
    switch (status) {
      case 'running':
        return 'text-blue-600 bg-blue-100';
      case 'idle':
        return 'text-gray-600 bg-gray-100';
      default:
        return 'text-yellow-600 bg-yellow-100';
    }
  };

  if (!device) {
    return (
      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
        <div className="flex items-center mb-6">
          <Activity className="w-6 h-6 text-gray-400 mr-3" />
          <h2 className="text-xl font-semibold text-gray-900">Device Status</h2>
        </div>
        <div className="text-center py-8">
          <div className="w-12 h-12 border-4 border-gray-300 border-t-blue-500 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-500">Loading device information...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 hover:shadow-xl transition-shadow duration-200">
      <div className="flex items-center mb-6">
        <Activity className="w-6 h-6 text-blue-500 mr-3" />
        <h2 className="text-xl font-semibold text-gray-900">Device Status</h2>
      </div>

      <div className="space-y-4">
        {/* Connection Status */}
        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
          <div className="flex items-center">
            <Wifi className="w-5 h-5 text-gray-500 mr-3" />
            <span className="font-medium text-gray-700">Connection</span>
          </div>
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(device.status)}`}>
            {device.status.charAt(0).toUpperCase() + device.status.slice(1)}
          </span>
        </div>

        {/* Pump Status */}
        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
          <div className="flex items-center">
            <Activity className={`w-5 h-5 mr-3 ${device.pumpStatus === 'running' ? 'text-blue-500 animate-pulse' : 'text-gray-500'}`} />
            <span className="font-medium text-gray-700">Pump</span>
          </div>
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${getPumpStatusColor(device.pumpStatus)}`}>
            {device.pumpStatus === 'running' ? 'Running' : 'Idle'}
          </span>
        </div>

        {/* Last Seen */}
        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
          <div className="flex items-center">
            <Clock className="w-5 h-5 text-gray-500 mr-3" />
            <span className="font-medium text-gray-700">Last Seen</span>
          </div>
          <span className="text-sm text-gray-600">
            {formatTimestamp(device.lastSeen)}
          </span>
        </div>

        {/* Connection Count */}
        {device.wsConnections !== undefined && (
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
            <div className="flex items-center">
              <Signal className="w-5 h-5 text-gray-500 mr-3" />
              <span className="font-medium text-gray-700">Connections</span>
            </div>
            <span className="text-sm text-gray-600">
              {device.wsConnections} total
            </span>
          </div>
        )}

        {/* IP Address */}
        {device.ip && device.ip !== 'dashboard' && (
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
            <div className="flex items-center">
              <HardDrive className="w-5 h-5 text-gray-500 mr-3" />
              <span className="font-medium text-gray-700">IP Address</span>
            </div>
            <span className="text-sm text-gray-600 font-mono">
              {device.ip}
            </span>
          </div>
        )}
      </div>

      {/* Status Indicator */}
      <div className="mt-6 pt-4 border-t border-gray-100">
        <div className="flex items-center justify-center">
          <div className={`w-3 h-3 rounded-full mr-2 animate-pulse ${
            device.status === 'online' ? 'bg-green-500' : 'bg-red-500'
          }`}></div>
          <span className="text-sm text-gray-600">
            {device.status === 'online' ? 'Real-time monitoring active' : 'Waiting for device connection'}
          </span>
        </div>
      </div>
    </div>
  );
};

export default DeviceStatus;