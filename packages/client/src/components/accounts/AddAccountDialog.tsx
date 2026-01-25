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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useValidateCredentials } from '@/hooks/useAccounts';

interface AddAccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: AccountFormData) => void;
  type: 'source' | 'mirror';
  isSubmitting: boolean;
}

export interface AccountFormData {
  oandaAccountId: string;
  apiToken: string;
  environment: 'practice' | 'live';
  scaleFactor?: number;
  alias?: string;
}

export function AddAccountDialog({
  open,
  onOpenChange,
  onSubmit,
  type,
  isSubmitting,
}: AddAccountDialogProps) {
  const [formData, setFormData] = useState<AccountFormData>({
    oandaAccountId: '',
    apiToken: '',
    environment: 'practice',
    scaleFactor: 1.0,
    alias: '',
  });
  const [validationError, setValidationError] = useState<string | null>(null);
  const validateMutation = useValidateCredentials();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    // Validate credentials first
    try {
      const result = await validateMutation.mutateAsync({
        oandaAccountId: formData.oandaAccountId,
        apiToken: formData.apiToken,
        environment: formData.environment,
      });

      if (!result.valid) {
        setValidationError(result.error || 'Invalid credentials');
        return;
      }

      onSubmit(formData);
      setFormData({
        oandaAccountId: '',
        apiToken: '',
        environment: 'practice',
        scaleFactor: 1.0,
        alias: '',
      });
    } catch (error) {
      setValidationError((error as Error).message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Add {type === 'source' ? 'Source' : 'Mirror'} Account
          </DialogTitle>
          <DialogDescription>
            Enter the OANDA account credentials.{' '}
            {type === 'mirror' && 'This account will mirror trades from the selected source.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="oandaAccountId">OANDA Account ID</Label>
            <Input
              id="oandaAccountId"
              value={formData.oandaAccountId}
              onChange={(e) =>
                setFormData({ ...formData, oandaAccountId: e.target.value })
              }
              placeholder="XXX-XXX-XXXXXXXX-XXX"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="alias">Alias (optional)</Label>
            <Input
              id="alias"
              value={formData.alias}
              onChange={(e) =>
                setFormData({ ...formData, alias: e.target.value })
              }
              placeholder="e.g., Main Trading, Test Account"
            />
            <p className="text-xs text-muted-foreground">
              A friendly name to help identify this account
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="apiToken">API Token</Label>
            <Input
              id="apiToken"
              type="password"
              value={formData.apiToken}
              onChange={(e) =>
                setFormData({ ...formData, apiToken: e.target.value })
              }
              placeholder="Enter your API token"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="environment">Environment</Label>
            <Select
              value={formData.environment}
              onValueChange={(value: 'practice' | 'live') =>
                setFormData({ ...formData, environment: value })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="practice">Practice</SelectItem>
                <SelectItem value="live">Live</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {type === 'mirror' && (
            <div className="space-y-2">
              <Label htmlFor="scaleFactor">Scale Factor</Label>
              <Input
                id="scaleFactor"
                type="number"
                step="0.01"
                min="0.01"
                max="100"
                value={formData.scaleFactor}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    scaleFactor: parseFloat(e.target.value) || 1.0,
                  })
                }
              />
              <p className="text-xs text-muted-foreground">
                Trade size multiplier (e.g., 0.5 = half size, 2.0 = double size)
              </p>
            </div>
          )}

          {validationError && (
            <p className="text-sm text-destructive">{validationError}</p>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || validateMutation.isPending}
            >
              {validateMutation.isPending
                ? 'Validating...'
                : isSubmitting
                ? 'Adding...'
                : 'Add Account'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
