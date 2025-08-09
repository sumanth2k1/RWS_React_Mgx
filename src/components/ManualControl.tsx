import React, { useState, useEffect } from 'react';
import { Droplets, Power, Play, Square } from 'lucide-react';
import { useNotification } from '../context/NotificationContext';

interface ManualControlProps {
  deviceId: string;
  isOnline: boolean;
  currentStatus: string;
}

const ManualControl: React.FC<ManualControlProps> = ({ 
  deviceId, 
  isOnline, 
  currentStatus 
}) => {
  const [duration, setDuration] = useState(5000);
  const [isOperating, setIsOperating] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const { addNotification } = useNotification();

  // Countdown timer effect
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (countdown > 0) {
      interval = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            setIsOperating(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [countdown]);

  // Update countdown when pump status changes
  useEffect(() => {
    if (currentStatus === 'running' && !isOperating) {
      setIsOperating(true);
      // If we don't have a countdown running, start one with default duration
      if (countdown === 0) {
        setCountdown(Math.ceil(duration / 1000));
      }
    } else if (currentStatus === 'idle') {
      setIsOperating(false);
      setCountdown(0);
    }
  }, [currentStatus]);

  const waterNow = async () => {
    if (!isOnline) {
      addNotification('Device must be online to operate', 'error');
      return;
    }

    setIsOperating(true);

    try {
      const response = await fetch(`https://rws-backend-v2.onrender.com/api/devices/${deviceId}/water`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'water',
          duration: duration
        })
      });

      const data = await response.json();
      
      if (data.success) {
        addNotification(`Manual watering started (${(duration / 1000).toFixed(1)}s)`, 'success');
        
        // Start countdown timer
        setCountdown(Math.ceil(duration / 1000));
      } else {
        throw new Error(data.error || 'Failed to start watering');
      }
    } catch (error: any) {
      console.error('Manual watering failed:', error);
      addNotification(error.message || 'Failed to start watering', 'error');
      setIsOperating(false);
    }
  };

  const stopWatering = async () => {
    try {
      const response = await fetch(`https://rws-backend-v2.onrender.com/api/devices/${deviceId}/water`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'stop' })
      });

      const data = await response.json();
      
      if (data.success) {
        setIsOperating(false);
        setCountdown(0);
        addNotification('Watering stopped', 'info');
      } else {
        throw new Error(data.error || 'Failed to stop watering');
      }
    } catch (error: any) {
      console.error('Stop watering failed:', error);
      addNotification(error.message || 'Failed to stop watering', 'error');
    }
  };

  const isRunning = currentStatus === 'running' || isOperating;

  return (
    <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 hover:shadow-xl transition-shadow duration-200">
      <div className="flex items-center mb-6">
        <Power className="w-6 h-6 text-blue-500 mr-3" />
        <h2 className="text-xl font-semibold text-gray-900">Manual Control</h2>
      </div>

      {/* Status Display */}
      <div className={`p-6 rounded-xl text-center mb-6 transition-all duration-300 ${
        isRunning 
          ? 'bg-blue-100 text-blue-800 border-2 border-blue-200' 
          : 'bg-gray-100 text-gray-600 border-2 border-gray-200'
      }`}>
        <Droplets className={`w-8 h-8 mx-auto mb-3 ${isRunning ? 'animate-bounce text-blue-600' : 'text-gray-500'}`} />
        <div className="text-lg font-semibold mb-1">
          {isRunning ? 'Watering Active' : 'Pump Idle'}
        </div>
        {isRunning && countdown > 0 ? (
          <div className="text-sm opacity-75">
            <div className="text-2xl font-bold text-blue-700 mb-1">{countdown}s</div>
            <div>Time remaining</div>
          </div>
        ) : (
          <div className="text-sm opacity-75">
            {isRunning ? 'System is actively watering plants' : 'Ready for operation'}
          </div>
        )}
        {isRunning && (
          <div className="mt-2">
            <div className="w-full bg-blue-200 rounded-full h-2">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all duration-1000" 
                style={{ 
                  width: countdown > 0 ? `${(countdown / Math.ceil(duration / 1000)) * 100}%` : '100%' 
                }}
              ></div>
            </div>
          </div>
        )}
      </div>

      {/* Duration Control */}
      <div className="mb-6">
        <label className="block text-sm font-semibold text-gray-700 mb-3">
          Watering Duration
        </label>
        <input
          type="range"
          value={duration}
          onChange={(e) => setDuration(parseInt(e.target.value))}
          min="1000"
          max="60000"
          step="1000"
          className="w-full h-3 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
          disabled={isRunning}
        />
        <div className="flex justify-between text-xs text-gray-500 mt-2">
          <span>1s</span>
          <span className="font-semibold text-gray-700">{(duration / 1000).toFixed(1)} seconds</span>
          <span>60s</span>
        </div>
      </div>

      {/* Control Buttons */}
      <div className="space-y-3">
        {!isRunning ? (
          <button
            onClick={waterNow}
            disabled={!isOnline}
            className="w-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed text-white font-semibold py-4 px-6 rounded-xl transition-all duration-200 flex items-center justify-center shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 disabled:transform-none"
          >
            <Play className="w-5 h-5 mr-3" />
            Start Watering
          </button>
        ) : (
          <button
            onClick={stopWatering}
            className="w-full bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white font-semibold py-4 px-6 rounded-xl transition-all duration-200 flex items-center justify-center shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
          >
            <Square className="w-5 h-5 mr-3" />
            Stop Watering
          </button>
        )}

        {!isOnline && (
          <div className="text-center text-sm text-orange-600 bg-orange-50 py-3 px-4 rounded-xl border border-orange-200">
            Device must be online for manual control
          </div>
        )}
      </div>

      {/* Quick Duration Presets */}
      <div className="mt-6 pt-4 border-t border-gray-100">
        <div className="text-sm font-medium text-gray-700 mb-3">Quick Presets</div>
        <div className="grid grid-cols-3 gap-2">
          {[3000, 10000, 30000].map((preset) => (
            <button
              key={preset}
              onClick={() => setDuration(preset)}
              disabled={isRunning}
              className={`py-2 px-3 text-xs rounded-lg transition-colors border ${
                duration === preset
                  ? 'bg-blue-100 text-blue-700 border-blue-200'
                  : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {preset / 1000}s
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ManualControl;