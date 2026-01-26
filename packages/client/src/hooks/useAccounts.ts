import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  api,
  CreateSourceAccountRequest,
  CreateMirrorAccountRequest,
  ValidateCredentialsRequest,
  ScalingMode,
} from '@/api/client';

export function useSourceAccounts() {
  return useQuery({
    queryKey: ['sourceAccounts'],
    queryFn: () => api.getSourceAccounts(),
  });
}

export function useMirrorAccounts(sourceId: string | null) {
  return useQuery({
    queryKey: ['mirrorAccounts', sourceId],
    queryFn: () => (sourceId ? api.getMirrorAccounts(sourceId) : Promise.resolve([])),
    enabled: !!sourceId,
  });
}

export function useCreateSourceAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateSourceAccountRequest) => api.createSourceAccount(data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['sourceAccounts'] });
      toast.success('Source account added', {
        description: data.alias || data.oandaAccountId,
      });
    },
    onError: (error: Error) => {
      toast.error('Failed to add source account', {
        description: error.message,
      });
    },
  });
}

export function useDeleteSourceAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.deleteSourceAccount(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sourceAccounts'] });
      toast.success('Source account deleted');
    },
    onError: (error: Error) => {
      toast.error('Failed to delete source account', {
        description: error.message,
      });
    },
  });
}

export function useUpdateSourceAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, alias }: { id: string; alias?: string }) =>
      api.updateSourceAccount(id, { alias }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sourceAccounts'] });
      toast.success('Source account updated');
    },
    onError: (error: Error) => {
      toast.error('Failed to update source account', {
        description: error.message,
      });
    },
  });
}

export function useCreateMirrorAccount(sourceId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateMirrorAccountRequest) => api.createMirrorAccount(sourceId, data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['mirrorAccounts', sourceId] });
      toast.success('Mirror account added', {
        description: data.alias || data.oandaAccountId,
      });
    },
    onError: (error: Error) => {
      toast.error('Failed to add mirror account', {
        description: error.message,
      });
    },
  });
}

export function useDeleteMirrorAccount(sourceId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.deleteMirrorAccount(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mirrorAccounts', sourceId] });
      toast.success('Mirror account deleted');
    },
    onError: (error: Error) => {
      toast.error('Failed to delete mirror account', {
        description: error.message,
      });
    },
  });
}

export function useUpdateMirrorAccount(sourceId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, scalingMode, scaleFactor, alias }: { id: string; scalingMode?: ScalingMode; scaleFactor?: number; alias?: string }) =>
      api.updateMirrorAccount(id, { scalingMode, scaleFactor, alias }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mirrorAccounts', sourceId] });
      toast.success('Mirror account updated');
    },
    onError: (error: Error) => {
      toast.error('Failed to update mirror account', {
        description: error.message,
      });
    },
  });
}

export function useValidateCredentials() {
  return useMutation({
    mutationFn: (data: ValidateCredentialsRequest) => api.validateCredentials(data),
  });
}
