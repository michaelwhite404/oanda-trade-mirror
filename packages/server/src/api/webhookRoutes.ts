import { Router, Request, Response } from 'express';
import { Types } from 'mongoose';
import { Webhook, WEBHOOK_EVENTS } from '../db';
import { generateWebhookSecret } from '../services/webhookService';

const router = Router();

// GET /api/webhooks - List user's webhooks
router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = req.authUser!.userId;
    const webhooks = await Webhook.find({ userId }).sort({ createdAt: -1 });

    // Don't expose full secrets in list view
    const sanitized = webhooks.map((w) => ({
      _id: w._id,
      name: w.name,
      url: w.url,
      secret: w.secret.substring(0, 8) + '...',
      events: w.events,
      isActive: w.isActive,
      lastTriggeredAt: w.lastTriggeredAt,
      failureCount: w.failureCount,
      createdAt: w.createdAt,
      updatedAt: w.updatedAt,
    }));

    res.json(sanitized);
  } catch (error) {
    console.error('Error fetching webhooks:', error);
    res.status(500).json({ error: 'Failed to fetch webhooks' });
  }
});

// GET /api/webhooks/events - List available webhook events
router.get('/events', (_req: Request, res: Response) => {
  res.json(WEBHOOK_EVENTS);
});

// POST /api/webhooks - Create a new webhook
router.post('/', async (req: Request, res: Response) => {
  try {
    const userId = req.authUser!.userId;
    const { name, url, events } = req.body;

    if (!name || !url || !events || !Array.isArray(events) || events.length === 0) {
      return res.status(400).json({ error: 'Name, URL, and at least one event are required' });
    }

    // Validate URL format
    try {
      new URL(url);
    } catch {
      return res.status(400).json({ error: 'Invalid URL format' });
    }

    // Validate events
    const invalidEvents = events.filter((e: string) => !WEBHOOK_EVENTS.includes(e as any));
    if (invalidEvents.length > 0) {
      return res.status(400).json({ error: `Invalid events: ${invalidEvents.join(', ')}` });
    }

    const secret = generateWebhookSecret();

    const webhook = await Webhook.create({
      userId,
      name,
      url,
      secret,
      events,
      isActive: true,
      lastTriggeredAt: null,
      failureCount: 0,
    });

    // Return full secret only on creation
    res.status(201).json({
      _id: webhook._id,
      name: webhook.name,
      url: webhook.url,
      secret: webhook.secret, // Full secret on creation
      events: webhook.events,
      isActive: webhook.isActive,
      lastTriggeredAt: webhook.lastTriggeredAt,
      failureCount: webhook.failureCount,
      createdAt: webhook.createdAt,
    });
  } catch (error) {
    console.error('Error creating webhook:', error);
    res.status(500).json({ error: 'Failed to create webhook' });
  }
});

// PATCH /api/webhooks/:id - Update a webhook
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const userId = req.authUser!.userId;
    const { id } = req.params;
    const { name, url, events, isActive } = req.body;

    if (!Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid webhook ID' });
    }

    const webhook = await Webhook.findOne({ _id: id, userId });
    if (!webhook) {
      return res.status(404).json({ error: 'Webhook not found' });
    }

    // Validate URL if provided
    if (url) {
      try {
        new URL(url);
      } catch {
        return res.status(400).json({ error: 'Invalid URL format' });
      }
    }

    // Validate events if provided
    if (events) {
      if (!Array.isArray(events) || events.length === 0) {
        return res.status(400).json({ error: 'At least one event is required' });
      }
      const invalidEvents = events.filter((e: string) => !WEBHOOK_EVENTS.includes(e as any));
      if (invalidEvents.length > 0) {
        return res.status(400).json({ error: `Invalid events: ${invalidEvents.join(', ')}` });
      }
    }

    const update: Record<string, unknown> = {};
    if (name !== undefined) update.name = name;
    if (url !== undefined) update.url = url;
    if (events !== undefined) update.events = events;
    if (isActive !== undefined) {
      update.isActive = isActive;
      // Reset failure count when re-enabling
      if (isActive) {
        update.failureCount = 0;
      }
    }

    const updated = await Webhook.findByIdAndUpdate(id, { $set: update }, { new: true });

    res.json({
      _id: updated!._id,
      name: updated!.name,
      url: updated!.url,
      secret: updated!.secret.substring(0, 8) + '...',
      events: updated!.events,
      isActive: updated!.isActive,
      lastTriggeredAt: updated!.lastTriggeredAt,
      failureCount: updated!.failureCount,
      createdAt: updated!.createdAt,
      updatedAt: updated!.updatedAt,
    });
  } catch (error) {
    console.error('Error updating webhook:', error);
    res.status(500).json({ error: 'Failed to update webhook' });
  }
});

// POST /api/webhooks/:id/regenerate-secret - Regenerate webhook secret
router.post('/:id/regenerate-secret', async (req: Request, res: Response) => {
  try {
    const userId = req.authUser!.userId;
    const { id } = req.params;

    if (!Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid webhook ID' });
    }

    const webhook = await Webhook.findOne({ _id: id, userId });
    if (!webhook) {
      return res.status(404).json({ error: 'Webhook not found' });
    }

    const newSecret = generateWebhookSecret();
    await Webhook.updateOne({ _id: id }, { $set: { secret: newSecret } });

    res.json({ secret: newSecret });
  } catch (error) {
    console.error('Error regenerating webhook secret:', error);
    res.status(500).json({ error: 'Failed to regenerate secret' });
  }
});

// DELETE /api/webhooks/:id - Delete a webhook
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const userId = req.authUser!.userId;
    const { id } = req.params;

    if (!Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid webhook ID' });
    }

    const result = await Webhook.deleteOne({ _id: id, userId });
    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Webhook not found' });
    }

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting webhook:', error);
    res.status(500).json({ error: 'Failed to delete webhook' });
  }
});

// POST /api/webhooks/:id/test - Send a test webhook
router.post('/:id/test', async (req: Request, res: Response) => {
  try {
    const userId = req.authUser!.userId;
    const { id } = req.params;

    if (!Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid webhook ID' });
    }

    const webhook = await Webhook.findOne({ _id: id, userId });
    if (!webhook) {
      return res.status(404).json({ error: 'Webhook not found' });
    }

    const { dispatchWebhookEvent } = await import('../services/webhookService');

    // Temporarily enable the webhook for the test if it's disabled
    const wasActive = webhook.isActive;
    if (!wasActive) {
      await Webhook.updateOne({ _id: id }, { $set: { isActive: true } });
    }

    await dispatchWebhookEvent(userId.toString(), 'trade.mirrored', {
      test: true,
      message: 'This is a test webhook delivery',
      timestamp: new Date().toISOString(),
    });

    // Restore original state if it was disabled
    if (!wasActive) {
      await Webhook.updateOne({ _id: id }, { $set: { isActive: false } });
    }

    res.json({ success: true, message: 'Test webhook sent' });
  } catch (error) {
    console.error('Error sending test webhook:', error);
    res.status(500).json({ error: 'Failed to send test webhook' });
  }
});

export default router;
