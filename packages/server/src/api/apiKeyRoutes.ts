import { Router, Request, Response } from 'express';
import { Types } from 'mongoose';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import { ApiKey } from '../db/models/ApiKey';

const router = Router();
const SALT_ROUNDS = 12;

function generateApiKey(): string {
  // Generate a 32-byte random key and encode as base64url
  const buffer = crypto.randomBytes(32);
  return 'otm_' + buffer.toString('base64url');
}

// GET /api/api-keys - List user's API keys
router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = req.authUser!.userId;

    const keys = await ApiKey.find({ userId }).sort({ createdAt: -1 });

    const sanitized = keys.map((key) => ({
      _id: key._id,
      name: key.name,
      keyPrefix: key.keyPrefix,
      isActive: key.isActive,
      lastUsedAt: key.lastUsedAt,
      expiresAt: key.expiresAt,
      createdAt: key.createdAt,
    }));

    res.json(sanitized);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// POST /api/api-keys - Create new API key
router.post('/', async (req: Request, res: Response) => {
  try {
    const userId = req.authUser!.userId;
    const { name, expiresInDays } = req.body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      res.status(400).json({ error: 'Name is required' });
      return;
    }

    if (name.length > 100) {
      res.status(400).json({ error: 'Name must be 100 characters or less' });
      return;
    }

    // Check key limit per user (max 10)
    const existingCount = await ApiKey.countDocuments({ userId, isActive: true });
    if (existingCount >= 10) {
      res.status(400).json({ error: 'Maximum of 10 active API keys allowed' });
      return;
    }

    // Generate the key
    const plainKey = generateApiKey();
    const keyHash = await bcrypt.hash(plainKey, SALT_ROUNDS);
    const keyPrefix = plainKey.substring(0, 12); // "otm_" + 8 chars

    // Calculate expiry if specified
    let expiresAt: Date | null = null;
    if (expiresInDays && typeof expiresInDays === 'number' && expiresInDays > 0) {
      expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + expiresInDays);
    }

    const apiKey = new ApiKey({
      userId: new Types.ObjectId(userId),
      name: name.trim(),
      keyHash,
      keyPrefix,
      isActive: true,
      expiresAt,
    });

    await apiKey.save();

    // Return the full key only this once
    res.status(201).json({
      _id: apiKey._id,
      name: apiKey.name,
      key: plainKey, // Only returned on creation!
      keyPrefix: apiKey.keyPrefix,
      isActive: apiKey.isActive,
      expiresAt: apiKey.expiresAt,
      createdAt: apiKey.createdAt,
    });
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

// DELETE /api/api-keys/:id - Revoke an API key
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const userId = req.authUser!.userId;
    const { id } = req.params;

    if (!Types.ObjectId.isValid(id)) {
      res.status(400).json({ error: 'Invalid API key ID' });
      return;
    }

    const apiKey = await ApiKey.findOneAndUpdate(
      { _id: id, userId },
      { $set: { isActive: false } },
      { new: true }
    );

    if (!apiKey) {
      res.status(404).json({ error: 'API key not found' });
      return;
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// PATCH /api/api-keys/:id - Update API key name
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const userId = req.authUser!.userId;
    const { id } = req.params;
    const { name } = req.body;

    if (!Types.ObjectId.isValid(id)) {
      res.status(400).json({ error: 'Invalid API key ID' });
      return;
    }

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      res.status(400).json({ error: 'Name is required' });
      return;
    }

    const apiKey = await ApiKey.findOneAndUpdate(
      { _id: id, userId },
      { $set: { name: name.trim() } },
      { new: true }
    );

    if (!apiKey) {
      res.status(404).json({ error: 'API key not found' });
      return;
    }

    res.json({
      _id: apiKey._id,
      name: apiKey.name,
      keyPrefix: apiKey.keyPrefix,
      isActive: apiKey.isActive,
      lastUsedAt: apiKey.lastUsedAt,
      expiresAt: apiKey.expiresAt,
      createdAt: apiKey.createdAt,
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

export default router;
