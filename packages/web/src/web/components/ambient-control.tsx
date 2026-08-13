import { useState } from "react";
import { Volume2, VolumeX, Waves } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import type { AmbientAudioControls } from "../hooks/use-ambient-audio";

const EASE = [0.22, 1, 0.36, 1] as const;

export function AmbientControl({ ambient }: { ambient: AmbientAudioControls }) {
  const [showSlider, setShowSlider] = useState(false);

  return (
    <div className="relative">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={ambient.toggleAmbience}
          onMouseEnter={() => setShowSlider(true)}
          className={`label-sm flex items-center gap-2 rounded-full border px-3.5 py-1.5 backdrop-blur-md transition-all duration-300 ${
            ambient.enabled
              ? "border-ember/60 bg-ink/75 text-ember shadow-[0_0_15px_rgba(235,94,40,0.25)]"
              : "border-cream/15 bg-ink/40 text-cream/50 hover:border-cream/30 hover:text-cream/80"
          }`}
        >
          <Waves
            className={`h-3.5 w-3.5 transition-transform duration-500 ${
              ambient.enabled ? "animate-pulse text-ember" : "text-cream/40"
            }`}
          />
          <span>AMBIENCE</span>
          <span
            className={`text-[10px] font-semibold tracking-wider ${
              ambient.enabled ? "text-ember" : "text-cream/35"
            }`}
          >
            {ambient.enabled ? "ON" : "OFF"}
          </span>
        </button>

        {ambient.enabled && (
          <button
            type="button"
            onClick={() => setShowSlider((prev) => !prev)}
            className="rounded-full border border-cream/15 bg-ink/40 p-1.5 text-cream/60 transition-colors hover:border-ember/40 hover:text-ember"
            aria-label="Adjust ambience volume"
          >
            {ambient.volume === 0 ? (
              <VolumeX className="h-3.5 w-3.5" />
            ) : (
              <Volume2 className="h-3.5 w-3.5" />
            )}
          </button>
        )}
      </div>

      <AnimatePresence>
        {showSlider && ambient.enabled && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.95 }}
            transition={{ duration: 0.25, ease: EASE }}
            onMouseLeave={() => setShowSlider(false)}
            className="glass absolute left-0 top-full z-40 mt-2 flex w-44 flex-col gap-1.5 rounded-xl p-3 shadow-xl"
          >
            <div className="flex items-center justify-between text-[11px] text-cream/60">
              <span>Rail Sound Volume</span>
              <span className="font-mono text-ember">
                {Math.round(ambient.volume * 100)}%
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={ambient.volume}
              onChange={(e) => ambient.setVolume(parseFloat(e.target.value))}
              className="h-1 w-full cursor-pointer appearance-none rounded-lg bg-cream/20 accent-ember"
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
