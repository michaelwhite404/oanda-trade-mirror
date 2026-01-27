import { useEffect, useState, useCallback } from 'react';
import { useWebSocketContext, WebSocketMessage } from '@/context/WebSocketContext';

type NotificationPermission = 'default' | 'granted' | 'denied';

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
          // Show test notification
          new Notification('Notifications Enabled', {
            body: 'You will be notified when trades are mirrored',
            icon: '/favicon.ico',
          });
        }
      } else if (permission === 'granted') {
        setEnabled(true);
        localStorage.setItem('notifications', 'true');
        // Show test notification
        new Notification('Notifications Enabled', {
          body: 'You will be notified when trades are mirrored',
          icon: '/favicon.ico',
        });
      }
    } else {
      // Disabling
      setEnabled(false);
      localStorage.setItem('notifications', 'false');
    }
  }, [enabled, permission, requestPermission]);

  const showNotification = useCallback((title: string, options?: NotificationOptions) => {
    if (!enabled || permission !== 'granted') return;

    try {
      new Notification(title, {
        icon: '/favicon.ico',
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
