import { Types } from 'mongoose';
import { TradeHistory, TradeHistoryDocument, MirrorAccount } from '../db';
import { IMirrorExecution, MirrorExecutionStatus } from '../types/models';
import { auditService } from './auditService';

interface CreateTradeHistoryParams {
  sourceAccountId: Types.ObjectId;
  sourceTransactionId: string;
  instrument: string;
  units: number;
  side: 'buy' | 'sell';
  price: number;
}

interface UpdateMirrorExecutionParams {
  mirrorAccountId: Types.ObjectId;
  oandaAccountId: string;
  status: MirrorExecutionStatus;
  executedUnits?: number;
  oandaTransactionId?: string;
  errorMessage?: string;
}

class TradeHistoryService {
  async createTradeRecord(params: CreateTradeHistoryParams): Promise<TradeHistoryDocument> {
    // Check if this trade was already processed
    const existing = await TradeHistory.findOne({
      sourceAccountId: params.sourceAccountId,
      sourceTransactionId: params.sourceTransactionId,
    });

    if (existing) {
      await auditService.debug('trade', 'Trade already exists in history', {
        sourceAccountId: params.sourceAccountId,
        transactionId: params.sourceTransactionId,
      });
      return existing;
    }

    // Get all active mirror accounts for this source
    const mirrorAccounts = await MirrorAccount.find({
      sourceAccountId: params.sourceAccountId,
      isActive: true,
    });

    // Initialize mirror executions as pending
    const mirrorExecutions: IMirrorExecution[] = mirrorAccounts.map((mirror) => ({
      mirrorAccountId: mirror._id as Types.ObjectId,
      oandaAccountId: mirror.oandaAccountId,
      status: 'pending' as MirrorExecutionStatus,
      executedUnits: null,
      oandaTransactionId: null,
      errorMessage: null,
      executedAt: new Date(),
    }));

    const tradeHistory = await TradeHistory.create({
      ...params,
      mirrorExecutions,
    });

    await auditService.logTradeDetected(
      params.sourceAccountId,
      params.sourceTransactionId,
      params.instrument,
      params.units,
      params.side
    );

    return tradeHistory;
  }

  async updateMirrorExecution(
    tradeHistoryId: Types.ObjectId,
    params: UpdateMirrorExecutionParams
  ): Promise<TradeHistoryDocument | null> {
    const updated = await TradeHistory.findOneAndUpdate(
      {
        _id: tradeHistoryId,
        'mirrorExecutions.mirrorAccountId': params.mirrorAccountId,
      },
      {
        $set: {
          'mirrorExecutions.$.status': params.status,
          'mirrorExecutions.$.executedUnits': params.executedUnits || null,
          'mirrorExecutions.$.oandaTransactionId': params.oandaTransactionId || null,
          'mirrorExecutions.$.errorMessage': params.errorMessage || null,
          'mirrorExecutions.$.executedAt': new Date(),
        },
      },
      { new: true }
    );

    return updated;
  }

  async getTradeBySourceTransaction(
    sourceAccountId: Types.ObjectId,
    sourceTransactionId: string
  ): Promise<TradeHistoryDocument | null> {
    return TradeHistory.findOne({
      sourceAccountId,
      sourceTransactionId,
    });
  }

  async getPendingMirrorExecutions(
    tradeHistoryId: Types.ObjectId
  ): Promise<IMirrorExecution[]> {
    const trade = await TradeHistory.findById(tradeHistoryId);
    if (!trade) return [];

    return trade.mirrorExecutions.filter((exec) => exec.status === 'pending');
  }

  async getRecentTrades(
    sourceAccountId: Types.ObjectId,
    limit: number = 50
  ): Promise<TradeHistoryDocument[]> {
    return TradeHistory.find({ sourceAccountId })
      .sort({ createdAt: -1 })
      .limit(limit);
  }

  async wasTransactionProcessed(
    sourceAccountId: Types.ObjectId,
    sourceTransactionId: string
  ): Promise<boolean> {
    const count = await TradeHistory.countDocuments({
      sourceAccountId,
      sourceTransactionId,
    });
    return count > 0;
  }
}

export const tradeHistoryService = new TradeHistoryService();
