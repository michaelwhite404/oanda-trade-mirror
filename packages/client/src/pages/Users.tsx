import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useUsers, useInviteUser, useResendInvite, useUpdateUser, useDeleteUser } from '@/hooks/useUsers';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { useAuth } from '@/context/AuthContext';
import { AddUserDialog, InviteFormData } from '@/components/users/AddUserDialog';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Plus, UserX, UserCheck, Mail, Clock, Search, X, History, ChevronDown, ChevronUp, UserPlus, RefreshCw, Shield, UserMinus } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { UserAccount, AuditAction } from '@/api/client';
import { useAuditLog } from '@/hooks/useAuditLog';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

function TableSkeleton() {
  return (
    <div className="space-y-3">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="flex items-center gap-4">
          <Skeleton className="h-10 w-10 rounded-full" />
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-8 w-24" />
        </div>
      ))}
    </div>
  );
}

export default function Users() {
  const [showAddUser, setShowAddUser] = useState(false);
  const [showInactive, setShowInactive] = useState(false);
  const [userToDeactivate, setUserToDeactivate] = useState<UserAccount | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'admin' | 'viewer'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'pending'>('all');
  const [showAuditLog, setShowAuditLog] = useState(false);
  const { data: users = [], isLoading, refetch } = useUsers();
  const { data: auditData, isLoading: isLoadingAudit } = useAuditLog({ limit: 20 });
  const inviteUserMutation = useInviteUser();
  const resendInviteMutation = useResendInvite();
  const updateUserMutation = useUpdateUser();
  const deleteUserMutation = useDeleteUser();
  const { user: currentUser } = useAuth();

  useKeyboardShortcuts({
    onRefresh: () => refetch(),
    onNew: () => setShowAddUser(true),
  });

  const handleInviteUser = async (data: InviteFormData) => {
    await inviteUserMutation.mutateAsync({
      email: data.email,
      role: data.role,
    });
    setShowAddUser(false);
  };

  const handleResendInvite = async (userId: string) => {
    await resendInviteMutation.mutateAsync(userId);
  };

  const handleRoleChange = async (userId: string, role: 'admin' | 'viewer') => {
    await updateUserMutation.mutateAsync({
      id: userId,
      data: { role },
    });
  };

  const handleDeactivate = async () => {
    if (userToDeactivate) {
      await deleteUserMutation.mutateAsync(userToDeactivate._id);
      setUserToDeactivate(null);
    }
  };

  const handleReactivate = async (userId: string) => {
    await updateUserMutation.mutateAsync({
      id: userId,
      data: { isActive: true },
    });
  };

  const inactiveCount = users.filter((u) => !u.isActive).length;

  const filteredUsers = users.filter((u) => {
    // Active/Inactive filter
    if (!showInactive && !u.isActive) return false;

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesUsername = u.username?.toLowerCase().includes(query);
      const matchesEmail = u.email.toLowerCase().includes(query);
      if (!matchesUsername && !matchesEmail) return false;
    }

    // Role filter
    if (roleFilter !== 'all' && u.role !== roleFilter) return false;

    // Status filter
    if (statusFilter !== 'all') {
      if (statusFilter === 'active' && u.registrationStatus !== 'active') return false;
      if (statusFilter === 'pending' && u.registrationStatus !== 'pending') return false;
    }

    return true;
  });

  const hasActiveFilters = searchQuery || roleFilter !== 'all' || statusFilter !== 'all';

  const clearFilters = () => {
    setSearchQuery('');
    setRoleFilter('all');
    setStatusFilter('all');
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
    return formatDate(dateString);
  };

  const getActionIcon = (action: AuditAction) => {
    switch (action) {
      case 'user.invited':
        return <UserPlus className="h-4 w-4 text-blue-500" />;
      case 'user.registered':
        return <UserCheck className="h-4 w-4 text-green-500" />;
      case 'user.role_changed':
        return <Shield className="h-4 w-4 text-amber-500" />;
      case 'user.deactivated':
        return <UserMinus className="h-4 w-4 text-red-500" />;
      case 'user.reactivated':
        return <RefreshCw className="h-4 w-4 text-green-500" />;
      case 'user.invite_resent':
        return <Mail className="h-4 w-4 text-blue-500" />;
      default:
        return <History className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const formatAction = (action: AuditAction) => {
    switch (action) {
      case 'user.invited':
        return 'invited';
      case 'user.registered':
        return 'completed registration';
      case 'user.role_changed':
        return 'changed role of';
      case 'user.deactivated':
        return 'deactivated';
      case 'user.reactivated':
        return 'reactivated';
      case 'user.invite_resent':
        return 'resent invite to';
      default:
        return action;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold sm:text-3xl">Users</h1>
        <Button onClick={() => setShowAddUser(true)}>
          <Plus className="mr-2 h-4 w-4" />
          <span className="hidden sm:inline">Invite User</span>
          <span className="sm:hidden">Invite</span>
        </Button>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 pr-9"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Select value={roleFilter} onValueChange={(v: 'all' | 'admin' | 'viewer') => setRoleFilter(v)}>
            <SelectTrigger className="w-[120px]">
              <SelectValue placeholder="Role" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All roles</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
              <SelectItem value="viewer">Viewer</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={(v: 'all' | 'active' | 'pending') => setStatusFilter(v)}>
            <SelectTrigger className="w-[130px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
            </SelectContent>
          </Select>
          {inactiveCount > 0 && (
            <div className="flex items-center gap-2">
              <Switch
                id="show-inactive"
                checked={showInactive}
                onCheckedChange={setShowInactive}
              />
              <Label htmlFor="show-inactive" className="text-sm text-muted-foreground cursor-pointer whitespace-nowrap">
                Inactive ({inactiveCount})
              </Label>
            </div>
          )}
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              <X className="mr-1 h-4 w-4" />
              Clear
            </Button>
          )}
        </div>
      </div>

      {isLoading ? (
        <TableSkeleton />
      ) : users.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <p className="text-muted-foreground">
            No users found. Invite someone to get started.
          </p>
          <Button className="mt-4" onClick={() => setShowAddUser(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Invite User
          </Button>
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <p className="text-muted-foreground">
            No users match your search criteria.
          </p>
          <Button variant="outline" className="mt-4" onClick={clearFilters}>
            <X className="mr-2 h-4 w-4" />
            Clear Filters
          </Button>
        </div>
      ) : (
        <>
        {/* Mobile card layout */}
        <div className="space-y-3 md:hidden">
          {filteredUsers.map((user) => (
            <div key={user._id} className={`rounded-lg border p-4 space-y-3 ${!user.isActive ? 'opacity-60' : ''}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  {user.avatarUrl ? (
                    <img
                      src={user.avatarUrl}
                      alt={user.username || user.email}
                      className="h-8 w-8 shrink-0 rounded-full"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-medium">
                      {(user.username || user.email).charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0">
                    {user.username ? (
                      <p className="font-medium truncate">@{user.username}</p>
                    ) : (
                      <p className="font-medium text-muted-foreground italic">Pending</p>
                    )}
                    <p className="text-sm text-muted-foreground truncate">{user.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {user.registrationStatus === 'pending' && user.isActive && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleResendInvite(user._id)}
                      disabled={resendInviteMutation.isPending}
                    >
                      <Mail className="h-4 w-4" />
                    </Button>
                  )}
                  {currentUser?.id !== user._id && user.isActive && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => setUserToDeactivate(user)}
                      disabled={deleteUserMutation.isPending}
                    >
                      <UserX className="h-4 w-4" />
                    </Button>
                  )}
                  {!user.isActive && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-green-600 hover:text-green-600"
                      onClick={() => handleReactivate(user._id)}
                      disabled={updateUserMutation.isPending}
                    >
                      <UserCheck className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {currentUser?.id === user._id ? (
                  <Badge variant={user.role === 'admin' ? 'default' : 'secondary'}>
                    {user.role}
                  </Badge>
                ) : (
                  <Select
                    value={user.role}
                    onValueChange={(value: 'admin' | 'viewer') =>
                      handleRoleChange(user._id, value)
                    }
                    disabled={updateUserMutation.isPending}
                  >
                    <SelectTrigger className="w-[100px] h-7 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="viewer">viewer</SelectItem>
                      <SelectItem value="admin">admin</SelectItem>
                    </SelectContent>
                  </Select>
                )}
                {!user.isActive ? (
                  <Badge variant="destructive">Inactive</Badge>
                ) : user.registrationStatus === 'pending' ? (
                  <Badge variant="outline" className="gap-1">
                    <Clock className="h-3 w-3" />
                    Pending
                  </Badge>
                ) : (
                  <Badge variant="default">Active</Badge>
                )}
                {user.authProvider === 'google' && (
                  <Badge variant="outline" className="text-xs">Google</Badge>
                )}
                <span className="text-xs text-muted-foreground ml-auto">
                  {user.registrationStatus === 'pending' ? (
                    <span className="italic">Not registered</span>
                  ) : (
                    formatDate(user.lastLoginAt)
                  )}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Desktop table layout */}
        <div className="hidden md:block rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden lg:table-cell">Last Login</TableHead>
                <TableHead className="w-[120px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.map((user) => (
                <TableRow key={user._id} className={!user.isActive ? 'opacity-60' : ''}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      {user.avatarUrl ? (
                        <img
                          src={user.avatarUrl}
                          alt={user.username || user.email}
                          className="h-8 w-8 rounded-full"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-sm font-medium">
                          {(user.username || user.email).charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div>
                        {user.username ? (
                          <p className="font-medium">@{user.username}</p>
                        ) : (
                          <p className="font-medium text-muted-foreground italic">
                            Pending
                          </p>
                        )}
                        <p className="text-sm text-muted-foreground">{user.email}</p>
                      </div>
                      {user.authProvider === 'google' && (
                        <Badge variant="outline" className="text-xs">
                          Google
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {currentUser?.id === user._id ? (
                      <Badge variant={user.role === 'admin' ? 'default' : 'secondary'}>
                        {user.role}
                      </Badge>
                    ) : (
                      <Select
                        value={user.role}
                        onValueChange={(value: 'admin' | 'viewer') =>
                          handleRoleChange(user._id, value)
                        }
                        disabled={updateUserMutation.isPending}
                      >
                        <SelectTrigger className="w-[100px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="viewer">viewer</SelectItem>
                          <SelectItem value="admin">admin</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  </TableCell>
                  <TableCell>
                    {!user.isActive ? (
                      <Badge variant="destructive">Inactive</Badge>
                    ) : user.registrationStatus === 'pending' ? (
                      <Badge variant="outline" className="gap-1">
                        <Clock className="h-3 w-3" />
                        Pending
                      </Badge>
                    ) : (
                      <Badge variant="default">Active</Badge>
                    )}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                    {user.registrationStatus === 'pending' ? (
                      <span className="italic">Not registered</span>
                    ) : (
                      formatDate(user.lastLoginAt)
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      {user.registrationStatus === 'pending' && user.isActive && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleResendInvite(user._id)}
                                disabled={resendInviteMutation.isPending}
                              >
                                <Mail className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Resend invite</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                      {currentUser?.id !== user._id && user.isActive && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-destructive hover:text-destructive"
                                onClick={() => setUserToDeactivate(user)}
                                disabled={deleteUserMutation.isPending}
                              >
                                <UserX className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Deactivate user</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                      {!user.isActive && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-green-600 hover:text-green-600"
                                onClick={() => handleReactivate(user._id)}
                                disabled={updateUserMutation.isPending}
                              >
                                <UserCheck className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Reactivate user</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        </>
      )}

      {/* Audit Log Section */}
      <Collapsible open={showAuditLog} onOpenChange={setShowAuditLog}>
        <div className="rounded-lg border">
          <CollapsibleTrigger asChild>
            <button className="flex w-full items-center justify-between p-4 hover:bg-muted/50 transition-colors">
              <div className="flex items-center gap-2">
                <History className="h-5 w-5 text-muted-foreground" />
                <span className="font-medium">Activity Log</span>
                {auditData && auditData.total > 0 && (
                  <Badge variant="secondary" className="ml-2">
                    {auditData.total}
                  </Badge>
                )}
              </div>
              {showAuditLog ? (
                <ChevronUp className="h-5 w-5 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-5 w-5 text-muted-foreground" />
              )}
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="border-t px-4 py-3">
              {isLoadingAudit ? (
                <div className="space-y-3">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <Skeleton className="h-8 w-8 rounded-full" />
                      <Skeleton className="h-4 flex-1" />
                      <Skeleton className="h-4 w-16" />
                    </div>
                  ))}
                </div>
              ) : !auditData || auditData.logs.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No activity recorded yet.
                </p>
              ) : (
                <div className="space-y-3">
                  {auditData.logs.map((log) => (
                    <div key={log._id} className="flex items-start gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                        {getActionIcon(log.action)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm">
                          <span className="font-medium">@{log.actorUsername}</span>
                          {' '}{formatAction(log.action)}{' '}
                          {log.targetUsername ? (
                            <span className="font-medium">@{log.targetUsername}</span>
                          ) : log.targetEmail ? (
                            <span className="font-medium">{log.targetEmail}</span>
                          ) : null}
                          {log.action === 'user.role_changed' && log.details && (
                            <span className="text-muted-foreground">
                              {' '}from {String(log.details.oldRole)} to {String(log.details.newRole)}
                            </span>
                          )}
                          {log.action === 'user.invited' && log.details && (
                            <span className="text-muted-foreground">
                              {' '}as {String(log.details.role)}
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatRelativeTime(log.createdAt)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>

      <AddUserDialog
        open={showAddUser}
        onOpenChange={setShowAddUser}
        onSubmit={handleInviteUser}
        isSubmitting={inviteUserMutation.isPending}
      />

      <AlertDialog
        open={!!userToDeactivate}
        onOpenChange={(open) => !open && setUserToDeactivate(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to deactivate{' '}
              <strong>{userToDeactivate?.username ? `@${userToDeactivate.username}` : userToDeactivate?.email}</strong>?
              They will no longer be able to log in. This action can be undone by reactivating the user.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeactivate}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Deactivate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
