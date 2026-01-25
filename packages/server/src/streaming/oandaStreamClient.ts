import https from 'https';
import { EventEmitter } from 'events';
import { Types } from 'mongoose';
import {
  OandaEnvironment,
  getOandaStreamUrl,
  OandaStreamMessage,
  isStreamHeartbeat,
  isStreamOrderFill,
} from '../types/oanda';
import { config } from '../config/config';
import { auditService } from '../services/auditService';

export interface DetectedTrade {
  transactionId: string;
  instrument: string;
  units: number;
  side: 'buy' | 'sell';
  price: number;
  time: string;
}

interface OandaStreamClientOptions {
  sourceAccountId: Types.ObjectId;
  oandaAccountId: string;
  apiToken: string;
  environment: OandaEnvironment;
}

export class OandaStreamClient extends EventEmitter {
  private sourceAccountId: Types.ObjectId;
  private oandaAccountId: string;
  private apiToken: string;
  private environment: OandaEnvironment;
  private request: ReturnType<typeof https.request> | null = null;
  private connected = false;
  private reconnectAttempts = 0;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private heartbeatTimeout: NodeJS.Timeout | null = null;
  private buffer = '';
  private stopped = false;

  constructor(options: OandaStreamClientOptions) {
    super();
    this.sourceAccountId = options.sourceAccountId;
    this.oandaAccountId = options.oandaAccountId;
    this.apiToken = options.apiToken;
    this.environment = options.environment;
  }

  async connect(): Promise<void> {
    if (this.stopped) return;

    const streamUrl = getOandaStreamUrl(this.environment);
    const url = new URL(`${streamUrl}/accounts/${this.oandaAccountId}/transactions/stream`);

    console.log(`[Stream] Connecting to ${this.oandaAccountId} (${this.environment})...`);

    return new Promise((resolve, reject) => {
      const req = https.request(
        {
          hostname: url.hostname,
          path: url.pathname,
          method: 'GET',
          headers: {
            Authorization: `Bearer ${this.apiToken}`,
            'Content-Type': 'application/json',
          },
        },
        (res) => {
          if (res.statusCode !== 200) {
            const error = new Error(`Stream connection failed: ${res.statusCode}`);
            this.handleError(error);
            reject(error);
            return;
          }

          this.connected = true;
          this.reconnectAttempts = 0;
          this.resetHeartbeatTimeout();

          console.log(`[Stream] Connected to ${this.oandaAccountId}`);
          this.emit('connected');
          resolve();

          res.on('data', (chunk: Buffer) => {
            this.handleData(chunk.toString());
          });

          res.on('end', () => {
            console.log(`[Stream] Connection ended for ${this.oandaAccountId}`);
            this.handleDisconnect();
          });

          res.on('error', (err) => {
            this.handleError(err);
          });
        }
      );

      req.on('error', (err) => {
        this.handleError(err);
        reject(err);
      });

      req.end();
      this.request = req;
    });
  }

  private handleData(data: string): void {
    this.buffer += data;

    // OANDA sends newline-delimited JSON
    const lines = this.buffer.split('\n');
    this.buffer = lines.pop() || ''; // Keep incomplete line in buffer

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      try {
        const message: OandaStreamMessage = JSON.parse(trimmed);
        this.processMessage(message);
      } catch (err) {
        console.error(`[Stream] Failed to parse message: ${trimmed}`);
      }
    }
  }

  private processMessage(message: OandaStreamMessage): void {
    if (isStreamHeartbeat(message)) {
      this.resetHeartbeatTimeout();
      return;
    }

    if (isStreamOrderFill(message)) {
      const units = parseFloat(message.units || '0');
      const trade: DetectedTrade = {
        transactionId: message.id,
        instrument: message.instrument || '',
        units: Math.abs(units),
        side: units >= 0 ? 'buy' : 'sell',
        price: parseFloat(message.price || '0'),
        time: message.time,
      };

      console.log(
        `[Stream] Trade detected on ${this.oandaAccountId}: ${trade.side} ${trade.units} ${trade.instrument}`
      );
      this.emit('transaction', trade);
    }
  }

  private resetHeartbeatTimeout(): void {
    if (this.heartbeatTimeout) {
      clearTimeout(this.heartbeatTimeout);
    }

    this.heartbeatTimeout = setTimeout(() => {
      console.log(`[Stream] Heartbeat timeout for ${this.oandaAccountId}`);
      this.handleDisconnect();
    }, config.streaming.heartbeatTimeoutMs);
  }

  private handleDisconnect(): void {
    this.connected = false;
    this.cleanup();

    if (this.stopped) return;

    this.emit('disconnected');
    this.scheduleReconnect();
  }

  private handleError(error: Error): void {
    console.error(`[Stream] Error for ${this.oandaAccountId}:`, error.message);

    auditService.error('system', 'Stream connection error', {
      sourceAccountId: this.sourceAccountId,
      details: { oandaAccountId: this.oandaAccountId, error: error.message },
    });

    this.connected = false;
    this.cleanup();

    if (this.stopped) return;

    this.emit('error', error);
    this.scheduleReconnect();
  }

  private scheduleReconnect(): void {
    if (this.stopped) return;

    this.reconnectAttempts++;

    if (this.reconnectAttempts > config.streaming.maxConsecutiveFailures) {
      console.log(
        `[Stream] Max reconnect attempts reached for ${this.oandaAccountId}, falling back to polling`
      );
      this.emit('fallback');
      return;
    }

    // Exponential backoff
    const delay = Math.min(
      config.streaming.reconnectDelayMs * Math.pow(2, this.reconnectAttempts - 1),
      config.streaming.maxReconnectDelayMs
    );

    console.log(
      `[Stream] Reconnecting to ${this.oandaAccountId} in ${delay}ms (attempt ${this.reconnectAttempts})`
    );
    this.emit('reconnecting', { attempt: this.reconnectAttempts, delay });

    this.reconnectTimeout = setTimeout(() => {
      this.connect().catch(() => {
        // Error handled in connect()
      });
    }, delay);
  }

  private cleanup(): void {
    if (this.heartbeatTimeout) {
      clearTimeout(this.heartbeatTimeout);
      this.heartbeatTimeout = null;
    }

    if (this.request) {
      this.request.destroy();
      this.request = null;
    }

    this.buffer = '';
  }

  disconnect(): void {
    console.log(`[Stream] Disconnecting from ${this.oandaAccountId}`);
    this.stopped = true;
    this.connected = false;

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    this.cleanup();
    this.emit('stopped');
  }

  isConnected(): boolean {
    return this.connected;
  }

  getSourceAccountId(): Types.ObjectId {
    return this.sourceAccountId;
  }

  getOandaAccountId(): string {
    return this.oandaAccountId;
  }
}
