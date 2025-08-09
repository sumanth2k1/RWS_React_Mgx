import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import DeviceAuth from './components/DeviceAuth';
import Dashboard from './components/Dashboard';
import { DeviceProvider } from './context/DeviceContext';
import { WebSocketProvider } from './context/WebSocketContext';
import { NotificationProvider } from './context/NotificationContext';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [deviceId, setDeviceId] = useState('');

  // Check for saved authentication
  useEffect(() => {
    const savedDeviceId = localStorage.getItem('wateringSystem_deviceId');
    if (savedDeviceId) {
      setDeviceId(savedDeviceId);
      setIsAuthenticated(true);
    }
  }, []);

  const handleAuthentication = (deviceId: string) => {
    setDeviceId(deviceId);
    setIsAuthenticated(true);
    localStorage.setItem('wateringSystem_deviceId', deviceId);
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setDeviceId('');
    localStorage.removeItem('wateringSystem_deviceId');
  };

  return (
    <NotificationProvider>
      <DeviceProvider>
        <WebSocketProvider>
          <Router>
            <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50">
              <Routes>
                <Route 
                  path="/auth" 
                  element={
                    !isAuthenticated ? (
                      <DeviceAuth onAuthenticated={handleAuthentication} />
                    ) : (
                      <Navigate to="/dashboard" replace />
                    )
                  } 
                />
                <Route 
                  path="/dashboard" 
                  element={
                    isAuthenticated ? (
                      <Dashboard deviceId={deviceId} onLogout={handleLogout} />
                    ) : (
                      <Navigate to="/auth" replace />
                    )
                  } 
                />
                <Route 
                  path="/" 
                  element={
                    <Navigate to={isAuthenticated ? "/dashboard" : "/auth"} replace />
                  } 
                />
              </Routes>
            </div>
          </Router>
        </WebSocketProvider>
      </DeviceProvider>
    </NotificationProvider>
  );
}

export default App;