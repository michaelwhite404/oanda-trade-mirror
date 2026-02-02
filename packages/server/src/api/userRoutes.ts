import { Router, Request, Response } from 'express';
import { Types } from 'mongoose';
import crypto from 'crypto';
import { User } from '../db/models/User';
import { UserRole } from '../types/models';
import { emailService } from '../services/emailService';

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

    const user = await User.findByIdAndUpdate(
      id,
      { $set: updates },
      { new: true }
    );

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
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

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

export default router;
