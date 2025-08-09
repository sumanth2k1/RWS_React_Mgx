import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface WebSocketMessage {
  type: string;
  data: any;
  timestamp: string;
}

interface WebSocketContextType {
  isConnected: boolean;
  lastMessage: WebSocketMessage | null;
  connect: () => void;
  disconnect: () => void;
  sendMessage: (type: string, data?: any) => void;
}

const WebSocketContext = createContext<WebSocketContextType | undefined>(undefined);

export const useWebSocket = () => {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocket must be used within a WebSocketProvider');
  }
  return context;
};

interface WebSocketProviderProps {
  children: ReactNode;
}

export const WebSocketProvider: React.FC<WebSocketProviderProps> = ({ children }) => {
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);

  const connect = () => {
    if (socket?.readyState === WebSocket.OPEN) {
      console.log('WebSocket already connected');
      return;
    }

    try {
      const wsUrl = 'wss://rws-backend-v2.onrender.com/ws';
      console.log('Connecting to WebSocket:', wsUrl);
      
      const newSocket = new WebSocket(wsUrl);

      newSocket.onopen = () => {
        console.log('✅ WebSocket connected');
        setIsConnected(true);
        setReconnectAttempts(0);
        
        // Join as frontend client
        sendMessageInternal(newSocket, 'frontend_join');
      };

      newSocket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          console.log('📥 WebSocket message:', message);
          setLastMessage(message);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      newSocket.onclose = (event) => {
        console.log('❌ WebSocket disconnected:', event.code, event.reason);
        setIsConnected(false);
        
        // Attempt to reconnect if not intentional
        if (reconnectAttempts < 5) {
          setTimeout(() => {
            setReconnectAttempts(prev => prev + 1);
            connect();
          }, 5000 * (reconnectAttempts + 1));
        }
      };

      newSocket.onerror = (error) => {
        console.error('❌ WebSocket error:', error);
        setIsConnected(false);
      };

      setSocket(newSocket);
    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
    }
  };

  const disconnect = () => {
    if (socket) {
      socket.close(1000, 'Manual disconnect');
      setSocket(null);
      setIsConnected(false);
    }
  };

  const sendMessageInternal = (ws: WebSocket, type: string, data: any = {}) => {
    if (ws.readyState === WebSocket.OPEN) {
      const message = JSON.stringify({
        type,
        data,
        timestamp: new Date().toISOString()
      });
      ws.send(message);
      console.log('📤 Sent WebSocket message:', type, data);
    }
  };

  const sendMessage = (type: string, data: any = {}) => {
    if (socket && socket.readyState === WebSocket.OPEN) {
      sendMessageInternal(socket, type, data);
    } else {
      console.warn('Cannot send message - WebSocket not connected');
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (socket) {
        socket.close();
      }
    };
  }, []);

  return (
    <WebSocketContext.Provider value={{
      isConnected,
      lastMessage,
      connect,
      disconnect,
      sendMessage
    }}>
      {children}
    </WebSocketContext.Provider>
  );
};