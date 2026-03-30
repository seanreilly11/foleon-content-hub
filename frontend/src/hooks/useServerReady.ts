import { useFetchHealth } from "./useFetchHealth";

export function useServerReady() {
    const { data } = useFetchHealth();

    const payload = data?.data ?? null;

    return {
        ready: payload?.ready ?? false,
        startupStage: payload?.startupStage ?? "connecting",
    };
}
