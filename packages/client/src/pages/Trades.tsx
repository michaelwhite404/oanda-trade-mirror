import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useSourceAccounts } from '@/hooks/useAccounts';
import { useTrades, usePlaceTrade } from '@/hooks/useTrades';
import { TradeTable } from '@/components/trades/TradeTable';
import { PlaceTradeDialog, TradeFormData } from '@/components/trades/PlaceTradeDialog';
import { Plus, RefreshCw } from 'lucide-react';

export default function Trades() {
  const [selectedSource, setSelectedSource] = useState<string | null>(null);
  const [showPlaceTrade, setShowPlaceTrade] = useState(false);

  const { data: sources = [], isLoading: sourcesLoading } = useSourceAccounts();
  const { data: trades = [], isLoading: tradesLoading, refetch } = useTrades(
    selectedSource,
    100
  );

  // Auto-select first source if none selected
  if (!selectedSource && sources.length > 0) {
    setSelectedSource(sources[0]._id);
  }

  const placeTradeMutation = usePlaceTrade(selectedSource || '');

  const handlePlaceTrade = async (data: TradeFormData) => {
    if (!selectedSource) return;
    await placeTradeMutation.mutateAsync(data);
    setShowPlaceTrade(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Trades</h1>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => refetch()}
            disabled={tradesLoading}
          >
            <RefreshCw className={`h-4 w-4 ${tradesLoading ? 'animate-spin' : ''}`} />
          </Button>
          <Button onClick={() => setShowPlaceTrade(true)} disabled={!selectedSource}>
            <Plus className="mr-2 h-4 w-4" />
            Place Trade
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Trade History</CardTitle>
            <div className="w-64">
              <Select
                value={selectedSource || ''}
                onValueChange={(value) => setSelectedSource(value)}
                disabled={sourcesLoading}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select source account" />
                </SelectTrigger>
                <SelectContent>
                  {sources.map((source) => (
                    <SelectItem key={source._id} value={source._id}>
                      {source.oandaAccountId} ({source.environment})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {!selectedSource ? (
            <p className="text-muted-foreground">
              Select a source account to view trades
            </p>
          ) : (
            <TradeTable trades={trades} isLoading={tradesLoading} />
          )}
        </CardContent>
      </Card>

      {selectedSource && (
        <PlaceTradeDialog
          open={showPlaceTrade}
          onOpenChange={setShowPlaceTrade}
          onSubmit={handlePlaceTrade}
          isSubmitting={placeTradeMutation.isPending}
        />
      )}
    </div>
  );
}
