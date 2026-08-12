import { useQuery } from "@tanstack/react-query";
import { orpc } from "../lib/api";

/** Debounced search text is passed in; empty strings never hit the server. */
export function useMusicSearch(query: string) {
  const trimmed = query.trim();
  return useQuery(
    orpc.music.search.queryOptions({
      input: { query: trimmed },
      enabled: trimmed.length > 0,
      // Searches are quota-expensive upstream, so cached results are reused generously.
      staleTime: 10 * 60 * 1000,
      gcTime: 30 * 60 * 1000,
    }),
  );
}

/** Whether YouTube search is configured on the server. */
export function useMusicProvider() {
  return useQuery(orpc.music.provider.queryOptions({ staleTime: Infinity }));
}

/** Onboard royalty-free playlist — the fallback when YouTube isn't available. */
export function useOnboardTracks() {
  return useQuery(orpc.music.onboard.queryOptions({ staleTime: Infinity }));
}
