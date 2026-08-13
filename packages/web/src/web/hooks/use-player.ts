import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/**
 * SAFAR's music transport.
 *
 * Two playback engines behind one controller:
 *  - `youtube` tracks play through the official YouTube IFrame Player API (the iframe itself is
 *    kept visually hidden — SAFAR draws all the controls). We never download or extract audio.
 *  - `onboard` tracks are the royalty-free instrumentals in `public/audio/`, played with a plain
 *    `<audio>` element. They are the fallback when YouTube search isn't available.
 */

export type Track = {
  /** YouTube video id, or the onboard track id. */
  id: string;
  kind: "youtube" | "onboard";
  title: string;
  artist: string;
  thumbnail: string;
  /** Seconds; 0 when unknown until playback reports it. */
  duration: number;
  /** Onboard tracks only — absolute path under `public/`. */
  src?: string;
};

export type PlayerController = {
  queue: Track[];
  index: number;
  track: Track | null;
  isPlaying: boolean;
  isLoading: boolean;
  /** User-safe message, never a raw API error. */
  error: string | null;
  currentTime: number;
  duration: number;
  volume: number;
  muted: boolean;
  /** Play a track now: jumps to it if already queued, otherwise inserts it after the current one. */
  playNow: (track: Track) => void;
  /** Append to the queue without interrupting playback. Returns false when already queued. */
  enqueue: (track: Track) => boolean;
  /** Replace the whole queue (used to seed the onboard playlist). */
  setQueue: (tracks: Track[], startIndex?: number) => void;
  removeAt: (index: number) => void;
  move: (index: number, direction: -1 | 1) => void;
  selectIndex: (index: number) => void;
  toggle: () => void;
  play: () => void;
  pause: () => void;
  next: () => void;
  previous: () => void;
  seek: (seconds: number) => void;
  seekBy: (delta: number) => void;
  setVolume: (value: number) => void;
  toggleMute: () => void;
};

/* ---------------------------------- YouTube IFrame API ---------------------------------- */

type YTPlayer = {
  loadVideoById: (id: string) => void;
  cueVideoById: (id: string) => void;
  playVideo: () => void;
  pauseVideo: () => void;
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
  setVolume: (value: number) => void;
  mute: () => void;
  unMute: () => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  destroy: () => void;
};

type YTNamespace = {
  Player: new (
    element: HTMLElement,
    options: {
      host?: string;
      videoId?: string;
      playerVars?: Record<string, number | string>;
      events?: {
        onReady?: () => void;
        onStateChange?: (event: { data: number }) => void;
        onError?: (event: { data: number }) => void;
      };
    },
  ) => YTPlayer;
  PlayerState: { ENDED: number; PLAYING: number; PAUSED: number; BUFFERING: number };
};

declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

const IFRAME_API_SRC = "https://www.youtube.com/iframe_api";
let apiPromise: Promise<YTNamespace> | null = null;

/** Loads the IFrame API once per session. */
function loadYoutubeApi(): Promise<YTNamespace> {
  if (apiPromise) return apiPromise;
  apiPromise = new Promise<YTNamespace>((resolve, reject) => {
    if (window.YT?.Player) {
      resolve(window.YT);
      return;
    }
    const timeout = window.setTimeout(() => {
      apiPromise = null;
      reject(new Error("timeout"));
    }, 15_000);
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      window.clearTimeout(timeout);
      if (window.YT?.Player) resolve(window.YT);
      else {
        apiPromise = null;
        reject(new Error("unavailable"));
      }
    };
    if (!document.querySelector(`script[src="${IFRAME_API_SRC}"]`)) {
      const script = document.createElement("script");
      script.src = IFRAME_API_SRC;
      script.async = true;
      script.onerror = () => {
        window.clearTimeout(timeout);
        apiPromise = null;
        reject(new Error("blocked"));
      };
      document.head.appendChild(script);
    }
  }).catch((err) => {
    apiPromise = null;
    throw err;
  });
  return apiPromise;
}

/** YouTube error codes → one calm SAFAR line. */
function youtubeErrorMessage(code: number): string {
  if (code === 101 || code === 150) return "This track can't be played here — try another.";
  if (code === 100) return "This track is no longer available.";
  return "This track can't be played right now.";
}

