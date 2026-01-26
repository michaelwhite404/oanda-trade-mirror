import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { GetTradesParams } from '@/api/client';
import { Search, X } from 'lucide-react';

interface TradeFiltersProps {
  filters: GetTradesParams;
  onFiltersChange: (filters: GetTradesParams) => void;
}

export function TradeFilters({ filters, onFiltersChange }: TradeFiltersProps) {
  const hasActiveFilters = filters.instrument || filters.side || filters.status;

  const clearFilters = () => {
    onFiltersChange({ limit: filters.limit });
  };

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <div className="relative flex-1 sm:max-w-xs">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search instrument..."
          value={filters.instrument || ''}
          onChange={(e) =>
            onFiltersChange({ ...filters, instrument: e.target.value || undefined })
          }
          className="pl-9"
        />
      </div>

      <Select
        value={filters.side || 'all'}
        onValueChange={(value) =>
          onFiltersChange({
            ...filters,
            side: value === 'all' ? undefined : (value as 'buy' | 'sell'),
          })
        }
      >
        <SelectTrigger className="w-full sm:w-32">
          <SelectValue placeholder="Side" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All sides</SelectItem>
          <SelectItem value="buy">Buy</SelectItem>
          <SelectItem value="sell">Sell</SelectItem>
        </SelectContent>
      </Select>

      <Select
        value={filters.status || 'all'}
        onValueChange={(value) =>
          onFiltersChange({
            ...filters,
            status: value === 'all' ? undefined : (value as 'pending' | 'success' | 'failed'),
          })
        }
      >
        <SelectTrigger className="w-full sm:w-36">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All statuses</SelectItem>
          <SelectItem value="success">Success</SelectItem>
          <SelectItem value="failed">Failed</SelectItem>
          <SelectItem value="pending">Pending</SelectItem>
        </SelectContent>
      </Select>

      {hasActiveFilters && (
        <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1">
          <X className="h-4 w-4" />
          <span className="hidden sm:inline">Clear</span>
        </Button>
      )}
    </div>
  );
}
