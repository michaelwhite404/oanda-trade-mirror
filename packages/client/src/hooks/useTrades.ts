import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, PlaceTradeRequest, GetLogsParams, GetTradesParams } from '@/api/client';

export function useTrades(sourceId: string | null, params: GetTradesParams = {}) {
  return useQuery({
    queryKey: ['trades', sourceId, params],
    queryFn: () => (sourceId ? api.getTrades(sourceId, params) : Promise.resolve([])),
    enabled: !!sourceId,
    // Reduced polling - real-time updates come via WebSocket
    refetchInterval: 60000,
  });
}

export function useTradeDetails(sourceId: string | null, txnId: string | null) {
  return useQuery({
    queryKey: ['trade', sourceId, txnId],
    queryFn: () =>
      sourceId && txnId ? api.getTradeDetails(sourceId, txnId) : Promise.resolve(null),
    enabled: !!sourceId && !!txnId,
  });
}

export function usePlaceTrade(sourceId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: PlaceTradeRequest) => api.placeTrade(sourceId, data),
    onSuccess: (_response, variables) => {
      queryClient.invalidateQueries({ queryKey: ['trades', sourceId] });
      toast.success('Trade placed successfully', {
        description: `${variables.side.toUpperCase()} ${variables.units} ${variables.instrument}`,
      });
    },
    onError: (error: Error) => {
      toast.error('Failed to place trade', {
        description: error.message,
      });
    },
  });
}

export function useLogs(params: GetLogsParams = {}) {
  return useQuery({
    queryKey: ['logs', params],
    queryFn: () => api.getLogs(params),
    refetchInterval: params.level ? false : 10000, // Auto-refresh unless filtering
  });
}

export function useHealth() {
  return useQuery({
    queryKey: ['health'],
    queryFn: () => api.getHealth(),
    refetchInterval: 30000,
  });
}

export function useBalances() {
  return useQuery({
    queryKey: ['balances'],
    queryFn: () => api.getBalances(),
    refetchInterval: 60000, // Refresh every minute
  });
}

export function usePositions() {
  return useQuery({
    queryKey: ['positions'],
    queryFn: () => api.getPositions(),
    refetchInterval: 30000, // Refresh every 30 seconds
  });
}

export function useStats() {
  return useQuery({
    queryKey: ['stats'],
    queryFn: () => api.getStats(),
    refetchInterval: 60000, // Refresh every minute
  });
}
