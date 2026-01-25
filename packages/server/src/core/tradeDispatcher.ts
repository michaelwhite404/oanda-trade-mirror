import { Types } from 'mongoose';
import { placeMarketOrder } from '../oanda/oandaApi';
import { TradeHistoryDocument, MirrorAccountDocument } from '../db';
import { TradeInstruction } from '../types/models';
import { tradeHistoryService } from '../services/tradeHistoryService';
import { auditService } from '../services/auditService';

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
  mirrorAccounts: MirrorAccountDocument[]
): Promise<MirrorResult[]> => {
  const results: MirrorResult[] = [];
  const sourceAccountId = tradeHistory.sourceAccountId as Types.ObjectId;

  for (const mirror of mirrorAccounts) {
    const mirrorAccountId = mirror._id as Types.ObjectId;
    const scaledUnits = Math.round(tradeHistory.units * mirror.scaleFactor);

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
          error: errorMessage,
        }
      );

      results.push({
        mirrorAccountId,
        oandaAccountId: mirror.oandaAccountId,
        success: false,
        errorMessage,
      });

      // Continue with other mirrors even if one fails
    }
  }

  return results;
};
