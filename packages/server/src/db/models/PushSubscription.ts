import mongoose, { Schema, Document } from 'mongoose';
import { IPushSubscription } from '../../types/models';

export interface PushSubscriptionDocument extends IPushSubscription, Document {}

const PushSubscriptionSchema = new Schema<PushSubscriptionDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    endpoint: {
      type: String,
      required: true,
      unique: true,
    },
    keys: {
      p256dh: {
        type: String,
        required: true,
      },
      auth: {
        type: String,
        required: true,
      },
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for user lookups
PushSubscriptionSchema.index({ userId: 1, endpoint: 1 });

export const PushSubscription = mongoose.model<PushSubscriptionDocument>(
  'PushSubscription',
  PushSubscriptionSchema
);
