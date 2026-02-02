import { Router, Request, Response } from 'express';
import { Types } from 'mongoose';
import bcrypt from 'bcrypt';
import { User } from '../db/models/User';
import { UserRole } from '../types/models';

const SALT_ROUNDS = 12;

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

// POST /api/users - Create new user (admin only)
router.post('/', async (req: Request, res: Response) => {
  try {
    const { username, email, password, role } = req.body;

    if (!username || !email || !password) {
      res.status(400).json({ error: 'Username, email, and password are required' });
      return;
    }

    if (password.length < 8) {
      res.status(400).json({ error: 'Password must be at least 8 characters' });
      return;
    }

    // Check if username or email already exists
    const existingUser = await User.findOne({
      $or: [{ username }, { email: email.toLowerCase() }],
    });

    if (existingUser) {
      if (existingUser.username === username) {
        res.status(400).json({ error: 'Username already exists' });
      } else {
        res.status(400).json({ error: 'Email already exists' });
      }
      return;
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    const user = new User({
      username,
      email: email.toLowerCase(),
      passwordHash,
      role: (role as UserRole) || 'viewer',
      authProvider: 'local',
      isActive: true,
    });

    await user.save();

    res.status(201).json({
      _id: user._id,
      username: user.username,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      authProvider: user.authProvider,
      createdAt: user.createdAt,
    });
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
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
      { $set: { isActive: false, refreshTokenHash: null } },
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
