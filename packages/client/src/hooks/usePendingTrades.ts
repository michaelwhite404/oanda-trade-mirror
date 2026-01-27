import { useState, useEffect, useCallback } from 'react';
import { useWebSocketContext, WebSocketMessage } from '@/context/WebSocketContext';

export interface PendingTrade {
  transactionId: string;
  sourceAccountId: string;
  instrument: string;
  units: number;
  side: 'buy' | 'sell';
  price: number;
  startedAt: Date;
  mirrorsCompleted: number;
  mirrorsFailed: number;
}

export function usePendingTrades() {
  const [pendingTrades, setPendingTrades] = useState<Map<string, PendingTrade>>(new Map());
  const { addMessageHandler } = useWebSocketContext();

  const handleMessage = useCallback((message: WebSocketMessage) => {
    if (message.type === 'trade:new') {
      // Server sends trade data under 'trade' property
      const trade = (message as WebSocketMessage & {
        trade?: {
          transactionId: string;
          instrument: string;
          units: number;
          side: 'buy' | 'sell';
          price: number;
        };
      }).trade;
      const sourceAccountId = message.sourceAccountId as string;

      if (trade?.transactionId) {
        setPendingTrades((prev) => {
          const next = new Map(prev);
          next.set(trade.transactionId, {
            transactionId: trade.transactionId,
            sourceAccountId,
            instrument: trade.instrument,
            units: trade.units,
            side: trade.side,
            price: trade.price,
            startedAt: new Date(),
            mirrorsCompleted: 0,
            mirrorsFailed: 0,
          });
          return next;
        });

        // Auto-remove after 30 seconds (fallback cleanup)
        setTimeout(() => {
          setPendingTrades((prev) => {
            const next = new Map(prev);
            next.delete(trade.transactionId);
            return next;
          });
        }, 30000);
      }
    }

    if (message.type === 'trade:mirror:complete') {
      const transactionId = (message as WebSocketMessage & { transactionId?: string }).transactionId;
      const success = (message as WebSocketMessage & { success?: boolean }).success;

      if (transactionId) {
        setPendingTrades((prev) => {
          const trade = prev.get(transactionId);
          if (!trade) return prev;

          const next = new Map(prev);
          const updated = {
            ...trade,
            mirrorsCompleted: trade.mirrorsCompleted + (success ? 1 : 0),
            mirrorsFailed: trade.mirrorsFailed + (success ? 0 : 1),
          };
          next.set(transactionId, updated);

          // Remove after a short delay so user can see completion
          setTimeout(() => {
            setPendingTrades((p) => {
              const n = new Map(p);
              n.delete(transactionId);
              return n;
            });
          }, 2000);

          return next;
        });
      }
    }
  }, []);

  useEffect(() => {
    const unsubscribe = addMessageHandler(handleMessage);
    return unsubscribe;
  }, [addMessageHandler, handleMessage]);

  return {
    pendingTrades: Array.from(pendingTrades.values()),
    hasPending: pendingTrades.size > 0,
  };
}
