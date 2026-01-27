import { Badge } from '@/components/ui/badge';
import { usePendingTrades, PendingTrade } from '@/hooks/usePendingTrades';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';

function PendingTradeItem({ trade }: { trade: PendingTrade }) {
  const isComplete = trade.mirrorsCompleted > 0 || trade.mirrorsFailed > 0;

  return (
    <div className="flex items-center justify-between rounded-lg border border-dashed border-primary/50 bg-primary/5 p-3 animate-in fade-in slide-in-from-top-2">
      <div className="flex items-center gap-3">
        {isComplete ? (
          trade.mirrorsFailed > 0 ? (
            <XCircle className="h-5 w-5 text-destructive" />
          ) : (
            <CheckCircle2 className="h-5 w-5 text-green-500" />
          )
        ) : (
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        )}
        <div>
          <div className="flex items-center gap-2">
            <span className="font-medium">{trade.instrument}</span>
            <Badge variant={trade.side === 'buy' ? 'default' : 'secondary'} className="text-xs">
              {trade.side.toUpperCase()}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {trade.units} units @ {trade.price}
          </p>
        </div>
      </div>
      <div className="text-right">
        {isComplete ? (
          <p className="text-sm">
            {trade.mirrorsCompleted > 0 && (
              <span className="text-green-600">{trade.mirrorsCompleted} mirrored</span>
            )}
            {trade.mirrorsCompleted > 0 && trade.mirrorsFailed > 0 && ' / '}
            {trade.mirrorsFailed > 0 && (
              <span className="text-destructive">{trade.mirrorsFailed} failed</span>
            )}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">Mirroring...</p>
        )}
      </div>
    </div>
  );
}

export function PendingTrades() {
  const { pendingTrades, hasPending } = usePendingTrades();

  if (!hasPending) return null;

  return (
    <div className="space-y-2">
      <h3 className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Trades Being Mirrored
      </h3>
      <div className="space-y-2">
        {pendingTrades.map((trade) => (
          <PendingTradeItem key={trade.transactionId} trade={trade} />
        ))}
      </div>
    </div>
  );
}
