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
import { useRealTimeUpdates } from '@/hooks/useRealTimeUpdates';
import { ConnectionStatus } from '@/components/ConnectionStatus';
import { TradeTable } from '@/components/trades/TradeTable';
import { TradeFilters } from '@/components/trades/TradeFilters';
import { PlaceTradeDialog, TradeFormData } from '@/components/trades/PlaceTradeDialog';
import { GetTradesParams } from '@/api/client';
import { Plus, RefreshCw } from 'lucide-react';

export default function Trades() {
  const [selectedSource, setSelectedSource] = useState<string | null>(null);
  const [showPlaceTrade, setShowPlaceTrade] = useState(false);
  const [filters, setFilters] = useState<GetTradesParams>({ limit: 100 });

  const { data: sources = [], isLoading: sourcesLoading } = useSourceAccounts();
  const { data: trades = [], isLoading: tradesLoading, refetch } = useTrades(
    selectedSource,
    filters
  );

  // Enable real-time updates for selected source
  useRealTimeUpdates(selectedSource);

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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold sm:text-3xl">Trades</h1>
          <ConnectionStatus />
        </div>
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
            <span className="hidden sm:inline">Place Trade</span>
            <span className="sm:hidden">Trade</span>
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle>Trade History</CardTitle>
            <div className="w-full sm:w-64">
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
                      {source.alias || source.oandaAccountId} ({source.environment})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {!selectedSource ? (
            <p className="text-muted-foreground">
              Select a source account to view trades
            </p>
          ) : (
            <>
              <TradeFilters filters={filters} onFiltersChange={setFilters} />
              <TradeTable trades={trades} isLoading={tradesLoading} />
            </>
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
