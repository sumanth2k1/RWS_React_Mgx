import React, { createContext, useContext, useState, ReactNode } from 'react';

interface Notification {
  id: number;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
  timestamp: string;
}

interface NotificationContextType {
  notifications: Notification[];
  addNotification: (message: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
  removeNotification: (id: number) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
};

interface NotificationProviderProps {
  children: ReactNode;
}

export const NotificationProvider: React.FC<NotificationProviderProps> = ({ children }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const addNotification = (message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info') => {
    const notification: Notification = {
      id: Date.now(),
      message,
      type,
      timestamp: new Date().toLocaleTimeString()
    };

    setNotifications(prev => [notification, ...prev.slice(0, 4)]);

    // Auto-remove after 5 seconds
    setTimeout(() => {
      removeNotification(notification.id);
    }, 5000);
  };

  const removeNotification = (id: number) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  return (
    <NotificationContext.Provider value={{
      notifications,
      addNotification,
      removeNotification
    }}>
      {children}
    </NotificationContext.Provider>
  );
};