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

interface PlaceTradeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: TradeFormData) => void;
  isSubmitting: boolean;
}

export interface TradeFormData {
  instrument: string;
  units: number;
  side: 'buy' | 'sell';
  tp?: number;
  sl?: number;
}

const COMMON_INSTRUMENTS = [
  'EUR_USD',
  'GBP_USD',
  'USD_JPY',
  'USD_CHF',
  'AUD_USD',
  'USD_CAD',
  'NZD_USD',
  'EUR_GBP',
  'EUR_JPY',
  'GBP_JPY',
];

export function PlaceTradeDialog({
  open,
  onOpenChange,
  onSubmit,
  isSubmitting,
}: PlaceTradeDialogProps) {
  const [formData, setFormData] = useState<TradeFormData>({
    instrument: 'EUR_USD',
    units: 1000,
    side: 'buy',
  });
  const [customInstrument, setCustomInstrument] = useState('');
  const [useCustom, setUseCustom] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      ...formData,
      instrument: useCustom ? customInstrument : formData.instrument,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Place Trade</DialogTitle>
          <DialogDescription>
            Place a market order on the source account. This trade will be
            automatically mirrored to all connected mirror accounts.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="instrument">Instrument</Label>
            {useCustom ? (
              <div className="flex gap-2">
                <Input
                  id="instrument"
                  value={customInstrument}
                  onChange={(e) => setCustomInstrument(e.target.value.toUpperCase())}
                  placeholder="e.g., XAU_USD"
                  required
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setUseCustom(false)}
                >
                  List
                </Button>
              </div>
            ) : (
              <div className="flex gap-2">
                <Select
                  value={formData.instrument}
                  onValueChange={(value) =>
                    setFormData({ ...formData, instrument: value })
                  }
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {COMMON_INSTRUMENTS.map((inst) => (
                      <SelectItem key={inst} value={inst}>
                        {inst}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setUseCustom(true)}
                >
                  Custom
                </Button>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="side">Side</Label>
            <Select
              value={formData.side}
              onValueChange={(value: 'buy' | 'sell') =>
                setFormData({ ...formData, side: value })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="buy">Buy (Long)</SelectItem>
                <SelectItem value="sell">Sell (Short)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="units">Units</Label>
            <Input
              id="units"
              type="number"
              min="1"
              value={formData.units}
              onChange={(e) =>
                setFormData({ ...formData, units: parseInt(e.target.value) || 0 })
              }
              required
            />
            <p className="text-xs text-muted-foreground">
              Number of units to trade (before scale factor is applied to mirrors)
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="tp">Take Profit (optional)</Label>
              <Input
                id="tp"
                type="number"
                step="0.00001"
                value={formData.tp || ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    tp: e.target.value ? parseFloat(e.target.value) : undefined,
                  })
                }
                placeholder="Price"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sl">Stop Loss (optional)</Label>
              <Input
                id="sl"
                type="number"
                step="0.00001"
                value={formData.sl || ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    sl: e.target.value ? parseFloat(e.target.value) : undefined,
                  })
                }
                placeholder="Price"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Placing...' : 'Place Trade'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
