import { AnimatePresence, motion } from "motion/react";
import type { Announcement } from "../hooks/use-journey-announcements";

const EASE = [0.22, 1, 0.36, 1] as const;

/** Station announcements that drift through the middle of the frame during Journey Mode. */
export function JourneyAnnouncer({ announcement }: { announcement: Announcement | null }) {
  return (
    <div className="pointer-events-none fixed inset-x-0 top-1/2 z-30 flex -translate-y-1/2 justify-center px-6">
      <AnimatePresence mode="wait">
        {announcement && (
          <motion.div
            key={announcement.id}
            className="text-center"
            initial={{ opacity: 0, y: 18, filter: "blur(12px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -18, filter: "blur(12px)" }}
            transition={{ duration: 0.9, ease: EASE }}
          >
            <p className="label-sm text-ember/70">
              {announcement.kind === "passing" ? "Journey" : "Ahead"}
            </p>
            <p className="display mt-3 text-3xl leading-tight text-offwhite drop-shadow-[0_2px_24px_rgba(0,0,0,0.9)] sm:text-5xl">
              {announcement.text}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
