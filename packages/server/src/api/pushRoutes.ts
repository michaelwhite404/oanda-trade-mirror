import { Router, Request, Response } from 'express';
import { pushService } from '../services/pushService';
import { authenticate } from '../middleware/authMiddleware';

const router = Router();

// GET /api/push/vapid-public-key - Get VAPID public key for client subscription
router.get('/vapid-public-key', (_req: Request, res: Response) => {
  const publicKey = pushService.getPublicKey();
  if (!publicKey) {
    res.status(503).json({ error: 'Push notifications not configured' });
    return;
  }
  res.json({ publicKey });
});

// POST /api/push/subscribe - Subscribe to push notifications
router.post('/subscribe', authenticate, async (req: Request, res: Response) => {
  try {
    const { subscription } = req.body;

    if (!subscription || !subscription.endpoint || !subscription.keys) {
      res.status(400).json({ error: 'Invalid subscription data' });
      return;
    }

    await pushService.subscribe(req.authUser!.userId, subscription);
    res.json({ success: true });
  } catch (error) {
    console.error('[Push] Subscribe error:', error);
    res.status(500).json({ error: 'Failed to subscribe' });
  }
});

// POST /api/push/unsubscribe - Unsubscribe from push notifications
router.post('/unsubscribe', authenticate, async (req: Request, res: Response) => {
  try {
    const { endpoint } = req.body;

    if (!endpoint) {
      res.status(400).json({ error: 'Endpoint required' });
      return;
    }

    await pushService.unsubscribe(endpoint);
    res.json({ success: true });
  } catch (error) {
    console.error('[Push] Unsubscribe error:', error);
    res.status(500).json({ error: 'Failed to unsubscribe' });
  }
});

// POST /api/push/test - Send a test notification (for debugging)
router.post('/test', authenticate, async (req: Request, res: Response) => {
  try {
    await pushService.sendToUser(req.authUser!.userId, {
      title: 'Test Notification',
      body: 'Push notifications are working!',
      tag: 'test',
    });
    res.json({ success: true });
  } catch (error) {
    console.error('[Push] Test notification error:', error);
    res.status(500).json({ error: 'Failed to send test notification' });
  }
});

export default router;
