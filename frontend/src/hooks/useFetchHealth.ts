import { useQuery } from '@tanstack/react-query';
import { apiGet } from '../lib/api';
import { healthDataSchema } from '../schemas';
import { HEALTH_POLL_INTERVAL_MS } from '../constants';

export function useFetchHealth() {
  return useQuery({
    queryKey: ['health'],
    queryFn: ({ signal }) =>
      apiGet('/health', undefined, healthDataSchema, { signal }),
    // Poll every 2s until ready: true, then stop automatically
    refetchInterval: (query) =>
      query.state.data?.data?.ready ? false : HEALTH_POLL_INTERVAL_MS,
    staleTime: Infinity,
    retry: false,
  });
}
