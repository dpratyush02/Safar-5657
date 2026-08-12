import { useEffect, useRef, useState } from "react";
import type { RouterOutputs } from "../lib/api-types";

type Status = RouterOutputs["train"]["status"];

export type Announcement = { id: number; text: string; kind: "passing" | "next" };

/**
 * Turns station changes into cinematic announcements:
 * "Now passing Balasore" → a few seconds later → "Next stop: Kharagpur".
 */
export function useJourneyAnnouncements(status: Status | undefined, enabled: boolean) {
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);
  const lastStation = useRef<string | null>(null);
  const wasEnabled = useRef(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    const clear = () => {
      timers.current.forEach(clearTimeout);
      timers.current = [];
    };

    if (!status || !enabled) {
      clear();
      setAnnouncement(null);
      lastStation.current = null;
      wasEnabled.current = enabled;
      return;
    }

    // Entering the mode always announces where you are right now.
    if (!wasEnabled.current) lastStation.current = null;
    wasEnabled.current = true;

    if (lastStation.current === status.currentStation) return;

    const isFirst = lastStation.current === null;
    lastStation.current = status.currentStation;
    clear();

    const id = Date.now();
    setAnnouncement({
      id,
      text: isFirst ? `Now at ${status.currentStation}` : `Now passing ${status.currentStation}`,
      kind: "passing",
    });

    timers.current.push(
      setTimeout(
        () => setAnnouncement({ id: id + 1, text: `Next stop: ${status.nextStation}`, kind: "next" }),
        4200,
      ),
      setTimeout(() => setAnnouncement(null), 9000),
    );

    return clear;
  }, [status, enabled]);

  useEffect(() => {
    return () => timers.current.forEach(clearTimeout);
  }, []);

  return announcement;
}

/** The line shown beside the player, e.g. "Somewhere between Balasore and Kharagpur". */
export function journeyLine(status: Status | undefined): string | null {
  if (!status) return null;
  if (status.currentStation === status.nextStation) return `Arriving at ${status.to}`;
  return `Somewhere between ${status.currentStation} and ${status.nextStation}`;
}
