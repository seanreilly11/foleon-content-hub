import { useFetchHealth } from './useFetchHealth';

export function useServerReady() {
  const { data } = useFetchHealth();

  // data is ApiResult<HealthData> — { data: HealthData, pagination: null }
  // apiGet unwraps the envelope so there is no .success field here
  const payload = data?.data ?? null;

  return {
    ready: payload?.ready ?? false,
    startupStage: payload?.startupStage ?? 'connecting',
  };
}
