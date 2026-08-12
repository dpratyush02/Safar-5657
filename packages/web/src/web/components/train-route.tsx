import { motion } from "motion/react";
import type { RouterOutputs } from "../lib/api-types";

type Route = RouterOutputs["train"]["route"];

const EASE = [0.22, 1, 0.36, 1] as const;

/**
 * Stylized railway route — deliberately not a map. A single warm rail, filled up to where the
 * train is, with a pulsing "you are here" marker. Ready to take real coordinates later.
 */
export function TrainRoute({ route }: { route: Route }) {
  const { stations, currentIndex, totalKm } = route;
  const rowCount = stations.length;
  // Fill fraction across the whole rail, based on distance rather than stop count.
  const covered = (route.progress / 100) * totalKm;
  const railFill = (() => {
    if (rowCount < 2) return 0;
    let segment = currentIndex;
    const from = stations[currentIndex]!.km;
    const to = stations[Math.min(currentIndex + 1, rowCount - 1)]!.km;
    const within = to > from ? (covered - from) / (to - from) : 0;
    segment += Math.min(Math.max(within, 0), 1);
    return (segment / (rowCount - 1)) * 100;
  })();

  return (
    <div className="relative">
      {/* Rail */}
      <div className="absolute bottom-3 left-[7px] top-3 w-px bg-cream/15" />
      <motion.div
        className="absolute left-[7px] top-3 w-px origin-top bg-gradient-to-b from-ember/70 to-ember"
        initial={{ height: 0 }}
        animate={{ height: `calc(${railFill}% - 0px)` }}
        transition={{ duration: 1.1, ease: EASE }}
        style={{ maxHeight: "calc(100% - 24px)" }}
      />

      <ol className="space-y-6">
        {stations.map((station, i) => {
          const isCurrent = station.status === "current";
          const isPassed = station.status === "passed";
          return (
            <motion.li
              key={`${station.code}-${i}`}
              className="relative flex items-start gap-4 pl-0"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.05 * i, ease: EASE }}
            >
              <span className="relative mt-1.5 flex h-3.5 w-3.5 shrink-0 items-center justify-center">
                {isCurrent && (
                  <span className="pulse-ring absolute h-3 w-3 rounded-full bg-ember/45" />
                )}
                <span
                  className={`relative rounded-full transition-all duration-500 ${
                    isCurrent
                      ? "h-3 w-3 bg-ember shadow-[0_0_12px_rgba(217,138,75,0.8)]"
                      : isPassed
                        ? "h-2 w-2 bg-ember/55"
                        : "h-2 w-2 border border-cream/35 bg-ink/60"
                  }`}
                />
              </span>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span
                    className={`truncate ${
                      isCurrent
                        ? "display text-lg text-offwhite sm:text-xl"
                        : isPassed
                          ? "text-sm text-cream/45"
                          : "text-sm text-cream/75"
                    }`}
                  >
                    {station.name}
                  </span>
                  {isCurrent && (
                    <motion.span
                      className="label-sm text-ember"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: [0.35, 1, 0.35] }}
                      transition={{ duration: 2.8, repeat: Infinity }}
                    >
                      ← you are here
                    </motion.span>
                  )}
                </div>
                <div className="label-sm mt-1 flex items-center gap-3 text-cream/30">
                  <span>{station.code}</span>
                  <span>{station.scheduled}</span>
                  <span>{station.km} km</span>
                </div>
              </div>
            </motion.li>
          );
        })}
      </ol>
    </div>
  );
}
