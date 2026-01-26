import mongoose, { Schema, Document } from 'mongoose';
import { IMirrorAccount } from '../../types/models';

export interface MirrorAccountDocument extends IMirrorAccount, Document {}

const MirrorAccountSchema = new Schema<MirrorAccountDocument>(
  {
    sourceAccountId: {
      type: Schema.Types.ObjectId,
      ref: 'SourceAccount',
      required: true,
      index: true,
    },
    oandaAccountId: {
      type: String,
      required: true,
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
    scalingMode: {
      type: String,
      enum: ['dynamic', 'static'],
      default: 'dynamic',
    },
    scaleFactor: {
      type: Number,
      default: 1.0,
      min: 0.01,
      max: 100,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound unique index to prevent duplicate mirror accounts for the same source
MirrorAccountSchema.index({ sourceAccountId: 1, oandaAccountId: 1 }, { unique: true });

export const MirrorAccount = mongoose.model<MirrorAccountDocument>(
  'MirrorAccount',
  MirrorAccountSchema
);
