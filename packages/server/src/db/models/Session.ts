import mongoose, { Schema, Document, Types } from 'mongoose';

export interface ISession {
  userId: Types.ObjectId;
  refreshTokenHash: string;
  userAgent: string | null;
  ipAddress: string | null;
  lastActiveAt: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface SessionDocument extends ISession, Document {}

const SessionSchema = new Schema<SessionDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    refreshTokenHash: {
      type: String,
      required: true,
    },
    userAgent: {
      type: String,
      default: null,
    },
    ipAddress: {
      type: String,
      default: null,
    },
    lastActiveAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Index for cleanup of old sessions
SessionSchema.index({ lastActiveAt: 1 });

// TTL index - auto-delete sessions older than 30 days of inactivity
SessionSchema.index({ lastActiveAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

export const Session = mongoose.model<SessionDocument>('Session', SessionSchema);
