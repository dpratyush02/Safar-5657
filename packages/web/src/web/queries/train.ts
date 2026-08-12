import { useQuery } from "@tanstack/react-query";
import { orpc } from "../lib/api";

/**
 * The UI polls our own server every few seconds so the journey visibly moves. This is NOT the
 * provider refresh rate: the server caches each train's live snapshot for TRAIN_STATUS_REFRESH_MS
 * (~120s by default) and advances the position by dead reckoning in between, so a 5s UI tick never
 * means 12 RailRadar calls a minute.
 */
const UI_POLL_MS = 5000;

export function useTrainStatus(trainNumber: string | null) {
  return useQuery(
    orpc.train.status.queryOptions({
      input: { trainNumber: trainNumber ?? "" },
      enabled: Boolean(trainNumber),
      refetchInterval: UI_POLL_MS,
      staleTime: 0,
    }),
  );
}

/** The station list only changes when the train actually moves on, so this can tick slower. */
export function useTrainRoute(trainNumber: string | null) {
  return useQuery(
    orpc.train.route.queryOptions({
      input: { trainNumber: trainNumber ?? "" },
      enabled: Boolean(trainNumber),
      refetchInterval: UI_POLL_MS * 3,
      staleTime: 0,
    }),
  );
}

/** Whether a live provider is configured, plus the server-side refresh interval. */
export function useTrainProvider() {
  return useQuery(orpc.train.provider.queryOptions({ staleTime: Infinity }));
}
