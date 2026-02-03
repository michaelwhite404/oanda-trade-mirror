import mongoose, { Schema, Document } from 'mongoose';
import { IUser } from '../../types/models';

export interface UserDocument extends IUser, Document {}

const UserSchema = new Schema<UserDocument>(
  {
    username: {
      type: String,
      default: null,
      unique: true,
      sparse: true,
      index: true,
      minlength: 3,
      maxlength: 50,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      index: true,
      lowercase: true,
    },
    passwordHash: {
      type: String,
      default: null,
    },
    role: {
      type: String,
      enum: ['admin', 'viewer'],
      required: true,
      default: 'viewer',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    registrationStatus: {
      type: String,
      enum: ['pending', 'active'],
      default: 'pending',
    },
    inviteToken: {
      type: String,
      default: null,
      index: true,
    },
    inviteExpiresAt: {
      type: Date,
      default: null,
    },
    lastLoginAt: {
      type: Date,
      default: null,
    },
    refreshTokenHash: {
      type: String,
      default: null,
    },
    authProvider: {
      type: String,
      enum: ['local', 'google'],
      default: 'local',
    },
    googleId: {
      type: String,
      default: null,
      sparse: true,
      index: true,
    },
    avatarUrl: {
      type: String,
      default: null,
    },
    resetPasswordToken: {
      type: String,
      default: null,
      index: true,
    },
    resetPasswordExpiresAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

export const User = mongoose.model<UserDocument>('User', UserSchema);