/* ------------------------------------- controller -------------------------------------- */

export function usePlayer(): PlayerController {
  const [queue, setQueueState] = useState<Track[]>([]);
  const [index, setIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(0.75);
  const [muted, setMuted] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const ytRef = useRef<YTPlayer | null>(null);
  const ytReadyRef = useRef(false);
  /** Video queued before the player finished booting. */
  const pendingVideoRef = useRef<string | null>(null);
  const wantPlayRef = useRef(false);
  const hostRef = useRef<HTMLDivElement | null>(null);

  const track = queue[index] ?? null;
  const trackRef = useRef<Track | null>(null);
  trackRef.current = track;

  /* ------------------------------ queue advance / loading ------------------------------ */

  const advanceRef = useRef<() => void>(() => {});
  const advance = useCallback(() => advanceRef.current(), []);

  useEffect(() => {
    advanceRef.current = () => {
      setIndex((i) => {
        if (i + 1 < queue.length) {
          wantPlayRef.current = true;
          return i + 1;
        }
        // Nothing left in the queue: stay put, paused.
        wantPlayRef.current = false;
        setIsPlaying(false);
        return i;
      });
    };
  }, [queue.length]);

  /* ------------------------------- onboard <audio> engine ------------------------------ */

  useEffect(() => {
    if (typeof Audio === "undefined") return;
    const audio = new Audio();
    audio.preload = "metadata";
    audio.volume = 0.75;
    audioRef.current = audio;

    const onTime = () => {
      if (trackRef.current?.kind === "onboard") setCurrentTime(audio.currentTime);
    };
    const onMeta = () => {
      if (trackRef.current?.kind === "onboard") {
        setDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
      }
    };
    const onPlay = () => {
      if (trackRef.current?.kind === "onboard") {
        setIsPlaying(true);
        setIsLoading(false);
      }
    };
    const onPause = () => {
      if (trackRef.current?.kind === "onboard") setIsPlaying(false);
    };
    const onEnded = () => {
      if (trackRef.current?.kind === "onboard") advance();
    };
    const onError = () => {
      if (trackRef.current?.kind === "onboard") {
        setIsLoading(false);
        setIsPlaying(false);
        setError("This track can't be played right now.");
      }
    };

    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("loadedmetadata", onMeta);
    audio.addEventListener("durationchange", onMeta);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("error", onError);

    return () => {
      audio.pause();
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("loadedmetadata", onMeta);
      audio.removeEventListener("durationchange", onMeta);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("error", onError);
      audioRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* -------------------------------- YouTube engine boot -------------------------------- */

  useEffect(() => {
    let cancelled = false;
    const host = document.createElement("div");
    // Hidden, but still laid out — YouTube refuses to play inside `display: none`.
    host.setAttribute("aria-hidden", "true");
    host.style.cssText =
      "position:fixed;left:-9999px;bottom:0;width:320px;height:180px;opacity:0;pointer-events:none;";
    document.body.appendChild(host);
    hostRef.current = host;

    void loadYoutubeApi()
      .then((YT) => {
        if (cancelled) return;
        const mount = document.createElement("div");
        host.appendChild(mount);
        const player = new YT.Player(mount, {
          playerVars: {
            controls: 0,
            disablekb: 1,
            modestbranding: 1,
            playsinline: 1,
            rel: 0,
            origin: window.location.origin,
          },
          events: {
            onReady: () => {
              ytReadyRef.current = true;
              player.setVolume(Math.round(volumeRef.current * 100));
              const pending = pendingVideoRef.current;
              if (pending) {
                pendingVideoRef.current = null;
                player.loadVideoById(pending);
                if (wantPlayRef.current) player.playVideo();
              }
            },
            onStateChange: (event) => {
              const state = event.data;
              if (state === YT.PlayerState.PLAYING) {
                setIsPlaying(true);
                setIsLoading(false);
                setError(null);
                setDuration(player.getDuration() || 0);
              } else if (state === YT.PlayerState.PAUSED) {
                setIsPlaying(false);
                setIsLoading(false);
              } else if (state === YT.PlayerState.BUFFERING) {
                setIsLoading(true);
              } else if (state === YT.PlayerState.ENDED) {
                setIsPlaying(false);
                advance();
              }
            },
            onError: (event) => {
              setIsLoading(false);
              setIsPlaying(false);
              setError(youtubeErrorMessage(event.data));
            },
          },
        });
        ytRef.current = player;
      })
      .catch(() => {
        /* YouTube iframe API unavailable (blocked or network); onboard tracks still work */
      });

    return () => {
      cancelled = true;
      try {
        ytRef.current?.destroy();
      } catch {
        /* player already gone */
      }
      ytRef.current = null;
      ytReadyRef.current = false;
      host.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const volumeRef = useRef(volume);
  volumeRef.current = volume;

  /** Poll the YouTube player for its clock — it has no timeupdate event. */
  useEffect(() => {
    if (track?.kind !== "youtube" || !isPlaying) return;
    const id = window.setInterval(() => {
      const player = ytRef.current;
      if (!player) return;
      setCurrentTime(player.getCurrentTime() || 0);
      const total = player.getDuration() || 0;
      if (total > 0) setDuration(total);
    }, 250);
    return () => window.clearInterval(id);
  }, [track?.kind, isPlaying]);

  /* ------------------------------ queue advance / loading ------------------------------ */

  /** Attach the current track to the right engine whenever it changes. */
  const loadedKeyRef = useRef<string | null>(null);
  useEffect(() => {
    const current = queue[index];
    if (!current) {
      loadedKeyRef.current = null;
      return;
    }
    const key = `${current.kind}:${current.id}`;
    if (loadedKeyRef.current === key) return;
    loadedKeyRef.current = key;

    setCurrentTime(0);
    setDuration(current.duration || 0);
    setError(null);

    if (current.kind === "onboard") {
      ytRef.current?.pauseVideo();
      const audio = audioRef.current;
      if (!audio || !current.src) return;
      audio.src = current.src;
      if (wantPlayRef.current) {
        setIsLoading(true);
        void audio.play().catch(() => {
          setIsPlaying(false);
          setIsLoading(false);
        });
      }
      return;
    }

    audioRef.current?.pause();
    const player = ytRef.current;
    if (!player || !ytReadyRef.current) {
      pendingVideoRef.current = current.id;
      if (wantPlayRef.current) setIsLoading(true);
      return;
    }
    setIsLoading(true);
    if (wantPlayRef.current) {
      player.loadVideoById(current.id);
      player.playVideo();
    } else {
      player.cueVideoById(current.id);
      setIsLoading(false);
    }
  }, [queue, index]);

  /* ---------------------------------- public transport --------------------------------- */

  const play = useCallback(() => {
    const current = trackRef.current;
    if (!current) return;
    wantPlayRef.current = true;
    setIsLoading(true);
    if (current.kind === "onboard") {
      void audioRef.current?.play().catch(() => {
        setIsPlaying(false);
        setIsLoading(false);
      });
      return;
    }
    const player = ytRef.current;
    if (!player || !ytReadyRef.current) {
      pendingVideoRef.current = current.id;
      return;
    }
    player.playVideo();
  }, []);

  const pause = useCallback(() => {
    wantPlayRef.current = false;
    const current = trackRef.current;
    if (current?.kind === "onboard") audioRef.current?.pause();
    else ytRef.current?.pauseVideo();
    setIsPlaying(false);
    setIsLoading(false);
  }, []);

  const toggle = useCallback(() => {
    if (isPlaying) pause();
    else play();
  }, [isPlaying, pause, play]);

  const selectIndex = useCallback((next: number) => {
    wantPlayRef.current = true;
    setIndex((i) => {
      if (next === i) {
        // Re-selecting the current track restarts it.
        loadedKeyRef.current = null;
      }
      return next;
    });
  }, []);

  const next = useCallback(() => {
    setIndex((i) => {
      if (i + 1 >= queue.length) return i;
      wantPlayRef.current = true;
      return i + 1;
    });
  }, [queue.length]);

  const previous = useCallback(() => {
    const current = trackRef.current;
    // Like a real player: restart first, step back only near the start of the track.
    const clock =
      current?.kind === "onboard"
        ? (audioRef.current?.currentTime ?? 0)
        : (ytRef.current?.getCurrentTime() ?? 0);
    if (clock > 3) {
      if (current?.kind === "onboard" && audioRef.current) audioRef.current.currentTime = 0;
      else ytRef.current?.seekTo(0, true);
      setCurrentTime(0);
      return;
    }
    setIndex((i) => {
      if (i - 1 < 0) return i;
      wantPlayRef.current = true;
      return i - 1;
    });
  }, []);

  const seek = useCallback((seconds: number) => {
    const current = trackRef.current;
    const safe = Math.max(0, seconds);
    if (current?.kind === "onboard") {
      if (audioRef.current) audioRef.current.currentTime = safe;
    } else {
      ytRef.current?.seekTo(safe, true);
    }
    setCurrentTime(safe);
  }, []);

  const seekBy = useCallback(
    (delta: number) => {
      const total = duration || 0;
      const target = currentTime + delta;
      seek(total > 0 ? Math.min(target, total) : target);
    },
    [currentTime, duration, seek],
  );

  const setVolume = useCallback((value: number) => {
    const clamped = Math.min(1, Math.max(0, value));
    setVolumeState(clamped);
    setMuted(clamped === 0);
    if (audioRef.current) {
      audioRef.current.volume = clamped;
      audioRef.current.muted = clamped === 0;
    }
    const player = ytRef.current;
    if (player && ytReadyRef.current) {
      player.setVolume(Math.round(clamped * 100));
      if (clamped === 0) player.mute();
      else player.unMute();
    }
  }, []);

  const toggleMute = useCallback(() => {
    setMuted((current) => {
      const nextMuted = !current;
      if (audioRef.current) audioRef.current.muted = nextMuted;
      const player = ytRef.current;
      if (player && ytReadyRef.current) {
        if (nextMuted) player.mute();
        else player.unMute();
      }
      return nextMuted;
    });
  }, []);

  const setQueue = useCallback((tracks: Track[], startIndex = 0) => {
    setQueueState(tracks);
    setIndex(Math.min(Math.max(0, startIndex), Math.max(0, tracks.length - 1)));
  }, []);

  const enqueue = useCallback((candidate: Track) => {
    let added = false;
    setQueueState((current) => {
      if (current.some((t) => t.kind === candidate.kind && t.id === candidate.id)) return current;
      added = true;
      return [...current, candidate];
    });
    return added;
  }, []);

  const playNow = useCallback((candidate: Track) => {
    wantPlayRef.current = true;
    setQueueState((current) => {
      const existing = current.findIndex(
        (t) => t.kind === candidate.kind && t.id === candidate.id,
      );
      if (existing >= 0) {
        setIndex(existing);
        return current;
      }
      setIndex(current.length);
      return [...current, candidate];
    });
  }, []);

  const removeAt = useCallback((target: number) => {
    setQueueState((current) => {
      if (target < 0 || target >= current.length) return current;
      const nextQueue = current.filter((_, i) => i !== target);
      setIndex((i) => {
        if (target < i) return i - 1;
        if (target === i) return Math.min(i, Math.max(0, nextQueue.length - 1));
        return i;
      });
      return nextQueue;
    });
  }, []);

  const move = useCallback((target: number, direction: -1 | 1) => {
    setQueueState((current) => {
      const to = target + direction;
      if (target < 0 || target >= current.length || to < 0 || to >= current.length) return current;
      const nextQueue = [...current];
      const [moved] = nextQueue.splice(target, 1);
      if (!moved) return current;
      nextQueue.splice(to, 0, moved);
      setIndex((i) => (i === target ? to : i === to ? target : i));
      return nextQueue;
    });
  }, []);

  return useMemo(
    () => ({
      queue,
      index,
      track,
      isPlaying,
      isLoading,
      error,
      currentTime,
      duration,
      volume,
      muted,
      playNow,
      enqueue,
      setQueue,
      removeAt,
      move,
      selectIndex,
      toggle,
      play,
      pause,
      next,
      previous,
      seek,
      seekBy,
      setVolume,
      toggleMute,
    }),
    [
      queue,
      index,
      track,
      isPlaying,
      isLoading,
      error,
      currentTime,
      duration,
      volume,
      muted,
      playNow,
      enqueue,
      setQueue,
      removeAt,
      move,
      selectIndex,
      toggle,
      play,
      pause,
      next,
      previous,
      seek,
      seekBy,
      setVolume,
      toggleMute,
    ],
  );
}

export function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}
