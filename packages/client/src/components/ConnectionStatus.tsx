import { useWebSocketContext, ConnectionStatus as Status } from '@/context/WebSocketContext';
import { Badge } from '@/components/ui/badge';
import { Wifi, WifiOff, Loader2 } from 'lucide-react';

export function ConnectionStatus() {
  const { status } = useWebSocketContext();

  const statusConfig: Record<Status, { label: string; variant: 'success' | 'destructive' | 'secondary' | 'warning'; icon: React.ReactNode }> = {
    connected: {
      label: 'Live',
      variant: 'success',
      icon: <Wifi className="h-3 w-3" />,
    },
    connecting: {
      label: 'Connecting',
      variant: 'secondary',
      icon: <Loader2 className="h-3 w-3 animate-spin" />,
    },
    reconnecting: {
      label: 'Reconnecting',
      variant: 'warning',
      icon: <Loader2 className="h-3 w-3 animate-spin" />,
    },
    disconnected: {
      label: 'Offline',
      variant: 'destructive',
      icon: <WifiOff className="h-3 w-3" />,
    },
  };

  const config = statusConfig[status];

  return (
    <Badge variant={config.variant} className="flex items-center gap-1">
      {config.icon}
      {config.label}
    </Badge>
  );
}
