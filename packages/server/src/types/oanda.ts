// OANDA API Response Types

export type OandaEnvironment = 'practice' | 'live';

export interface OandaTransaction {
  id: string;
  type: string;
  time: string;
  accountID: string;
}

export interface OandaOrderFillTransaction extends OandaTransaction {
  type: 'ORDER_FILL';
  orderID: string;
  instrument: string;
  units: string;
  price: string;
  pl: string;
  financing: string;
  commission: string;
  accountBalance: string;
  reason: string;
  tradeOpened?: {
    tradeID: string;
    units: string;
  };
  tradeReduced?: {
    tradeID: string;
    units: string;
    realizedPL: string;
  };
  tradeClosed?: Array<{
    tradeID: string;
    units: string;
    realizedPL: string;
  }>;
}

export interface OandaTransactionsResponse {
  transactions: OandaTransaction[];
  lastTransactionID: string;
}

export interface OandaTransactionsSinceIdResponse {
  transactions: OandaTransaction[];
  lastTransactionID: string;
}

export interface OandaOrderResponse {
  orderCreateTransaction: {
    id: string;
    type: string;
    time: string;
    accountID: string;
    instrument: string;
    units: string;
  };
  orderFillTransaction?: OandaOrderFillTransaction;
  orderCancelTransaction?: {
    id: string;
    type: string;
    reason: string;
  };
  relatedTransactionIDs: string[];
  lastTransactionID: string;
}

export interface OandaAccountSummary {
  id: string;
  alias: string;
  currency: string;
  balance: string;
  createdByUserID: number;
  createdTime: string;
  guaranteedStopLossOrderMode: string;
  pl: string;
  resettablePL: string;
  financing: string;
  commission: string;
  guaranteedExecutionFees: string;
  marginRate: string;
  openTradeCount: number;
  openPositionCount: number;
  pendingOrderCount: number;
  hedgingEnabled: boolean;
  unrealizedPL: string;
  NAV: string;
  marginUsed: string;
  marginAvailable: string;
  positionValue: string;
  marginCloseoutUnrealizedPL: string;
  marginCloseoutNAV: string;
  marginCloseoutMarginUsed: string;
  marginCloseoutPercent: string;
  marginCloseoutPositionValue: string;
  withdrawalLimit: string;
  marginCallMarginUsed: string;
  marginCallPercent: string;
  lastTransactionID: string;
}

export interface OandaAccountResponse {
  account: OandaAccountSummary;
  lastTransactionID: string;
}

export function isOrderFillTransaction(
  transaction: OandaTransaction
): transaction is OandaOrderFillTransaction {
  return transaction.type === 'ORDER_FILL';
}

export function getOandaBaseUrl(environment: OandaEnvironment): string {
  return environment === 'live'
    ? 'https://api-fxtrade.oanda.com/v3'
    : 'https://api-fxpractice.oanda.com/v3';
}
