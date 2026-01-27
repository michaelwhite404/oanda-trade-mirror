import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useSourceAccounts, useMirrorAccounts } from '@/hooks/useAccounts';
import { useTrades, useHealth, useLogs, useBalances } from '@/hooks/useTrades';
import { useGlobalRealTimeUpdates } from '@/hooks/useRealTimeUpdates';
import { ConnectionStatus } from '@/components/ConnectionStatus';
import { OpenPositions } from '@/components/positions/OpenPositions';
import { TradeStats } from '@/components/stats/TradeStats';
import { PendingTrades } from '@/components/trades/PendingTrades';
import { Activity, Users, TrendingUp, AlertCircle, Wallet } from 'lucide-react';
import { AccountBalance } from '@/api/client';

function BalanceCardSkeleton() {
  return (
    <div className="rounded-lg border p-3 space-y-2">
      <div className="flex items-center justify-between">
        <Skeleton className="h-5 w-32" />
        <div className="flex gap-2">
          <Skeleton className="h-5 w-14" />
          <Skeleton className="h-5 w-16" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Skeleton className="h-3 w-12" />
          <Skeleton className="h-4 w-20" />
        </div>
        <div className="space-y-1">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-4 w-16" />
        </div>
        <div className="space-y-1">
          <Skeleton className="h-3 w-8" />
          <Skeleton className="h-4 w-20" />
        </div>
        <div className="space-y-1">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-4 w-8" />
        </div>
      </div>
    </div>
  );
}

function formatCurrency(value: string | undefined, currency: string | undefined) {
  if (!value) return '—';
  const num = parseFloat(value);
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency || 'USD',
    minimumFractionDigits: 2,
  }).format(num);
}

function BalanceCard({ account, type }: { account: AccountBalance; type: 'source' | 'mirror' }) {
  const isPositivePL = account.unrealizedPL && parseFloat(account.unrealizedPL) >= 0;

  return (
    <div className="rounded-lg border p-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-medium">{account.alias || account.oandaAccountId}</p>
          {account.alias && (
            <p className="text-xs text-muted-foreground">{account.oandaAccountId}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={type === 'source' ? 'default' : 'secondary'}>
            {type}
          </Badge>
          <Badge variant={account.environment === 'live' ? 'destructive' : 'outline'}>
            {account.environment}
          </Badge>
        </div>
      </div>
      {account.error ? (
        <p className="mt-2 text-sm text-destructive">{account.error}</p>
      ) : (
        <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
          <div>
            <p className="text-muted-foreground">Balance</p>
            <p className="font-medium">{formatCurrency(account.balance, account.currency)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Unrealized P/L</p>
            <p className={`font-medium ${isPositivePL ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(account.unrealizedPL, account.currency)}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">NAV</p>
            <p className="font-medium">{formatCurrency(account.nav, account.currency)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Open Trades</p>
            <p className="font-medium">{account.openTradeCount ?? 0}</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Dashboard() {
  const { data: sources = [], isLoading: sourcesLoading } = useSourceAccounts();
  const { data: health } = useHealth();
  const { data: logsData } = useLogs({ limit: 10 });
  const { data: balancesData, isLoading: balancesLoading } = useBalances();

  // Enable real-time updates
  useGlobalRealTimeUpdates();

  const firstSourceId = sources[0]?._id;
  const { data: mirrors = [] } = useMirrorAccounts(firstSourceId || null);
  const { data: trades = [] } = useTrades(firstSourceId || null, { limit: 10 });

  const todayTrades = trades.filter((t) => {
    const tradeDate = new Date(t.createdAt);
    const today = new Date();
    return tradeDate.toDateString() === today.toDateString();
  });

  const recentLogs = logsData?.logs || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold sm:text-3xl">Dashboard</h1>
        <ConnectionStatus />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">System Status</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Badge variant={health?.status === 'ok' ? 'success' : 'destructive'}>
                {health?.status === 'ok' ? 'Online' : 'Offline'}
              </Badge>
            </div>
            {health?.timestamp && (
              <p className="mt-2 text-xs text-muted-foreground">
                Last check: {new Date(health.timestamp).toLocaleTimeString()}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Source Accounts</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {sourcesLoading ? '...' : sources.length}
            </div>
            <p className="text-xs text-muted-foreground">
              {mirrors.length} mirror account{mirrors.length !== 1 ? 's' : ''}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Trades Today</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{todayTrades.length}</div>
            <p className="text-xs text-muted-foreground">
              {trades.length} total recent trades
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Recent Errors</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {recentLogs.filter((l) => l.level === 'error').length}
            </div>
            <p className="text-xs text-muted-foreground">
              {recentLogs.filter((l) => l.level === 'warn').length} warnings
            </p>
          </CardContent>
        </Card>
      </div>

      <PendingTrades />

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            Account Balances
          </CardTitle>
        </CardHeader>
        <CardContent>
          {balancesLoading ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <BalanceCardSkeleton />
              <BalanceCardSkeleton />
            </div>
          ) : !balancesData?.sources.length ? (
            <p className="text-sm text-muted-foreground">No accounts configured</p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {balancesData.sources.map((account) => (
                <BalanceCard key={account.accountId} account={account} type="source" />
              ))}
              {balancesData.mirrors.map((account) => (
                <BalanceCard key={account.accountId} account={account} type="mirror" />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <OpenPositions />

      <TradeStats />

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recent Trades</CardTitle>
          </CardHeader>
          <CardContent>
            {trades.length === 0 ? (
              <p className="text-sm text-muted-foreground">No recent trades</p>
            ) : (
              <div className="space-y-4">
                {trades.slice(0, 5).map((trade) => {
                  const successCount = trade.mirrorExecutions.filter(
                    (e) => e.status === 'success'
                  ).length;
                  const totalMirrors = trade.mirrorExecutions.length;

                  return (
                    <div
                      key={trade._id}
                      className="flex items-center justify-between border-b pb-2"
                    >
                      <div>
                        <p className="font-medium">{trade.instrument}</p>
                        <p className="text-sm text-muted-foreground">
                          {trade.side.toUpperCase()} {trade.units} @ {trade.price}
                        </p>
                      </div>
                      <div className="text-right">
                        <Badge
                          variant={
                            successCount === totalMirrors
                              ? 'success'
                              : successCount > 0
                              ? 'warning'
                              : 'destructive'
                          }
                        >
                          {successCount}/{totalMirrors} mirrors
                        </Badge>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {new Date(trade.createdAt).toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            {recentLogs.length === 0 ? (
              <p className="text-sm text-muted-foreground">No recent activity</p>
            ) : (
              <div className="space-y-4">
                {recentLogs.slice(0, 5).map((log) => (
                  <div key={log._id} className="flex items-start justify-between border-b pb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={
                            log.level === 'error'
                              ? 'destructive'
                              : log.level === 'warn'
                              ? 'warning'
                              : 'secondary'
                          }
                        >
                          {log.level}
                        </Badge>
                        <span className="text-xs text-muted-foreground">{log.category}</span>
                      </div>
                      <p className="mt-1 text-sm">{log.action}</p>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
