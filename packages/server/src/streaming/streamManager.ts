import { Types } from 'mongoose';
import { OandaStreamClient, DetectedTrade } from './oandaStreamClient';
import { eventBus } from '../websocket/eventBus';
import { accountService } from '../services/accountService';
import { SourceAccountDocument } from '../db';
import { config } from '../config/config';
import { auditService } from '../services/auditService';

interface StreamInfo {
  client: OandaStreamClient;
  status: 'connecting' | 'connected' | 'reconnecting' | 'fallback' | 'stopped';
  pollingInterval?: NodeJS.Timeout;
}

type TransactionCallback = (
  sourceAccountId: Types.ObjectId,
  trade: DetectedTrade
) => Promise<void>;

export class StreamManager {
  private streams: Map<string, StreamInfo> = new Map();
  private onTransactionCallback: TransactionCallback | null = null;
  private checkForNewTradesCallback:
    | ((source: SourceAccountDocument) => Promise<DetectedTrade[]>)
    | null = null;

  setOnTransaction(callback: TransactionCallback): void {
    this.onTransactionCallback = callback;
  }

  setCheckForNewTrades(
    callback: (source: SourceAccountDocument) => Promise<DetectedTrade[]>
  ): void {
    this.checkForNewTradesCallback = callback;
  }

  async startStreams(): Promise<void> {
    if (!config.streaming.enabled) {
      console.log('[StreamManager] Streaming disabled, skipping');
      return;
    }

    console.log('[StreamManager] Starting streams for all active source accounts');

    const sources = await accountService.getActiveSourceAccounts();

    for (const source of sources) {
      await this.addSourceAccount(source);
    }

    await auditService.info('system', 'Stream manager started', {
      details: { accountCount: sources.length },
    });
  }

  async addSourceAccount(source: SourceAccountDocument): Promise<void> {
    const accountId = (source._id as Types.ObjectId).toString();

    if (this.streams.has(accountId)) {
      console.log(`[StreamManager] Stream already exists for ${source.oandaAccountId}`);
      return;
    }

    const client = new OandaStreamClient({
      sourceAccountId: source._id as Types.ObjectId,
      oandaAccountId: source.oandaAccountId,
      apiToken: source.apiToken,
      environment: source.environment,
    });

    const streamInfo: StreamInfo = {
      client,
      status: 'connecting',
    };

    this.streams.set(accountId, streamInfo);

    // Set up event handlers
    client.on('connected', () => {
      streamInfo.status = 'connected';
      eventBus.emitStreamStatus(source._id as Types.ObjectId, 'connected');
    });

    client.on('disconnected', () => {
      streamInfo.status = 'reconnecting';
      eventBus.emitStreamStatus(source._id as Types.ObjectId, 'disconnected');
    });

    client.on('reconnecting', () => {
      streamInfo.status = 'reconnecting';
      eventBus.emitStreamStatus(source._id as Types.ObjectId, 'reconnecting');
    });

    client.on('fallback', () => {
      streamInfo.status = 'fallback';
      eventBus.emitStreamStatus(
        source._id as Types.ObjectId,
        'fallback',
        'Falling back to polling'
      );
      this.startFallbackPolling(source, streamInfo);
    });

    client.on('error', (error: Error) => {
      eventBus.emitError(error.message, source._id as Types.ObjectId);
    });

    client.on('transaction', async (trade: DetectedTrade) => {
      // Emit event for WebSocket broadcast
      eventBus.emitTradeNew(source._id as Types.ObjectId, trade);

      // Call the orchestrator's trade handler
      if (this.onTransactionCallback) {
        try {
          await this.onTransactionCallback(source._id as Types.ObjectId, trade);
        } catch (err) {
          console.error('[StreamManager] Error processing transaction:', err);
          eventBus.emitError(
            `Error processing transaction: ${(err as Error).message}`,
            source._id as Types.ObjectId
          );
        }
      }
    });

    // Connect
    try {
      await client.connect();
    } catch (err) {
      console.error(
        `[StreamManager] Failed to connect stream for ${source.oandaAccountId}:`,
        err
      );
      // The client will handle reconnection
    }
  }

  private startFallbackPolling(
    source: SourceAccountDocument,
    streamInfo: StreamInfo
  ): void {
    if (streamInfo.pollingInterval) {
      clearInterval(streamInfo.pollingInterval);
    }

    console.log(
      `[StreamManager] Starting fallback polling for ${source.oandaAccountId} at ${config.streaming.fallbackPollingIntervalMs}ms`
    );

    streamInfo.pollingInterval = setInterval(async () => {
      if (!this.checkForNewTradesCallback) return;

      try {
        // Refresh source account to get latest lastTransactionId
        const refreshedSource = await accountService.getSourceAccountById(
          source._id as Types.ObjectId
        );
        if (!refreshedSource || !refreshedSource.isActive) {
          this.removeSourceAccount(source._id as Types.ObjectId);
          return;
        }

        const trades = await this.checkForNewTradesCallback(refreshedSource);

        for (const trade of trades) {
          eventBus.emitTradeNew(source._id as Types.ObjectId, trade);

          if (this.onTransactionCallback) {
            await this.onTransactionCallback(source._id as Types.ObjectId, trade);
          }
        }
      } catch (err) {
        console.error(`[StreamManager] Fallback polling error for ${source.oandaAccountId}:`, err);
      }
    }, config.streaming.fallbackPollingIntervalMs);
  }

  removeSourceAccount(sourceAccountId: Types.ObjectId): void {
    const accountId = sourceAccountId.toString();
    const streamInfo = this.streams.get(accountId);

    if (!streamInfo) return;

    console.log(`[StreamManager] Removing stream for account ${accountId}`);

    if (streamInfo.pollingInterval) {
      clearInterval(streamInfo.pollingInterval);
    }

    streamInfo.client.disconnect();
    this.streams.delete(accountId);
  }

  async stopStreams(): Promise<void> {
    console.log('[StreamManager] Stopping all streams');

    for (const [accountId, streamInfo] of this.streams) {
      if (streamInfo.pollingInterval) {
        clearInterval(streamInfo.pollingInterval);
      }
      streamInfo.client.disconnect();
    }

    this.streams.clear();

    await auditService.info('system', 'Stream manager stopped');
  }

  getStatus(): Map<string, { oandaAccountId: string; status: string }> {
    const status = new Map<string, { oandaAccountId: string; status: string }>();

    for (const [accountId, streamInfo] of this.streams) {
      status.set(accountId, {
        oandaAccountId: streamInfo.client.getOandaAccountId(),
        status: streamInfo.status,
      });
    }

    return status;
  }

  getStreamCount(): number {
    return this.streams.size;
  }
}

// Singleton instance
export const streamManager = new StreamManager();
