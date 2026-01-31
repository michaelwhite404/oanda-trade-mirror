import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useLogs } from '@/hooks/useTrades';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { RefreshCw } from 'lucide-react';

function LogRowSkeleton() {
  return (
    <TableRow>
      <TableCell><Skeleton className="h-4 w-32" /></TableCell>
      <TableCell><Skeleton className="h-5 w-12" /></TableCell>
      <TableCell><Skeleton className="h-5 w-14" /></TableCell>
      <TableCell><Skeleton className="h-4 w-48" /></TableCell>
      <TableCell className="hidden lg:table-cell"><Skeleton className="h-4 w-32" /></TableCell>
    </TableRow>
  );
}

function LogCardSkeleton() {
  return (
    <div className="rounded-lg border p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Skeleton className="h-5 w-12" />
          <Skeleton className="h-5 w-14" />
        </div>
        <Skeleton className="h-4 w-24" />
      </div>
      <Skeleton className="h-4 w-3/4" />
    </div>
  );
}

type LogLevel = 'info' | 'warn' | 'error' | 'debug' | 'all';
type LogCategory = 'trade' | 'account' | 'system' | 'api' | 'all';

export default function Logs() {
  const [level, setLevel] = useState<LogLevel>('all');
  const [category, setCategory] = useState<LogCategory>('all');
  const [limit, setLimit] = useState(100);

  const { data, isLoading, refetch } = useLogs({
    level: level === 'all' ? undefined : level,
    category: category === 'all' ? undefined : category,
    limit,
  });

  // Keyboard shortcuts
  useKeyboardShortcuts({
    onRefresh: () => refetch(),
  });

  const logs = data?.logs || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold sm:text-3xl">Logs</h1>
        <Button
          variant="outline"
          size="icon"
          onClick={() => refetch()}
          disabled={isLoading}
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle>Execution Logs</CardTitle>
            <div className="flex flex-wrap gap-2">
              <Select
                value={level}
                onValueChange={(value) => setLevel(value as LogLevel)}
              >
                <SelectTrigger className="w-28">
                  <SelectValue placeholder="All levels" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All levels</SelectItem>
                  <SelectItem value="error">Error</SelectItem>
                  <SelectItem value="warn">Warning</SelectItem>
                  <SelectItem value="info">Info</SelectItem>
                  <SelectItem value="debug">Debug</SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={category}
                onValueChange={(value) => setCategory(value as LogCategory)}
              >
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="All categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All categories</SelectItem>
                  <SelectItem value="trade">Trade</SelectItem>
                  <SelectItem value="account">Account</SelectItem>
                  <SelectItem value="system">System</SelectItem>
                  <SelectItem value="api">API</SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={String(limit)}
                onValueChange={(value) => setLimit(parseInt(value))}
              >
                <SelectTrigger className="w-20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                  <SelectItem value="200">200</SelectItem>
                  <SelectItem value="500">500</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <>
              <div className="space-y-3 md:hidden">
                <LogCardSkeleton />
                <LogCardSkeleton />
                <LogCardSkeleton />
                <LogCardSkeleton />
                <LogCardSkeleton />
              </div>
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Timestamp</TableHead>
                      <TableHead>Level</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead className="hidden lg:table-cell">Details</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <LogRowSkeleton />
                    <LogRowSkeleton />
                    <LogRowSkeleton />
                    <LogRowSkeleton />
                    <LogRowSkeleton />
                  </TableBody>
                </Table>
              </div>
            </>
          ) : logs.length === 0 ? (
            <p className="text-muted-foreground">No logs found</p>
          ) : (
            <>
              {/* Mobile card view */}
              <div className="space-y-3 md:hidden">
                {logs.map((log) => (
                  <div key={log._id} className="rounded-lg border p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={
                            log.level === 'error'
                              ? 'destructive'
                              : log.level === 'warn'
                              ? 'warning'
                              : log.level === 'debug'
                              ? 'outline'
                              : 'secondary'
                          }
                        >
                          {log.level}
                        </Badge>
                        <Badge variant="outline">{log.category}</Badge>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {new Date(log.timestamp).toLocaleString()}
                      </span>
                    </div>
                    <p className="mt-2 text-sm">{log.action}</p>
                    {log.details && Object.keys(log.details).length > 0 && (
                      <code className="mt-2 block truncate text-xs text-muted-foreground">
                        {JSON.stringify(log.details)}
                      </code>
                    )}
                  </div>
                ))}
              </div>

              {/* Desktop table view */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Timestamp</TableHead>
                      <TableHead>Level</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead className="hidden lg:table-cell">Details</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.map((log) => (
                      <TableRow key={log._id}>
                        <TableCell className="whitespace-nowrap">
                          {new Date(log.timestamp).toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              log.level === 'error'
                                ? 'destructive'
                                : log.level === 'warn'
                                ? 'warning'
                                : log.level === 'debug'
                                ? 'outline'
                                : 'secondary'
                            }
                          >
                            {log.level}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{log.category}</Badge>
                        </TableCell>
                        <TableCell>{log.action}</TableCell>
                        <TableCell className="hidden max-w-xs truncate lg:table-cell">
                          {log.details && Object.keys(log.details).length > 0 ? (
                            <code className="text-xs">
                              {JSON.stringify(log.details)}
                            </code>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <p className="mt-4 text-sm text-muted-foreground">
                Showing {logs.length} of {data?.total || 0} logs
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
