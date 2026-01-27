import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { usePositions } from '@/hooks/useTrades';
import { AccountPositions, Position } from '@/api/client';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

function PositionCardSkeleton() {
  return (
    <div className="rounded-lg border p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-3 w-24" />
        </div>
        <Skeleton className="h-5 w-20" />
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between rounded border p-2">
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-14" />
            <Skeleton className="h-4 w-16" />
          </div>
          <div className="space-y-1 text-right">
            <Skeleton className="h-4 w-16 ml-auto" />
            <Skeleton className="h-3 w-12 ml-auto" />
          </div>
        </div>
      </div>
    </div>
  );
}

function PositionRow({ position }: { position: Position }) {
  const side = position.long ? 'long' : 'short';
  const data = position.long || position.short;
  if (!data) return null;

  const unrealizedPL = parseFloat(position.unrealizedPL);
  const plColor = unrealizedPL > 0 ? 'text-green-600' : unrealizedPL < 0 ? 'text-red-600' : '';

  return (
    <div className="flex items-center justify-between rounded border p-2">
      <div className="flex items-center gap-2">
        <Badge variant={side === 'long' ? 'default' : 'secondary'}>
          {side === 'long' ? <TrendingUp className="mr-1 h-3 w-3" /> : <TrendingDown className="mr-1 h-3 w-3" />}
          {side.toUpperCase()}
        </Badge>
        <span className="font-medium">{position.instrument.replace('_', '/')}</span>
      </div>
      <div className="text-right">
        <p className="text-sm">{Math.abs(parseFloat(data.units))} units</p>
        <p className={`text-xs ${plColor}`}>
          {unrealizedPL >= 0 ? '+' : ''}{unrealizedPL.toFixed(2)} P/L
        </p>
      </div>
    </div>
  );
}

function AccountPositionsCard({ account }: { account: AccountPositions }) {
  const hasPositions = account.positions.length > 0;

  return (
    <div className="rounded-lg border p-3">
      <div className="mb-2 flex items-center justify-between">
        <div>
          <p className="font-medium">{account.alias || account.oandaAccountId}</p>
          <p className="text-xs text-muted-foreground">
            {account.accountType === 'source' ? 'Source' : 'Mirror'} - {account.environment}
          </p>
        </div>
        <Badge variant={account.accountType === 'source' ? 'default' : 'outline'}>
          {account.positions.length} position{account.positions.length !== 1 ? 's' : ''}
        </Badge>
      </div>

      {account.error ? (
        <p className="text-sm text-destructive">{account.error}</p>
      ) : hasPositions ? (
        <div className="space-y-2">
          {account.positions.map((pos) => (
            <PositionRow key={pos.instrument} position={pos} />
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No open positions</p>
      )}
    </div>
  );
}

export function OpenPositions() {
  const { data, isLoading, error } = usePositions();

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Minus className="h-5 w-5" />
            Open Positions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <PositionCardSkeleton />
            <PositionCardSkeleton />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Minus className="h-5 w-5" />
            Open Positions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-destructive">Failed to load positions</p>
        </CardContent>
      </Card>
    );
  }

  const allAccounts = [...(data?.sources || []), ...(data?.mirrors || [])];
  const totalPositions = allAccounts.reduce((sum, acc) => sum + acc.positions.length, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Open Positions
          </span>
          <Badge variant="outline">{totalPositions} total</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {allAccounts.length === 0 ? (
          <p className="text-muted-foreground">No accounts configured</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {allAccounts.map((account) => (
              <AccountPositionsCard key={account.accountId} account={account} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
