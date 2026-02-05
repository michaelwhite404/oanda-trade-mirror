import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAuth } from '@/context/AuthContext';
import { useApiKeys, useCreateApiKey, useDeleteApiKey } from '@/hooks/useApiKeys';
import { useSessions, useRevokeSession, useRevokeOtherSessions } from '@/hooks/useSessions';
import {
  useWebhooks,
  useCreateWebhook,
  useUpdateWebhook,
  useDeleteWebhook,
  useRegenerateWebhookSecret,
  useTestWebhook,
} from '@/hooks/useWebhooks';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Trash2, Copy, Check, Key, AlertTriangle, User, Mail, Shield, Pencil, Lock, Clock, Monitor, Smartphone, LogOut, Play, RefreshCw, Webhook } from 'lucide-react';
import { api, ApiKeyInfo, ApiKeyWithSecret, ApiKeyScope, SCOPE_DESCRIPTIONS, SessionInfo, WebhookInfo, WebhookEvent, WEBHOOK_EVENTS, WEBHOOK_EVENT_DESCRIPTIONS, CreateWebhookRequest } from '@/api/client';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';

function ApiKeysSkeleton() {
  return (
    <div className="space-y-3">
      {[...Array(2)].map((_, i) => (
        <div key={i} className="flex items-center gap-4">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-8 w-16" />
        </div>
      ))}
    </div>
  );
}

