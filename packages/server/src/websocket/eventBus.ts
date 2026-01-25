import { EventEmitter } from 'events';
import { Types } from 'mongoose';

// Event types
export interface TradeNewEvent {
  type: 'trade:new';
  sourceAccountId: Types.ObjectId;
  trade: {
    transactionId: string;
    instrument: string;
    units: number;
    side: 'buy' | 'sell';
    price: number;
    time: string;
  };
}

export interface TradeMirrorStartEvent {
  type: 'trade:mirror:start';
  sourceAccountId: Types.ObjectId;
  mirrorAccountId: Types.ObjectId;
  transactionId: string;
}

export interface TradeMirrorCompleteEvent {
  type: 'trade:mirror:complete';
  sourceAccountId: Types.ObjectId;
  mirrorAccountId: Types.ObjectId;
  transactionId: string;
  success: boolean;
  executedUnits?: number;
  oandaTransactionId?: string;
  errorMessage?: string;
}

export interface StreamStatusEvent {
  type: 'stream:status';
  sourceAccountId: Types.ObjectId;
  status: 'connected' | 'disconnected' | 'reconnecting' | 'fallback';
  message?: string;
}

export interface SystemErrorEvent {
  type: 'error';
  sourceAccountId?: Types.ObjectId;
  error: string;
  details?: unknown;
}

export type AppEvent =
  | TradeNewEvent
  | TradeMirrorStartEvent
  | TradeMirrorCompleteEvent
  | StreamStatusEvent
  | SystemErrorEvent;

class AppEventBus extends EventEmitter {
  emitTradeNew(sourceAccountId: Types.ObjectId, trade: TradeNewEvent['trade']): void {
    this.emit('trade:new', { type: 'trade:new', sourceAccountId, trade });
  }

  emitTradeMirrorStart(
    sourceAccountId: Types.ObjectId,
    mirrorAccountId: Types.ObjectId,
    transactionId: string
  ): void {
    this.emit('trade:mirror:start', {
      type: 'trade:mirror:start',
      sourceAccountId,
      mirrorAccountId,
      transactionId,
    });
  }

  emitTradeMirrorComplete(
    sourceAccountId: Types.ObjectId,
    mirrorAccountId: Types.ObjectId,
    transactionId: string,
    result: {
      success: boolean;
      executedUnits?: number;
      oandaTransactionId?: string;
      errorMessage?: string;
    }
  ): void {
    this.emit('trade:mirror:complete', {
      type: 'trade:mirror:complete',
      sourceAccountId,
      mirrorAccountId,
      transactionId,
      ...result,
    });
  }

  emitStreamStatus(
    sourceAccountId: Types.ObjectId,
    status: StreamStatusEvent['status'],
    message?: string
  ): void {
    this.emit('stream:status', { type: 'stream:status', sourceAccountId, status, message });
  }

  emitError(error: string, sourceAccountId?: Types.ObjectId, details?: unknown): void {
    this.emit('error', { type: 'error', sourceAccountId, error, details });
  }

  // Type-safe event listeners
  onTradeNew(callback: (event: TradeNewEvent) => void): void {
    this.on('trade:new', callback);
  }

  onTradeMirrorStart(callback: (event: TradeMirrorStartEvent) => void): void {
    this.on('trade:mirror:start', callback);
  }

  onTradeMirrorComplete(callback: (event: TradeMirrorCompleteEvent) => void): void {
    this.on('trade:mirror:complete', callback);
  }

  onStreamStatus(callback: (event: StreamStatusEvent) => void): void {
    this.on('stream:status', callback);
  }

  onError(callback: (event: SystemErrorEvent) => void): void {
    this.on('error', callback);
  }

  // Listen to all events (for WebSocket broadcasting)
  onAny(callback: (event: AppEvent) => void): void {
    const eventTypes = [
      'trade:new',
      'trade:mirror:start',
      'trade:mirror:complete',
      'stream:status',
      'error',
    ];
    eventTypes.forEach((type) => {
      this.on(type, callback);
    });
  }
}

// Singleton instance
export const eventBus = new AppEventBus();
