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

// Detect if user is on Mac for display purposes
const isMac = typeof navigator !== 'undefined' && navigator.platform.toUpperCase().indexOf('MAC') >= 0;
const modKey = isMac ? '⌘' : 'Ctrl';

export const shortcuts: Shortcut[] = [
  { keys: `${modKey} 1`, description: 'Go to Dashboard', category: 'Navigation' },
  { keys: `${modKey} 2`, description: 'Go to Accounts', category: 'Navigation' },
  { keys: `${modKey} 3`, description: 'Go to Trades', category: 'Navigation' },
  { keys: `${modKey} 4`, description: 'Go to Logs', category: 'Navigation' },
  { keys: `${modKey} R`, description: 'Refresh data', category: 'Actions' },
  { keys: `${modKey} N`, description: 'New item (context-dependent)', category: 'Actions' },
  { keys: 'T', description: 'Toggle dark mode', category: 'Toggle' },
  { keys: '?', description: 'Show keyboard shortcuts', category: 'Actions' },
  { keys: 'Esc', description: 'Close dialog', category: 'Actions' },
];

// Check if the modifier key is pressed (Cmd on Mac, Ctrl on Windows/Linux)
function hasModifier(event: KeyboardEvent): boolean {
  return isMac ? event.metaKey : event.ctrlKey;
}

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

      // Modifier key shortcuts (Cmd/Ctrl + key)
      if (hasModifier(event)) {
        switch (key) {
          case 'r':
            event.preventDefault();
            handlers.onRefresh?.();
            break;
          case 'n':
            event.preventDefault();
            handlers.onNew?.();
            break;
        }
        return;
      }

      // Single key shortcuts (no modifier)
      switch (key) {
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

// Navigation shortcuts using Cmd/Ctrl + number keys
export function useNavigationShortcuts() {
  const navigate = useNavigate();

  useEffect(() => {
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

      // Only handle if modifier key is pressed
      if (!hasModifier(event)) return;

      switch (event.key) {
        case '1':
          event.preventDefault();
          navigate('/');
          break;
        case '2':
          event.preventDefault();
          navigate('/accounts');
          break;
        case '3':
          event.preventDefault();
          navigate('/trades');
          break;
        case '4':
          event.preventDefault();
          navigate('/logs');
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [navigate]);
}
