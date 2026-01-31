import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { shortcuts, Shortcut } from '@/hooks/useKeyboardShortcuts';
import { Keyboard } from 'lucide-react';

function ShortcutKey({ keys }: { keys: string }) {
  const keyParts = keys.split(' ');
  return (
    <span className="flex items-center gap-1">
      {keyParts.map((key, i) => (
        <span key={i}>
          <kbd className="rounded bg-muted px-2 py-1 font-mono text-sm">
            {key}
          </kbd>
          {i < keyParts.length - 1 && <span className="mx-1 text-muted-foreground">then</span>}
        </span>
      ))}
    </span>
  );
}

function ShortcutGroup({ category, items }: { category: string; items: Shortcut[] }) {
  return (
    <div>
      <h3 className="mb-2 text-sm font-medium text-muted-foreground">{category}</h3>
      <div className="space-y-2">
        {items.map((shortcut) => (
          <div key={shortcut.keys} className="flex items-center justify-between">
            <span className="text-sm">{shortcut.description}</span>
            <ShortcutKey keys={shortcut.keys} />
          </div>
        ))}
      </div>
    </div>
  );
}

export function KeyboardShortcutsDialog() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handleShowShortcuts = () => setOpen(true);
    window.addEventListener('show-shortcuts', handleShowShortcuts);
    return () => window.removeEventListener('show-shortcuts', handleShowShortcuts);
  }, []);

  const navigation = shortcuts.filter((s) => s.category === 'Navigation');
  const actions = shortcuts.filter((s) => s.category === 'Actions');
  const toggles = shortcuts.filter((s) => s.category === 'Toggle');

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Keyboard className="h-5 w-5" />
            Keyboard Shortcuts
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-6">
          <ShortcutGroup category="Navigation" items={navigation} />
          <ShortcutGroup category="Actions" items={actions} />
          <ShortcutGroup category="Toggle" items={toggles} />
        </div>
        <p className="text-xs text-muted-foreground">
          Press <kbd className="rounded bg-muted px-1.5 py-0.5 font-mono">?</kbd> anytime to show this dialog
        </p>
      </DialogContent>
    </Dialog>
  );
}
