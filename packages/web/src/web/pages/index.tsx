import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Radio } from "lucide-react";
import { HeroScene } from "../components/hero-scene";
import { Navigation, type OverlayKind } from "../components/navigation";
import { MusicPlayer } from "../components/music-player";
import { TrainTracker } from "../components/train-tracker";
import { AboutOverlay } from "../components/about-overlay";
import { AmbientControl } from "../components/ambient-control";
import { BoardingScreen } from "../components/boarding-screen";
import { StationAnnouncement } from "../components/station-announcement";
import { usePlayer, type Track } from "../hooks/use-player";
import { useJourneyState } from "../hooks/use-journey-state";
import { useAmbientAudio } from "../hooks/use-ambient-audio";
import { journeyLine } from "../hooks/use-journey-announcements";
import { useMusicProvider, useOnboardTracks } from "../queries/music";

const EASE = [0.22, 1, 0.36, 1] as const;
const DEFAULT_TRAIN = "18402";

export default function Index() {
  const player = usePlayer();
  const [overlay, setOverlay] = useState<OverlayKind>(null);
  const [playerExpanded, setPlayerExpanded] = useState(false);
  const [journeyMode, setJourneyMode] = useState(false);
  const [trainNumber, setTrainNumber] = useState<string | null>(null);
  const [boardingComplete, setBoardingComplete] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  // Check prefers-reduced-motion
  useEffect(() => {
    if (typeof window === "undefined") return;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(media.matches);
    const onChange = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  // Centralized Journey State & Ambient Audio
  const journey = useJourneyState(trainNumber);
  const ambient = useAmbientAudio(journey.isMoving, journeyMode);

  const musicProvider = useMusicProvider();
  const onboard = useOnboardTracks();

  // Seed onboard tracks if no custom YouTube search key configured
  const seeded = useRef(false);
  useEffect(() => {
    if (seeded.current) return;
    if (musicProvider.data === undefined || onboard.data === undefined) return;
    if (musicProvider.data.live) {
      seeded.current = true;
      return;
    }
    seeded.current = true;
    player.setQueue(
      onboard.data.tracks.map(
        (t): Track => ({
          id: t.id,
          kind: "onboard",
          title: t.title,
          artist: t.artist,
          thumbnail: t.thumbnail,
          duration: t.duration,
          src: t.src,
        }),
      ),
    );
  }, [musicProvider.data, onboard.data, player]);

  const openOverlay = useCallback((kind: Exclude<OverlayKind, null>) => {
    if (kind === "music") {
      setPlayerExpanded(true);
      setOverlay(null);
      return;
    }
    setOverlay(kind);
  }, []);

  const closeOverlay = useCallback(() => setOverlay(null), []);

  const toggleJourneyMode = useCallback(() => {
    setJourneyMode((on) => {
      const next = !on;
      if (next) {
        setOverlay(null);
        setPlayerExpanded(false);
        setTrainNumber((current) => current ?? DEFAULT_TRAIN);
        if (!player.isPlaying && player.track) player.play();
      }
      return next;
    });
  }, [player]);

  // Keyboard controls: Space toggles playback, arrows seek, Esc closes overlays / leaves journey mode
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing =
        target !== null &&
        (["INPUT", "TEXTAREA"].includes(target.tagName) || target.isContentEditable);
      if (event.key === "Escape") {
        if (overlay) setOverlay(null);
        else if (playerExpanded) setPlayerExpanded(false);
        else if (journeyMode) setJourneyMode(false);
        return;
      }
      if (typing) return;
      if (event.code === "Space") {
        event.preventDefault();
        player.toggle();
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        player.seekBy(-5);
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        player.seekBy(5);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [player, overlay, playerExpanded, journeyMode]);

  const trackerOpen = overlay === "train";

  return (
    <main className="relative h-full w-full overflow-hidden">
      {!boardingComplete && (
        <BoardingScreen onComplete={() => setBoardingComplete(true)} />
      )}

      <HeroScene
        dimmed={overlay !== null}
        movementIntensity={journey.movementIntensity}
        isMoving={journey.isMoving}
        reducedMotion={reducedMotion}
      />

      <Navigation
        active={overlay}
        onOpen={openOverlay}
        hidden={journeyMode || trackerOpen}
        journeyMode={journeyMode}
        onToggleJourneyMode={toggleJourneyMode}
      />

      {/* Ambient Rail Sound Control Bar — Top Right */}
      {!journeyMode && !trackerOpen && (
        <div className="fixed right-5 top-20 z-30 sm:right-8 sm:top-8">
          <AmbientControl ambient={ambient} />
        </div>
      )}

      {/* Track my train button — top-left on mobile, bottom-left on desktop */}
      <AnimatePresence>
        {!journeyMode && overlay === null && (
          <motion.div
            className="fixed left-5 top-36 z-30 sm:bottom-11 sm:left-8 sm:top-auto"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 14 }}
            transition={{ duration: 0.8, delay: 0.9, ease: EASE }}
          >
            <button
              type="button"
              onClick={() => setOverlay("train")}
              className="label group flex items-center gap-2.5 rounded-full border border-cream/15 bg-ink/45 px-4 py-2.5 text-cream/70 backdrop-blur-md transition-all duration-300 hover:border-ember/50 hover:text-offwhite"
            >
              <Radio className="h-3.5 w-3.5 text-ember" strokeWidth={1.6} />
              Track my train
              {journey.status && (
                <span className="text-ember/80">
                  {Math.round(journey.interpolatedProgress)}%
                </span>
              )}
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Station Transition Cinematic Announcement */}
      <StationAnnouncement
        announcement={journey.announcement}
        onDismiss={journey.clearAnnouncement}
      />

      {/* Journey Mode: minimal screensaver status */}
      <AnimatePresence>
        {journeyMode && journey.status && (
          <motion.div
            className="fixed left-5 top-6 z-30 sm:left-8 sm:top-8"
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.8, ease: EASE }}
          >
            <p className="label-sm text-cream/30">
              {journey.status.trainNumber} · {journey.smoothedSpeed} km/h ·{" "}
              {journey.delayMinutes === 0 ? "on time" : `+${journey.delayMinutes} min`}
            </p>
            <p className="display mt-2 text-lg text-cream/70">{journey.currentStation}</p>
            <div className="mt-4 flex items-center gap-4">
              <button
                type="button"
                onClick={toggleJourneyMode}
                className="label-sm text-cream/30 transition-colors hover:text-ember"
              >
                Leave journey mode (Esc)
              </button>
              <AmbientControl ambient={ambient} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <MusicPlayer
        player={player}
        expanded={playerExpanded && !journeyMode}
        onExpandedChange={setPlayerExpanded}
        minimal={journeyMode}
        journeyLine={trainNumber ? journeyLine(journey.status) : null}
        searchAvailable={musicProvider.data?.live ?? false}
      />

      <TrainTracker
        open={trackerOpen}
        onClose={closeOverlay}
        trainNumber={trainNumber}
        onTrack={setTrainNumber}
      />

      <AboutOverlay open={overlay === "about"} onClose={closeOverlay} />
    </main>
  );
}
