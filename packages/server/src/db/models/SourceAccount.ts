import mongoose, { Schema, Document } from 'mongoose';
import { ISourceAccount } from '../../types/models';

export interface SourceAccountDocument extends ISourceAccount, Document {}

const SourceAccountSchema = new Schema<SourceAccountDocument>(
  {
    oandaAccountId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    apiToken: {
      type: String,
      required: true,
    },
    environment: {
      type: String,
      enum: ['practice', 'live'],
      required: true,
      default: 'practice',
    },
    alias: {
      type: String,
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    lastTransactionId: {
      type: String,
      default: null,
    },
    lastSyncedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

export const SourceAccount = mongoose.model<SourceAccountDocument>(
  'SourceAccount',
  SourceAccountSchema
);
