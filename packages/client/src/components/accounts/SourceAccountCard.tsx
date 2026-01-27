import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  useMirrorAccounts,
  useDeleteSourceAccount,
  useDeleteMirrorAccount,
  useUpdateMirrorAccount,
  useCreateMirrorAccount,
  useUpdateSourceAccount,
  useToggleMirrorAccount,
  usePauseAllMirrors,
  useResumeAllMirrors,
} from '@/hooks/useAccounts';
import { useSyncStatus } from '@/hooks/useTrades';
import { SourceAccount, MirrorAccount, ScalingMode } from '@/api/client';
import { AddAccountDialog, AccountFormData } from './AddAccountDialog';
import { DeleteConfirmDialog } from './DeleteConfirmDialog';
import { Plus, Trash2, Edit2, Check, X, Pause, Play, CheckCircle2, AlertCircle, Clock, PauseCircle, PlayCircle } from 'lucide-react';

interface SourceAccountCardProps {
  source: SourceAccount;
}

export function SourceAccountCard({ source }: SourceAccountCardProps) {
  const [showAddMirror, setShowAddMirror] = useState(false);
  const [editingScaleFactor, setEditingScaleFactor] = useState<string | null>(null);
  const [newScaleFactor, setNewScaleFactor] = useState('');
  const [editingSourceAlias, setEditingSourceAlias] = useState(false);
  const [newSourceAlias, setNewSourceAlias] = useState('');
  const [editingMirrorAlias, setEditingMirrorAlias] = useState<string | null>(null);
  const [newMirrorAlias, setNewMirrorAlias] = useState('');
  const [showDeleteSource, setShowDeleteSource] = useState(false);
  const [mirrorToDelete, setMirrorToDelete] = useState<MirrorAccount | null>(null);

  const { data: mirrors = [], isLoading } = useMirrorAccounts(source._id);
  const { data: syncStatus } = useSyncStatus(source._id);
  const deleteSourceMutation = useDeleteSourceAccount();
  const deleteMirrorMutation = useDeleteMirrorAccount(source._id);
  const updateMirrorMutation = useUpdateMirrorAccount(source._id);
  const createMirrorMutation = useCreateMirrorAccount(source._id);
  const updateSourceMutation = useUpdateSourceAccount();
  const toggleMirrorMutation = useToggleMirrorAccount(source._id);
  const pauseAllMutation = usePauseAllMirrors(source._id);
  const resumeAllMutation = useResumeAllMirrors(source._id);

  const handleAddMirror = async (data: AccountFormData) => {
    await createMirrorMutation.mutateAsync({
      oandaAccountId: data.oandaAccountId,
      apiToken: data.apiToken,
      environment: data.environment,
      scalingMode: data.scalingMode,
      scaleFactor: data.scaleFactor,
      alias: data.alias || undefined,
    });
    setShowAddMirror(false);
  };

  const handleToggleScalingMode = async (mirrorId: string, currentMode: ScalingMode) => {
    const newMode: ScalingMode = currentMode === 'dynamic' ? 'static' : 'dynamic';
    await updateMirrorMutation.mutateAsync({ id: mirrorId, scalingMode: newMode });
  };

  const handleUpdateScaleFactor = async (mirrorId: string) => {
    const factor = parseFloat(newScaleFactor);
    if (isNaN(factor) || factor < 0.01 || factor > 100) return;

    await updateMirrorMutation.mutateAsync({ id: mirrorId, scaleFactor: factor });
    setEditingScaleFactor(null);
    setNewScaleFactor('');
  };

  const handleUpdateSourceAlias = async () => {
    await updateSourceMutation.mutateAsync({ id: source._id, alias: newSourceAlias || undefined });
    setEditingSourceAlias(false);
    setNewSourceAlias('');
  };

  const handleUpdateMirrorAlias = async (mirrorId: string) => {
    await updateMirrorMutation.mutateAsync({ id: mirrorId, alias: newMirrorAlias || undefined });
    setEditingMirrorAlias(null);
    setNewMirrorAlias('');
  };

  const handleDeleteSource = async () => {
    await deleteSourceMutation.mutateAsync(source._id);
    setShowDeleteSource(false);
  };

  const handleDeleteMirror = async () => {
    if (mirrorToDelete) {
      await deleteMirrorMutation.mutateAsync(mirrorToDelete._id);
      setMirrorToDelete(null);
    }
  };

  const getMirrorSyncStatus = (mirrorId: string) => {
    if (!syncStatus) return null;
    return syncStatus.mirrorStatus.find((s) => s.mirrorAccountId === mirrorId);
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            {editingSourceAlias ? (
              <div className="flex items-center gap-2">
                <Input
                  value={newSourceAlias}
                  onChange={(e) => setNewSourceAlias(e.target.value)}
                  placeholder="Enter alias"
                  className="h-8 w-48"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={handleUpdateSourceAlias}
                >
                  <Check className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setEditingSourceAlias(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <CardTitle
                className="flex cursor-pointer items-center gap-2 text-lg hover:text-muted-foreground"
                onClick={() => {
                  setEditingSourceAlias(true);
                  setNewSourceAlias(source.alias || '');
                }}
              >
                {source.alias || source.oandaAccountId}
                <Edit2 className="h-4 w-4" />
              </CardTitle>
            )}
            {!editingSourceAlias && source.alias && (
              <p className="text-sm text-muted-foreground">{source.oandaAccountId}</p>
            )}
            <div className="mt-1 flex items-center gap-2">
              <Badge variant={source.environment === 'live' ? 'destructive' : 'secondary'}>
                {source.environment}
              </Badge>
              <Badge variant={source.isActive ? 'success' : 'outline'}>
                {source.isActive ? 'Active' : 'Inactive'}
              </Badge>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowDeleteSource(true)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">
              {source.lastSyncedAt ? (
                <>Last synced: {new Date(source.lastSyncedAt).toLocaleString()}</>
              ) : (
                <>Never synced</>
              )}
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <h4 className="font-medium">Mirror Accounts</h4>
                <div className="flex items-center gap-2">
                  {mirrors.length > 0 && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => pauseAllMutation.mutate()}
                        disabled={pauseAllMutation.isPending || mirrors.every((m) => !m.isActive)}
                        title="Pause all mirrors"
                      >
                        <PauseCircle className="mr-1 h-4 w-4" />
                        Pause All
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => resumeAllMutation.mutate()}
                        disabled={resumeAllMutation.isPending || mirrors.every((m) => m.isActive)}
                        title="Resume all mirrors"
                      >
                        <PlayCircle className="mr-1 h-4 w-4" />
                        Resume All
                      </Button>
                    </>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowAddMirror(true)}
                  >
                    <Plus className="mr-1 h-4 w-4" />
                    Add Mirror
                  </Button>
                </div>
              </div>

              {isLoading ? (
                <p className="text-sm text-muted-foreground">Loading...</p>
              ) : mirrors.length === 0 ? (
                <p className="text-sm text-muted-foreground">No mirror accounts</p>
              ) : (
                <div className="space-y-2">
                  {mirrors.map((mirror) => (
                    <div
                      key={mirror._id}
                      className={`flex items-center justify-between rounded-lg border p-3 ${
                        !mirror.isActive ? 'border-dashed border-yellow-500/50 bg-yellow-50/50 dark:bg-yellow-950/20' : ''
                      }`}
                    >
                      <div>
                        {editingMirrorAlias === mirror._id ? (
                          <div className="mb-1 flex items-center gap-1">
                            <Input
                              value={newMirrorAlias}
                              onChange={(e) => setNewMirrorAlias(e.target.value)}
                              placeholder="Enter alias"
                              className="h-6 w-32 text-sm"
                            />
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => handleUpdateMirrorAlias(mirror._id)}
                            >
                              <Check className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => setEditingMirrorAlias(null)}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        ) : (
                          <p
                            className={`flex cursor-pointer items-center gap-1 font-medium hover:text-muted-foreground ${
                              !mirror.isActive ? 'text-muted-foreground' : ''
                            }`}
                            onClick={() => {
                              setEditingMirrorAlias(mirror._id);
                              setNewMirrorAlias(mirror.alias || '');
                            }}
                          >
                            {mirror.alias || mirror.oandaAccountId}
                            <Edit2 className="h-3 w-3" />
                          </p>
                        )}
                        {!editingMirrorAlias && mirror.alias && (
                          <p className="text-xs text-muted-foreground">{mirror.oandaAccountId}</p>
                        )}
                        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                          <Badge variant="outline" className="text-xs">
                            {mirror.environment}
                          </Badge>
                          {!mirror.isActive && (
                            <Badge variant="warning" className="animate-pulse text-xs">
                              Paused
                            </Badge>
                          )}
                          {mirror.isActive && (() => {
                            const status = getMirrorSyncStatus(mirror._id);
                            if (!status) return null;
                            if (status.pendingCount > 0) {
                              return (
                                <Badge variant="outline" className="gap-1 border-yellow-500 bg-yellow-50 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-400">
                                  <Clock className="h-3 w-3" />
                                  {status.pendingCount} pending
                                </Badge>
                              );
                            }
                            if (status.failedCount > 0) {
                              return (
                                <Badge variant="outline" className="gap-1 border-red-500 bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-400">
                                  <AlertCircle className="h-3 w-3" />
                                  {status.failedCount} failed
                                </Badge>
                              );
                            }
                            if (status.successCount > 0) {
                              return (
                                <Badge variant="outline" className="gap-1 border-green-500 bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-400">
                                  <CheckCircle2 className="h-3 w-3" />
                                  Synced
                                </Badge>
                              );
                            }
                            return null;
                          })()}
                          <Badge
                            variant={mirror.scalingMode === 'dynamic' ? 'default' : 'secondary'}
                            className="cursor-pointer text-xs"
                            onClick={() => handleToggleScalingMode(mirror._id, mirror.scalingMode)}
                            title="Click to toggle scaling mode"
                          >
                            {mirror.scalingMode === 'dynamic' ? 'NAV-based' : 'Static'}
                          </Badge>
                          {mirror.scalingMode === 'static' && (
                            <>
                              {editingScaleFactor === mirror._id ? (
                                <div className="flex items-center gap-1">
                                  <Input
                                    type="number"
                                    step="0.01"
                                    min="0.01"
                                    max="100"
                                    value={newScaleFactor}
                                    onChange={(e) => setNewScaleFactor(e.target.value)}
                                    className="h-6 w-20 text-xs"
                                  />
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6"
                                    onClick={() => handleUpdateScaleFactor(mirror._id)}
                                  >
                                    <Check className="h-3 w-3" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6"
                                    onClick={() => setEditingScaleFactor(null)}
                                  >
                                    <X className="h-3 w-3" />
                                  </Button>
                                </div>
                              ) : (
                                <span
                                  className="flex cursor-pointer items-center gap-1 hover:text-foreground"
                                  onClick={() => {
                                    setEditingScaleFactor(mirror._id);
                                    setNewScaleFactor(String(mirror.scaleFactor));
                                  }}
                                >
                                  {mirror.scaleFactor}x
                                  <Edit2 className="h-3 w-3" />
                                </span>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => toggleMirrorMutation.mutate(mirror._id)}
                          disabled={toggleMirrorMutation.isPending}
                          title={mirror.isActive ? 'Pause mirroring' : 'Resume mirroring'}
                        >
                          {mirror.isActive ? (
                            <Pause className="h-4 w-4" />
                          ) : (
                            <Play className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setMirrorToDelete(mirror)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <AddAccountDialog
        open={showAddMirror}
        onOpenChange={setShowAddMirror}
        onSubmit={handleAddMirror}
        type="mirror"
        isSubmitting={createMirrorMutation.isPending}
      />

      <DeleteConfirmDialog
        open={showDeleteSource}
        onOpenChange={setShowDeleteSource}
        onConfirm={handleDeleteSource}
        accountId={source.oandaAccountId}
        accountName={source.alias || source.oandaAccountId}
        type="source"
        isDeleting={deleteSourceMutation.isPending}
      />

      {mirrorToDelete && (
        <DeleteConfirmDialog
          open={!!mirrorToDelete}
          onOpenChange={(open) => !open && setMirrorToDelete(null)}
          onConfirm={handleDeleteMirror}
          accountId={mirrorToDelete.oandaAccountId}
          accountName={mirrorToDelete.alias || mirrorToDelete.oandaAccountId}
          type="mirror"
          isDeleting={deleteMirrorMutation.isPending}
        />
      )}
    </>
  );
}
