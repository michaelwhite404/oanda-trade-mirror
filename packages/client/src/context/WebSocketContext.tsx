import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'reconnecting';

export interface WebSocketMessage {
  type: string;
  timestamp: string;
  [key: string]: unknown;
}

interface WebSocketContextValue {
  status: ConnectionStatus;
  lastMessage: WebSocketMessage | null;
  subscribe: (sourceAccountId: string) => void;
  unsubscribe: (sourceAccountId: string) => void;
  addMessageHandler: (handler: (message: WebSocketMessage) => void) => () => void;
}

const WebSocketContext = createContext<WebSocketContextValue | null>(null);

interface WebSocketProviderProps {
  children: React.ReactNode;
}

export function WebSocketProvider({ children }: WebSocketProviderProps) {
  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptRef = useRef(0);
  const messageHandlersRef = useRef<Set<(message: WebSocketMessage) => void>>(new Set());

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.hostname;
    // In dev mode (port 5173), connect to backend on 3001. In production, use same port.
    const port = window.location.port === '5173' ? '3001' : window.location.port;
    const wsUrl = `${protocol}//${host}:${port}/ws`;

    console.log('[WebSocket] Connecting to', wsUrl);
    setStatus('connecting');

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('[WebSocket] Connected');
      setStatus('connected');
      reconnectAttemptRef.current = 0;
    };

    ws.onmessage = (event) => {
      try {
        const message: WebSocketMessage = JSON.parse(event.data);
        setLastMessage(message);

        // Notify all handlers
        messageHandlersRef.current.forEach((handler) => {
          try {
            handler(message);
          } catch (err) {
            console.error('[WebSocket] Handler error:', err);
          }
        });
      } catch (err) {
        console.error('[WebSocket] Failed to parse message:', event.data);
      }
    };

    ws.onclose = () => {
      console.log('[WebSocket] Disconnected');
      setStatus('disconnected');
      wsRef.current = null;
      scheduleReconnect();
    };

    ws.onerror = (error) => {
      console.error('[WebSocket] Error:', error);
    };
  }, []);

  const scheduleReconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }

    reconnectAttemptRef.current++;
    const delay = Math.min(1000 * Math.pow(2, reconnectAttemptRef.current - 1), 16000);

    console.log(`[WebSocket] Reconnecting in ${delay}ms (attempt ${reconnectAttemptRef.current})`);
    setStatus('reconnecting');

    reconnectTimeoutRef.current = setTimeout(() => {
      connect();
    }, delay);
  }, [connect]);

  const subscribe = useCallback((sourceAccountId: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'subscribe', sourceAccountId }));
    }
  }, []);

  const unsubscribe = useCallback((sourceAccountId: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'unsubscribe', sourceAccountId }));
    }
  }, []);

  const addMessageHandler = useCallback((handler: (message: WebSocketMessage) => void) => {
    messageHandlersRef.current.add(handler);
    return () => {
      messageHandlersRef.current.delete(handler);
    };
  }, []);

  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connect]);

  return (
    <WebSocketContext.Provider
      value={{
        status,
        lastMessage,
        subscribe,
        unsubscribe,
        addMessageHandler,
      }}
    >
      {children}
    </WebSocketContext.Provider>
  );
}

export function useWebSocketContext() {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocketContext must be used within a WebSocketProvider');
  }
  return context;
}
