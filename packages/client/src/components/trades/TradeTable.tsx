import React, { useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Trade } from '@/api/client';
import { useRetryMirrorExecution } from '@/hooks/useTrades';
import { ChevronDown, ChevronRight, RotateCcw } from 'lucide-react';

function TradeRowSkeleton() {
  return (
    <TableRow>
      <TableCell><Skeleton className="h-6 w-6" /></TableCell>
      <TableCell><Skeleton className="h-4 w-32" /></TableCell>
      <TableCell><Skeleton className="h-4 w-16" /></TableCell>
      <TableCell><Skeleton className="h-5 w-12" /></TableCell>
      <TableCell className="text-right"><Skeleton className="h-4 w-12 ml-auto" /></TableCell>
      <TableCell className="hidden lg:table-cell text-right"><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
      <TableCell><Skeleton className="h-5 w-20" /></TableCell>
    </TableRow>
  );
}

function TradeCardSkeleton() {
  return (
    <div className="rounded-lg border p-3 space-y-2">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-16" />
            <Skeleton className="h-5 w-12" />
          </div>
          <Skeleton className="h-4 w-24" />
        </div>
        <Skeleton className="h-4 w-16" />
      </div>
      <Skeleton className="h-5 w-20" />
    </div>
  );
}

interface TradeTableProps {
  trades: Trade[];
  isLoading: boolean;
  sourceId: string | null;
}

function MirrorStatusBadges({ trade }: { trade: Trade }) {
  const successCount = trade.mirrorExecutions.filter((e) => e.status === 'success').length;
  const failedCount = trade.mirrorExecutions.filter((e) => e.status === 'failed').length;
  const pendingCount = trade.mirrorExecutions.filter((e) => e.status === 'pending').length;
  const totalMirrors = trade.mirrorExecutions.length;

  return (
    <div className="flex flex-wrap gap-1">
      {successCount > 0 && <Badge variant="success">{successCount} success</Badge>}
      {failedCount > 0 && <Badge variant="destructive">{failedCount} failed</Badge>}
      {pendingCount > 0 && <Badge variant="warning">{pendingCount} pending</Badge>}
      {totalMirrors === 0 && <Badge variant="outline">No mirrors</Badge>}
    </div>
  );
}

