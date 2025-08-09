import React from 'react';
import { Droplets, Wifi, WifiOff, Zap, LogOut, Settings } from 'lucide-react';

interface HeaderProps {
  deviceId: string;
  isOnline: boolean;
  isWebSocketConnected: boolean;
  onLogout: () => void;
}

const Header: React.FC<HeaderProps> = ({ 
  deviceId, 
  isOnline, 
  isWebSocketConnected, 
  onLogout 
}) => {
  return (
    <div className="bg-white shadow-lg border-b border-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center py-4">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-green-500 rounded-xl flex items-center justify-center mr-4 shadow-lg">
              <Droplets className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Smart Watering System</h1>
              <p className="text-sm text-gray-600 font-mono">Device: {deviceId}</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            {/* WebSocket Status */}
            <div className={`flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
              isWebSocketConnected 
                ? 'bg-green-100 text-green-800 shadow-sm' 
                : 'bg-red-100 text-red-800 shadow-sm'
            }`}>
              <Zap className={`w-4 h-4 mr-2 ${isWebSocketConnected ? 'animate-pulse' : ''}`} />
              Socket {isWebSocketConnected ? 'Connected' : 'Disconnected'}
            </div>

            {/* Device Status */}
            <div className={`flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
              isOnline 
                ? 'bg-green-100 text-green-800 shadow-sm' 
                : 'bg-red-100 text-red-800 shadow-sm'
            }`}>
              {isOnline ? (
                <Wifi className="w-4 h-4 mr-2 animate-pulse" />
              ) : (
                <WifiOff className="w-4 h-4 mr-2" />
              )}
              Device {isOnline ? 'Online' : 'Offline'}
            </div>

            {/* Settings */}
            <button className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors">
              <Settings className="w-5 h-5" />
            </button>

            {/* Logout */}
            <button
              onClick={onLogout}
              className="flex items-center px-4 py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Switch Device
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Header;