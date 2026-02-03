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
import { Plus, UserX, UserCheck, Mail, Clock } from 'lucide-react';
import { UserAccount } from '@/api/client';

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
  const { data: users = [], isLoading, refetch } = useUsers();
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

  const filteredUsers = showInactive ? users : users.filter((u) => u.isActive);
  const inactiveCount = users.filter((u) => !u.isActive).length;

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

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold sm:text-3xl">Users</h1>
        <div className="flex items-center gap-4">
          {inactiveCount > 0 && (
            <div className="flex items-center gap-2">
              <Switch
                id="show-inactive"
                checked={showInactive}
                onCheckedChange={setShowInactive}
              />
              <Label htmlFor="show-inactive" className="text-sm text-muted-foreground cursor-pointer">
                Show inactive ({inactiveCount})
              </Label>
            </div>
          )}
          <Button onClick={() => setShowAddUser(true)}>
            <Plus className="mr-2 h-4 w-4" />
            <span className="hidden sm:inline">Invite User</span>
            <span className="sm:hidden">Invite</span>
          </Button>
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
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last Login</TableHead>
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
                  <TableCell className="text-sm text-muted-foreground">
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
      )}

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
