import { AnimatePresence, motion } from "motion/react";
import { TrainFront } from "lucide-react";

export type OverlayKind = "train" | "music" | null;

const EASE = [0.22, 1, 0.36, 1] as const;

const ITEMS: Array<{ key: Exclude<OverlayKind, null>; label: string }> = [
  { key: "train", label: "Train" },
  { key: "music", label: "Music" },
];

export function Navigation({
  active,
  onOpen,
  hidden,
  journeyMode,
  onToggleJourneyMode,
}: {
  active: OverlayKind;
  onOpen: (kind: Exclude<OverlayKind, null>) => void;
  hidden: boolean;
  journeyMode: boolean;
  onToggleJourneyMode: () => void;
}) {
  return (
    <AnimatePresence>
      {!hidden && (
        <motion.header
          className="pointer-events-none fixed inset-x-0 top-0 z-30 flex items-start justify-between p-5 sm:p-8"
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -16 }}
          transition={{ duration: 0.7, ease: EASE }}
        >
          <motion.div
            className="pointer-events-auto flex items-start gap-3"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.5, ease: EASE }}
          >
            <TrainFront className="mt-1 h-4 w-4 shrink-0 text-ember" strokeWidth={1.5} />
            <div>
              <h1 className="display text-2xl leading-none tracking-[0.16em] text-offwhite sm:text-3xl">
                SAFAR
              </h1>
              <div className="mt-2 hidden sm:block">
                <p className="label-sm text-cream/45">Your journey. Your music.</p>
              </div>
            </div>
          </motion.div>

          <motion.nav
            className="pointer-events-auto flex flex-col items-end gap-2 sm:gap-2.5"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.65, ease: EASE }}
          >
            <div className="flex items-center gap-5 sm:flex-col sm:items-end sm:gap-2.5">
              {ITEMS.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => onOpen(item.key)}
                  className={`label group relative py-1 transition-colors duration-300 ${
                    active === item.key ? "text-ember" : "text-cream/60 hover:text-offwhite"
                  }`}
                >
                  {item.label}
                  <span
                    className={`absolute -bottom-0.5 right-0 h-px bg-ember transition-all duration-500 ${
                      active === item.key ? "w-full" : "w-0 group-hover:w-full"
                    }`}
                  />
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={onToggleJourneyMode}
              className={`label-sm flex items-center gap-2 rounded-full border sm:mt-2 px-3 py-1.5 transition-colors duration-300 ${
                journeyMode
                  ? "border-ember/60 bg-ember/15 text-ember"
                  : "border-cream/15 text-cream/45 hover:border-cream/35 hover:text-cream/80"
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${journeyMode ? "bg-ember" : "bg-cream/30"}`}
              />
              Journey mode
            </button>
          </motion.nav>
        </motion.header>
      )}
    </AnimatePresence>
  );
}
