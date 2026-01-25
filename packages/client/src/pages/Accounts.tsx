import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useSourceAccounts, useCreateSourceAccount } from '@/hooks/useAccounts';
import { SourceAccountCard } from '@/components/accounts/SourceAccountCard';
import { AddAccountDialog, AccountFormData } from '@/components/accounts/AddAccountDialog';
import { Plus } from 'lucide-react';

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
        <p className="text-muted-foreground">Loading accounts...</p>
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
