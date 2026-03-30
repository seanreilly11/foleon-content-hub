import { useQuery } from "@tanstack/react-query";
import { apiGet } from "../lib/api";
import { metaDataSchema } from "../schemas";
import { STABLE_STALE_TIME } from "../constants";

export function useFetchMeta() {
    return useQuery({
        queryKey: ["publications-meta"],
        queryFn: ({ signal }) =>
            apiGet("/api/publications/meta", undefined, metaDataSchema, {
                signal,
            }),
        staleTime: STABLE_STALE_TIME,
    });
}
