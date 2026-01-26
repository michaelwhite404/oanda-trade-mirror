import { Router, Request, Response } from 'express';
import { Types } from 'mongoose';
import { tradeHistoryService } from '../services/tradeHistoryService';
import { accountService } from '../services/accountService';
import { placeMarketOrder } from '../oanda/oandaApi';
import { TradeInstruction } from '../types/models';
import { auditService } from '../services/auditService';

const router = Router();

// GET /api/trades/:sourceId - Get recent trades for a source account
router.get('/:sourceId', async (req: Request, res: Response) => {
  try {
    const { sourceId } = req.params;
    if (!Types.ObjectId.isValid(sourceId)) {
      res.status(400).json({ error: 'Invalid source account ID' });
      return;
    }

    const { instrument, side, status, dateFrom, dateTo, limit } = req.query;

    // Check if any filters are applied
    const hasFilters = instrument || side || status || dateFrom || dateTo;

    if (hasFilters) {
      const trades = await tradeHistoryService.searchTrades(
        new Types.ObjectId(sourceId),
        {
          instrument: instrument as string | undefined,
          side: side as 'buy' | 'sell' | undefined,
          status: status as 'pending' | 'success' | 'failed' | undefined,
          dateFrom: dateFrom ? new Date(dateFrom as string) : undefined,
          dateTo: dateTo ? new Date(dateTo as string) : undefined,
          limit: parseInt(limit as string) || 100,
        }
      );
      res.json(trades);
    } else {
      const trades = await tradeHistoryService.getRecentTrades(
        new Types.ObjectId(sourceId),
        parseInt(limit as string) || 50
      );
      res.json(trades);
    }
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// GET /api/trades/:sourceId/export - Export trade history as CSV
router.get('/:sourceId/export', async (req: Request, res: Response) => {
  try {
    const { sourceId } = req.params;
    if (!Types.ObjectId.isValid(sourceId)) {
      res.status(400).json({ error: 'Invalid source account ID' });
      return;
    }

    const { dateFrom, dateTo } = req.query;

    const query: Record<string, unknown> = { sourceAccountId: new Types.ObjectId(sourceId) };

    if (dateFrom || dateTo) {
      query.createdAt = {};
      if (dateFrom) {
        (query.createdAt as Record<string, Date>).$gte = new Date(dateFrom as string);
      }
      if (dateTo) {
        (query.createdAt as Record<string, Date>).$lte = new Date(dateTo as string);
      }
    }

    const trades = await tradeHistoryService.searchTrades(
      new Types.ObjectId(sourceId),
      {
        dateFrom: dateFrom ? new Date(dateFrom as string) : undefined,
        dateTo: dateTo ? new Date(dateTo as string) : undefined,
        limit: 10000, // Large limit for export
      }
    );

    // Build CSV
    const headers = [
      'Date',
      'Time',
      'Instrument',
      'Side',
      'Units',
      'Price',
      'Source Transaction ID',
      'Mirror Account',
      'Mirror Status',
      'Mirror Units',
      'Mirror Transaction ID',
      'Mirror Error',
    ];

    const rows = trades.flatMap((trade) => {
      const createdAt = trade.createdAt as Date | string | undefined;
      const date = createdAt ? new Date(createdAt) : new Date();
      const dateStr = date.toISOString().split('T')[0];
      const timeStr = date.toISOString().split('T')[1].split('.')[0];

      if (trade.mirrorExecutions.length === 0) {
        return [[
          dateStr,
          timeStr,
          trade.instrument,
          trade.side.toUpperCase(),
          trade.units,
          trade.price,
          trade.sourceTransactionId,
          '',
          'No mirrors',
          '',
          '',
          '',
        ]];
      }

      return trade.mirrorExecutions.map((exec) => [
        dateStr,
        timeStr,
        trade.instrument,
        trade.side.toUpperCase(),
        trade.units,
        trade.price,
        trade.sourceTransactionId,
        exec.oandaAccountId,
        exec.status,
        exec.executedUnits || '',
        exec.oandaTransactionId || '',
        exec.errorMessage || '',
      ]);
    });

    const csvContent = [
      headers.join(','),
      ...rows.map((row) =>
        row.map((cell) => {
          const str = String(cell);
          // Escape quotes and wrap in quotes if contains comma
          if (str.includes(',') || str.includes('"') || str.includes('\n')) {
            return `"${str.replace(/"/g, '""')}"`;
          }
          return str;
        }).join(',')
      ),
    ].join('\n');

    const exportDate = new Date().toISOString().split('T')[0];
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="trade-history-${exportDate}.csv"`);
    res.send(csvContent);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// GET /api/trades/:sourceId/:txnId - Get a single trade by transaction ID
router.get('/:sourceId/:txnId', async (req: Request, res: Response) => {
  try {
    const { sourceId, txnId } = req.params;
    if (!Types.ObjectId.isValid(sourceId)) {
      res.status(400).json({ error: 'Invalid source account ID' });
      return;
    }

    const trade = await tradeHistoryService.getTradeBySourceTransaction(
      new Types.ObjectId(sourceId),
      txnId
    );

    if (!trade) {
      res.status(404).json({ error: 'Trade not found' });
      return;
    }

    res.json(trade);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// POST /api/trades/:sourceId - Place a manual trade on a source account
router.post('/:sourceId', async (req: Request, res: Response) => {
  try {
    const { sourceId } = req.params;
    if (!Types.ObjectId.isValid(sourceId)) {
      res.status(400).json({ error: 'Invalid source account ID' });
      return;
    }

    const { instrument, units, side, tp, sl } = req.body;

    if (!instrument || !units || !side) {
      res.status(400).json({ error: 'instrument, units, and side are required' });
      return;
    }

    if (!['buy', 'sell'].includes(side)) {
      res.status(400).json({ error: 'side must be "buy" or "sell"' });
      return;
    }

    // Get the source account to get credentials
    const sourceAccount = await accountService.getSourceAccountById(
      new Types.ObjectId(sourceId)
    );

    if (!sourceAccount) {
      res.status(404).json({ error: 'Source account not found' });
      return;
    }

    if (!sourceAccount.isActive) {
      res.status(400).json({ error: 'Source account is not active' });
      return;
    }

    const instruction: TradeInstruction = {
      instrument,
      units: Math.abs(units),
      side,
      type: 'MARKET',
      tp: tp || undefined,
      sl: sl || undefined,
    };

    const result = await placeMarketOrder(
      sourceAccount.oandaAccountId,
      sourceAccount.apiToken,
      instruction,
      sourceAccount.environment
    );

    await auditService.info('trade', 'Manual trade placed on source account', {
      sourceAccountId: sourceAccount._id as Types.ObjectId,
      details: { instrument, units, side, response: result.data },
    });

    res.status(201).json({
      success: true,
      orderFillTransaction: result.data.orderFillTransaction,
      relatedTransactionIDs: result.data.relatedTransactionIDs,
    });
  } catch (error) {
    const axiosError = error as { response?: { data?: unknown } };
    if (axiosError.response?.data) {
      res.status(400).json({
        error: 'OANDA API error',
        details: axiosError.response.data,
      });
    } else {
      res.status(500).json({ error: (error as Error).message });
    }
  }
});

export default router;
