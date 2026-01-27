import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useSourceAccounts, useCreateSourceAccount } from '@/hooks/useAccounts';
import { SourceAccountCard } from '@/components/accounts/SourceAccountCard';
import { AddAccountDialog, AccountFormData } from '@/components/accounts/AddAccountDialog';
import { Plus } from 'lucide-react';

function AccountCardSkeleton() {
  return (
    <div className="rounded-lg border bg-card p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-48" />
        </div>
        <Skeleton className="h-8 w-8 rounded-full" />
      </div>
      <div className="space-y-3">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </div>
      <div className="border-t pt-4 space-y-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-16 w-full" />
      </div>
    </div>
  );
}

export default function Accounts() {
  const [showAddSource, setShowAddSource] = useState(false);
  const { data: sources = [], isLoading } = useSourceAccounts();
  const createSourceMutation = useCreateSourceAccount();

  const handleAddSource = async (data: AccountFormData) => {
    await createSourceMutation.mutateAsync({
      oandaAccountId: data.oandaAccountId,
      apiToken: data.apiToken,
      environment: data.environment,
      alias: data.alias || undefined,
    });
    setShowAddSource(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold sm:text-3xl">Accounts</h1>
        <Button onClick={() => setShowAddSource(true)}>
          <Plus className="mr-2 h-4 w-4" />
          <span className="hidden sm:inline">Add Source Account</span>
          <span className="sm:hidden">Add Account</span>
        </Button>
      </div>

      {isLoading ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <AccountCardSkeleton />
          <AccountCardSkeleton />
        </div>
      ) : sources.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <p className="text-muted-foreground">
            No source accounts configured. Add a source account to start monitoring trades.
          </p>
          <Button className="mt-4" onClick={() => setShowAddSource(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Source Account
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {sources.map((source) => (
            <SourceAccountCard key={source._id} source={source} />
          ))}
        </div>
      )}

      <AddAccountDialog
        open={showAddSource}
        onOpenChange={setShowAddSource}
        onSubmit={handleAddSource}
        type="source"
        isSubmitting={createSourceMutation.isPending}
      />
    </div>
  );
}
