import { useEffect, useState, useCallback } from 'react';
import { useWebSocketContext, WebSocketMessage } from '@/context/WebSocketContext';

type NotificationPermission = 'default' | 'granted' | 'denied';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

async function subscribeToPush(): Promise<boolean> {
  try {
    // Get VAPID public key from server
    const keyResponse = await fetch('/api/push/vapid-public-key', {
      credentials: 'include',
    });

    if (!keyResponse.ok) return false;

    const { publicKey } = await keyResponse.json();

    // Get service worker registration
    const registration = await navigator.serviceWorker.ready;

    // Subscribe to push
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
    });

    // Send subscription to server
    const subscribeResponse = await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        subscription: {
          endpoint: subscription.endpoint,
          keys: {
            p256dh: btoa(String.fromCharCode(...new Uint8Array(subscription.getKey('p256dh')!))),
            auth: btoa(String.fromCharCode(...new Uint8Array(subscription.getKey('auth')!))),
          },
        },
      }),
    });

    return subscribeResponse.ok;
  } catch (error) {
    console.error('Failed to subscribe to push:', error);
    return false;
  }
}

async function unsubscribeFromPush(): Promise<void> {
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();

    if (subscription) {
      await subscription.unsubscribe();
      await fetch('/api/push/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ endpoint: subscription.endpoint }),
      });
    }
  } catch (error) {
    console.error('Failed to unsubscribe from push:', error);
  }
}

export function useNotifications() {
  const [permission, setPermission] = useState<NotificationPermission>(() => {
    if (typeof Notification === 'undefined') return 'denied';
    return Notification.permission;
  });

  const [enabled, setEnabled] = useState<boolean>(() => {
    return localStorage.getItem('notifications') === 'true';
  });

  const { addMessageHandler } = useWebSocketContext();

  const requestPermission = useCallback(async () => {
    if (typeof Notification === 'undefined') {
      console.warn('Notifications not supported');
      return 'denied';
    }

    const result = await Notification.requestPermission();
    setPermission(result);
    return result;
  }, []);

  const toggleNotifications = useCallback(async () => {
    if (!enabled) {
      // Enabling - request permission first if needed
      if (permission === 'default') {
        const result = await requestPermission();
        if (result === 'granted') {
          setEnabled(true);
          localStorage.setItem('notifications', 'true');
          // Subscribe to push notifications
          const pushSubscribed = await subscribeToPush();
          // Show test notification
          new Notification('Notifications Enabled', {
            body: pushSubscribed
              ? 'You will receive push notifications for trades'
              : 'You will be notified when trades are mirrored',
            icon: '/icon-192.png',
          });
        }
      } else if (permission === 'granted') {
        setEnabled(true);
        localStorage.setItem('notifications', 'true');
        // Subscribe to push notifications
        const pushSubscribed = await subscribeToPush();
        // Show test notification
        new Notification('Notifications Enabled', {
          body: pushSubscribed
            ? 'You will receive push notifications for trades'
            : 'You will be notified when trades are mirrored',
          icon: '/icon-192.png',
        });
      }
    } else {
      // Disabling
      setEnabled(false);
      localStorage.setItem('notifications', 'false');
      // Unsubscribe from push
      await unsubscribeFromPush();
    }
  }, [enabled, permission, requestPermission]);

  const showNotification = useCallback((title: string, options?: NotificationOptions) => {
    if (!enabled || permission !== 'granted') return;

    try {
      new Notification(title, {
        icon: '/icon-192.png',
        ...options,
      });
    } catch (err) {
      console.error('Failed to show notification:', err);
    }
  }, [enabled, permission]);

  // Listen for WebSocket messages
  useEffect(() => {
    if (!enabled || permission !== 'granted') return;

    const handleMessage = (message: WebSocketMessage) => {
      if (message.type === 'trade:mirror:complete') {
        const { success, executedUnits, errorMessage } = message as WebSocketMessage & {
          success: boolean;
          executedUnits?: number;
          errorMessage?: string;
        };

        if (success) {
          showNotification('Trade Mirrored', {
            body: `Successfully mirrored ${executedUnits} units`,
            tag: 'mirror-success',
          });
        } else {
          showNotification('Mirror Failed', {
            body: errorMessage || 'Failed to mirror trade',
            tag: 'mirror-failed',
          });
        }
      }
    };

    const unsubscribe = addMessageHandler(handleMessage);
    return unsubscribe;
  }, [enabled, permission, addMessageHandler, showNotification]);

  return {
    permission,
    enabled,
    toggleNotifications,
    requestPermission,
    showNotification,
    isSupported: typeof Notification !== 'undefined',
  };
}
