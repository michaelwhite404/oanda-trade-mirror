import { Types } from 'mongoose';
import { SourceAccountDocument, SourceAccount } from '../db';
import { checkForNewTrades, DetectedTrade } from './tradeMonitor';
import { mirrorTrade } from './tradeDispatcher';
import { accountService } from '../services/accountService';
import { tradeHistoryService } from '../services/tradeHistoryService';
import { auditService } from '../services/auditService';
import { streamManager } from '../streaming/streamManager';
import { eventBus } from '../websocket/eventBus';
import { config } from '../config/config';

export interface OrchestratorConfig {
  pollingIntervalMs: number;
}

export class MirrorOrchestrator {
  private config: OrchestratorConfig;
  private isRunning: boolean = false;
  private intervalId: NodeJS.Timeout | null = null;
  private useStreaming: boolean = false;

  constructor(orchestratorConfig: OrchestratorConfig) {
    this.config = orchestratorConfig;
    this.useStreaming = config.streaming.enabled;
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      await auditService.warn('system', 'Orchestrator already running');
      return;
    }

    this.isRunning = true;
    await auditService.logSystemStart();

    if (this.useStreaming) {
      await this.startStreamingMode();
    } else {
      await this.startPollingMode();
    }
  }

  private async startStreamingMode(): Promise<void> {
    console.log('[Orchestrator] Starting in streaming mode');

    // Set up the stream manager callbacks
    streamManager.setOnTransaction(async (sourceAccountId, trade) => {
      await this.handleStreamedTrade(sourceAccountId, trade);
    });

    // Provide the checkForNewTrades function for fallback polling
    streamManager.setCheckForNewTrades(async (source) => {
      return checkForNewTrades(source);
    });

    // Start streams for all accounts
    await streamManager.startStreams();

    await auditService.info('system', 'Streaming mode started', {
      details: { streamCount: streamManager.getStreamCount() },
    });
  }

  private async startPollingMode(): Promise<void> {
    console.log('[Orchestrator] Starting in polling mode');

    // Run immediately on start
    await this.pollAllSources();

    // Then set up interval
    this.intervalId = setInterval(async () => {
      await this.pollAllSources();
    }, this.config.pollingIntervalMs);

    await auditService.info('system', 'Polling mode started', {
      details: { intervalMs: this.config.pollingIntervalMs },
    });
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;

    if (this.useStreaming) {
      await streamManager.stopStreams();
    }

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    await auditService.logSystemShutdown();
  }

  private async handleStreamedTrade(
    sourceAccountId: Types.ObjectId,
    trade: DetectedTrade
  ): Promise<void> {
    try {
      // Check if this trade was already processed (idempotency)
      const alreadyProcessed = await tradeHistoryService.wasTransactionProcessed(
        sourceAccountId,
        trade.transactionId
      );

      if (alreadyProcessed) {
        await auditService.debug('trade', 'Trade already processed, skipping', {
          sourceAccountId,
          transactionId: trade.transactionId,
        });
        return;
      }

      // Get mirror accounts for this source
      const mirrorAccounts = await accountService.getMirrorAccountsForSource(sourceAccountId);

      if (mirrorAccounts.length === 0) {
        await auditService.warn('trade', 'No active mirror accounts for source', {
          sourceAccountId,
          details: { transactionId: trade.transactionId },
        });
        return;
      }

      // Process the trade
      await this.processTrade(sourceAccountId, trade, mirrorAccounts);
    } catch (error) {
      await auditService.error('trade', 'Error handling streamed trade', {
        sourceAccountId,
        transactionId: trade.transactionId,
        details: { error: (error as Error).message },
      });
    }
  }

  private async pollAllSources(): Promise<void> {
    try {
      // Get fresh list of active source accounts each poll
      const sourceAccounts = await accountService.getActiveSourceAccounts();

      if (sourceAccounts.length === 0) {
        return;
      }

      // Process each source account
      await Promise.all(
        sourceAccounts.map((source) => this.processSourceAccount(source))
      );
    } catch (error) {
      await auditService.error('system', 'Error in poll cycle', {
        details: { error: (error as Error).message },
      });
    }
  }

  private async processSourceAccount(sourceAccount: SourceAccountDocument): Promise<void> {
    const sourceAccountId = sourceAccount._id as Types.ObjectId;

    try {
      // Refresh source account to get latest lastTransactionId
      const freshSource = await SourceAccount.findById(sourceAccountId);
      if (!freshSource || !freshSource.isActive) {
        return;
      }

      // Check for new trades
      const newTrades = await checkForNewTrades(freshSource);

      if (newTrades.length === 0) {
        return;
      }

      // Get mirror accounts for this source
      const mirrorAccounts = await accountService.getMirrorAccountsForSource(sourceAccountId);

      if (mirrorAccounts.length === 0) {
        await auditService.warn('trade', 'No active mirror accounts for source', {
          sourceAccountId,
          details: { tradesDetected: newTrades.length },
        });
        return;
      }

      // Process each detected trade
      for (const trade of newTrades) {
        // Emit event for WebSocket (in polling mode)
        eventBus.emitTradeNew(sourceAccountId, trade);
        await this.processTrade(sourceAccountId, trade, mirrorAccounts);
      }
    } catch (error) {
      await auditService.error('trade', 'Error processing source account', {
        sourceAccountId,
        details: { error: (error as Error).message },
      });
    }
  }

  private async processTrade(
    sourceAccountId: Types.ObjectId,
    trade: DetectedTrade,
    mirrorAccounts: Awaited<ReturnType<typeof accountService.getMirrorAccountsForSource>>
  ): Promise<void> {
    try {
      // Check if this trade was already processed (idempotency)
      const alreadyProcessed = await tradeHistoryService.wasTransactionProcessed(
        sourceAccountId,
        trade.transactionId
      );

      if (alreadyProcessed) {
        await auditService.debug('trade', 'Trade already processed, skipping', {
          sourceAccountId,
          transactionId: trade.transactionId,
        });
        return;
      }

      // Create trade history record
      const tradeHistory = await tradeHistoryService.createTradeRecord({
        sourceAccountId,
        sourceTransactionId: trade.transactionId,
        instrument: trade.instrument,
        units: trade.units,
        side: trade.side,
        price: trade.price,
      });

      // Emit mirror start events
      for (const mirror of mirrorAccounts) {
        eventBus.emitTradeMirrorStart(
          sourceAccountId,
          mirror._id as Types.ObjectId,
          trade.transactionId
        );
      }

      // Execute mirrors
      const results = await mirrorTrade(tradeHistory, mirrorAccounts);

      // Emit mirror complete events
      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        const mirror = mirrorAccounts[i];

        eventBus.emitTradeMirrorComplete(
          sourceAccountId,
          mirror._id as Types.ObjectId,
          trade.transactionId,
          {
            success: result.success,
            executedUnits: result.executedUnits,
            oandaTransactionId: result.oandaTransactionId,
            errorMessage: result.errorMessage,
          }
        );
      }

      // Log summary
      const successCount = results.filter((r) => r.success).length;
      const failCount = results.filter((r) => !r.success).length;

      if (failCount > 0) {
        await auditService.warn('trade', 'Some mirror executions failed', {
          sourceAccountId,
          transactionId: trade.transactionId,
          details: { successCount, failCount },
        });
      } else {
        await auditService.info('trade', 'All mirror executions successful', {
          sourceAccountId,
          transactionId: trade.transactionId,
          details: { successCount },
        });
      }
    } catch (error) {
      await auditService.error('trade', 'Error processing trade', {
        sourceAccountId,
        transactionId: trade.transactionId,
        details: { error: (error as Error).message },
      });
    }
  }

  isStreamingEnabled(): boolean {
    return this.useStreaming;
  }

  getStreamStatus(): Map<string, { oandaAccountId: string; status: string }> | null {
    if (!this.useStreaming) return null;
    return streamManager.getStatus();
  }
}
