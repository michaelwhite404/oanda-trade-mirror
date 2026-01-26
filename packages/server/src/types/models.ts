import { Types } from 'mongoose';
import { OandaEnvironment } from './oanda';

// Legacy interfaces (kept for compatibility)
export interface AccountConfig {
  accountId: string;
  token: string;
  type: 'source' | 'mirror';
  scaleFactor?: number;
}

export interface TradeInstruction {
  instrument: string;
  units: number;
  side: 'buy' | 'sell';
  type: 'MARKET' | 'LIMIT';
  tp?: number;
  sl?: number;
}

// MongoDB Document Interfaces

export interface ISourceAccount {
  oandaAccountId: string;
  apiToken: string;
  environment: OandaEnvironment;
  alias: string | null;
  isActive: boolean;
  lastTransactionId: string | null;
  lastSyncedAt: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export type ScalingMode = 'dynamic' | 'static';

export interface IMirrorAccount {
  sourceAccountId: Types.ObjectId;
  oandaAccountId: string;
  apiToken: string;
  environment: OandaEnvironment;
  alias: string | null;
  scalingMode: ScalingMode;
  scaleFactor: number; // Used when scalingMode is 'static', ignored when 'dynamic'
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export type MirrorExecutionStatus = 'pending' | 'success' | 'failed';

export interface IMirrorExecution {
  mirrorAccountId: Types.ObjectId;
  oandaAccountId: string;
  status: MirrorExecutionStatus;
  executedUnits: number | null;
  oandaTransactionId: string | null;
  errorMessage: string | null;
  executedAt: Date;
}

export interface ITradeHistory {
  sourceAccountId: Types.ObjectId;
  sourceTransactionId: string;
  instrument: string;
  units: number;
  side: 'buy' | 'sell';
  price: number;
  mirrorExecutions: IMirrorExecution[];
  createdAt?: Date;
  updatedAt?: Date;
}

export type LogLevel = 'info' | 'warn' | 'error' | 'debug';
export type LogCategory = 'trade' | 'account' | 'system' | 'api';

export interface IExecutionLog {
  timestamp: Date;
  level: LogLevel;
  category: LogCategory;
  action: string;
  sourceAccountId?: Types.ObjectId;
  mirrorAccountId?: Types.ObjectId;
  transactionId?: string;
  details: Record<string, unknown>;
  createdAt?: Date;
}
