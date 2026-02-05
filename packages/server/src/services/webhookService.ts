import crypto from 'crypto';
import { Webhook, WebhookDocument, WebhookEvent } from '../db';

interface WebhookPayload {
  event: WebhookEvent;
  timestamp: string;
  data: Record<string, unknown>;
}

function signPayload(payload: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

async function deliverWebhook(
  webhook: WebhookDocument,
  payload: WebhookPayload
): Promise<boolean> {
  const body = JSON.stringify(payload);
  const signature = signPayload(body, webhook.secret);

  try {
    const response = await fetch(webhook.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Signature': signature,
        'X-Webhook-Event': payload.event,
        'X-Webhook-Timestamp': payload.timestamp,
      },
      body,
      signal: AbortSignal.timeout(10000), // 10 second timeout
    });

    if (response.ok) {
      await Webhook.updateOne(
        { _id: webhook._id },
        {
          $set: { lastTriggeredAt: new Date(), failureCount: 0 },
        }
      );
      return true;
    } else {
      console.error(
        `Webhook delivery failed for ${webhook.name}: ${response.status} ${response.statusText}`
      );
      await incrementFailureCount(webhook);
      return false;
    }
  } catch (error) {
    console.error(`Webhook delivery error for ${webhook.name}:`, error);
    await incrementFailureCount(webhook);
    return false;
  }
}

async function incrementFailureCount(webhook: WebhookDocument): Promise<void> {
  const newFailureCount = webhook.failureCount + 1;
  const update: Record<string, unknown> = {
    failureCount: newFailureCount,
    lastTriggeredAt: new Date(),
  };

  // Disable webhook after 5 consecutive failures
  if (newFailureCount >= 5) {
    update.isActive = false;
    console.warn(`Webhook ${webhook.name} disabled after ${newFailureCount} consecutive failures`);
  }

  await Webhook.updateOne({ _id: webhook._id }, { $set: update });
}

export async function dispatchWebhookEvent(
  userId: string,
  event: WebhookEvent,
  data: Record<string, unknown>
): Promise<void> {
  const webhooks = await Webhook.find({
    userId,
    events: event,
    isActive: true,
  });

  if (webhooks.length === 0) {
    return;
  }

  const payload: WebhookPayload = {
    event,
    timestamp: new Date().toISOString(),
    data,
  };

  // Deliver to all matching webhooks in parallel
  await Promise.allSettled(
    webhooks.map((webhook) => deliverWebhook(webhook, payload))
  );
}

export function generateWebhookSecret(): string {
  return crypto.randomBytes(32).toString('hex');
}
