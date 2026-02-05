import mongoose, { Schema, Document, Types } from 'mongoose';

export const WEBHOOK_EVENTS = [
  'trade.mirrored',
  'trade.failed',
  'trade.retried',
  'account.connected',
  'account.disconnected',
] as const;

export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

export interface IWebhook {
  userId: Types.ObjectId;
  name: string;
  url: string;
  secret: string;
  events: WebhookEvent[];
  isActive: boolean;
  lastTriggeredAt: Date | null;
  failureCount: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface WebhookDocument extends IWebhook, Document {}

const WebhookSchema = new Schema<WebhookDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    url: {
      type: String,
      required: true,
      trim: true,
    },
    secret: {
      type: String,
      required: true,
    },
    events: {
      type: [String],
      enum: WEBHOOK_EVENTS,
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    lastTriggeredAt: {
      type: Date,
      default: null,
    },
    failureCount: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

export const Webhook = mongoose.model<WebhookDocument>('Webhook', WebhookSchema);
