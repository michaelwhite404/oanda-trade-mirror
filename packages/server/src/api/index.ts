import { Router } from 'express';
import accountRoutes from './accountRoutes';
import tradeRoutes from './tradeRoutes';
import logRoutes from './logRoutes';

const router = Router();

router.use('/accounts', accountRoutes);
router.use('/trades', tradeRoutes);
router.use('/logs', logRoutes);

// Health check endpoint
router.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

export default router;
