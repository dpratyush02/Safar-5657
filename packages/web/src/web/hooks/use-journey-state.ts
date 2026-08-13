import { useEffect, useMemo, useRef, useState } from "react";
import { useTrainRoute, useTrainStatus } from "../queries/train";
import type { TrainRoute, TrainStatus } from "../../api/services/trainApi";

export type StationEventKind = "approaching" | "arrived" | "departed" | "next-stop";

export type StationAnnouncementEvent = {
  id: string;
  stationName: string;
  kind: StationEventKind;
  trainName?: string;
  timestamp: number;
};

export type JourneyState = {
  trainNumber: string | null;
  status: TrainStatus | null;
  route: TrainRoute | null;
  isLoading: boolean;
  isError: boolean;
  /** Exponentially smoothed speed (km/h) to prevent API readout jitter. */
  smoothedSpeed: number;
  /** Normalized visual movement intensity (0 to 1). */
  movementIntensity: number;
  /** Interpolated route progress percentage (0 to 100). */
  interpolatedProgress: number;
  /** True when train speed > 0. */
  isMoving: boolean;
  currentStation: string;
  previousStation: string;
  nextStation: string;
  delayMinutes: number;
  announcement: StationAnnouncementEvent | null;
  clearAnnouncement: () => void;
};

const LERP_FACTOR = 0.04;

export function useJourneyState(trainNumber: string | null): JourneyState {
  const statusQuery = useTrainStatus(trainNumber);
  const routeQuery = useTrainRoute(trainNumber);

  const status = statusQuery.data ?? null;
  const route = routeQuery.data ?? null;

  const [smoothedSpeed, setSmoothedSpeed] = useState(0);
  const [interpolatedProgress, setInterpolatedProgress] = useState(0);
  const [announcement, setAnnouncement] = useState<StationAnnouncementEvent | null>(null);

  const targetSpeedRef = useRef(0);
  const targetProgressRef = useRef(0);
  const animFrameRef = useRef<number>(0);
  const lastAnnouncedStationRef = useRef<string | null>(null);

  useEffect(() => {
    targetSpeedRef.current = status?.speed ?? 0;
    targetProgressRef.current = status?.progress ?? 0;
  }, [status?.speed, status?.progress]);

  // Smooth speed & progress LERP animation loop
  useEffect(() => {
    let active = true;

    const animate = () => {
      if (!active) return;

      setSmoothedSpeed((prev) => {
        const diff = targetSpeedRef.current - prev;
        if (Math.abs(diff) < 0.05) return targetSpeedRef.current;
        return prev + diff * LERP_FACTOR;
      });

      setInterpolatedProgress((prev) => {
        const diff = targetProgressRef.current - prev;
        if (Math.abs(diff) < 0.01) return targetProgressRef.current;
        return prev + diff * LERP_FACTOR;
      });

      animFrameRef.current = requestAnimationFrame(animate);
    };

    animFrameRef.current = requestAnimationFrame(animate);

    return () => {
      active = false;
      cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  // Station transition announcement trigger logic
  useEffect(() => {
    if (!status || !status.currentStation) return;

    const key = `${status.trainNumber}:${status.currentStation}`;
    if (lastAnnouncedStationRef.current === key) return;

    // First time initializing: store station without firing modal alert
    if (lastAnnouncedStationRef.current === null) {
      lastAnnouncedStationRef.current = key;
      return;
    }

    lastAnnouncedStationRef.current = key;

    const kind: StationEventKind =
      status.speed === 0 ? "arrived" : "next-stop";

    setAnnouncement({
      id: `${key}:${Date.now()}`,
      stationName: status.currentStation,
      kind,
      trainName: status.trainName,
      timestamp: Date.now(),
    });
  }, [status?.trainNumber, status?.currentStation, status?.speed, status?.trainName]);

  const clearAnnouncement = () => setAnnouncement(null);

  const movementIntensity = useMemo(() => {
    if (smoothedSpeed <= 0) return 0;
    if (smoothedSpeed <= 30) return 0.2 + (smoothedSpeed / 30) * 0.15;
    if (smoothedSpeed <= 60) return 0.35 + ((smoothedSpeed - 30) / 30) * 0.25;
    if (smoothedSpeed <= 100) return 0.6 + ((smoothedSpeed - 60) / 40) * 0.25;
    return Math.min(1.0, 0.85 + ((smoothedSpeed - 100) / 50) * 0.15);
  }, [smoothedSpeed]);

  return {
    trainNumber,
    status,
    route,
    isLoading: statusQuery.isLoading || routeQuery.isLoading,
    isError: statusQuery.isError || routeQuery.isError,
    smoothedSpeed: Math.round(smoothedSpeed),
    movementIntensity,
    interpolatedProgress,
    isMoving: smoothedSpeed > 0,
    currentStation: status?.currentStation ?? "En Route",
    previousStation: status?.previousStation ?? "Origin",
    nextStation: status?.nextStation ?? "Destination",
    delayMinutes: status?.delayMinutes ?? 0,
    announcement,
    clearAnnouncement,
  };
}
