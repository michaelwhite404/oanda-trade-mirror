import { Router } from 'express';
import accountRoutes from './accountRoutes';
import tradeRoutes from './tradeRoutes';
import logRoutes from './logRoutes';
import authRoutes from './authRoutes';
import pushRoutes from './pushRoutes';
import userRoutes from './userRoutes';
import apiKeyRoutes from './apiKeyRoutes';
import webhookRoutes from './webhookRoutes';
import { streamManager } from '../streaming/streamManager';
import { authenticate, requireRole } from '../middleware/authMiddleware';
import { apiLimiter } from '../middleware/rateLimiter';

const router = Router();

// Health check endpoint (no rate limit)
router.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Stream status endpoint
router.get('/streams/status', (_req, res) => {
  const streamStatus = streamManager.getStatus();
  const streams = Array.from(streamStatus.entries()).map(([accountId, info]) => ({
    accountId,
    oandaAccountId: info.oandaAccountId,
    status: info.status,
  }));

  // Calculate overall status
  let overallStatus: 'connected' | 'degraded' | 'disconnected' = 'disconnected';

  if (streams.length === 0) {
    overallStatus = 'disconnected';
  } else if (streams.every(s => s.status === 'connected')) {
    overallStatus = 'connected';
  } else if (streams.some(s => s.status === 'connected' || s.status === 'fallback')) {
    overallStatus = 'degraded';
  }

  res.json({
    overallStatus,
    streamCount: streams.length,
    streams,
  });
});

// Apply general rate limit to all remaining routes
router.use(apiLimiter);

// Auth routes (public)
router.use('/auth', authRoutes);

// Push routes (public key endpoint is public, subscribe/unsubscribe are protected)
router.use('/push', pushRoutes);

// Protected routes
router.use('/accounts', authenticate, accountRoutes);
router.use('/trades', authenticate, tradeRoutes);
router.use('/logs', authenticate, logRoutes);
router.use('/api-keys', authenticate, apiKeyRoutes);
router.use('/webhooks', authenticate, webhookRoutes);

// Admin-only routes
router.use('/users', authenticate, requireRole('admin'), userRoutes);

export default router;
