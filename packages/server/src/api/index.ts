import { Router } from 'express';
import accountRoutes from './accountRoutes';
import tradeRoutes from './tradeRoutes';
import logRoutes from './logRoutes';
import { streamManager } from '../streaming/streamManager';

const router = Router();

router.use('/accounts', accountRoutes);
router.use('/trades', tradeRoutes);
router.use('/logs', logRoutes);

// Health check endpoint
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

export default router;
