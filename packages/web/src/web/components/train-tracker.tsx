import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, Search, X } from "lucide-react";
import { useTrainRoute, useTrainStatus } from "../queries/train";
import { TrainRoute } from "./train-route";

const EASE = [0.22, 1, 0.36, 1] as const;
const SUGGESTIONS = ["18402", "12841", "12951", "12626"];

/** Full-screen & Mobile Draggable Bottom Sheet for live train tracking. */
export function TrainTracker({
  open,
  onClose,
  trainNumber,
  onTrack,
}: {
  open: boolean;
  onClose: () => void;
  trainNumber: string | null;
  onTrack: (value: string) => void;
}) {
  const [input, setInput] = useState(trainNumber ?? "");
  const [error, setError] = useState<string | null>(null);

  const status = useTrainStatus(open ? trainNumber : null);
  const route = useTrainRoute(open ? trainNumber : null);
  const isLive = status.data?.source === "live";

  const submit = (value: string) => {
    const clean = value.trim();
    if (!/^\d{4,6}$/.test(clean)) {
      setError("Train numbers are 4–6 digits, like 18402");
      return;
    }
    setError(null);
    setInput(clean);
    onTrack(clean);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.section
          className="fixed inset-0 z-40 overflow-y-auto safar-scroll"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4 }}
        >
          <motion.div
            className="glass-deep min-h-full w-full rounded-t-3xl px-5 pb-40 pt-4 touch-pan-y sm:rounded-none sm:px-10 sm:pb-44 sm:pt-10"
            initial={{ y: "100%", filter: "blur(10px)" }}
            animate={{ y: 0, filter: "blur(0px)" }}
            exit={{ y: "100%", filter: "blur(10px)" }}
            transition={{ duration: 0.55, ease: EASE }}
          >
            {/* Mobile Drag Handle Indicator */}
            <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-cream/20 sm:hidden" />

            <div className="mx-auto max-w-5xl">
              <header className="flex items-start justify-between gap-6">
                <div>
                  <p className="label-sm text-cream/35">Live journey</p>
                  <h2 className="display mt-2 text-3xl text-offwhite sm:text-4xl">
                    Track my train
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close train tracker"
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-cream/15 text-cream/60 transition-colors hover:border-ember/50 hover:text-offwhite"
                >
                  <X className="h-4 w-4" strokeWidth={1.6} />
                </button>
              </header>

              {/* Number entry */}
              <form
                className="mt-8"
                onSubmit={(e) => {
                  e.preventDefault();
                  submit(input);
                }}
              >
                <label className="label-sm block text-cream/35" htmlFor="train-number">
                  Train number
                </label>
                <div className="mt-3 flex items-center gap-3 border-b border-cream/15 pb-3 focus-within:border-ember/60">
                  <Search className="h-4 w-4 shrink-0 text-cream/30" strokeWidth={1.6} />
                  <input
                    id="train-number"
                    value={input}
                    onChange={(e) => setInput(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    inputMode="numeric"
                    placeholder="18402"
                    autoComplete="off"
                    className="display min-w-0 flex-1 bg-transparent text-2xl tracking-[0.14em] text-offwhite outline-none placeholder:text-cream/20 sm:text-3xl"
                  />
                  <button
                    type="submit"
                    className="label group flex items-center gap-2 rounded-full border border-ember/40 bg-ember/15 px-4 py-2 text-ember transition-colors hover:bg-ember hover:text-ink"
                  >
                    Track
                    <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                  </button>
                </div>
                {error && <p className="mt-2 text-xs text-rust">{error}</p>}

                {/* Suggestions */}
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <span className="label-sm mr-1 text-cream/30">Try:</span>
                  {SUGGESTIONS.map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => submit(num)}
                      className="label-sm rounded-full border border-cream/10 bg-ink/40 px-3 py-1 text-cream/60 transition-colors hover:border-cream/30 hover:text-offwhite"
                    >
                      {num}
                    </button>
                  ))}
                </div>
              </form>

              {/* Status & Route Readout */}
              {status.isLoading && (
                <div className="mt-16 text-center">
                  <p className="label-sm text-ember/70 animate-pulse">Locating train...</p>
                </div>
              )}

              {status.data && (
                <div className="mt-12 space-y-12">
                  {/* Primary train status overview */}
                  <div className="grid gap-6 rounded-2xl border border-cream/10 bg-ink/40 p-6 sm:grid-cols-3">
                    <div>
                      <span className="label-sm text-cream/35">Train Name</span>
                      <p className="display mt-1 text-xl text-offwhite">{status.data.trainName}</p>
                      <p className="mt-1 text-xs text-cream/40">{status.data.trainNumber}</p>
                    </div>
                    <div>
                      <span className="label-sm text-cream/35">Current Speed</span>
                      <p className="display mt-1 text-xl text-ember">{status.data.speed} km/h</p>
                      <p className="mt-1 text-xs text-cream/40">
                        {status.data.speed === 0 ? "Stationary at platform" : "In motion"}
                      </p>
                    </div>
                    <div>
                      <span className="label-sm text-cream/35">Schedule Status</span>
                      <p
                        className={`display mt-1 text-xl ${
                          status.data.delayMinutes === 0 ? "text-emerald-400" : "text-amber-400"
                        }`}
                      >
                        {status.data.delayMinutes === 0
                          ? "On Time"
                          : `+${status.data.delayMinutes} min delay`}
                      </p>
                      <p className="mt-1 text-xs text-cream/40">
                        {isLive ? "Live GPS signal" : "Demo timetable simulation"}
                      </p>
                    </div>
                  </div>

                  {/* Route map */}
                  {route.data && (
                    <div>
                      <h3 className="label-sm mb-6 text-cream/35">Route & Stations</h3>
                      <TrainRoute route={route.data} />
                    </div>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        </motion.section>
      )}
    </AnimatePresence>
  );
}
