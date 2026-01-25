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

    const limit = parseInt(req.query.limit as string) || 50;
    const trades = await tradeHistoryService.getRecentTrades(
      new Types.ObjectId(sourceId),
      limit
    );

    res.json(trades);
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
