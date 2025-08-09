import React, { useState } from 'react';
import { Droplets, Wifi, AlertCircle, Loader, CheckCircle } from 'lucide-react';
import { useNotification } from '../context/NotificationContext';

interface DeviceAuthProps {
  onAuthenticated: (deviceId: string) => void;
}

const DeviceAuth: React.FC<DeviceAuthProps> = ({ onAuthenticated }) => {
  const [deviceId, setDeviceId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { addNotification } = useNotification();

  const validateDevice = async () => {
    if (!deviceId.trim()) {
      setError('Please enter a device ID');
      return;
    }

    if (deviceId.length < 3) {
      setError('Device ID must be at least 3 characters');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch(`https://rws-backend-v2.onrender.com/api/devices/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          deviceId: deviceId.trim().toUpperCase(),
          ip: 'dashboard',
          timestamp: new Date().toISOString()
        })
      });

      const data = await response.json();
      
      if (data.success) {
        addNotification(`Connected to device ${deviceId.toUpperCase()}`, 'success');
        onAuthenticated(deviceId.trim().toUpperCase());
      } else {
        throw new Error(data.error || 'Device validation failed');
      }
    } catch (error: any) {
      console.error('Device validation error:', error);
      if (error.message.includes('404') || error.message.includes('not found')) {
        setError('Device not found. Please check the device ID or make sure the device is registered.');
      } else if (error.message.includes('network') || error.message.includes('fetch')) {
        setError('Network error. Please check your internet connection and try again.');
      } else {
        setError('Failed to connect to device. Please try again.');
      }
      addNotification('Authentication failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      validateDevice();
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl p-8 border border-gray-100 relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-100 to-green-100 rounded-full transform translate-x-16 -translate-y-16 opacity-50"></div>
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-gradient-to-tr from-green-100 to-blue-100 rounded-full transform -translate-x-12 translate-y-12 opacity-50"></div>
        
        <div className="relative z-10">
          <div className="text-center mb-8">
            <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-green-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg">
              <Droplets className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-gray-800 mb-3">Smart Watering</h1>
            <p className="text-gray-600 text-lg">Enter your device ID to access the control dashboard</p>
          </div>

          <div className="space-y-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-3">
                Device ID
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={deviceId}
                  onChange={(e) => setDeviceId(e.target.value.toUpperCase())}
                  onKeyPress={handleKeyPress}
                  placeholder="Enter device ID (e.g., STRWSMK1)"
                  className="w-full px-4 py-4 pl-12 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 text-lg font-mono"
                  maxLength={20}
                />
                <Wifi className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              </div>
              <div className="flex justify-between text-xs text-gray-500 mt-2">
                <span>3-20 characters</span>
                <span>{deviceId.length}/20</span>
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border-2 border-red-200 text-red-700 px-4 py-4 rounded-xl text-sm flex items-start animate-pulse">
                <AlertCircle className="w-5 h-5 mr-3 mt-0.5 flex-shrink-0" />
                <div>
                  <div className="font-semibold mb-1">Authentication Error</div>
                  <div>{error}</div>
                </div>
              </div>
            )}

            <button
              onClick={validateDevice}
              disabled={loading || !deviceId.trim()}
              className="w-full bg-gradient-to-r from-blue-500 to-green-500 hover:from-blue-600 hover:to-green-600 disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed text-white font-semibold py-4 px-6 rounded-xl transition-all duration-200 flex items-center justify-center text-lg shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 disabled:transform-none"
            >
              {loading ? (
                <>
                  <Loader className="w-6 h-6 mr-3 animate-spin" />
                  Connecting...
                </>
              ) : (
                <>
                  <CheckCircle className="w-6 h-6 mr-3" />
                  Connect to Device
                </>
              )}
            </button>

            <div className="text-center">
              <div className="text-xs text-gray-500 space-y-1">
                <div>• Ensure your device is powered on and connected</div>
                <div>• Device ID is usually printed on the device label</div>
                <div>• Contact support if you need assistance</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DeviceAuth;