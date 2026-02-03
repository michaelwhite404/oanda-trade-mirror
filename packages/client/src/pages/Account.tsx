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
import { useAuth } from '@/context/AuthContext';
import { useApiKeys, useCreateApiKey, useDeleteApiKey } from '@/hooks/useApiKeys';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Trash2, Copy, Check, Key, AlertTriangle, User, Mail, Shield, Pencil } from 'lucide-react';
import { api, ApiKeyInfo, ApiKeyWithSecret } from '@/api/client';

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
  const [newKeyName, setNewKeyName] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [createdKey, setCreatedKey] = useState<ApiKeyWithSecret | null>(null);
  const [keyToRevoke, setKeyToRevoke] = useState<ApiKeyInfo | null>(null);
  const [copied, setCopied] = useState(false);

  const { data: apiKeys = [], isLoading: isLoadingKeys } = useApiKeys();
  const createMutation = useCreateApiKey();
  const deleteMutation = useDeleteApiKey();

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

  const handleEditUsername = () => {
    setNewUsername(user?.username || '');
    setShowEditUsernameDialog(true);
  };

  const handleSaveUsername = () => {
    if (!newUsername.trim() || newUsername === user?.username) return;
    updateUsernameMutation.mutate(newUsername.trim());
  };

  const handleCreate = async () => {
    if (!newKeyName.trim()) return;

    try {
      const result = await createMutation.mutateAsync({ name: newKeyName.trim() });
      setCreatedKey(result);
      setNewKeyName('');
      setShowCreateDialog(false);
    } catch {
      // Error handled in hook
    }
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

  const activeKeys = apiKeys.filter((k) => k.isActive);

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
                    <TableHead>Last Used</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="w-[60px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activeKeys.map((apiKey) => (
                    <TableRow key={apiKey._id}>
                      <TableCell className="font-medium">{apiKey.name}</TableCell>
                      <TableCell>
                        <code className="rounded bg-muted px-2 py-1 text-sm">
                          {apiKey.keyPrefix}...
                        </code>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(apiKey.lastUsedAt)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(apiKey.createdAt)}
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
                  ))}
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

      {/* Create Key Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create API Key</DialogTitle>
            <DialogDescription>
              Give your API key a name to help you remember what it's used for.
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
            <div className="space-y-2">
              <Label>Name</Label>
              <p className="text-sm">{createdKey?.name}</p>
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
    </div>
  );
}
