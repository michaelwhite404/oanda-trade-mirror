import { Types } from 'mongoose';
import { SourceAccountDocument, SourceAccount } from '../db';
import { checkForNewTrades, DetectedTrade } from './tradeMonitor';
import { mirrorTrade } from './tradeDispatcher';
import { accountService } from '../services/accountService';
import { tradeHistoryService } from '../services/tradeHistoryService';
import { auditService } from '../services/auditService';

export interface OrchestratorConfig {
  pollingIntervalMs: number;
}

export class MirrorOrchestrator {
  private config: OrchestratorConfig;
  private isRunning: boolean = false;
  private intervalId: NodeJS.Timeout | null = null;

  constructor(config: OrchestratorConfig) {
    this.config = config;
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      await auditService.warn('system', 'Orchestrator already running');
      return;
    }

    this.isRunning = true;
    await auditService.logSystemStart();

    // Run immediately on start
    await this.pollAllSources();

    // Then set up interval
    this.intervalId = setInterval(async () => {
      await this.pollAllSources();
    }, this.config.pollingIntervalMs);
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    await auditService.logSystemShutdown();
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

      // Execute mirrors
      const results = await mirrorTrade(tradeHistory, mirrorAccounts);

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
}
