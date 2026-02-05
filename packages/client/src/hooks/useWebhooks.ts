import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, CreateWebhookRequest, UpdateWebhookRequest } from '../api/client';

export function useWebhooks() {
  return useQuery({
    queryKey: ['webhooks'],
    queryFn: () => api.getWebhooks(),
  });
}

export function useWebhookEvents() {
  return useQuery({
    queryKey: ['webhook-events'],
    queryFn: () => api.getWebhookEvents(),
    staleTime: Infinity, // Events don't change
  });
}

export function useCreateWebhook() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateWebhookRequest) => api.createWebhook(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhooks'] });
    },
  });
}

export function useUpdateWebhook() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateWebhookRequest }) =>
      api.updateWebhook(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhooks'] });
    },
  });
}

export function useDeleteWebhook() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.deleteWebhook(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhooks'] });
    },
  });
}

export function useRegenerateWebhookSecret() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.regenerateWebhookSecret(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhooks'] });
    },
  });
}

export function useTestWebhook() {
  return useMutation({
    mutationFn: (id: string) => api.testWebhook(id),
  });
}
