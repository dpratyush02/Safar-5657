import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";

const EASE = [0.22, 1, 0.36, 1] as const;
const STORAGE_KEY = "safar_boarded_session";

export function BoardingScreen({ onComplete }: { onComplete: () => void }) {
  const [stage, setStage] = useState<"boarding" | "title" | "ready" | "done">(() => {
    try {
      if (typeof window !== "undefined" && window.sessionStorage.getItem(STORAGE_KEY)) {
        return "done";
      }
    } catch {
      /* ignore */
    }
    return "boarding";
  });

  useEffect(() => {
    if (stage === "done") {
      onComplete();
      return;
    }

    const t1 = setTimeout(() => setStage("title"), 700);
    const t2 = setTimeout(() => setStage("ready"), 1600);
    const t3 = setTimeout(() => {
      try {
        window.sessionStorage.setItem(STORAGE_KEY, "true");
      } catch {
        /* ignore */
      }
      setStage("done");
      onComplete();
    }, 2400);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [stage, onComplete]);

  return (
    <AnimatePresence>
      {stage !== "done" && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink text-offwhite"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.05 }}
          transition={{ duration: 0.9, ease: EASE }}
        >
          <div className="flex flex-col items-center text-center">
            {stage === "boarding" && (
              <motion.div
                key="boarding"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.5, ease: EASE }}
              >
                <p className="label-sm text-xs tracking-widest text-ember/80">BOARDING...</p>
                <div className="mt-3 h-[2px] w-24 overflow-hidden bg-cream/10">
                  <motion.div
                    className="h-full bg-ember"
                    initial={{ x: "-100%" }}
                    animate={{ x: "100%" }}
                    transition={{ repeat: Infinity, duration: 1.2, ease: "easeInOut" }}
                  />
                </div>
              </motion.div>
            )}

            {stage === "title" && (
              <motion.div
                key="title"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.05 }}
                transition={{ duration: 0.6, ease: EASE }}
              >
                <h1 className="display text-4xl tracking-wider text-offwhite sm:text-6xl">
                  SAFAR
                </h1>
                <p className="mt-2 text-xs italic text-cream/50">Journey by Train & Music</p>
              </motion.div>
            )}

            {stage === "ready" && (
              <motion.div
                key="ready"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.5, ease: EASE }}
              >
                <p className="label-sm text-sm tracking-widest text-ember">TRAIN READY</p>
              </motion.div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