export default function Account() {
  const { user, updateUser } = useAuth();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditUsernameDialog, setShowEditUsernameDialog] = useState(false);
  const [showChangePasswordDialog, setShowChangePasswordDialog] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [keyExpiration, setKeyExpiration] = useState<string>('never');
  const [keyScopes, setKeyScopes] = useState<ApiKeyScope[]>(['full']);
  const [newUsername, setNewUsername] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [createdKey, setCreatedKey] = useState<ApiKeyWithSecret | null>(null);
  const [keyToRevoke, setKeyToRevoke] = useState<ApiKeyInfo | null>(null);
  const [sessionToRevoke, setSessionToRevoke] = useState<SessionInfo | null>(null);
  const [showRevokeOtherSessions, setShowRevokeOtherSessions] = useState(false);
  const [copied, setCopied] = useState(false);

  // Webhook state
  const [showCreateWebhookDialog, setShowCreateWebhookDialog] = useState(false);
  const [showEditWebhookDialog, setShowEditWebhookDialog] = useState(false);
  const [editingWebhook, setEditingWebhook] = useState<WebhookInfo | null>(null);
  const [webhookToDelete, setWebhookToDelete] = useState<string | null>(null);
  const [newWebhookSecret, setNewWebhookSecret] = useState<string | null>(null);
  const [copiedWebhookSecret, setCopiedWebhookSecret] = useState(false);
  const [webhookFormData, setWebhookFormData] = useState<CreateWebhookRequest>({
    name: '',
    url: '',
    events: [],
  });

  const { data: apiKeys = [], isLoading: isLoadingKeys } = useApiKeys();
  const { data: sessions = [], isLoading: isLoadingSessions } = useSessions();
  const { data: webhooks = [], isLoading: isLoadingWebhooks } = useWebhooks();
  const revokeSessionMutation = useRevokeSession();
  const revokeOtherSessionsMutation = useRevokeOtherSessions();
  const createMutation = useCreateApiKey();
  const deleteMutation = useDeleteApiKey();
  const createWebhookMutation = useCreateWebhook();
  const updateWebhookMutation = useUpdateWebhook();
  const deleteWebhookMutation = useDeleteWebhook();
  const regenerateWebhookSecretMutation = useRegenerateWebhookSecret();
  const testWebhookMutation = useTestWebhook();

  const updateUsernameMutation = useMutation({
    mutationFn: (username: string) => api.updateProfile({ username }),
    onSuccess: (data) => {
      updateUser({ username: data.user.username });
      toast.success('Username updated');
      setShowEditUsernameDialog(false);
    },
    onError: (error: Error) => {
      toast.error('Failed to update username', {
        description: error.message,
      });
    },
  });

  const changePasswordMutation = useMutation({
    mutationFn: (data: { currentPassword: string; newPassword: string }) => api.changePassword(data),
    onSuccess: () => {
      toast.success('Password changed successfully');
      setShowChangePasswordDialog(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    },
    onError: (error: Error) => {
      toast.error('Failed to change password', {
        description: error.message,
      });
    },
  });

  const setPasswordMutation = useMutation({
    mutationFn: (data: { newPassword: string }) => api.setPassword(data),
    onSuccess: () => {
      toast.success('Password set successfully');
      updateUser({ hasPassword: true });
      setShowChangePasswordDialog(false);
      setNewPassword('');
      setConfirmPassword('');
    },
    onError: (error: Error) => {
      toast.error('Failed to set password', {
        description: error.message,
      });
    },
  });

  const handleEditUsername = () => {
    setNewUsername(user?.username || '');
    setShowEditUsernameDialog(true);
  };

  const handlePasswordSubmit = () => {
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    if (newPassword.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }

    if (user?.hasPassword) {
      changePasswordMutation.mutate({ currentPassword, newPassword });
    } else {
      setPasswordMutation.mutate({ newPassword });
    }
  };

  const handleSaveUsername = () => {
    if (!newUsername.trim() || newUsername === user?.username) return;
    updateUsernameMutation.mutate(newUsername.trim());
  };

  const handleCreate = async () => {
    if (!newKeyName.trim()) return;

    try {
      const expiresInDays = keyExpiration === 'never' ? undefined : parseInt(keyExpiration);
      const result = await createMutation.mutateAsync({
        name: newKeyName.trim(),
        expiresInDays,
        scopes: keyScopes,
      });
      setCreatedKey(result);
      setNewKeyName('');
      setKeyExpiration('never');
      setKeyScopes(['full']);
      setShowCreateDialog(false);
    } catch {
      // Error handled in hook
    }
  };

  // Scope tree structure
  const scopeTree: Record<string, ApiKeyScope[]> = {
    accounts: ['read:accounts', 'write:accounts'],
    trades: ['read:trades', 'write:trades'],
    logs: ['read:logs'],
  };

  const allNonFullScopes: ApiKeyScope[] = [
    ...scopeTree.accounts,
    ...scopeTree.trades,
    ...scopeTree.logs,
  ];

  const isFull = keyScopes.includes('full');
  const hasAllScopes = allNonFullScopes.every((s) => keyScopes.includes(s));

  const toggleFull = () => {
    if (isFull || hasAllScopes) {
      // Deselect all
      setKeyScopes([]);
    } else {
      // Select full
      setKeyScopes(['full']);
    }
  };

  const toggleCategory = (category: string) => {
    const categoryScopes = scopeTree[category];
    const hasAll = categoryScopes.every((s) => keyScopes.includes(s) || isFull);

    setKeyScopes((prev) => {
      // Remove 'full' when toggling specific scopes
      let newScopes: ApiKeyScope[] = prev.filter((s) => s !== 'full');

      if (hasAll && !isFull) {
        // Remove all scopes in this category
        newScopes = newScopes.filter((s) => !categoryScopes.includes(s));
      } else {
        // Add all scopes in this category
        categoryScopes.forEach((s) => {
          if (!newScopes.includes(s)) {
            newScopes.push(s);
          }
        });
      }

      return newScopes;
    });
  };

  const toggleScope = (scope: ApiKeyScope) => {
    if (scope === 'full') return; // Use toggleFull for full scope
    setKeyScopes((prev) => {
      // Remove 'full' when toggling specific scopes
      let newScopes = prev.filter((s) => s !== 'full');

      if (newScopes.includes(scope)) {
        newScopes = newScopes.filter((s) => s !== scope);
      } else {
        newScopes.push(scope);
      }

      return newScopes;
    });
  };

  const isScopeChecked = (scope: ApiKeyScope) => isFull || keyScopes.includes(scope);

  const isCategoryChecked = (category: string) => {
    const categoryScopes = scopeTree[category];
    return categoryScopes.every((s) => isFull || keyScopes.includes(s));
  };

  const isCategoryIndeterminate = (category: string) => {
    if (isFull) return false;
    const categoryScopes = scopeTree[category];
    const checkedCount = categoryScopes.filter((s) => keyScopes.includes(s)).length;
    return checkedCount > 0 && checkedCount < categoryScopes.length;
  };

  const formatScopes = (scopes: ApiKeyScope[]) => {
    if (scopes.includes('full')) return 'Full access';
    if (scopes.length === 0) return 'No access';
    if (scopes.length === allNonFullScopes.length) return 'Full access';
    if (scopes.length === 1) return SCOPE_DESCRIPTIONS[scopes[0]];
    return `${scopes.length} permissions`;
  };

  const handleCopy = async () => {
    if (createdKey?.key) {
      await navigator.clipboard.writeText(createdKey.key);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleRevoke = async () => {
    if (keyToRevoke) {
      await deleteMutation.mutateAsync(keyToRevoke._id);
      setKeyToRevoke(null);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getExpirationStatus = (expiresAt: string | null) => {
    if (!expiresAt) return { label: 'Never', variant: 'secondary' as const };
    const expDate = new Date(expiresAt);
    const now = new Date();
    const daysUntilExpiry = Math.ceil((expDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (daysUntilExpiry < 0) {
      return { label: 'Expired', variant: 'destructive' as const };
    } else if (daysUntilExpiry <= 7) {
      return { label: `${daysUntilExpiry}d left`, variant: 'destructive' as const };
    } else if (daysUntilExpiry <= 30) {
      return { label: `${daysUntilExpiry}d left`, variant: 'outline' as const };
    } else {
      return {
        label: expDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        variant: 'secondary' as const,
      };
    }
  };

  const activeKeys = apiKeys.filter((k) => k.isActive);

  const handleRevokeSession = async () => {
    if (sessionToRevoke) {
      await revokeSessionMutation.mutateAsync(sessionToRevoke.id);
      toast.success('Session revoked');
      setSessionToRevoke(null);
    }
  };

  const handleRevokeOtherSessions = async () => {
    const result = await revokeOtherSessionsMutation.mutateAsync();
    toast.success(`Revoked ${result.revokedCount} other session${result.revokedCount === 1 ? '' : 's'}`);
    setShowRevokeOtherSessions(false);
  };

  const parseUserAgent = (ua: string | null) => {
    if (!ua) return { device: 'Unknown Device', browser: 'Unknown Browser' };

    let device = 'Desktop';
    let browser = 'Unknown Browser';

    // Detect mobile
    if (/Mobile|Android|iPhone|iPad/.test(ua)) {
      if (/iPhone/.test(ua)) device = 'iPhone';
      else if (/iPad/.test(ua)) device = 'iPad';
      else if (/Android/.test(ua)) device = 'Android';
      else device = 'Mobile';
    } else if (/Macintosh/.test(ua)) {
      device = 'Mac';
    } else if (/Windows/.test(ua)) {
      device = 'Windows';
    } else if (/Linux/.test(ua)) {
      device = 'Linux';
    }

    // Detect browser
    if (/Chrome/.test(ua) && !/Edg/.test(ua)) browser = 'Chrome';
    else if (/Safari/.test(ua) && !/Chrome/.test(ua)) browser = 'Safari';
    else if (/Firefox/.test(ua)) browser = 'Firefox';
    else if (/Edg/.test(ua)) browser = 'Edge';

    return { device, browser };
  };

  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const otherSessionsCount = sessions.filter((s) => !s.isCurrent).length;

  // Webhook handlers
  const handleCreateWebhook = async () => {
    if (!webhookFormData.name || !webhookFormData.url || webhookFormData.events.length === 0) {
      toast.error('Please fill in all required fields and select at least one event.');
      return;
    }
    try {
      const result = await createWebhookMutation.mutateAsync(webhookFormData);
      setNewWebhookSecret(result.secret);
      setShowCreateWebhookDialog(false);
      setWebhookFormData({ name: '', url: '', events: [] });
      toast.success('Webhook created. Make sure to save the secret!');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create webhook');
    }
  };

  const handleEditWebhook = async () => {
    if (!editingWebhook) return;
    try {
      await updateWebhookMutation.mutateAsync({
        id: editingWebhook._id,
        data: {
          name: webhookFormData.name,
          url: webhookFormData.url,
          events: webhookFormData.events,
        },
      });
      setShowEditWebhookDialog(false);
      setEditingWebhook(null);
      setWebhookFormData({ name: '', url: '', events: [] });
      toast.success('Webhook updated.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update webhook');
    }
  };

  const handleDeleteWebhook = async () => {
    if (!webhookToDelete) return;
    try {
      await deleteWebhookMutation.mutateAsync(webhookToDelete);
      setWebhookToDelete(null);
      toast.success('Webhook deleted.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete webhook');
    }
  };

  const handleToggleWebhookActive = async (webhook: WebhookInfo) => {
    try {
      await updateWebhookMutation.mutateAsync({
        id: webhook._id,
        data: { isActive: !webhook.isActive },
      });
      toast.success(webhook.isActive ? 'Webhook disabled.' : 'Webhook enabled.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update webhook');
    }
  };

  const handleRegenerateWebhookSecret = async (id: string) => {
    try {
      const result = await regenerateWebhookSecretMutation.mutateAsync(id);
      setNewWebhookSecret(result.secret);
      toast.success('New secret generated. Update your integration!');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to regenerate secret');
    }
  };

  const handleTestWebhook = async (id: string) => {
    try {
      const result = await testWebhookMutation.mutateAsync(id);
      toast.success(result.message);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to send test webhook');
    }
  };

  const handleCopyWebhookSecret = () => {
    if (newWebhookSecret) {
      navigator.clipboard.writeText(newWebhookSecret);
      setCopiedWebhookSecret(true);
      setTimeout(() => setCopiedWebhookSecret(false), 2000);
    }
  };

  const openEditWebhookDialog = (webhook: WebhookInfo) => {
    setEditingWebhook(webhook);
    setWebhookFormData({
      name: webhook.name,
      url: webhook.url,
      events: webhook.events,
    });
    setShowEditWebhookDialog(true);
  };

  const toggleWebhookEvent = (event: WebhookEvent) => {
    setWebhookFormData((prev) => ({
      ...prev,
      events: prev.events.includes(event)
        ? prev.events.filter((e) => e !== event)
        : [...prev.events, event],
    }));
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold sm:text-3xl">Account</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your profile and API access
        </p>
      </div>

      {/* Profile Section */}
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>Your account information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            {user?.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt={user.username}
                className="h-16 w-16 rounded-full"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted text-xl font-medium">
                {user?.username.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="space-y-1">
              <p className="text-lg font-medium">@{user?.username}</p>
              <Badge variant="secondary">{user?.role}</Badge>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex items-center gap-2 text-sm">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Username:</span>
              <span>{user?.username}</span>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                onClick={handleEditUsername}
              >
                <Pencil className="h-3 w-3" />
              </Button>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Email:</span>
              <span>{user?.email || 'Not set'}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Shield className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Role:</span>
              <span className="capitalize">{user?.role}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Security Section */}
      <Card>
        <CardHeader>
          <CardTitle>Security</CardTitle>
          <CardDescription>Manage your account security</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Lock className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Password</p>
                <p className="text-xs text-muted-foreground">
                  {user?.hasPassword
                    ? 'Change your account password'
                    : 'Set a password to enable email/password login'}
                </p>
              </div>
            </div>
            <Button variant="outline" onClick={() => setShowChangePasswordDialog(true)}>
              {user?.hasPassword ? 'Change Password' : 'Set Password'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Active Sessions Section */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>Active Sessions</CardTitle>
            <CardDescription>Devices where you're currently logged in</CardDescription>
          </div>
          {otherSessionsCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowRevokeOtherSessions(true)}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sign Out Others
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {isLoadingSessions ? (
            <div className="space-y-3">
              {[...Array(2)].map((_, i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-10 w-10 rounded-lg" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-48" />
                  </div>
                </div>
              ))}
            </div>
          ) : sessions.length === 0 ? (
            <div className="rounded-lg border border-dashed p-6 text-center">
              <Monitor className="mx-auto h-10 w-10 text-muted-foreground/50" />
              <p className="mt-3 text-sm text-muted-foreground">
                No active sessions found.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {sessions.map((session) => {
                const { device, browser } = parseUserAgent(session.userAgent);
                const isMobile = ['iPhone', 'iPad', 'Android', 'Mobile'].includes(device);
                return (
                  <div
                    key={session.id}
                    className="flex items-center gap-4 rounded-lg border p-3"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                      {isMobile ? (
                        <Smartphone className="h-5 w-5 text-muted-foreground" />
                      ) : (
                        <Monitor className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium truncate">
                          {browser} on {device}
                        </p>
                        {session.isCurrent && (
                          <Badge variant="secondary" className="text-xs">
                            This device
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {session.ipAddress || 'Unknown IP'} · Last active {formatRelativeTime(session.lastActiveAt)}
                      </p>
                    </div>
                    {!session.isCurrent && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:text-destructive"
                              onClick={() => setSessionToRevoke(session)}
                            >
                              <LogOut className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Sign out this device</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* API Keys Section */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>API Keys</CardTitle>
            <CardDescription>Create API keys to access the platform programmatically</CardDescription>
          </div>
          <Button size="sm" onClick={() => setShowCreateDialog(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Create Key
          </Button>
        </CardHeader>
        <CardContent>
          {isLoadingKeys ? (
            <ApiKeysSkeleton />
          ) : activeKeys.length === 0 ? (
            <div className="rounded-lg border border-dashed p-6 text-center">
              <Key className="mx-auto h-10 w-10 text-muted-foreground/50" />
              <p className="mt-3 text-sm text-muted-foreground">
                No API keys yet. Create one to get started.
              </p>
            </div>
          ) : (
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Key</TableHead>
                    <TableHead>Permissions</TableHead>
                    <TableHead>Expires</TableHead>
                    <TableHead>Last Used</TableHead>
                    <TableHead className="w-[60px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activeKeys.map((apiKey) => {
                    const expStatus = getExpirationStatus(apiKey.expiresAt);
                    return (
                      <TableRow key={apiKey._id}>
                        <TableCell className="font-medium">{apiKey.name}</TableCell>
                        <TableCell>
                          <code className="rounded bg-muted px-2 py-1 text-sm">
                            {apiKey.keyPrefix}...
                          </code>
                        </TableCell>
                        <TableCell>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger>
                                <Badge variant="secondary">
                                  {formatScopes(apiKey.scopes || ['full'])}
                                </Badge>
                              </TooltipTrigger>
                              <TooltipContent className="max-w-xs">
                                <ul className="text-xs space-y-1">
                                  {(apiKey.scopes || ['full']).map((scope) => (
                                    <li key={scope}>
                                      <span className="font-medium">{scope}</span>: {SCOPE_DESCRIPTIONS[scope]}
                                    </li>
                                  ))}
                                </ul>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </TableCell>
                        <TableCell>
                          <Badge variant={expStatus.variant}>
                            {expStatus.variant === 'destructive' && (
                              <Clock className="mr-1 h-3 w-3" />
                            )}
                            {expStatus.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDate(apiKey.lastUsedAt)}
                        </TableCell>
                        <TableCell>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-destructive hover:text-destructive"
                                  onClick={() => setKeyToRevoke(apiKey)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Revoke key</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          <div className="mt-4 rounded-lg bg-muted/50 p-3">
            <p className="text-sm font-medium">Usage</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Include your API key in the Authorization header:
            </p>
            <pre className="mt-2 overflow-x-auto rounded bg-muted p-2 text-xs">
              <code>Authorization: Bearer otm_your_api_key_here</code>
            </pre>
          </div>
        </CardContent>
      </Card>

      {/* Webhooks Section */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>Webhooks</CardTitle>
            <CardDescription>Send events to external services when trades are mirrored</CardDescription>
          </div>
          <Button size="sm" onClick={() => setShowCreateWebhookDialog(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Webhook
          </Button>
        </CardHeader>
        <CardContent>
          {isLoadingWebhooks ? (
            <div className="space-y-3">
              {[...Array(2)].map((_, i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 flex-1" />
                  <Skeleton className="h-8 w-16" />
                </div>
              ))}
            </div>
          ) : webhooks.length === 0 ? (
            <div className="rounded-lg border border-dashed p-6 text-center">
              <Webhook className="mx-auto h-10 w-10 text-muted-foreground/50" />
              <p className="mt-3 text-sm text-muted-foreground">
                No webhooks configured. Create one to receive event notifications.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {webhooks.map((webhook) => (
                <div key={webhook._id} className="rounded-lg border p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                      <Switch
                        checked={webhook.isActive}
                        onCheckedChange={() => handleToggleWebhookActive(webhook)}
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{webhook.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{webhook.url}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="ghost" size="sm" onClick={() => openEditWebhookDialog(webhook)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Edit</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="ghost" size="sm" onClick={() => handleTestWebhook(webhook._id)}>
                              <Play className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Send Test</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="ghost" size="sm" onClick={() => handleRegenerateWebhookSecret(webhook._id)}>
                              <RefreshCw className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Regenerate Secret</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:text-destructive"
                              onClick={() => setWebhookToDelete(webhook._id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Delete</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {webhook.events.map((event) => (
                      <Badge key={event} variant="secondary" className="text-xs">
                        {event}
                      </Badge>
                    ))}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span>Secret: {webhook.secret}</span>
                    {webhook.lastTriggeredAt && (
                      <span>Last triggered: {formatRelativeTime(webhook.lastTriggeredAt)}</span>
                    )}
                    {webhook.failureCount > 0 && (
                      <span className="flex items-center gap-1 text-yellow-600">
                        <AlertTriangle className="h-3 w-3" />
                        {webhook.failureCount} failure{webhook.failureCount !== 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Key Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={(open) => {
        setShowCreateDialog(open);
        if (!open) {
          setNewKeyName('');
          setKeyExpiration('never');
          setKeyScopes(['full']);
        }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create API Key</DialogTitle>
            <DialogDescription>
              Configure your API key's name, expiration, and permissions.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="keyName">Name</Label>
              <Input
                id="keyName"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                placeholder="e.g., Production Server, Local Development"
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="expiration">Expiration</Label>
              <Select value={keyExpiration} onValueChange={setKeyExpiration}>
                <SelectTrigger>
                  <SelectValue placeholder="Select expiration" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="never">Never expires</SelectItem>
                  <SelectItem value="30">30 days</SelectItem>
                  <SelectItem value="60">60 days</SelectItem>
                  <SelectItem value="90">90 days</SelectItem>
                  <SelectItem value="180">6 months</SelectItem>
                  <SelectItem value="365">1 year</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Permissions</Label>
              <div className="rounded-md border p-3 space-y-2">
                {/* Full Access */}
                <div className="flex items-center space-x-3">
                  <Checkbox
                    id="scope-full"
                    checked={isFull || hasAllScopes}
                    onCheckedChange={toggleFull}
                  />
                  <label htmlFor="scope-full" className="text-sm font-medium cursor-pointer">
                    Full Access
                  </label>
                </div>

                {/* Accounts */}
                <div className="ml-4 space-y-1">
                  <div className="flex items-center space-x-3">
                    <Checkbox
                      id="scope-accounts"
                      checked={isCategoryChecked('accounts')}
                      ref={(el) => {
                        if (el) {
                          (el as unknown as HTMLButtonElement).dataset.state =
                            isCategoryIndeterminate('accounts') ? 'indeterminate' :
                            isCategoryChecked('accounts') ? 'checked' : 'unchecked';
                        }
                      }}
                      onCheckedChange={() => toggleCategory('accounts')}
                    />
                    <label htmlFor="scope-accounts" className="text-sm font-medium cursor-pointer">
                      Accounts
                    </label>
                  </div>
                  <div className="ml-6 space-y-1">
                    <div className="flex items-center space-x-3">
                      <Checkbox
                        id="scope-read-accounts"
                        checked={isScopeChecked('read:accounts')}
                        onCheckedChange={() => toggleScope('read:accounts')}
                        disabled={isFull}
                      />
                      <label htmlFor="scope-read-accounts" className="text-sm cursor-pointer text-muted-foreground">
                        Read
                      </label>
                    </div>
                    <div className="flex items-center space-x-3">
                      <Checkbox
                        id="scope-write-accounts"
                        checked={isScopeChecked('write:accounts')}
                        onCheckedChange={() => toggleScope('write:accounts')}
                        disabled={isFull}
                      />
                      <label htmlFor="scope-write-accounts" className="text-sm cursor-pointer text-muted-foreground">
                        Write
                      </label>
                    </div>
                  </div>
                </div>

                {/* Trades */}
                <div className="ml-4 space-y-1">
                  <div className="flex items-center space-x-3">
                    <Checkbox
                      id="scope-trades"
                      checked={isCategoryChecked('trades')}
                      ref={(el) => {
                        if (el) {
                          (el as unknown as HTMLButtonElement).dataset.state =
                            isCategoryIndeterminate('trades') ? 'indeterminate' :
                            isCategoryChecked('trades') ? 'checked' : 'unchecked';
                        }
                      }}
                      onCheckedChange={() => toggleCategory('trades')}
                    />
                    <label htmlFor="scope-trades" className="text-sm font-medium cursor-pointer">
                      Trades
                    </label>
                  </div>
                  <div className="ml-6 space-y-1">
                    <div className="flex items-center space-x-3">
                      <Checkbox
                        id="scope-read-trades"
                        checked={isScopeChecked('read:trades')}
                        onCheckedChange={() => toggleScope('read:trades')}
                        disabled={isFull}
                      />
                      <label htmlFor="scope-read-trades" className="text-sm cursor-pointer text-muted-foreground">
                        Read
                      </label>
                    </div>
                    <div className="flex items-center space-x-3">
                      <Checkbox
                        id="scope-write-trades"
                        checked={isScopeChecked('write:trades')}
                        onCheckedChange={() => toggleScope('write:trades')}
                        disabled={isFull}
                      />
                      <label htmlFor="scope-write-trades" className="text-sm cursor-pointer text-muted-foreground">
                        Write
                      </label>
                    </div>
                  </div>
                </div>

                {/* Logs */}
                <div className="ml-4 space-y-1">
                  <div className="flex items-center space-x-3">
                    <Checkbox
                      id="scope-logs"
                      checked={isCategoryChecked('logs')}
                      onCheckedChange={() => toggleCategory('logs')}
                    />
                    <label htmlFor="scope-logs" className="text-sm font-medium cursor-pointer">
                      Logs
                    </label>
                  </div>
                  <div className="ml-6 space-y-1">
                    <div className="flex items-center space-x-3">
                      <Checkbox
                        id="scope-read-logs"
                        checked={isScopeChecked('read:logs')}
                        onCheckedChange={() => toggleScope('read:logs')}
                        disabled={isFull}
                      />
                      <label htmlFor="scope-read-logs" className="text-sm cursor-pointer text-muted-foreground">
                        Read
                      </label>
                    </div>
                  </div>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                For security, grant only the permissions your application needs.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={!newKeyName.trim() || createMutation.isPending}
            >
              {createMutation.isPending ? 'Creating...' : 'Create Key'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Show Created Key Dialog */}
      <Dialog open={!!createdKey} onOpenChange={() => setCreatedKey(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>API Key Created</DialogTitle>
            <DialogDescription>
              <span className="flex items-center gap-2 text-amber-500">
                <AlertTriangle className="h-4 w-4" />
                Copy your API key now. You won't be able to see it again!
              </span>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Name</Label>
                <p className="text-sm font-medium">{createdKey?.name}</p>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Expires</Label>
                <p className="text-sm font-medium">
                  {createdKey?.expiresAt
                    ? new Date(createdKey.expiresAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })
                    : 'Never'}
                </p>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Permissions</Label>
              <div className="flex flex-wrap gap-1">
                {(createdKey?.scopes || ['full']).map((scope) => (
                  <Badge key={scope} variant="secondary" className="text-xs">
                    {scope === 'full' ? 'Full Access' : scope}
                  </Badge>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>API Key</Label>
              <div className="flex gap-2">
                <code className="flex-1 overflow-x-auto rounded bg-muted p-3 text-sm">
                  {createdKey?.key}
                </code>
                <Button variant="outline" size="icon" onClick={handleCopy}>
                  {copied ? (
                    <Check className="h-4 w-4 text-green-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setCreatedKey(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Revoke Confirmation Dialog */}
      <AlertDialog open={!!keyToRevoke} onOpenChange={() => setKeyToRevoke(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke API Key</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to revoke <strong>{keyToRevoke?.name}</strong>?
              Any applications using this key will no longer be able to authenticate.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRevoke}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Revoke Key
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Username Dialog */}
      <Dialog open={showEditUsernameDialog} onOpenChange={setShowEditUsernameDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Username</DialogTitle>
            <DialogDescription>
              Choose a new username. It must be unique and can only contain letters, numbers, underscores, and hyphens.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                placeholder="Enter new username"
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                3-50 characters. Letters, numbers, underscores, and hyphens only.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditUsernameDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveUsername}
              disabled={!newUsername.trim() || newUsername === user?.username || updateUsernameMutation.isPending}
            >
              {updateUsernameMutation.isPending ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Set/Change Password Dialog */}
      <Dialog open={showChangePasswordDialog} onOpenChange={(open) => {
        setShowChangePasswordDialog(open);
        if (!open) {
          setCurrentPassword('');
          setNewPassword('');
          setConfirmPassword('');
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{user?.hasPassword ? 'Change Password' : 'Set Password'}</DialogTitle>
            <DialogDescription>
              {user?.hasPassword
                ? 'Enter your current password and choose a new one.'
                : 'Set a password to enable email/password login alongside your existing sign-in method.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {user?.hasPassword && (
              <div className="space-y-2">
                <Label htmlFor="currentPassword">Current Password</Label>
                <Input
                  id="currentPassword"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  autoFocus
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="newPassword">{user?.hasPassword ? 'New Password' : 'Password'}</Label>
              <Input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoFocus={!user?.hasPassword}
              />
              <p className="text-xs text-muted-foreground">
                At least 8 characters with uppercase, lowercase, and numbers.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowChangePasswordDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handlePasswordSubmit}
              disabled={
                (user?.hasPassword && !currentPassword) ||
                !newPassword ||
                !confirmPassword ||
                changePasswordMutation.isPending ||
                setPasswordMutation.isPending
              }
            >
              {(changePasswordMutation.isPending || setPasswordMutation.isPending)
                ? (user?.hasPassword ? 'Changing...' : 'Setting...')
                : (user?.hasPassword ? 'Change Password' : 'Set Password')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Revoke Session Confirmation Dialog */}
      <AlertDialog open={!!sessionToRevoke} onOpenChange={() => setSessionToRevoke(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sign Out Device</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to sign out this device? They will need to log in again to access their account.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRevokeSession}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Sign Out
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Revoke Other Sessions Confirmation Dialog */}
      <AlertDialog open={showRevokeOtherSessions} onOpenChange={setShowRevokeOtherSessions}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sign Out Other Devices</AlertDialogTitle>
            <AlertDialogDescription>
              This will sign you out of all other devices ({otherSessionsCount} session{otherSessionsCount === 1 ? '' : 's'}).
              You will remain signed in on this device.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRevokeOtherSessions}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Sign Out Others
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Create Webhook Dialog */}
      <Dialog open={showCreateWebhookDialog} onOpenChange={(open) => {
        setShowCreateWebhookDialog(open);
        if (!open) setWebhookFormData({ name: '', url: '', events: [] });
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Webhook</DialogTitle>
            <DialogDescription>
              Configure a URL to receive event notifications.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="webhookName">Name</Label>
              <Input
                id="webhookName"
                value={webhookFormData.name}
                onChange={(e) => setWebhookFormData((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="My Webhook"
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="webhookUrl">URL</Label>
              <Input
                id="webhookUrl"
                value={webhookFormData.url}
                onChange={(e) => setWebhookFormData((prev) => ({ ...prev, url: e.target.value }))}
                placeholder="https://example.com/webhook"
              />
            </div>
            <div className="space-y-2">
              <Label>Events</Label>
              <div className="rounded-md border p-3 space-y-2">
                {WEBHOOK_EVENTS.map((event) => (
                  <div key={event} className="flex items-start gap-2">
                    <Checkbox
                      id={`wh-${event}`}
                      checked={webhookFormData.events.includes(event)}
                      onCheckedChange={() => toggleWebhookEvent(event)}
                    />
                    <div className="grid gap-1 leading-none">
                      <label htmlFor={`wh-${event}`} className="text-sm font-medium leading-none cursor-pointer">
                        {event}
                      </label>
                      <p className="text-xs text-muted-foreground">
                        {WEBHOOK_EVENT_DESCRIPTIONS[event]}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateWebhookDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateWebhook} disabled={createWebhookMutation.isPending}>
              {createWebhookMutation.isPending ? 'Creating...' : 'Create Webhook'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Webhook Dialog */}
      <Dialog open={showEditWebhookDialog} onOpenChange={(open) => {
        setShowEditWebhookDialog(open);
        if (!open) {
          setEditingWebhook(null);
          setWebhookFormData({ name: '', url: '', events: [] });
        }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Webhook</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="editWebhookName">Name</Label>
              <Input
                id="editWebhookName"
                value={webhookFormData.name}
                onChange={(e) => setWebhookFormData((prev) => ({ ...prev, name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="editWebhookUrl">URL</Label>
              <Input
                id="editWebhookUrl"
                value={webhookFormData.url}
                onChange={(e) => setWebhookFormData((prev) => ({ ...prev, url: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Events</Label>
              <div className="rounded-md border p-3 space-y-2">
                {WEBHOOK_EVENTS.map((event) => (
                  <div key={event} className="flex items-start gap-2">
                    <Checkbox
                      id={`edit-wh-${event}`}
                      checked={webhookFormData.events.includes(event)}
                      onCheckedChange={() => toggleWebhookEvent(event)}
                    />
                    <div className="grid gap-1 leading-none">
                      <label htmlFor={`edit-wh-${event}`} className="text-sm font-medium leading-none cursor-pointer">
                        {event}
                      </label>
                      <p className="text-xs text-muted-foreground">
                        {WEBHOOK_EVENT_DESCRIPTIONS[event]}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditWebhookDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleEditWebhook} disabled={updateWebhookMutation.isPending}>
              {updateWebhookMutation.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Webhook Confirmation */}
      <AlertDialog open={!!webhookToDelete} onOpenChange={() => setWebhookToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Webhook</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this webhook? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDeleteWebhook}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Webhook Secret Dialog */}
      <Dialog open={!!newWebhookSecret} onOpenChange={() => setNewWebhookSecret(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Webhook Secret</DialogTitle>
            <DialogDescription>
              <span className="flex items-center gap-2 text-amber-500">
                <AlertTriangle className="h-4 w-4" />
                Copy your webhook secret now. You won't be able to see it again!
              </span>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-2">
              <code className="flex-1 overflow-x-auto rounded bg-muted p-3 text-sm font-mono break-all">
                {newWebhookSecret}
              </code>
              <Button variant="outline" size="icon" onClick={handleCopyWebhookSecret}>
                {copiedWebhookSecret ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              Use this secret to verify webhook payloads. The signature is sent in the{' '}
              <code className="bg-muted px-1 rounded">X-Webhook-Signature</code> header.
            </p>
          </div>
          <DialogFooter>
            <Button onClick={() => setNewWebhookSecret(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
