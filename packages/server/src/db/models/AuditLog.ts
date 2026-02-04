import mongoose, { Schema, Document, Types } from 'mongoose';

export type AuditAction =
  | 'user.invited'
  | 'user.registered'
  | 'user.role_changed'
  | 'user.deactivated'
  | 'user.reactivated'
  | 'user.invite_resent';

export interface IAuditLog {
  action: AuditAction;
  actorId: Types.ObjectId;
  actorUsername: string;
  targetId?: Types.ObjectId;
  targetEmail?: string;
  targetUsername?: string;
  details?: Record<string, unknown>;
  createdAt?: Date;
}

export interface AuditLogDocument extends IAuditLog, Document {}

const AuditLogSchema = new Schema<AuditLogDocument>(
  {
    action: {
      type: String,
      required: true,
      enum: [
        'user.invited',
        'user.registered',
        'user.role_changed',
        'user.deactivated',
        'user.reactivated',
        'user.invite_resent',
      ],
      index: true,
    },
    actorId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    actorUsername: {
      type: String,
      required: true,
    },
    targetId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    targetEmail: {
      type: String,
    },
    targetUsername: {
      type: String,
    },
    details: {
      type: Schema.Types.Mixed,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

// TTL index - auto-delete logs older than 1 year
AuditLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 365 * 24 * 60 * 60 });

export const AuditLog = mongoose.model<AuditLogDocument>('AuditLog', AuditLogSchema);
