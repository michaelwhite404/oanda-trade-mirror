import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useWebSocketContext, WebSocketMessage } from '@/context/WebSocketContext';

export function useRealTimeUpdates(sourceAccountId: string | null) {
  const queryClient = useQueryClient();
  const { subscribe, unsubscribe, addMessageHandler, status } = useWebSocketContext();

  useEffect(() => {
    if (!sourceAccountId) return;

    // Subscribe to this source account's updates
    subscribe(sourceAccountId);

    const removeHandler = addMessageHandler((message: WebSocketMessage) => {
      // Only handle messages for our subscribed source
      const msgSourceId = message.sourceAccountId as string | undefined;
      if (msgSourceId && msgSourceId !== sourceAccountId) return;

      switch (message.type) {
        case 'trade:new':
        case 'trade:mirror:complete':
          // Invalidate trades query to refetch
          queryClient.invalidateQueries({ queryKey: ['trades', sourceAccountId] });
          break;

        case 'stream:status':
          // Could update a local stream status state if needed
          break;
      }
    });

    return () => {
      unsubscribe(sourceAccountId);
      removeHandler();
    };
  }, [sourceAccountId, subscribe, unsubscribe, addMessageHandler, queryClient]);

  return { isConnected: status === 'connected' };
}

// Hook for subscribing to all events (e.g., for dashboard)
export function useGlobalRealTimeUpdates() {
  const queryClient = useQueryClient();
  const { addMessageHandler, status } = useWebSocketContext();

  useEffect(() => {
    const removeHandler = addMessageHandler((message: WebSocketMessage) => {
      switch (message.type) {
        case 'trade:new':
        case 'trade:mirror:complete':
          // Invalidate all trades queries
          queryClient.invalidateQueries({ queryKey: ['trades'] });
          // Also invalidate logs as new entries may have been created
          queryClient.invalidateQueries({ queryKey: ['logs'] });
          break;

        case 'stream:status':
          // Invalidate health/status if we track stream health
          queryClient.invalidateQueries({ queryKey: ['health'] });
          break;
      }
    });

    return removeHandler;
  }, [addMessageHandler, queryClient]);

  return { isConnected: status === 'connected', status };
}
