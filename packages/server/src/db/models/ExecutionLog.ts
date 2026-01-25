import mongoose, { Schema, Document } from 'mongoose';
import { IExecutionLog } from '../../types/models';

export interface ExecutionLogDocument extends IExecutionLog, Document {}

const ExecutionLogSchema = new Schema<ExecutionLogDocument>(
  {
    timestamp: {
      type: Date,
      required: true,
      default: () => new Date(),
      index: true,
    },
    level: {
      type: String,
      enum: ['info', 'warn', 'error', 'debug'],
      required: true,
      index: true,
    },
    category: {
      type: String,
      enum: ['trade', 'account', 'system', 'api'],
      required: true,
      index: true,
    },
    action: {
      type: String,
      required: true,
    },
    sourceAccountId: {
      type: Schema.Types.ObjectId,
      ref: 'SourceAccount',
      index: true,
    },
    mirrorAccountId: {
      type: Schema.Types.ObjectId,
      ref: 'MirrorAccount',
      index: true,
    },
    transactionId: {
      type: String,
      index: true,
    },
    details: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

// TTL index to auto-expire logs after 90 days
ExecutionLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

export const ExecutionLog = mongoose.model<ExecutionLogDocument>(
  'ExecutionLog',
  ExecutionLogSchema
);
