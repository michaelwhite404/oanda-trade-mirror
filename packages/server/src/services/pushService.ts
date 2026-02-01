import webpush from 'web-push';
import { PushSubscription } from '../db/models/PushSubscription';
import { Types } from 'mongoose';

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || '';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || '';
const VAPID_EMAIL = process.env.VAPID_EMAIL || 'mailto:admin@example.com';

// Configure web-push
if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
} else {
  console.warn('[PushService] VAPID keys not configured - push notifications disabled');
}

export interface PushPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  data?: Record<string, unknown>;
}

interface SubscriptionData {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

class PushService {
  getPublicKey(): string {
    return VAPID_PUBLIC_KEY;
  }

  async subscribe(userId: string, subscription: SubscriptionData): Promise<void> {
    // Upsert subscription (update if endpoint exists, create if not)
    await PushSubscription.findOneAndUpdate(
      { endpoint: subscription.endpoint },
      {
        userId: new Types.ObjectId(userId),
        endpoint: subscription.endpoint,
        keys: subscription.keys,
      },
      { upsert: true, new: true }
    );
  }

  async unsubscribe(endpoint: string): Promise<void> {
    await PushSubscription.deleteOne({ endpoint });
  }

  async unsubscribeUser(userId: string): Promise<void> {
    await PushSubscription.deleteMany({ userId: new Types.ObjectId(userId) });
  }

  async sendToUser(userId: string, payload: PushPayload): Promise<void> {
    const subscriptions = await PushSubscription.find({
      userId: new Types.ObjectId(userId),
    });

    await this.sendToSubscriptions(subscriptions, payload);
  }

  async sendToAll(payload: PushPayload): Promise<void> {
    const subscriptions = await PushSubscription.find();
    await this.sendToSubscriptions(subscriptions, payload);
  }

  private async sendToSubscriptions(
    subscriptions: Array<{ endpoint: string; keys: { p256dh: string; auth: string } }>,
    payload: PushPayload
  ): Promise<void> {
    const notifications = subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: sub.keys,
          },
          JSON.stringify(payload)
        );
      } catch (error: unknown) {
        // Remove invalid subscriptions (expired or unsubscribed)
        if (error && typeof error === 'object' && 'statusCode' in error) {
          const statusCode = (error as { statusCode: number }).statusCode;
          if (statusCode === 404 || statusCode === 410) {
            await PushSubscription.deleteOne({ endpoint: sub.endpoint });
          }
        }
        console.error('[PushService] Failed to send notification:', error);
      }
    });

    await Promise.allSettled(notifications);
  }

  // Convenience methods for common notifications
  async notifyTradeExecuted(
    userId: string,
    instrument: string,
    side: 'buy' | 'sell',
    units: number
  ): Promise<void> {
    await this.sendToUser(userId, {
      title: 'Trade Mirrored',
      body: `${side.toUpperCase()} ${Math.abs(units)} ${instrument}`,
      tag: 'trade-executed',
      data: { type: 'trade', instrument, side, units },
    });
  }

  async notifyTradeFailed(
    userId: string,
    instrument: string,
    error: string
  ): Promise<void> {
    await this.sendToUser(userId, {
      title: 'Mirror Failed',
      body: `Failed to mirror ${instrument}: ${error}`,
      tag: 'trade-failed',
      data: { type: 'error', instrument, error },
    });
  }
}

export const pushService = new PushService();
