import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface DeleteConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  accountId: string;
  accountName: string;
  type: 'source' | 'mirror';
  isDeleting: boolean;
}

export function DeleteConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
  accountId,
  accountName,
  type,
  isDeleting,
}: DeleteConfirmDialogProps) {
  const [confirmText, setConfirmText] = useState('');

  const handleClose = (isOpen: boolean) => {
    if (!isOpen) {
      setConfirmText('');
    }
    onOpenChange(isOpen);
  };

  const handleConfirm = () => {
    if (confirmText === accountId) {
      onConfirm();
      setConfirmText('');
    }
  };

  const isConfirmEnabled = confirmText === accountId;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete {type === 'source' ? 'Source' : 'Mirror'} Account</DialogTitle>
          <DialogDescription>
            This action cannot be undone. This will permanently deactivate the account
            {type === 'source' && ' and all its mirror accounts'}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <p className="text-sm">
            To confirm, please type the account ID:{' '}
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-sm">
              {accountId}
            </code>
          </p>
          {accountName !== accountId && (
            <p className="text-sm text-muted-foreground">
              Account: {accountName}
            </p>
          )}
          <div className="space-y-2">
            <Label htmlFor="confirmText">Account ID</Label>
            <Input
              id="confirmText"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="Type account ID to confirm"
              autoComplete="off"
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => handleClose(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleConfirm}
            disabled={!isConfirmEnabled || isDeleting}
          >
            {isDeleting ? 'Deleting...' : 'Delete Account'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
