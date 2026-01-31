import { useState, useEffect } from 'react';
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
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { ConnectionStatus } from '@/components/ConnectionStatus';
import { TradeTable } from '@/components/trades/TradeTable';
import { TradeFilters } from '@/components/trades/TradeFilters';
import { PendingTrades } from '@/components/trades/PendingTrades';
import { PlaceTradeDialog, TradeFormData } from '@/components/trades/PlaceTradeDialog';
import { GetTradesParams } from '@/api/client';
import { Plus, RefreshCw, Download } from 'lucide-react';

const SELECTED_SOURCE_KEY = 'selectedSourceAccount';

export default function Trades() {
  const [selectedSource, setSelectedSource] = useState<string | null>(() => {
    return localStorage.getItem(SELECTED_SOURCE_KEY);
  });
  const [showPlaceTrade, setShowPlaceTrade] = useState(false);
  const [filters, setFilters] = useState<GetTradesParams>({ limit: 100 });

  const { data: sources = [], isLoading: sourcesLoading } = useSourceAccounts();
  const { data: trades = [], isLoading: tradesLoading, refetch } = useTrades(
    selectedSource,
    filters
  );

  // Enable real-time updates for selected source
  useRealTimeUpdates(selectedSource);

  // Keyboard shortcuts
  useKeyboardShortcuts({
    onRefresh: () => refetch(),
    onNew: () => selectedSource && setShowPlaceTrade(true),
  });

  // Persist selected source to localStorage
  useEffect(() => {
    if (selectedSource) {
      localStorage.setItem(SELECTED_SOURCE_KEY, selectedSource);
    }
  }, [selectedSource]);

  // Auto-select source: use stored value if valid, otherwise first source
  useEffect(() => {
    if (sources.length === 0) return;

    // Check if current selection is valid
    const isValidSelection = selectedSource && sources.some(s => s._id === selectedSource);

    if (!isValidSelection) {
      // Fall back to first source
      setSelectedSource(sources[0]._id);
    }
  }, [sources, selectedSource]);

  const placeTradeMutation = usePlaceTrade(selectedSource || '');

  const handlePlaceTrade = async (data: TradeFormData) => {
    if (!selectedSource) return;
    await placeTradeMutation.mutateAsync(data);
    setShowPlaceTrade(false);
  };

  const handleExport = () => {
    if (!selectedSource) return;
    const params = new URLSearchParams();
    if (filters.dateFrom) params.set('dateFrom', filters.dateFrom);
    if (filters.dateTo) params.set('dateTo', filters.dateTo);
    window.open(`/api/trades/${selectedSource}/export?${params}`, '_blank');
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
          <Button
            variant="outline"
            onClick={handleExport}
            disabled={!selectedSource || trades.length === 0}
          >
            <Download className="mr-2 h-4 w-4" />
            <span className="hidden sm:inline">Export CSV</span>
            <span className="sm:hidden">Export</span>
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
          <PendingTrades />
          {!selectedSource ? (
            <p className="text-muted-foreground">
              Select a source account to view trades
            </p>
          ) : (
            <>
              <TradeFilters filters={filters} onFiltersChange={setFilters} />
              <TradeTable trades={trades} isLoading={tradesLoading} sourceId={selectedSource} />
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
