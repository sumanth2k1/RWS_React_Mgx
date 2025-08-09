import React, { useState, useEffect } from 'react';
import { Clock, Plus, Trash2, RefreshCw, Bell, Calendar } from 'lucide-react';
import { useNotification } from '../context/NotificationContext';

interface Alarm {
  _id: string;
  deviceId: string;
  time: string; // HH:MM format
  duration: number;
  days: string[]; // ['monday', 'tuesday', etc.]
  status: string;
  name: string;
  createdAt: string;
  isActive: boolean;
}

interface AlarmManagerProps {
  deviceId: string;
  isOnline: boolean;
}

const AlarmManager: React.FC<AlarmManagerProps> = ({ deviceId, isOnline }) => {
  const [alarms, setAlarms] = useState<Alarm[]>([]);
  const [loading, setLoading] = useState(false);
  const [newAlarm, setNewAlarm] = useState({
    name: '',
    time: '',
    duration: 5000,
    days: [] as string[]
  });
  const { addNotification } = useNotification();

  const daysOfWeek = [
    { key: 'monday', label: 'Mon' },
    { key: 'tuesday', label: 'Tue' },
    { key: 'wednesday', label: 'Wed' },
    { key: 'thursday', label: 'Thu' },
    { key: 'friday', label: 'Fri' },
    { key: 'saturday', label: 'Sat' },
    { key: 'sunday', label: 'Sun' }
  ];

  useEffect(() => {
    fetchAlarms();
  }, [deviceId]);

  const fetchAlarms = async () => {
    setLoading(true);
    try {
      const response = await fetch(`https://rws-backend-v2.onrender.com/api/devices/${deviceId}/schedules`);
      const data = await response.json();
      // Check if response is ok and is JSON
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }
      
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const responseText = await response.text();
        throw new Error(`Expected JSON response but got: ${contentType}. Response: ${responseText.substring(0, 200)}`);
      }
      
      if (data.success) {
        // Convert schedules to the alarm format for compatibility with UI
        const formattedAlarms = (data.schedules || []).map((schedule: any) => {
          // Extract time from ISO string
          const scheduleTime = new Date(schedule.time);
          const hours = String(scheduleTime.getHours()).padStart(2, '0');
          const minutes = String(scheduleTime.getMinutes()).padStart(2, '0');
          
          return {
            _id: schedule.id,
            deviceId: deviceId,
            time: `${hours}:${minutes}`,
            duration: schedule.duration,
            days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'], // Default to every day
            status: schedule.status,
            name: `Watering at ${hours}:${minutes}`,
            createdAt: schedule.createdAt || new Date().toISOString(),
            isActive: schedule.status === 'pending'
          };
        });
        
        setAlarms(formattedAlarms);
      } else {
        throw new Error(data.error || 'Failed to fetch alarms');
      }
    } catch (error: any) {
      console.error('Failed to fetch alarms:', error);
      addNotification(`Failed to fetch alarms: ${error.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const createAlarm = async () => {
    if (!newAlarm.name.trim()) {
      addNotification('Please enter an alarm name', 'error');
      return;
    }

    if (!newAlarm.time) {
      addNotification('Please select a time', 'error');
      return;
    }

    if (newAlarm.days.length === 0) {
      addNotification('Please select at least one day', 'error');
      return;
    }

    try {
      // Convert the alarm time to a Date object using the next occurrence of that time
      const [hours, minutes] = newAlarm.time.split(':');
      const alarmTime = new Date();
      alarmTime.setHours(parseInt(hours, 10), parseInt(minutes, 10), 0, 0);
      
      // If time is already past for today, schedule for tomorrow
      if (alarmTime < new Date()) {
        alarmTime.setDate(alarmTime.getDate() + 1);
      }

      const response = await fetch(`https://rws-backend-v2.onrender.com/api/schedules`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId,
          time: alarmTime.toISOString(),
          duration: parseInt(newAlarm.duration.toString())
        })
      });

      const data = await response.json();
      
      if (data.success) {
        addNotification('Alarm created successfully', 'success');
        setNewAlarm({ name: '', time: '', duration: 5000, days: [] });
        fetchAlarms();
      } else {
        throw new Error(data.error || 'Failed to create alarm');
      }
    } catch (error: any) {
      console.error('Failed to create alarm:', error);
      addNotification(error.message || 'Failed to create alarm', 'error');
    }
  };

  // Note: There's no toggle function in the backend API, so we'll skip this functionality
  const toggleAlarm = async (alarmId: string, isActive: boolean) => {
    try {
      // Since there's no endpoint to toggle schedules, we'll just delete and recreate if needed
      addNotification(`This functionality is not supported with the current backend API`, 'warning');
      
      // Refresh the alarms/schedules list
      fetchAlarms();
      
    } catch (error: any) {
      console.error('Failed to toggle alarm:', error);
      addNotification(error.message || 'Failed to toggle alarm', 'error');
    }
  };

  const deleteAlarm = async (alarmId: string) => {
    try {
      // There's no specific DELETE endpoint for schedules, so we'll just refresh the view
      // In a production app, we'd implement proper deletion functionality
      addNotification('Alarm deletion is not supported with the current backend API', 'warning');
      
      // Refresh the list to show updated state from server
      fetchAlarms();
    } catch (error: any) {
      console.error('Failed to delete alarm:', error);
      addNotification(error.message || 'Failed to delete alarm', 'error');
    }
  };

  const toggleDay = (day: string) => {
    setNewAlarm(prev => ({
      ...prev,
      days: prev.days.includes(day) 
        ? prev.days.filter(d => d !== day)
        : [...prev.days, day]
    }));
  };

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  const formatDays = (days: string[]) => {
    if (days.length === 7) return 'Every day';
    if (days.length === 5 && !days.includes('saturday') && !days.includes('sunday')) {
      return 'Weekdays';
    }
    if (days.length === 2 && days.includes('saturday') && days.includes('sunday')) {
      return 'Weekends';
    }
    return days.map(day => day.charAt(0).toUpperCase() + day.slice(1, 3)).join(', ');
  };

  return (
    <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-gray-100 bg-gradient-to-r from-purple-50 to-blue-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <Bell className="w-6 h-6 text-purple-500 mr-3" />
            <h2 className="text-xl font-semibold text-gray-900">Watering Alarms</h2>
          </div>
          <button
            onClick={fetchAlarms}
            disabled={loading}
            className="flex items-center px-3 py-2 text-sm text-purple-600 hover:text-purple-800 hover:bg-purple-100 rounded-lg transition-colors"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      <div className="p-6">
        {/* Create New Alarm */}
        <div className="mb-8 p-6 bg-gray-50 rounded-xl">
          <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
            <Plus className="w-5 h-5 mr-2" />
            Create New Alarm
          </h3>
          
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Alarm Name</label>
                <input
                  type="text"
                  value={newAlarm.name}
                  onChange={(e) => setNewAlarm({...newAlarm, name: e.target.value})}
                  placeholder="e.g., Morning Watering"
                  className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Time</label>
                <input
                  type="time"
                  value={newAlarm.time}
                  onChange={(e) => setNewAlarm({...newAlarm, time: e.target.value})}
                  className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Duration</label>
              <select
                value={newAlarm.duration}
                onChange={(e) => setNewAlarm({...newAlarm, duration: parseInt(e.target.value)})}
                className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                <option value={3000}>3 seconds</option>
                <option value={5000}>5 seconds</option>
                <option value={10000}>10 seconds</option>
                <option value={30000}>30 seconds</option>
                <option value={60000}>1 minute</option>
                <option value={120000}>2 minutes</option>
                <option value={300000}>5 minutes</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">Repeat Days</label>
              <div className="flex flex-wrap gap-2">
                {daysOfWeek.map((day) => (
                  <button
                    key={day.key}
                    onClick={() => toggleDay(day.key)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      newAlarm.days.includes(day.key)
                        ? 'bg-purple-500 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    {day.label}
                  </button>
                ))}
              </div>
              <div className="mt-2 text-xs text-gray-500">
                Selected: {newAlarm.days.length > 0 ? formatDays(newAlarm.days) : 'None'}
              </div>
            </div>

            <button
              onClick={createAlarm}
              className="w-full bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200 flex items-center justify-center shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
            >
              <Plus className="w-5 h-5 mr-2" />
              Create Alarm
            </button>

            {!isOnline && (
              <div className="text-center text-sm text-orange-600 bg-orange-50 py-3 px-4 rounded-lg border border-orange-200">
                Alarms can be created offline but won't trigger until device is online
              </div>
            )}
          </div>
        </div>

        {/* Alarms List */}
        <div>
          <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
            <Clock className="w-5 h-5 mr-2" />
            Your Alarms ({alarms.length})
          </h3>

          {loading ? (
            <div className="text-center py-8">
              <div className="w-8 h-8 border-4 border-gray-300 border-t-purple-500 rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-gray-500">Loading alarms...</p>
            </div>
          ) : alarms.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Bell className="w-16 h-16 mx-auto mb-4 opacity-30" />
              <p className="text-lg font-medium mb-2">No alarms set</p>
              <p className="text-sm">Create your first watering alarm above</p>
            </div>
          ) : (
            <div className="space-y-3">
              {alarms.map((alarm) => (
                <div
                  key={alarm._id}
                  className={`p-4 rounded-xl border-2 transition-all duration-200 ${
                    alarm.isActive 
                      ? 'bg-purple-50 border-purple-200 hover:bg-purple-100' 
                      : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center mb-2">
                        <div className={`w-3 h-3 rounded-full mr-3 ${
                          alarm.isActive ? 'bg-purple-500 animate-pulse' : 'bg-gray-400'
                        }`}></div>
                        <h4 className="font-semibold text-gray-900">{alarm.name}</h4>
                      </div>
                      <div className="text-2xl font-bold text-purple-600 mb-1">
                        {formatTime(alarm.time)}
                      </div>
                      <div className="text-sm text-gray-600 mb-1">
                        {formatDays(alarm.days)}
                      </div>
                      <div className="text-xs text-gray-500">
                        Duration: {(alarm.duration / 1000).toFixed(1)}s
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => toggleAlarm(alarm._id, alarm.isActive)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                          alarm.isActive
                            ? 'bg-purple-500 text-white hover:bg-purple-600'
                            : 'bg-gray-300 text-gray-700 hover:bg-gray-400'
                        }`}
                      >
                        {alarm.isActive ? 'ON' : 'OFF'}
                      </button>
                      
                      <button
                        onClick={() => deleteAlarm(alarm._id)}
                        className="p-2 text-red-600 hover:text-red-800 hover:bg-red-100 rounded-lg transition-colors"
                        title="Delete alarm"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AlarmManager;