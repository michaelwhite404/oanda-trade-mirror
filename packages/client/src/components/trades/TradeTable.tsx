import { useState } from 'react';
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
import { Trade } from '@/api/client';
import { ChevronDown, ChevronRight } from 'lucide-react';

interface TradeTableProps {
  trades: Trade[];
  isLoading: boolean;
}

export function TradeTable({ trades, isLoading }: TradeTableProps) {
  const [expandedTrade, setExpandedTrade] = useState<string | null>(null);

  if (isLoading) {
    return <p className="text-muted-foreground">Loading trades...</p>;
  }

  if (trades.length === 0) {
    return <p className="text-muted-foreground">No trades found</p>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-8"></TableHead>
          <TableHead>Time</TableHead>
          <TableHead>Instrument</TableHead>
          <TableHead>Side</TableHead>
          <TableHead className="text-right">Units</TableHead>
          <TableHead className="text-right">Price</TableHead>
          <TableHead>Mirror Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {trades.map((trade) => {
          const isExpanded = expandedTrade === trade._id;
          const successCount = trade.mirrorExecutions.filter(
            (e) => e.status === 'success'
          ).length;
          const failedCount = trade.mirrorExecutions.filter(
            (e) => e.status === 'failed'
          ).length;
          const pendingCount = trade.mirrorExecutions.filter(
            (e) => e.status === 'pending'
          ).length;
          const totalMirrors = trade.mirrorExecutions.length;

          return (
            <>
              <TableRow
                key={trade._id}
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
                <TableCell>
                  {new Date(trade.createdAt).toLocaleString()}
                </TableCell>
                <TableCell className="font-medium">{trade.instrument}</TableCell>
                <TableCell>
                  <Badge variant={trade.side === 'buy' ? 'default' : 'secondary'}>
                    {trade.side.toUpperCase()}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">{trade.units}</TableCell>
                <TableCell className="text-right">{trade.price}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    {successCount > 0 && (
                      <Badge variant="success">{successCount} success</Badge>
                    )}
                    {failedCount > 0 && (
                      <Badge variant="destructive">{failedCount} failed</Badge>
                    )}
                    {pendingCount > 0 && (
                      <Badge variant="warning">{pendingCount} pending</Badge>
                    )}
                    {totalMirrors === 0 && (
                      <Badge variant="outline">No mirrors</Badge>
                    )}
                  </div>
                </TableCell>
              </TableRow>
              {isExpanded && (
                <TableRow key={`${trade._id}-details`}>
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
            </>
          );
        })}
      </TableBody>
    </Table>
  );
}
