import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, CreateApiKeyRequest } from '@/api/client';

export function useApiKeys() {
  return useQuery({
    queryKey: ['apiKeys'],
    queryFn: () => api.getApiKeys(),
  });
}

export function useCreateApiKey() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateApiKeyRequest) => api.createApiKey(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['apiKeys'] });
    },
    onError: (error: Error) => {
      toast.error('Failed to create API key', {
        description: error.message,
      });
    },
  });
}

export function useUpdateApiKey() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      api.updateApiKey(id, { name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['apiKeys'] });
      toast.success('API key updated');
    },
    onError: (error: Error) => {
      toast.error('Failed to update API key', {
        description: error.message,
      });
    },
  });
}

export function useDeleteApiKey() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.deleteApiKey(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['apiKeys'] });
      toast.success('API key revoked');
    },
    onError: (error: Error) => {
      toast.error('Failed to revoke API key', {
        description: error.message,
      });
    },
  });
}
