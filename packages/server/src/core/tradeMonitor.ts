import axios from 'axios';
import { Types } from 'mongoose';
import { SourceAccountDocument } from '../db';
import {
  OandaTransactionsSinceIdResponse,
  OandaOrderFillTransaction,
  isOrderFillTransaction,
  getOandaBaseUrl,
} from '../types/oanda';
import { accountService } from '../services/accountService';
import { auditService } from '../services/auditService';

export interface DetectedTrade {
  transactionId: string;
  instrument: string;
  units: number;
  side: 'buy' | 'sell';
  price: number;
  time: string;
}

export const checkForNewTrades = async (
  sourceAccount: SourceAccountDocument
): Promise<DetectedTrade[]> => {
  const baseUrl = getOandaBaseUrl(sourceAccount.environment);
  const accountId = sourceAccount.oandaAccountId;
  const sourceAccountId = sourceAccount._id as Types.ObjectId;

  try {
    // Use sinceId endpoint if we have a last transaction ID, otherwise get account summary
    let lastTransactionId = sourceAccount.lastTransactionId;

    if (!lastTransactionId) {
      // First run: get current lastTransactionID from account summary
      const summaryRes = await axios.get(`${baseUrl}/accounts/${accountId}/summary`, {
        headers: { Authorization: `Bearer ${sourceAccount.apiToken}` },
      });
      lastTransactionId = summaryRes.data.lastTransactionID;

      // Update the source account with initial transaction ID
      await accountService.updateLastTransactionId(sourceAccountId, lastTransactionId!);

      await auditService.info('trade', 'Initialized source account transaction tracking', {
        sourceAccountId,
        transactionId: lastTransactionId!,
      });

      // Return empty on first run - we only track new trades going forward
      return [];
    }

    // Fetch transactions since last known ID
    const res = await axios.get<OandaTransactionsSinceIdResponse>(
      `${baseUrl}/accounts/${accountId}/transactions/sinceid`,
      {
        params: { id: lastTransactionId },
        headers: { Authorization: `Bearer ${sourceAccount.apiToken}` },
      }
    );

    const transactions = res.data.transactions;
    const newLastTransactionId = res.data.lastTransactionID;

    // Update last transaction ID if there are new transactions
    if (newLastTransactionId !== lastTransactionId) {
      await accountService.updateLastTransactionId(sourceAccountId, newLastTransactionId);
    }

    // Filter for ORDER_FILL transactions only
    const orderFills = transactions.filter(isOrderFillTransaction) as OandaOrderFillTransaction[];

    // Convert to DetectedTrade format
    const detectedTrades: DetectedTrade[] = orderFills.map((fill) => {
      const units = parseFloat(fill.units);
      return {
        transactionId: fill.id,
        instrument: fill.instrument,
        units: Math.abs(units),
        side: units > 0 ? 'buy' : 'sell',
        price: parseFloat(fill.price),
        time: fill.time,
      };
    });

    if (detectedTrades.length > 0) {
      await auditService.debug('trade', `Detected ${detectedTrades.length} new trades`, {
        sourceAccountId,
        details: { trades: detectedTrades.map((t) => t.transactionId) },
      });
    }

    return detectedTrades;
  } catch (error) {
    await auditService.logApiError(
      'Failed to check for new trades',
      error as Error,
      sourceAccountId
    );
    throw error;
  }
};
