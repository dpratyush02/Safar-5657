import { AnimatePresence, motion } from "motion/react";
import { X } from "lucide-react";

const EASE = [0.22, 1, 0.36, 1] as const;

export function AboutOverlay({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-40 flex items-center justify-center px-5"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4 }}
        >
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="absolute inset-0 cursor-default bg-ink/55 backdrop-blur-[3px]"
          />
          <motion.div
            className="glass-deep relative w-full max-w-lg rounded-2xl p-8 sm:p-10"
            initial={{ opacity: 0, y: 22, filter: "blur(10px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: 22, filter: "blur(10px)" }}
            transition={{ duration: 0.6, ease: EASE }}
          >
            <button
              type="button"
              onClick={onClose}
              aria-label="Close about"
              className="absolute right-5 top-5 text-cream/45 transition-colors hover:text-offwhite"
            >
              <X className="h-4 w-4" strokeWidth={1.6} />
            </button>

            <p className="label-sm text-cream/35">About</p>
            <h2 className="display mt-3 text-3xl leading-tight text-offwhite">
              SAFAR is a digital train journey where music meets the railway.
            </h2>
            <p className="mt-5 text-[13.5px] leading-relaxed text-cream/50">
              One coach, one aisle, one song at a time. Put on a track, enter a train number, and
              watch the journey move — stations passing, speed drifting, the delay you have already
              made peace with.
            </p>
            <div className="hairline my-7 h-px" />
            <p className="label-sm leading-relaxed text-cream/30">
              Music here is original and royalty-free. Train data runs on demo journeys until a
              live railway provider is connected.
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
