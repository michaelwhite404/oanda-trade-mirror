import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, PlaceTradeRequest, GetLogsParams } from '@/api/client';

export function useTrades(sourceId: string | null, limit = 50) {
  return useQuery({
    queryKey: ['trades', sourceId, limit],
    queryFn: () => (sourceId ? api.getTrades(sourceId, limit) : Promise.resolve([])),
    enabled: !!sourceId,
    refetchInterval: 5000,
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trades', sourceId] });
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
