import React, { useState, useEffect } from 'react';
import { Calendar, Clock, Plus, Trash2, RefreshCw } from 'lucide-react';
import { useNotification } from '../context/NotificationContext';

interface Schedule {
  _id: string;
  deviceId: string;
  time: string;
  duration: number;
  status: string;
  createdAt: string;
}

interface ScheduleManagerProps {
  deviceId: string;
  isOnline: boolean;
}

const ScheduleManager: React.FC<ScheduleManagerProps> = ({ deviceId, isOnline }) => {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(false);
  const [newSchedule, setNewSchedule] = useState({
    date: '',
    time: '',
    duration: 5000
  });
  const { addNotification } = useNotification();

  useEffect(() => {
    fetchSchedules();
  }, [deviceId]);

  const fetchSchedules = async () => {
    setLoading(true);
    try {
      const response = await fetch(`https://rws-backend-v2.onrender.com/api/devices/${deviceId}/schedules`);
      const data = await response.json();
      
      if (data.success) {
        setSchedules(data.schedules || []);
      } else {
        throw new Error(data.error || 'Failed to fetch schedules');
      }
    } catch (error: any) {
      console.error('Failed to fetch schedules:', error);
      addNotification('Failed to fetch schedules', 'error');
    } finally {
      setLoading(false);
    }
  };

  const createSchedule = async () => {
    if (!newSchedule.date || !newSchedule.time) {
      addNotification('Please select date and time', 'error');
      return;
    }

    const scheduleDateTime = new Date(`${newSchedule.date}T${newSchedule.time}`);
    if (scheduleDateTime <= new Date()) {
      addNotification('Schedule time must be in the future', 'error');
      return;
    }

    try {
      const response = await fetch(`https://rws-backend-v2.onrender.com/api/schedules`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId,
          time: scheduleDateTime.toISOString(),
          duration: parseInt(newSchedule.duration.toString())
        })
      });

      const data = await response.json();
      
      if (data.success) {
        addNotification('Schedule created successfully', 'success');
        setNewSchedule({ date: '', time: '', duration: 5000 });
        fetchSchedules();
      } else {
        throw new Error(data.error || 'Failed to create schedule');
      }
    } catch (error: any) {
      console.error('Failed to create schedule:', error);
      addNotification(error.message || 'Failed to create schedule', 'error');
    }
  };

  const deleteSchedule = async (scheduleId: string) => {
    try {
      const response = await fetch(`https://rws-backend-v2.onrender.com/api/schedules/${scheduleId}`, {
        method: 'DELETE'
      });

      const data = await response.json();
      
      if (data.success) {
        addNotification('Schedule deleted', 'success');
        fetchSchedules();
      } else {
        throw new Error(data.error || 'Failed to delete schedule');
      }
    } catch (error: any) {
      console.error('Failed to delete schedule:', error);
      addNotification(error.message || 'Failed to delete schedule', 'error');
    }
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getCurrentDateTime = () => {
    const now = new Date();
    const date = now.toISOString().split('T')[0];
    const time = now.toTimeString().slice(0, 5);
    return { date, time };
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'executed':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'failed':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-600 border-gray-200';
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-gray-100 bg-gradient-to-r from-green-50 to-blue-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <Calendar className="w-6 h-6 text-green-500 mr-3" />
            <h2 className="text-xl font-semibold text-gray-900">Schedule Manager</h2>
          </div>
          <button
            onClick={fetchSchedules}
            disabled={loading}
            className="flex items-center px-3 py-2 text-sm text-blue-600 hover:text-blue-800 hover:bg-blue-100 rounded-lg transition-colors"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      <div className="p-6">
        {/* Create New Schedule */}
        <div className="mb-8 p-6 bg-gray-50 rounded-xl">
          <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
            <Plus className="w-5 h-5 mr-2" />
            Create New Schedule
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Date</label>
              <input
                type="date"
                value={newSchedule.date}
                onChange={(e) => setNewSchedule({...newSchedule, date: e.target.value})}
                min={getCurrentDateTime().date}
                className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Time</label>
              <input
                type="time"
                value={newSchedule.time}
                onChange={(e) => setNewSchedule({...newSchedule, time: e.target.value})}
                className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Duration</label>
              <select
                value={newSchedule.duration}
                onChange={(e) => setNewSchedule({...newSchedule, duration: parseInt(e.target.value)})}
                className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
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
          </div>

          <button
            onClick={createSchedule}
            className="w-full bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200 flex items-center justify-center shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
          >
            <Plus className="w-5 h-5 mr-2" />
            Create Schedule
          </button>

          {!isOnline && (
            <div className="mt-4 text-center text-sm text-orange-600 bg-orange-50 py-3 px-4 rounded-lg border border-orange-200">
              Schedules can be created offline but won't execute until device is online
            </div>
          )}
        </div>

        {/* Schedules List */}
        <div>
          <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
            <Clock className="w-5 h-5 mr-2" />
            Upcoming Schedules ({schedules.length})
          </h3>

          {loading ? (
            <div className="text-center py-8">
              <div className="w-8 h-8 border-4 border-gray-300 border-t-blue-500 rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-gray-500">Loading schedules...</p>
            </div>
          ) : schedules.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Calendar className="w-16 h-16 mx-auto mb-4 opacity-30" />
              <p className="text-lg font-medium mb-2">No schedules yet</p>
              <p className="text-sm">Create your first watering schedule above</p>
            </div>
          ) : (
            <div className="space-y-3">
              {schedules.map((schedule) => (
                <div
                  key={schedule._id}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center flex-1">
                    <Clock className="w-5 h-5 text-gray-500 mr-4" />
                    <div className="flex-1">
                      <div className="font-semibold text-gray-900">
                        {formatDateTime(schedule.time)}
                      </div>
                      <div className="text-sm text-gray-500">
                        Duration: {(schedule.duration / 1000).toFixed(1)} seconds
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-3">
                    <span className={`px-3 py-1 text-xs font-medium rounded-full border ${getStatusColor(schedule.status)}`}>
                      {schedule.status.charAt(0).toUpperCase() + schedule.status.slice(1)}
                    </span>
                    
                    {schedule.status === 'pending' && (
                      <button
                        onClick={() => deleteSchedule(schedule._id)}
                        className="p-2 text-red-600 hover:text-red-800 hover:bg-red-100 rounded-lg transition-colors"
                        title="Delete schedule"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
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

export default ScheduleManager;