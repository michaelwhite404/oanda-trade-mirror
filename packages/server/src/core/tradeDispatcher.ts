import { Types } from 'mongoose';
import { placeMarketOrder, getAccountSummary } from '../oanda/oandaApi';
import { TradeHistoryDocument, MirrorAccountDocument, SourceAccountDocument, MirrorAccount, SourceAccount, Webhook } from '../db';
import { TradeInstruction } from '../types/models';
import { tradeHistoryService } from '../services/tradeHistoryService';
import { auditService } from '../services/auditService';
import { dispatchWebhookEvent } from '../services/webhookService';

// Dynamic scaling constants
const MIN_SCALE_FACTOR = 0.1;
const MAX_SCALE_FACTOR = 2.0;

// Dispatch webhooks to all subscribed users
async function dispatchTradeWebhook(
  event: 'trade.mirrored' | 'trade.failed' | 'trade.retried',
  data: Record<string, unknown>
): Promise<void> {
  try {
    // Find all users who have webhooks for this event
    const webhooks = await Webhook.find({
      events: event,
      isActive: true,
    }).distinct('userId');

    // Dispatch to each user in parallel
    await Promise.allSettled(
      webhooks.map((userId) => dispatchWebhookEvent(userId.toString(), event, data))
    );
  } catch (error) {
    console.error('Error dispatching trade webhook:', error);
  }
}

interface ScaleResult {
  scaleFactor: number;
  sourceNav?: number;
  mirrorNav?: number;
  mode: 'dynamic' | 'static';
}

async function calculateScaleFactor(
  source: SourceAccountDocument,
  mirror: MirrorAccountDocument
): Promise<ScaleResult> {
  // If static mode, just use the configured scale factor
  if (mirror.scalingMode === 'static') {
    return {
      scaleFactor: mirror.scaleFactor,
      mode: 'static',
    };
  }

  // Dynamic mode: calculate based on NAV ratio
  try {
    const [sourceSummary, mirrorSummary] = await Promise.all([
      getAccountSummary(source.oandaAccountId, source.apiToken, source.environment),
      getAccountSummary(mirror.oandaAccountId, mirror.apiToken, mirror.environment),
    ]);

    const sourceNav = parseFloat(sourceSummary.account.NAV);
    const mirrorNav = parseFloat(mirrorSummary.account.NAV);

    if (isNaN(sourceNav) || isNaN(mirrorNav) || sourceNav <= 0) {
      // Fall back to static scale factor if NAV fetch fails
      await auditService.warn('trade', 'Failed to calculate dynamic scale, using static fallback', {
        mirrorAccountId: mirror._id as Types.ObjectId,
        details: { sourceNav, mirrorNav },
      });
      return {
        scaleFactor: mirror.scaleFactor,
        mode: 'static',
      };
    }

    // Calculate raw scale factor based on NAV ratio
    let dynamicScale = mirrorNav / sourceNav;

    // Apply guardrails
    dynamicScale = Math.max(MIN_SCALE_FACTOR, Math.min(MAX_SCALE_FACTOR, dynamicScale));

    return {
      scaleFactor: dynamicScale,
      sourceNav,
      mirrorNav,
      mode: 'dynamic',
    };
  } catch (error) {
    // Fall back to static scale factor on error
    await auditService.warn('trade', 'Error calculating dynamic scale, using static fallback', {
      mirrorAccountId: mirror._id as Types.ObjectId,
      details: { error: (error as Error).message },
    });
    return {
      scaleFactor: mirror.scaleFactor,
      mode: 'static',
    };
  }
}

export interface MirrorResult {
  mirrorAccountId: Types.ObjectId;
  oandaAccountId: string;
  success: boolean;
  oandaTransactionId?: string;
  executedUnits?: number;
  errorMessage?: string;
}

