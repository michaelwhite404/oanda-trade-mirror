import { Router, Request, Response } from 'express';
import { Types } from 'mongoose';
import { ExecutionLog } from '../db';
import { LogLevel, LogCategory } from '../types/models';
import { requireScope } from '../middleware/authMiddleware';

const router = Router();

// GET /api/logs - Get execution logs with optional filters
router.get('/', requireScope('read:logs'), async (req: Request, res: Response) => {
  try {
    const {
      level,
      category,
      sourceAccountId,
      mirrorAccountId,
      limit = '100',
      offset = '0',
    } = req.query;

    // Build query
    const query: Record<string, unknown> = {};

    if (level && ['info', 'warn', 'error', 'debug'].includes(level as string)) {
      query.level = level as LogLevel;
    }

    if (
      category &&
      ['trade', 'account', 'system', 'api'].includes(category as string)
    ) {
      query.category = category as LogCategory;
    }

    if (sourceAccountId && Types.ObjectId.isValid(sourceAccountId as string)) {
      query.sourceAccountId = new Types.ObjectId(sourceAccountId as string);
    }

    if (mirrorAccountId && Types.ObjectId.isValid(mirrorAccountId as string)) {
      query.mirrorAccountId = new Types.ObjectId(mirrorAccountId as string);
    }

    const logs = await ExecutionLog.find(query)
      .sort({ timestamp: -1 })
      .skip(parseInt(offset as string))
      .limit(Math.min(parseInt(limit as string), 500));

    const total = await ExecutionLog.countDocuments(query);

    res.json({
      logs,
      total,
      limit: parseInt(limit as string),
      offset: parseInt(offset as string),
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

export default router;
