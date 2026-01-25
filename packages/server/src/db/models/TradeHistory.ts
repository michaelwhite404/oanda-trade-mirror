import mongoose, { Schema, Document } from 'mongoose';
import { ITradeHistory, IMirrorExecution } from '../../types/models';

export interface TradeHistoryDocument extends ITradeHistory, Document {}

const MirrorExecutionSchema = new Schema<IMirrorExecution>(
  {
    mirrorAccountId: {
      type: Schema.Types.ObjectId,
      ref: 'MirrorAccount',
      required: true,
    },
    oandaAccountId: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'success', 'failed'],
      required: true,
      default: 'pending',
    },
    executedUnits: {
      type: Number,
      default: null,
    },
    oandaTransactionId: {
      type: String,
      default: null,
    },
    errorMessage: {
      type: String,
      default: null,
    },
    executedAt: {
      type: Date,
      required: true,
    },
  },
  { _id: false }
);

const TradeHistorySchema = new Schema<TradeHistoryDocument>(
  {
    sourceAccountId: {
      type: Schema.Types.ObjectId,
      ref: 'SourceAccount',
      required: true,
      index: true,
    },
    sourceTransactionId: {
      type: String,
      required: true,
      index: true,
    },
    instrument: {
      type: String,
      required: true,
    },
    units: {
      type: Number,
      required: true,
    },
    side: {
      type: String,
      enum: ['buy', 'sell'],
      required: true,
    },
    price: {
      type: Number,
      required: true,
    },
    mirrorExecutions: {
      type: [MirrorExecutionSchema],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

// Compound unique index to prevent duplicate trade entries
TradeHistorySchema.index(
  { sourceAccountId: 1, sourceTransactionId: 1 },
  { unique: true }
);

export const TradeHistory = mongoose.model<TradeHistoryDocument>(
  'TradeHistory',
  TradeHistorySchema
);