export const mirrorTrade = async (
  tradeHistory: TradeHistoryDocument,
  mirrorAccounts: MirrorAccountDocument[],
  sourceAccount: SourceAccountDocument
): Promise<MirrorResult[]> => {
  const results: MirrorResult[] = [];
  const sourceAccountId = tradeHistory.sourceAccountId as Types.ObjectId;

  for (const mirror of mirrorAccounts) {
    const mirrorAccountId = mirror._id as Types.ObjectId;

    // Calculate scale factor (dynamic NAV-based or static)
    const scaleResult = await calculateScaleFactor(sourceAccount, mirror);
    const scaledUnits = Math.round(tradeHistory.units * scaleResult.scaleFactor);

    // Skip if scaled units would be zero
    if (scaledUnits === 0) {
      await auditService.warn('trade', 'Skipping mirror trade - scaled units would be zero', {
        sourceAccountId,
        mirrorAccountId,
        details: {
          originalUnits: tradeHistory.units,
          scaleFactor: scaleResult.scaleFactor,
          scalingMode: scaleResult.mode,
        },
      });
      continue;
    }

    const instruction: TradeInstruction = {
      instrument: tradeHistory.instrument,
      units: scaledUnits,
      side: tradeHistory.side,
      type: 'MARKET',
    };

    try {
      const response = await placeMarketOrder(
        mirror.oandaAccountId,
        mirror.apiToken,
        instruction,
        mirror.environment
      );

      const oandaTransactionId = response.data?.orderFillTransaction?.id ||
        response.data?.orderCreateTransaction?.id ||
        null;

      // Update trade history with successful execution
      await tradeHistoryService.updateMirrorExecution(tradeHistory._id as Types.ObjectId, {
        mirrorAccountId,
        oandaAccountId: mirror.oandaAccountId,
        status: 'success',
        executedUnits: scaledUnits,
        oandaTransactionId,
      });

      await auditService.logMirrorExecution(
        sourceAccountId,
        mirrorAccountId,
        tradeHistory.sourceTransactionId,
        true,
        {
          instrument: tradeHistory.instrument,
          units: scaledUnits,
          originalUnits: tradeHistory.units,
          scaleFactor: scaleResult.scaleFactor,
          scalingMode: scaleResult.mode,
          sourceNav: scaleResult.sourceNav,
          mirrorNav: scaleResult.mirrorNav,
          oandaTransactionId,
        }
      );

      results.push({
        mirrorAccountId,
        oandaAccountId: mirror.oandaAccountId,
        success: true,
        oandaTransactionId,
        executedUnits: scaledUnits,
      });

      // Dispatch webhook for successful mirror
      dispatchTradeWebhook('trade.mirrored', {
        sourceAccountId: sourceAccountId.toString(),
        mirrorAccountId: mirrorAccountId.toString(),
        instrument: tradeHistory.instrument,
        side: tradeHistory.side,
        originalUnits: tradeHistory.units,
        executedUnits: scaledUnits,
        scaleFactor: scaleResult.scaleFactor,
        scalingMode: scaleResult.mode,
        oandaTransactionId,
        sourceTransactionId: tradeHistory.sourceTransactionId,
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // Update trade history with failed execution
      await tradeHistoryService.updateMirrorExecution(tradeHistory._id as Types.ObjectId, {
        mirrorAccountId,
        oandaAccountId: mirror.oandaAccountId,
        status: 'failed',
        errorMessage,
      });

      await auditService.logMirrorExecution(
        sourceAccountId,
        mirrorAccountId,
        tradeHistory.sourceTransactionId,
        false,
        {
          instrument: tradeHistory.instrument,
          units: scaledUnits,
          originalUnits: tradeHistory.units,
          scaleFactor: scaleResult.scaleFactor,
          scalingMode: scaleResult.mode,
          error: errorMessage,
        }
      );

      results.push({
        mirrorAccountId,
        oandaAccountId: mirror.oandaAccountId,
        success: false,
        errorMessage,
      });

      // Dispatch webhook for failed mirror
      dispatchTradeWebhook('trade.failed', {
        sourceAccountId: sourceAccountId.toString(),
        mirrorAccountId: mirrorAccountId.toString(),
        instrument: tradeHistory.instrument,
        side: tradeHistory.side,
        originalUnits: tradeHistory.units,
        errorMessage,
        sourceTransactionId: tradeHistory.sourceTransactionId,
      });

      // Continue with other mirrors even if one fails
    }
  }

  return results;
};

export const retryMirrorExecution = async (
  tradeId: Types.ObjectId,
  mirrorAccountId: Types.ObjectId
): Promise<MirrorResult> => {
  // Get the trade
  const trade = await tradeHistoryService.getTradeById(tradeId);
  if (!trade) {
    throw new Error('Trade not found');
  }

  // Find the failed execution
  const execution = trade.mirrorExecutions.find(
    (e) => e.mirrorAccountId.toString() === mirrorAccountId.toString()
  );
  if (!execution) {
    throw new Error('Mirror execution not found for this trade');
  }
  if (execution.status !== 'failed') {
    throw new Error('Can only retry failed executions');
  }

  // Get the mirror account
  const mirror = await MirrorAccount.findById(mirrorAccountId);
  if (!mirror) {
    throw new Error('Mirror account not found');
  }

  // Get the source account for dynamic scaling
  const source = await SourceAccount.findById(trade.sourceAccountId);
  if (!source) {
    throw new Error('Source account not found');
  }

  // Calculate scale factor
  const scaleResult = await calculateScaleFactor(source, mirror);
  const scaledUnits = Math.round(trade.units * scaleResult.scaleFactor);

  if (scaledUnits === 0) {
    throw new Error('Scaled units would be zero');
  }

  const instruction: TradeInstruction = {
    instrument: trade.instrument,
    units: scaledUnits,
    side: trade.side,
    type: 'MARKET',
  };

  try {
    const response = await placeMarketOrder(
      mirror.oandaAccountId,
      mirror.apiToken,
      instruction,
      mirror.environment
    );

    const oandaTransactionId = response.data?.orderFillTransaction?.id ||
      response.data?.orderCreateTransaction?.id ||
      null;

    // Update trade history with successful execution
    await tradeHistoryService.updateMirrorExecution(tradeId, {
      mirrorAccountId,
      oandaAccountId: mirror.oandaAccountId,
      status: 'success',
      executedUnits: scaledUnits,
      oandaTransactionId,
    });

    await auditService.info('trade', 'Mirror execution retry succeeded', {
      sourceAccountId: trade.sourceAccountId as Types.ObjectId,
      mirrorAccountId,
      transactionId: trade.sourceTransactionId,
      details: {
        instrument: trade.instrument,
        units: scaledUnits,
        scaleFactor: scaleResult.scaleFactor,
        scalingMode: scaleResult.mode,
        oandaTransactionId,
      },
    });

    // Dispatch webhook for successful retry
    dispatchTradeWebhook('trade.retried', {
      sourceAccountId: (trade.sourceAccountId as Types.ObjectId).toString(),
      mirrorAccountId: mirrorAccountId.toString(),
      instrument: trade.instrument,
      side: trade.side,
      originalUnits: trade.units,
      executedUnits: scaledUnits,
      scaleFactor: scaleResult.scaleFactor,
      scalingMode: scaleResult.mode,
      oandaTransactionId,
      sourceTransactionId: trade.sourceTransactionId,
      success: true,
    });

    return {
      mirrorAccountId,
      oandaAccountId: mirror.oandaAccountId,
      success: true,
      oandaTransactionId,
      executedUnits: scaledUnits,
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Update trade history with failed execution (again)
    await tradeHistoryService.updateMirrorExecution(tradeId, {
      mirrorAccountId,
      oandaAccountId: mirror.oandaAccountId,
      status: 'failed',
      errorMessage,
    });

    await auditService.warn('trade', 'Mirror execution retry failed', {
      sourceAccountId: trade.sourceAccountId as Types.ObjectId,
      mirrorAccountId,
      transactionId: trade.sourceTransactionId,
      details: {
        instrument: trade.instrument,
        units: scaledUnits,
        error: errorMessage,
      },
    });

    return {
      mirrorAccountId,
      oandaAccountId: mirror.oandaAccountId,
      success: false,
      errorMessage,
    };
  }
};
