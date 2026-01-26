import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useStats } from '@/hooks/useTrades';
import { AccountStatsData } from '@/api/client';
import { BarChart3, TrendingUp, TrendingDown, Target, Activity } from 'lucide-react';

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(value);
}

function formatPercent(value: number) {
  return `${value.toFixed(1)}%`;
}

function StatItem({ label, value, subValue, className }: {
  label: string;
  value: string | number;
  subValue?: string;
  className?: string;
}) {
  return (
    <div className="text-center">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-lg font-semibold ${className || ''}`}>{value}</p>
      {subValue && <p className="text-xs text-muted-foreground">{subValue}</p>}
    </div>
  );
}

function AccountStatsCard({ account }: { account: AccountStatsData }) {
  if (account.error) {
    return (
      <div className="rounded-lg border p-4">
        <div className="mb-2 flex items-center justify-between">
          <p className="font-medium">{account.alias || account.oandaAccountId}</p>
          <Badge variant="outline">{account.environment}</Badge>
        </div>
        <p className="text-sm text-destructive">{account.error}</p>
      </div>
    );
  }

  const stats = account.stats!;
  const plColor = stats.totalRealizedPL >= 0 ? 'text-green-600' : 'text-red-600';
  const PlIcon = stats.totalRealizedPL >= 0 ? TrendingUp : TrendingDown;

  return (
    <div className="rounded-lg border p-4">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="font-medium">{account.alias || account.oandaAccountId}</p>
          <p className="text-xs text-muted-foreground">{account.oandaAccountId}</p>
        </div>
        <Badge variant="outline">{account.environment}</Badge>
      </div>

      {/* P/L Summary */}
      <div className="mb-4 flex items-center gap-2 rounded-lg bg-muted/50 p-3">
        <PlIcon className={`h-8 w-8 ${plColor}`} />
        <div>
          <p className="text-xs text-muted-foreground">Realized P/L (30d)</p>
          <p className={`text-2xl font-bold ${plColor}`}>
            {formatCurrency(stats.totalRealizedPL)}
          </p>
        </div>
      </div>

      {/* Win/Loss Stats */}
      <div className="mb-4 grid grid-cols-4 gap-2">
        <StatItem
          label="Win Rate"
          value={formatPercent(stats.winRate)}
          className={stats.winRate >= 50 ? 'text-green-600' : 'text-red-600'}
        />
        <StatItem
          label="Wins"
          value={stats.winCount}
          className="text-green-600"
        />
        <StatItem
          label="Losses"
          value={stats.lossCount}
          className="text-red-600"
        />
        <StatItem
          label="Total"
          value={stats.winCount + stats.lossCount}
        />
      </div>

      {/* Average Win/Loss */}
      <div className="mb-4 grid grid-cols-2 gap-2">
        <div className="rounded bg-green-50 p-2 text-center dark:bg-green-950">
          <p className="text-xs text-muted-foreground">Avg Win</p>
          <p className="font-semibold text-green-600">{formatCurrency(stats.avgWin)}</p>
        </div>
        <div className="rounded bg-red-50 p-2 text-center dark:bg-red-950">
          <p className="text-xs text-muted-foreground">Avg Loss</p>
          <p className="font-semibold text-red-600">{formatCurrency(stats.avgLoss)}</p>
        </div>
      </div>

      {/* Mirror Stats */}
      <div className="grid grid-cols-3 gap-2 border-t pt-3">
        <StatItem
          label="Trades Today"
          value={stats.tradesToday}
        />
        <StatItem
          label="Total Trades"
          value={stats.totalTrades}
        />
        <StatItem
          label="Mirror Rate"
          value={formatPercent(stats.mirrorSuccessRate)}
          subValue={`${stats.mirrorSuccessCount}/${stats.mirrorSuccessCount + stats.mirrorFailedCount}`}
          className={stats.mirrorSuccessRate >= 95 ? 'text-green-600' : 'text-yellow-600'}
        />
      </div>
    </div>
  );
}

export function TradeStats() {
  const { data, isLoading, error } = useStats();

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Trade Statistics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Loading statistics...</p>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Trade Statistics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-destructive">Failed to load statistics</p>
        </CardContent>
      </Card>
    );
  }

  const accounts = data?.accounts || [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5" />
          Trade Statistics
        </CardTitle>
      </CardHeader>
      <CardContent>
        {accounts.length === 0 ? (
          <p className="text-muted-foreground">No accounts configured</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {accounts.map((account) => (
              <AccountStatsCard key={account.accountId} account={account} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
