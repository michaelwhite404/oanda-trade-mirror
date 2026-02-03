import mongoose, { Schema, Document, Types } from 'mongoose';

// Available API key scopes
export const API_KEY_SCOPES = [
  'read:accounts',
  'write:accounts',
  'read:trades',
  'write:trades',
  'read:logs',
  'full',
] as const;

export type ApiKeyScope = (typeof API_KEY_SCOPES)[number];

export interface IApiKey {
  userId: Types.ObjectId;
  name: string;
  keyHash: string;
  keyPrefix: string; // First 8 chars for display
  scopes: ApiKeyScope[];
  isActive: boolean;
  lastUsedAt: Date | null;
  expiresAt: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ApiKeyDocument extends IApiKey, Document {}

const ApiKeySchema = new Schema<ApiKeyDocument>(
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
      maxlength: 100,
    },
    keyHash: {
      type: String,
      required: true,
      unique: true,
    },
    keyPrefix: {
      type: String,
      required: true,
    },
    scopes: {
      type: [String],
      enum: API_KEY_SCOPES,
      default: ['full'],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    lastUsedAt: {
      type: Date,
      default: null,
    },
    expiresAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Index for looking up keys by hash
ApiKeySchema.index({ keyHash: 1 });

export const ApiKey = mongoose.model<ApiKeyDocument>('ApiKey', ApiKeySchema);
