import { useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from './useTheme';

interface ShortcutHandlers {
  onRefresh?: () => void;
  onNew?: () => void;
}

export interface Shortcut {
  keys: string;
  description: string;
  category: 'Navigation' | 'Actions' | 'Toggle';
}

export const shortcuts: Shortcut[] = [
  { keys: 'g d', description: 'Go to Dashboard', category: 'Navigation' },
  { keys: 'g a', description: 'Go to Accounts', category: 'Navigation' },
  { keys: 'g t', description: 'Go to Trades', category: 'Navigation' },
  { keys: 'g l', description: 'Go to Logs', category: 'Navigation' },
  { keys: 'r', description: 'Refresh data', category: 'Actions' },
  { keys: 'n', description: 'New item (context-dependent)', category: 'Actions' },
  { keys: 't', description: 'Toggle dark mode', category: 'Toggle' },
  { keys: '?', description: 'Show keyboard shortcuts', category: 'Actions' },
  { keys: 'Esc', description: 'Close dialog', category: 'Actions' },
];

export function useKeyboardShortcuts(handlers: ShortcutHandlers = {}) {
  const { toggleTheme } = useTheme();

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in inputs
      const target = event.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable
      ) {
        return;
      }

      const key = event.key.toLowerCase();

      // Single key shortcuts
      switch (key) {
        case 'r':
          event.preventDefault();
          handlers.onRefresh?.();
          break;
        case 'n':
          event.preventDefault();
          handlers.onNew?.();
          break;
        case 't':
          event.preventDefault();
          toggleTheme();
          break;
        case '?':
          event.preventDefault();
          // Dispatch custom event to show shortcuts modal
          window.dispatchEvent(new CustomEvent('show-shortcuts'));
          break;
      }
    },
    [handlers, toggleTheme]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}

// Separate hook for 'g' prefix navigation shortcuts
export function useNavigationShortcuts() {
  const navigate = useNavigate();

  useEffect(() => {
    let gPressed = false;
    let gTimeout: ReturnType<typeof setTimeout> | null = null;

    const handleKeyDown = (event: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in inputs
      const target = event.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable
      ) {
        return;
      }

      const key = event.key.toLowerCase();

      if (key === 'g' && !gPressed) {
        gPressed = true;
        // Reset after 1 second
        gTimeout = setTimeout(() => {
          gPressed = false;
        }, 1000);
        return;
      }

      if (gPressed) {
        gPressed = false;
        if (gTimeout) clearTimeout(gTimeout);

        switch (key) {
          case 'd':
            event.preventDefault();
            navigate('/');
            break;
          case 'a':
            event.preventDefault();
            navigate('/accounts');
            break;
          case 't':
            event.preventDefault();
            navigate('/trades');
            break;
          case 'l':
            event.preventDefault();
            navigate('/logs');
            break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (gTimeout) clearTimeout(gTimeout);
    };
  }, [navigate]);
}
