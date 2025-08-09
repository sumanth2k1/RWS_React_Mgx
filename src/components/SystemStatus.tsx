import React, { useState, useEffect } from 'react';
import { BarChart3, Globe, Users, Clock, RefreshCw } from 'lucide-react';

interface SystemStatusProps {
  isConnected: boolean;
}

const SystemStatus: React.FC<SystemStatusProps> = ({ isConnected }) => {
  const [systemData, setSystemData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const fetchSystemStatus = async () => {
    setLoading(true);
    try {
      const response = await fetch(`https://rws-backend-v2.onrender.com/health`);
      const data = await response.json();
      setSystemData(data);
    } catch (error) {
      console.error('Failed to fetch system status:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSystemStatus();
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchSystemStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  const formatUptime = (uptime: number) => {
    const hours = Math.floor(uptime / (1000 * 60 * 60));
    const minutes = Math.floor((uptime % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  return (
    <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 hover:shadow-xl transition-shadow duration-200">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <BarChart3 className="w-6 h-6 text-purple-500 mr-3" />
          <h2 className="text-xl font-semibold text-gray-900">System Status</h2>
        </div>
        <button
          onClick={fetchSystemStatus}
          disabled={loading}
          className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {systemData ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center p-4 bg-blue-50 rounded-xl">
              <Globe className="w-6 h-6 text-blue-500 mx-auto mb-2" />
              <div className="text-2xl font-bold text-blue-600">
                {systemData.devices?.online || 0}
              </div>
              <div className="text-sm text-gray-600">Online Devices</div>
            </div>

            <div className="text-center p-4 bg-green-50 rounded-xl">
              <Users className="w-6 h-6 text-green-500 mx-auto mb-2" />
              <div className="text-2xl font-bold text-green-600">
                {systemData.websocket?.connections || 0}
              </div>
              <div className="text-sm text-gray-600">Active Connections</div>
            </div>
          </div>

          <div className="p-4 bg-purple-50 rounded-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <Clock className="w-5 h-5 text-purple-500 mr-2" />
                <span className="font-medium text-gray-700">Uptime</span>
              </div>
              <span className="text-sm font-semibold text-purple-600">
                {systemData.uptime ? formatUptime(systemData.uptime) : 'Unknown'}
              </span>
            </div>
          </div>

          <div className="p-4 bg-gray-50 rounded-xl">
            <div className="text-center">
              <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                systemData.status === 'healthy'
                  ? 'bg-green-100 text-green-800'
                  : 'bg-red-100 text-red-800'
              }`}>
                <div className={`w-2 h-2 rounded-full mr-2 ${
                  systemData.status === 'healthy' ? 'bg-green-500' : 'bg-red-500'
                }`}></div>
                System {systemData.status || 'Unknown'}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center py-8">
          <div className="w-12 h-12 border-4 border-gray-300 border-t-purple-500 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-500">Loading system status...</p>
        </div>
      )}

      {/* Connection Status */}
      <div className="mt-6 pt-4 border-t border-gray-100">
        <div className="flex items-center justify-center">
          <div className={`w-3 h-3 rounded-full mr-2 animate-pulse ${
            isConnected ? 'bg-green-500' : 'bg-red-500'
          }`}></div>
          <span className="text-sm text-gray-600">
            WebSocket {isConnected ? 'Connected' : 'Disconnected'}
          </span>
        </div>
      </div>
    </div>
  );
};

export default SystemStatus;