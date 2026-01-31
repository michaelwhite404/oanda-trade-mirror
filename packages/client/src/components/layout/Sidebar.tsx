import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Users, TrendingUp, FileText, Menu, X, Wifi, WifiOff, AlertTriangle, Moon, Sun, Bell, BellOff, Keyboard } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useStreamStatus } from '@/hooks/useTrades';
import { useTheme } from '@/hooks/useTheme';
import { useNotifications } from '@/hooks/useNotifications';

// Detect if user is on Mac for shortcut display
const isMac = typeof navigator !== 'undefined' && navigator.platform.toUpperCase().indexOf('MAC') >= 0;
const modKey = isMac ? '⌘' : 'Ctrl+';

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard, shortcut: `${modKey}1` },
  { name: 'Accounts', href: '/accounts', icon: Users, shortcut: `${modKey}2` },
  { name: 'Trades', href: '/trades', icon: TrendingUp, shortcut: `${modKey}3` },
  { name: 'Logs', href: '/logs', icon: FileText, shortcut: `${modKey}4` },
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
  const { theme, toggleTheme } = useTheme();
  const { enabled: notificationsEnabled, toggleNotifications, isSupported: notificationsSupported, permission } = useNotifications();

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
        <div className="flex items-center gap-2">
          <StreamStatusIndicator />
          <Button variant="ghost" size="icon" onClick={toggleTheme}>
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
        </div>
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
                  'group flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                )
              }
            >
              <span className="flex items-center gap-3">
                <item.icon className="h-5 w-5" />
                {item.name}
              </span>
              <kbd className="hidden rounded bg-muted/50 px-1.5 py-0.5 font-mono text-xs text-muted-foreground group-hover:inline-block">
                {item.shortcut}
              </kbd>
            </NavLink>
          ))}
        </nav>
        <div className="space-y-1 border-t p-4">
          {notificationsSupported && (
            <Button
              variant="ghost"
              className="w-full justify-start gap-3"
              onClick={toggleNotifications}
              disabled={permission === 'denied'}
              title={permission === 'denied' ? 'Notifications blocked by browser' : undefined}
            >
              {notificationsEnabled ? (
                <>
                  <Bell className="h-5 w-5" />
                  Notifications On
                </>
              ) : (
                <>
                  <BellOff className="h-5 w-5" />
                  Notifications Off
                </>
              )}
            </Button>
          )}
          <Button
            variant="ghost"
            className="w-full justify-start gap-3"
            onClick={toggleTheme}
          >
            {theme === 'dark' ? (
              <>
                <Sun className="h-5 w-5" />
                Light Mode
              </>
            ) : (
              <>
                <Moon className="h-5 w-5" />
                Dark Mode
              </>
            )}
          </Button>
          <Button
            variant="ghost"
            className="w-full justify-start gap-3"
            onClick={() => window.dispatchEvent(new CustomEvent('show-shortcuts'))}
          >
            <Keyboard className="h-5 w-5" />
            Keyboard Shortcuts
          </Button>
        </div>
      </div>
    </>
  );
}
