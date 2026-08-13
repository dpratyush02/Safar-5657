import { useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import type { StationAnnouncementEvent } from "../hooks/use-journey-state";

const EASE = [0.22, 1, 0.36, 1] as const;

export function StationAnnouncement({
  announcement,
  onDismiss,
}: {
  announcement: StationAnnouncementEvent | null;
  onDismiss: () => void;
}) {
  useEffect(() => {
    if (!announcement) return;
    const timer = setTimeout(() => {
      onDismiss();
    }, 5500);
    return () => clearTimeout(timer);
  }, [announcement, onDismiss]);

  return (
    <AnimatePresence>
      {announcement && (
        <motion.div
          key={announcement.id}
          className="pointer-events-none fixed inset-0 z-40 flex items-center justify-center px-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.8, ease: EASE }}
        >
          <motion.div
            className="flex max-w-lg flex-col items-center text-center"
            initial={{ scale: 0.92, y: 15, filter: "blur(10px)" }}
            animate={{ scale: 1, y: 0, filter: "blur(0px)" }}
            exit={{ scale: 0.96, y: -10, filter: "blur(8px)" }}
            transition={{ duration: 0.9, ease: EASE }}
          >
            {/* Top divider line */}
            <div className="h-[1px] w-24 bg-gradient-to-r from-transparent via-ember/60 to-transparent sm:w-36" />

            <span className="label-sm mt-3 text-xs tracking-widest text-ember/90">
              {announcement.trainName ? `${announcement.trainName} · ` : ""}
              {announcement.kind === "arrived"
                ? "NOW ARRIVING AT"
                : announcement.kind === "approaching"
                  ? "APPROACHING"
                  : "NEXT STOP"}
            </span>

            <h2 className="display mt-2 text-3xl tracking-wide text-offwhite sm:text-5xl drop-shadow-[0_8px_24px_rgba(0,0,0,0.9)]">
              {announcement.stationName}
            </h2>

            {/* Bottom divider line */}
            <div className="mt-4 h-[1px] w-24 bg-gradient-to-r from-transparent via-ember/60 to-transparent sm:w-36" />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
