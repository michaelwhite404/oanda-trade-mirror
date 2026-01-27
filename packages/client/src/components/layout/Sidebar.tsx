import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Users, TrendingUp, FileText, Menu, X, Wifi, WifiOff, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useStreamStatus } from '@/hooks/useTrades';

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Accounts', href: '/accounts', icon: Users },
  { name: 'Trades', href: '/trades', icon: TrendingUp },
  { name: 'Logs', href: '/logs', icon: FileText },
];

function StreamStatusIndicator() {
  const { data: status, isLoading } = useStreamStatus();

  if (isLoading || !status) {
    return (
      <div className="flex h-6 w-6 items-center justify-center">
        <div className="h-2 w-2 animate-pulse rounded-full bg-muted-foreground" />
      </div>
    );
  }

  const config = {
    connected: {
      icon: Wifi,
      color: 'text-green-500',
      bgColor: 'bg-green-500',
      label: 'Connected',
      description: `${status.streamCount} stream(s) active`,
    },
    degraded: {
      icon: AlertTriangle,
      color: 'text-yellow-500',
      bgColor: 'bg-yellow-500',
      label: 'Degraded',
      description: 'Some streams are reconnecting',
    },
    disconnected: {
      icon: WifiOff,
      color: 'text-red-500',
      bgColor: 'bg-red-500',
      label: 'Disconnected',
      description: 'No active streams',
    },
  }[status.overallStatus];

  const Icon = config.icon;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex cursor-pointer items-center gap-1.5">
            <div className={cn('h-2 w-2 rounded-full', config.bgColor)} />
            <Icon className={cn('h-4 w-4', config.color)} />
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <p className="font-medium">{config.label}</p>
          <p className="text-xs text-muted-foreground">{config.description}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

interface SidebarProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function Sidebar({ open, onOpenChange }: SidebarProps) {
  return (
    <>
      {/* Mobile header */}
      <div className="fixed left-0 right-0 top-0 z-40 flex h-14 items-center justify-between border-b bg-card px-4 lg:hidden">
        <div className="flex items-center">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onOpenChange(!open)}
          >
            <Menu className="h-5 w-5" />
          </Button>
          <h1 className="ml-3 text-lg font-bold">OANDA Mirror</h1>
        </div>
        <StreamStatusIndicator />
      </div>

      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => onOpenChange(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r bg-card transition-transform duration-200 lg:static lg:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex h-14 items-center justify-between border-b px-4 lg:h-16 lg:px-6">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-bold lg:text-xl">OANDA Mirror</h1>
            <StreamStatusIndicator />
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => onOpenChange(false)}
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
        <nav className="flex-1 space-y-1 p-4">
          {navigation.map((item) => (
            <NavLink
              key={item.name}
              to={item.href}
              onClick={() => onOpenChange(false)}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                )
              }
            >
              <item.icon className="h-5 w-5" />
              {item.name}
            </NavLink>
          ))}
        </nav>
      </div>
    </>
  );
}
