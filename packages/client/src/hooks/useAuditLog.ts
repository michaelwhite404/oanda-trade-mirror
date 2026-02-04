import { useQuery } from '@tanstack/react-query';
import { api, GetAuditLogParams } from '../api/client';

export function useAuditLog(params: GetAuditLogParams = {}) {
  return useQuery({
    queryKey: ['auditLog', params],
    queryFn: () => api.getAuditLog(params),
  });
}
