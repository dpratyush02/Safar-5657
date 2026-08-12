import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, Search, X } from "lucide-react";
import { useTrainRoute, useTrainStatus } from "../queries/train";
import { TrainRoute } from "./train-route";

const EASE = [0.22, 1, 0.36, 1] as const;
const SUGGESTIONS = ["18402", "12841", "12951", "12626"];

/** Full-screen live train experience: number entry, live status readout and the route map. */
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
  // The badge follows the data we actually got back, not just what is configured — a provider
  // outage falls back to demo journeys and says so.
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
            className="glass-deep min-h-full w-full px-5 pb-40 pt-6 sm:px-10 sm:pb-44 sm:pt-10"
            initial={{ y: 28, filter: "blur(10px)" }}
            animate={{ y: 0, filter: "blur(0px)" }}
            exit={{ y: 28, filter: "blur(10px)" }}
            transition={{ duration: 0.6, ease: EASE }}
          >
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
                    className="display min-w-0 flex-1 bg-transparent text-2xl text-offwhite tracking-[0.14em] outline-none placeholder:text-cream/20 sm:text-3xl"
                  />
                  <button
                    type="submit"
                    disabled={status.isFetching && status.isLoading}
                    className="label flex items-center gap-2 rounded-full border border-ember/50 bg-ember/15 px-4 py-2 text-ember transition-colors hover:bg-ember/25 disabled:opacity-50"
                  >
                    {status.isLoading && trainNumber ? "Locating" : "Track"}
                    <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.8} />
                  </button>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {error ? (
                    <span className="label-sm text-rust">{error}</span>
                  ) : (
                    <>
                      <span className="label-sm text-cream/25">Try</span>
                      {SUGGESTIONS.map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => submit(s)}
                          className="label-sm rounded-full border border-cream/12 px-2.5 py-1 text-cream/45 transition-colors hover:border-ember/40 hover:text-ember"
                        >
                          {s}
                        </button>
                      ))}
                    </>
                  )}
                </div>
              </form>

              <div className="hairline my-9 h-px" />

              {/* Status */}
              {!trainNumber && (
                <p className="max-w-md text-sm leading-relaxed text-cream/40">
                  Enter a train number to follow the journey — current station, speed, delay and
                  the road ahead, updating live while your music keeps playing.
                </p>
              )}

              {trainNumber && status.isLoading && <StatusSkeleton />}

              {trainNumber && status.data && (
                <div className="grid gap-12 lg:grid-cols-[1.05fr_0.95fr]">
                  <div>
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="display text-4xl text-offwhite sm:text-5xl">
                        {status.data.trainNumber}
                      </span>
                      <span
                        className={`label-sm flex items-center gap-2 rounded-full border px-2.5 py-1 ${
                          isLive
                            ? "border-live/40 text-live"
                            : "border-cream/15 text-cream/40"
                        }`}
                      >
                        <motion.span
                          className={`h-1.5 w-1.5 rounded-full ${isLive ? "bg-live" : "bg-cream/40"}`}
                          animate={{ opacity: [1, 0.25, 1] }}
                          transition={{ duration: 2, repeat: Infinity }}
                        />
                        {isLive ? "Live" : "Demo data"}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-cream/55">{status.data.trainName}</p>
                    {status.data.notice && (
                      <p className="label-sm mt-3 text-cream/35">{status.data.notice}</p>
                    )}

                    <p className="display mt-6 text-xl text-cream/85 sm:text-2xl">
                      {status.data.from}
                      <span className="mx-3 text-ember">→</span>
                      {status.data.to}
                    </p>

                    <dl className="mt-8 grid grid-cols-2 gap-x-8 gap-y-7 sm:grid-cols-3">
                      <Field label="Current station" value={status.data.currentStation} accent />
                      <Field label="Next station" value={status.data.nextStation} />
                      <Field label="Current speed" value={`${status.data.speed} km/h`} />
                      <Field
                        label="Delay"
                        value={
                          status.data.delayMinutes === 0
                            ? "On time"
                            : `+${String(status.data.delayMinutes).padStart(2, "0")} min`
                        }
                      />
                      <Field label="Expected arrival" value={status.data.expectedArrival} />
                      <Field
                        label="Distance covered"
                        value={`${status.data.distanceCovered} / ${status.data.totalKm} km`}
                      />
                    </dl>

                    <div className="mt-9">
                      <div className="flex items-baseline justify-between">
                        <span className="label-sm text-cream/35">Journey progress</span>
                        <span className="display text-lg text-ember tabular-nums">
                          {Math.round(status.data.progress)}%
                        </span>
                      </div>
                      <div className="mt-3 h-[3px] w-full overflow-hidden rounded-full bg-cream/12">
                        <motion.div
                          className="h-full rounded-full bg-gradient-to-r from-rust to-ember"
                          animate={{ width: `${status.data.progress}%` }}
                          transition={{ duration: 1, ease: EASE }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="lg:border-l lg:border-cream/10 lg:pl-12">
                    <p className="label-sm mb-7 text-cream/35">Route</p>
                    {route.isLoading && <RouteSkeleton />}
                    {route.data && <TrainRoute route={route.data} />}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </motion.section>
      )}
    </AnimatePresence>
  );
}

function Field({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div>
      <dt className="label-sm text-cream/30">{label}</dt>
      <dd
        className={`display mt-2 text-lg leading-snug ${accent ? "text-ember" : "text-offwhite"}`}
      >
        {value}
      </dd>
    </div>
  );
}

function StatusSkeleton() {
  return (
    <div className="grid gap-12 lg:grid-cols-2">
      <div className="space-y-4">
        <div className="h-10 w-40 animate-pulse rounded bg-cream/8" />
        <div className="h-4 w-60 animate-pulse rounded bg-cream/6" />
        <div className="mt-8 grid grid-cols-2 gap-6 sm:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="h-2.5 w-16 animate-pulse rounded bg-cream/6" />
              <div className="h-5 w-24 animate-pulse rounded bg-cream/8" />
            </div>
          ))}
        </div>
      </div>
      <RouteSkeleton />
    </div>
  );
}

function RouteSkeleton() {
  return (
    <div className="space-y-6">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4">
          <div className="h-2.5 w-2.5 animate-pulse rounded-full bg-cream/10" />
          <div className="h-4 w-40 animate-pulse rounded bg-cream/6" />
        </div>
      ))}
    </div>
  );
}