function MirrorExecutionDetails({
  trade,
  sourceId,
  onRetry,
  isRetrying,
}: {
  trade: Trade;
  sourceId: string | null;
  onRetry: (tradeId: string, mirrorAccountId: string) => void;
  isRetrying: boolean;
}) {
  return (
    <div className="mt-3 rounded-lg bg-muted/50 p-3">
      <h4 className="mb-2 text-sm font-medium">Mirror Executions</h4>
      {trade.mirrorExecutions.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No mirror accounts were configured when this trade was executed.
        </p>
      ) : (
        <div className="space-y-2">
          {trade.mirrorExecutions.map((exec, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between rounded border bg-background p-2"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{exec.oandaAccountId}</p>
                <p className="text-xs text-muted-foreground">
                  {exec.executedUnits ? `${exec.executedUnits} units` : 'Not executed'}
                </p>
                {exec.errorMessage && (
                  <p className="truncate text-xs text-destructive">{exec.errorMessage}</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                {exec.status === 'failed' && sourceId && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRetry(trade._id, exec.mirrorAccountId);
                    }}
                    disabled={isRetrying}
                  >
                    <RotateCcw className="mr-1 h-3 w-3" />
                    Retry
                  </Button>
                )}
                <Badge
                  variant={
                    exec.status === 'success'
                      ? 'success'
                      : exec.status === 'failed'
                      ? 'destructive'
                      : 'warning'
                  }
                >
                  {exec.status}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      )}
      <p className="mt-2 truncate text-xs text-muted-foreground">
        TXN: {trade.sourceTransactionId}
      </p>
    </div>
  );
}

export function TradeTable({ trades, isLoading, sourceId }: TradeTableProps) {
  const [expandedTrade, setExpandedTrade] = useState<string | null>(null);
  const retryMutation = useRetryMirrorExecution(sourceId || '');

  const handleRetry = (tradeId: string, mirrorAccountId: string) => {
    retryMutation.mutate({ tradeId, mirrorAccountId });
  };

  if (isLoading) {
    return (
      <>
        <div className="space-y-3 md:hidden">
          <TradeCardSkeleton />
          <TradeCardSkeleton />
          <TradeCardSkeleton />
        </div>
        <div className="hidden md:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8"></TableHead>
                <TableHead>Time</TableHead>
                <TableHead>Instrument</TableHead>
                <TableHead>Side</TableHead>
                <TableHead className="text-right">Units</TableHead>
                <TableHead className="hidden text-right lg:table-cell">Price</TableHead>
                <TableHead>Mirror Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TradeRowSkeleton />
              <TradeRowSkeleton />
              <TradeRowSkeleton />
              <TradeRowSkeleton />
              <TradeRowSkeleton />
            </TableBody>
          </Table>
        </div>
      </>
    );
  }

  if (trades.length === 0) {
    return <p className="text-muted-foreground">No trades found</p>;
  }

  return (
    <>
      {/* Mobile card view */}
      <div className="space-y-3 md:hidden">
        {trades.map((trade) => {
          const isExpanded = expandedTrade === trade._id;
          return (
            <div
              key={trade._id}
              className="rounded-lg border p-3"
              onClick={() => setExpandedTrade(isExpanded ? null : trade._id)}
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{trade.instrument}</span>
                    <Badge variant={trade.side === 'buy' ? 'default' : 'secondary'}>
                      {trade.side.toUpperCase()}
                    </Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {trade.units} @ {trade.price}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    {new Date(trade.createdAt).toLocaleTimeString()}
                  </span>
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </div>
              </div>
              <div className="mt-2">
                <MirrorStatusBadges trade={trade} />
              </div>
              {isExpanded && (
                <MirrorExecutionDetails
                  trade={trade}
                  sourceId={sourceId}
                  onRetry={handleRetry}
                  isRetrying={retryMutation.isPending}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Desktop table view */}
      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8"></TableHead>
              <TableHead>Time</TableHead>
              <TableHead>Instrument</TableHead>
              <TableHead>Side</TableHead>
              <TableHead className="text-right">Units</TableHead>
              <TableHead className="hidden text-right lg:table-cell">Price</TableHead>
              <TableHead>Mirror Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {trades.map((trade) => {
              const isExpanded = expandedTrade === trade._id;

              return (
                <React.Fragment key={trade._id}>
                  <TableRow
                    className="cursor-pointer"
                    onClick={() => setExpandedTrade(isExpanded ? null : trade._id)}
                  >
                    <TableCell>
                      <Button variant="ghost" size="icon" className="h-6 w-6">
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </Button>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {new Date(trade.createdAt).toLocaleString()}
                    </TableCell>
                    <TableCell className="font-medium">{trade.instrument}</TableCell>
                    <TableCell>
                      <Badge variant={trade.side === 'buy' ? 'default' : 'secondary'}>
                        {trade.side.toUpperCase()}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">{trade.units}</TableCell>
                    <TableCell className="hidden text-right lg:table-cell">
                      {trade.price}
                    </TableCell>
                    <TableCell>
                      <MirrorStatusBadges trade={trade} />
                    </TableCell>
                  </TableRow>
                  {isExpanded && (
                    <TableRow>
                      <TableCell colSpan={7} className="bg-muted/50">
                        <div className="p-4">
                          <h4 className="mb-2 font-medium">Mirror Executions</h4>
                          {trade.mirrorExecutions.length === 0 ? (
                            <p className="text-sm text-muted-foreground">
                              No mirror accounts were configured when this trade was executed.
                            </p>
                          ) : (
                            <div className="space-y-2">
                              {trade.mirrorExecutions.map((exec, idx) => (
                                <div
                                  key={idx}
                                  className="flex items-center justify-between rounded border bg-background p-3"
                                >
                                  <div>
                                    <p className="font-medium">{exec.oandaAccountId}</p>
                                    <p className="text-sm text-muted-foreground">
                                      {exec.executedUnits
                                        ? `${exec.executedUnits} units`
                                        : 'Not executed'}
                                      {exec.oandaTransactionId &&
                                        ` - TXN: ${exec.oandaTransactionId}`}
                                    </p>
                                    {exec.errorMessage && (
                                      <p className="text-sm text-destructive">
                                        {exec.errorMessage}
                                      </p>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2">
                                    {exec.status === 'failed' && sourceId && (
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleRetry(trade._id, exec.mirrorAccountId);
                                        }}
                                        disabled={retryMutation.isPending}
                                      >
                                        <RotateCcw className="mr-1 h-3 w-3" />
                                        Retry
                                      </Button>
                                    )}
                                    <Badge
                                      variant={
                                        exec.status === 'success'
                                          ? 'success'
                                          : exec.status === 'failed'
                                          ? 'destructive'
                                          : 'warning'
                                      }
                                    >
                                      {exec.status}
                                    </Badge>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                          <p className="mt-2 text-xs text-muted-foreground">
                            Source Transaction ID: {trade.sourceTransactionId}
                          </p>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </React.Fragment>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
