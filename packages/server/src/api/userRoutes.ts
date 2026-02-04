import { Router, Request, Response } from 'express';
import { Types } from 'mongoose';
import crypto from 'crypto';
import { User } from '../db/models/User';
import { AuditLog, AuditAction } from '../db';
import { UserRole } from '../types/models';
import { emailService } from '../services/emailService';

async function logAudit(
  action: AuditAction,
  actorId: string,
  actorUsername: string,
  target?: { id?: string; email?: string; username?: string },
  details?: Record<string, unknown>
) {
  try {
    await AuditLog.create({
      action,
      actorId: new Types.ObjectId(actorId),
      actorUsername,
      targetId: target?.id ? new Types.ObjectId(target.id) : undefined,
      targetEmail: target?.email,
      targetUsername: target?.username,
      details,
    });
  } catch (error) {
    console.error('[AuditLog] Failed to log action:', error);
  }
}

const INVITE_EXPIRY_DAYS = 7;

function generateInviteToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

const router = Router();

// GET /api/users - List all users (admin only)
router.get('/', async (_req: Request, res: Response) => {
  try {
    const users = await User.find().sort({ createdAt: -1 });
    const sanitized = users.map((user) => ({
      _id: user._id,
      username: user.username,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      registrationStatus: user.registrationStatus,
      lastLoginAt: user.lastLoginAt,
      authProvider: user.authProvider,
      avatarUrl: user.avatarUrl,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    }));
    res.json(sanitized);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// POST /api/users - Invite new user (admin only)
router.post('/', async (req: Request, res: Response) => {
  try {
    const { email, role } = req.body;

    if (!email) {
      res.status(400).json({ error: 'Email is required' });
      return;
    }

    // Validate email format
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      res.status(400).json({ error: 'Invalid email format' });
      return;
    }

    // Check if email already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });

    if (existingUser) {
      res.status(400).json({ error: 'A user with this email already exists' });
      return;
    }

    // Generate invite token
    const inviteToken = generateInviteToken();
    const inviteExpiresAt = new Date();
    inviteExpiresAt.setDate(inviteExpiresAt.getDate() + INVITE_EXPIRY_DAYS);

    const user = new User({
      email: email.toLowerCase(),
      role: (role as UserRole) || 'viewer',
      authProvider: 'local',
      isActive: true,
      registrationStatus: 'pending',
      inviteToken,
      inviteExpiresAt,
    });

    await user.save();

    // Send invite email
    const invitedBy = req.authUser?.username;
    await emailService.sendInvite({
      email: user.email,
      inviteToken,
      role: user.role,
      invitedBy,
    });

    // Log audit event
    await logAudit(
      'user.invited',
      req.authUser!.userId,
      req.authUser!.username,
      { id: user._id.toString(), email: user.email },
      { role: user.role }
    );

    res.status(201).json({
      _id: user._id,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      registrationStatus: user.registrationStatus,
      createdAt: user.createdAt,
    });
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

// POST /api/users/:id/resend-invite - Resend invite email (admin only)
router.post('/:id/resend-invite', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!Types.ObjectId.isValid(id)) {
      res.status(400).json({ error: 'Invalid user ID' });
      return;
    }

    const user = await User.findById(id);

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    if (user.registrationStatus !== 'pending') {
      res.status(400).json({ error: 'User has already completed registration' });
      return;
    }

    // Generate new invite token
    const inviteToken = generateInviteToken();
    const inviteExpiresAt = new Date();
    inviteExpiresAt.setDate(inviteExpiresAt.getDate() + INVITE_EXPIRY_DAYS);

    user.inviteToken = inviteToken;
    user.inviteExpiresAt = inviteExpiresAt;
    await user.save();

    // Send invite email
    const invitedBy = req.authUser?.username;
    await emailService.sendInvite({
      email: user.email,
      inviteToken,
      role: user.role,
      invitedBy,
    });

    // Log audit event
    await logAudit(
      'user.invite_resent',
      req.authUser!.userId,
      req.authUser!.username,
      { id: user._id.toString(), email: user.email, username: user.username || undefined }
    );

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// PATCH /api/users/:id - Update user role/status (admin only)
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!Types.ObjectId.isValid(id)) {
      res.status(400).json({ error: 'Invalid user ID' });
      return;
    }

    const { role, isActive } = req.body;
    const updates: Partial<{ role: UserRole; isActive: boolean }> = {};

    if (role !== undefined) {
      if (!['admin', 'viewer'].includes(role)) {
        res.status(400).json({ error: 'Invalid role. Must be "admin" or "viewer"' });
        return;
      }
      updates.role = role as UserRole;
    }

    if (isActive !== undefined) {
      updates.isActive = Boolean(isActive);
    }

    if (Object.keys(updates).length === 0) {
      res.status(400).json({ error: 'No valid fields to update' });
      return;
    }

    // Prevent deactivating yourself or changing your own role
    const currentUserId = req.authUser?.userId;
    if (currentUserId === id) {
      if (updates.role !== undefined || updates.isActive === false) {
        res.status(400).json({ error: 'Cannot modify your own role or deactivate yourself' });
        return;
      }
    }

    // Check if we're reactivating a pending user
    const existingUser = await User.findById(id);
    if (!existingUser) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const isReactivatingPendingUser =
      updates.isActive === true &&
      !existingUser.isActive &&
      existingUser.registrationStatus === 'pending';

    // If reactivating a pending user, regenerate invite token
    if (isReactivatingPendingUser) {
      const inviteToken = generateInviteToken();
      const inviteExpiresAt = new Date();
      inviteExpiresAt.setDate(inviteExpiresAt.getDate() + INVITE_EXPIRY_DAYS);

      existingUser.isActive = true;
      existingUser.inviteToken = inviteToken;
      existingUser.inviteExpiresAt = inviteExpiresAt;
      if (updates.role) {
        existingUser.role = updates.role;
      }
      await existingUser.save();

      // Send new invite email
      const invitedBy = req.authUser?.username;
      await emailService.sendInvite({
        email: existingUser.email,
        inviteToken,
        role: existingUser.role,
        invitedBy,
      });

      // Log audit event for reactivation
      await logAudit(
        'user.reactivated',
        req.authUser!.userId,
        req.authUser!.username,
        { id: existingUser._id.toString(), email: existingUser.email, username: existingUser.username || undefined }
      );

      res.json({
        _id: existingUser._id,
        username: existingUser.username,
        email: existingUser.email,
        role: existingUser.role,
        isActive: existingUser.isActive,
        registrationStatus: existingUser.registrationStatus,
        lastLoginAt: existingUser.lastLoginAt,
        authProvider: existingUser.authProvider,
        avatarUrl: existingUser.avatarUrl,
        createdAt: existingUser.createdAt,
        updatedAt: existingUser.updatedAt,
      });
      return;
    }

    // Track what's changing for audit log
    const oldRole = existingUser.role;
    const oldIsActive = existingUser.isActive;

    const user = await User.findByIdAndUpdate(
      id,
      { $set: updates },
      { new: true }
    );

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    // Log audit events for changes
    if (updates.role !== undefined && updates.role !== oldRole) {
      await logAudit(
        'user.role_changed',
        req.authUser!.userId,
        req.authUser!.username,
        { id: user._id.toString(), email: user.email, username: user.username || undefined },
        { oldRole, newRole: updates.role }
      );
    }

    if (updates.isActive === true && !oldIsActive) {
      await logAudit(
        'user.reactivated',
        req.authUser!.userId,
        req.authUser!.username,
        { id: user._id.toString(), email: user.email, username: user.username || undefined }
      );
    }

    res.json({
      _id: user._id,
      username: user.username,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      registrationStatus: user.registrationStatus,
      lastLoginAt: user.lastLoginAt,
      authProvider: user.authProvider,
      avatarUrl: user.avatarUrl,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// DELETE /api/users/:id - Deactivate user (admin only)
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!Types.ObjectId.isValid(id)) {
      res.status(400).json({ error: 'Invalid user ID' });
      return;
    }

    // Prevent deleting yourself
    const currentUserId = req.authUser?.userId;
    if (currentUserId === id) {
      res.status(400).json({ error: 'Cannot deactivate yourself' });
      return;
    }

    const user = await User.findByIdAndUpdate(
      id,
      { $set: { isActive: false, refreshTokenHash: null, inviteToken: null } },
      { new: true }
    );

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    // Log audit event
    await logAudit(
      'user.deactivated',
      req.authUser!.userId,
      req.authUser!.username,
      { id: user._id.toString(), email: user.email, username: user.username || undefined }
    );

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// GET /api/users/audit-log - Get audit log (admin only)
router.get('/audit-log', async (req: Request, res: Response) => {
  try {
    const { limit = '50', offset = '0', action } = req.query;

    const query: Record<string, unknown> = {};
    if (action && typeof action === 'string') {
      query.action = action;
    }

    const [logs, total] = await Promise.all([
      AuditLog.find(query)
        .sort({ createdAt: -1 })
        .skip(Number(offset))
        .limit(Number(limit)),
      AuditLog.countDocuments(query),
    ]);

    res.json({
      logs: logs.map((log) => ({
        _id: log._id,
        action: log.action,
        actorId: log.actorId,
        actorUsername: log.actorUsername,
        targetId: log.targetId,
        targetEmail: log.targetEmail,
        targetUsername: log.targetUsername,
        details: log.details,
        createdAt: log.createdAt,
      })),
      total,
      limit: Number(limit),
      offset: Number(offset),
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

export default router;
