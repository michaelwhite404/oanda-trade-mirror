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

  async getTradeById(tradeId: Types.ObjectId): Promise<TradeHistoryDocument | null> {
    return TradeHistory.findById(tradeId);
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

  async searchTrades(
    sourceAccountId: Types.ObjectId,
    filters: {
      instrument?: string;
      side?: 'buy' | 'sell';
      status?: 'pending' | 'success' | 'failed';
      dateFrom?: Date;
      dateTo?: Date;
      limit?: number;
    }
  ): Promise<TradeHistoryDocument[]> {
    const query: Record<string, unknown> = { sourceAccountId };

    if (filters.instrument) {
      // Case-insensitive partial match
      query.instrument = { $regex: filters.instrument, $options: 'i' };
    }

    if (filters.side) {
      query.side = filters.side;
    }

    if (filters.dateFrom || filters.dateTo) {
      query.createdAt = {};
      if (filters.dateFrom) {
        (query.createdAt as Record<string, Date>).$gte = filters.dateFrom;
      }
      if (filters.dateTo) {
        (query.createdAt as Record<string, Date>).$lte = filters.dateTo;
      }
    }

    // Filter by mirror execution status
    if (filters.status) {
      query['mirrorExecutions.status'] = filters.status;
    }

    return TradeHistory.find(query)
      .sort({ createdAt: -1 })
      .limit(filters.limit || 100);
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

  async getSyncStatus(sourceAccountId: Types.ObjectId): Promise<{
    totalTrades: number;
    pendingCount: number;
    failedCount: number;
    lastTradeAt: Date | null;
    mirrorStatus: Array<{
      mirrorAccountId: string;
      oandaAccountId: string;
      pendingCount: number;
      failedCount: number;
      successCount: number;
      lastSuccessAt: Date | null;
    }>;
  }> {
    // Get recent trades (last 100)
    const trades = await TradeHistory.find({ sourceAccountId })
      .sort({ createdAt: -1 })
      .limit(100);

    const totalTrades = trades.length;
    const lastTradeAt = trades.length > 0 ? trades[0].createdAt as Date : null;

    // Aggregate mirror execution stats
    const mirrorStats = new Map<string, {
      oandaAccountId: string;
      pendingCount: number;
      failedCount: number;
      successCount: number;
      lastSuccessAt: Date | null;
    }>();

    let pendingCount = 0;
    let failedCount = 0;

    for (const trade of trades) {
      for (const exec of trade.mirrorExecutions) {
        const mirrorId = exec.mirrorAccountId.toString();

        if (!mirrorStats.has(mirrorId)) {
          mirrorStats.set(mirrorId, {
            oandaAccountId: exec.oandaAccountId,
            pendingCount: 0,
            failedCount: 0,
            successCount: 0,
            lastSuccessAt: null,
          });
        }

        const stats = mirrorStats.get(mirrorId)!;

        if (exec.status === 'pending') {
          stats.pendingCount++;
          pendingCount++;
        } else if (exec.status === 'failed') {
          stats.failedCount++;
          failedCount++;
        } else if (exec.status === 'success') {
          stats.successCount++;
          if (!stats.lastSuccessAt || exec.executedAt > stats.lastSuccessAt) {
            stats.lastSuccessAt = exec.executedAt;
          }
        }
      }
    }

    return {
      totalTrades,
      pendingCount,
      failedCount,
      lastTradeAt,
      mirrorStatus: Array.from(mirrorStats.entries()).map(([mirrorAccountId, stats]) => ({
        mirrorAccountId,
        ...stats,
      })),
    };
  }
}

export const tradeHistoryService = new TradeHistoryService();
