import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  ChevronDown,
  ChevronUp,
  ListMusic,
  Loader2,
  Pause,
  Play,
  Plus,
  Search,
  SkipBack,
  SkipForward,
  Trash2,
  Volume1,
  Volume2,
  VolumeX,
} from "lucide-react";
import { formatTime, type PlayerController, type Track } from "../hooks/use-player";
import { useMusicSearch } from "../queries/music";

const EASE = [0.22, 1, 0.36, 1] as const;

/**
 * SAFAR's music surface: a slim glass strip that belongs to the scene, expanding into a
 * search + queue panel. Playback runs on the hidden YouTube player; every control here is ours.
 */
export function MusicPlayer({
  player,
  expanded,
  onExpandedChange,
  minimal,
  journeyLine,
  searchAvailable,
}: {
  player: PlayerController;
  expanded: boolean;
  onExpandedChange: (value: boolean) => void;
  minimal: boolean;
  journeyLine: string | null;
  searchAvailable: boolean;
}) {
  const [tab, setTab] = useState<"search" | "queue">("search");
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [justQueued, setJustQueued] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Searches are quota-expensive upstream, so wait for the typing to settle.
  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(query), 450);
    return () => window.clearTimeout(id);
  }, [query]);

  useEffect(() => {
    if (expanded) {
      const id = window.setTimeout(() => inputRef.current?.focus(), 420);
      return () => window.clearTimeout(id);
    }
    return undefined;
  }, [expanded]);

  const search = useMusicSearch(debounced);
  const results = useMemo<Track[]>(
    () =>
      (search.data?.tracks ?? []).map((t) => ({
        id: t.videoId,
        kind: "youtube" as const,
        title: t.title,
        artist: t.artist,
        thumbnail: t.thumbnail,
        duration: t.duration,
      })),
    [search.data],
  );

  const track = player.track;
  const progress = player.duration > 0 ? (player.currentTime / player.duration) * 100 : 0;
  const searchNotice = search.data?.notice ?? null;
  const searchFailed = search.isError;

  return (
    <motion.div
      className="pointer-events-none fixed inset-x-0 bottom-0 z-30 flex justify-center px-3 pb-16 sm:px-6 sm:pb-7"
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.9, delay: 0.85, ease: EASE }}
    >
      <div className="pointer-events-auto w-full max-w-[620px]">
        {/* Context line — ties the music to the journey */}
        <AnimatePresence>
          {journeyLine && !expanded && (
            <motion.div
              key={journeyLine}
              className="mb-3 text-center"
              initial={{ opacity: 0, y: 8, filter: "blur(6px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, y: -8, filter: "blur(6px)" }}
              transition={{ duration: 0.7, ease: EASE }}
            >
              <p className="label-sm text-ember/70">Listening while travelling</p>
              <p className="mt-1.5 text-[12px] italic text-cream/40">{journeyLine}</p>
            </motion.div>
          )}
        </AnimatePresence>

        <motion.div
          layout
          transition={{ duration: 0.5, ease: EASE }}
          className="glass overflow-hidden rounded-2xl shadow-[0_24px_60px_-24px_rgba(0,0,0,0.85)]"
        >
          {/* Expanded: artwork, search, results, queue */}
          <AnimatePresence initial={false}>
            {expanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.55, ease: EASE }}
              >
                <div className="p-5 sm:p-6">
                  <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-cream/20 sm:hidden" />
                  <div className="flex gap-4 sm:gap-5">
                    <Artwork track={track} playing={player.isPlaying} />
                    <div className="min-w-0 flex-1">
                      <p className="label-sm text-cream/35">
                        {track ? "Now playing" : "Nothing queued yet"}
                      </p>
                      <h3 className="display mt-1 truncate text-xl text-offwhite sm:text-2xl">
                        {track?.title ?? "Search a song to begin"}
                      </h3>
                      <p className="mt-1 truncate text-sm text-cream/55">
                        {track?.artist ?? "The coach is quiet"}
                      </p>
                      {player.error && (
                        <p className="mt-2 text-[12px] italic text-rust/90">{player.error}</p>
                      )}
                    </div>
                  </div>

                  {/* Search */}
                  <div className="mt-5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <TabButton
                          active={tab === "search"}
                          onClick={() => setTab("search")}
                          label="Search"
                        />
                        <TabButton
                          active={tab === "queue"}
                          onClick={() => setTab("queue")}
                          label={`Queue${player.queue.length ? ` · ${player.queue.length}` : ""}`}
                        />
                      </div>
                      {search.isFetching && (
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-ember/70" />
                      )}
                    </div>

                    {tab === "search" ? (
                      <div className="mt-3">
                        <div className="flex items-center gap-2.5 rounded-xl border border-cream/12 bg-ink/40 px-3 py-2.5 transition-colors duration-300 focus-within:border-ember/45">
                          <Search className="h-3.5 w-3.5 shrink-0 text-cream/35" strokeWidth={1.6} />
                          <input
                            ref={inputRef}
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Search a song, artist or album..."
                            aria-label="Search music"
                            className="w-full bg-transparent text-[13px] text-offwhite placeholder:text-cream/28 focus:outline-none"
                          />
                        </div>

                        <div className="safar-scroll mt-3 max-h-[38vh] space-y-0.5 overflow-y-auto pr-1 sm:max-h-[34vh]">
                          {debounced.trim() === "" && (
                            <Hint>
                              Try an artist, a film or a mood — Arijit Singh, Ilaiyaraaja, lo-fi
                              tabla.
                            </Hint>
                          )}
                          {debounced.trim() !== "" && searchFailed && (
                            <Hint>Music search isn&apos;t available right now.</Hint>
                          )}
                          {debounced.trim() !== "" && !searchFailed && searchNotice && (
                            <Hint>{searchNotice}</Hint>
                          )}
                          {results.map((result) => (
                            <ResultRow
                              key={result.id}
                              track={result}
                              current={track?.kind === "youtube" && track.id === result.id}
                              playing={player.isPlaying}
                              queued={justQueued === result.id}
                              onPlay={() => player.playNow(result)}
                              onQueue={() => {
                                player.enqueue(result);
                                setJustQueued(result.id);
                                window.setTimeout(() => setJustQueued(null), 1400);
                              }}
                            />
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="safar-scroll mt-3 max-h-[38vh] space-y-0.5 overflow-y-auto pr-1 sm:max-h-[34vh]">
                        {player.queue.length === 0 && (
                          <Hint>Nothing in the queue. Search for a song and press play.</Hint>
                        )}
                        {player.queue.map((item, i) => (
                          <QueueRow
                            key={`${item.kind}:${item.id}`}
                            track={item}
                            position={i}
                            current={i === player.index}
                            playing={player.isPlaying}
                            first={i === 0}
                            last={i === player.queue.length - 1}
                            onSelect={() => player.selectIndex(i)}
                            onRemove={() => player.removeAt(i)}
                            onMove={(direction) => player.move(i, direction)}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div className="hairline h-px" />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Collapsed bar — always the transport */}
          <div className="flex items-center gap-3 px-3 py-3 sm:gap-4 sm:px-4">
            <button
              type="button"
              onClick={() => onExpandedChange(!expanded)}
              className="relative shrink-0"
              aria-label={expanded ? "Collapse player" : "Expand player"}
            >
              {track?.thumbnail ? (
                <img
                  src={track.thumbnail}
                  alt=""
                  className={`h-11 w-11 rounded-lg object-cover ring-1 ring-cream/15 transition-transform duration-500 sm:h-12 sm:w-12 ${
                    player.isPlaying ? "scale-100" : "scale-95 opacity-80"
                  }`}
                />
              ) : (
                <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-cream/8 ring-1 ring-cream/15 sm:h-12 sm:w-12">
                  <ListMusic className="h-4 w-4 text-cream/40" strokeWidth={1.6} />
                </span>
              )}
            </button>

            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-2">
                <span className="display truncate text-[15px] text-offwhite sm:text-base">
                  {track?.title ?? "SAFAR music"}
                </span>
                <span className="hidden truncate text-[11px] text-cream/40 sm:inline">
                  {track?.artist ?? "Search a song"}
                </span>
              </div>

              <div className="mt-2 flex items-center gap-2.5">
                <span className="label-sm w-8 shrink-0 text-cream/35 tabular-nums">
                  {formatTime(player.currentTime)}
                </span>
                <div className="relative flex-1">
                  <div className="h-[2px] w-full rounded-full bg-cream/15" />
                  <div
                    className="absolute inset-y-0 left-0 h-[2px] rounded-full bg-ember"
                    style={{ width: `${progress}%` }}
                  />
                  <input
                    type="range"
                    min={0}
                    max={player.duration || 0}
                    step={0.1}
                    value={player.currentTime}
                    onChange={(e) => player.seek(Number(e.target.value))}
                    aria-label="Seek"
                    className="rail absolute -top-2 left-0 h-5 w-full opacity-0 hover:opacity-100"
                  />
                </div>
                <span className="label-sm w-8 shrink-0 text-right text-cream/35 tabular-nums">
                  {formatTime(player.duration)}
                </span>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-1 sm:gap-1.5">
              <IconButton label="Previous track" onClick={player.previous}>
                <SkipBack className="h-4 w-4" strokeWidth={1.6} />
              </IconButton>

              <button
                type="button"
                onClick={player.toggle}
                aria-label={player.isPlaying ? "Pause" : "Play"}
                className="flex h-11 w-11 items-center justify-center rounded-full border border-cream/20 bg-cream/8 text-offwhite transition-all duration-300 hover:border-ember/60 hover:bg-ember/20 active:scale-95"
              >
                {player.isLoading && !player.isPlaying ? (
                  <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.8} />
                ) : player.isPlaying ? (
                  <Pause className="h-4 w-4" strokeWidth={1.8} />
                ) : (
                  <Play className="ml-0.5 h-4 w-4" strokeWidth={1.8} />
                )}
              </button>

              <IconButton label="Next track" onClick={player.next}>
                <SkipForward className="h-4 w-4" strokeWidth={1.6} />
              </IconButton>

              {!minimal && (
                <div className="group ml-1 hidden items-center gap-2 sm:flex">
                  <IconButton
                    label={player.muted ? "Unmute" : "Mute"}
                    onClick={player.toggleMute}
                  >
                    {player.muted || player.volume === 0 ? (
                      <VolumeX className="h-4 w-4" strokeWidth={1.6} />
                    ) : player.volume < 0.5 ? (
                      <Volume1 className="h-4 w-4" strokeWidth={1.6} />
                    ) : (
                      <Volume2 className="h-4 w-4" strokeWidth={1.6} />
                    )}
                  </IconButton>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={player.muted ? 0 : player.volume}
                    onChange={(e) => player.setVolume(Number(e.target.value))}
                    aria-label="Volume"
                    className="rail w-0 opacity-0 transition-all duration-500 group-hover:w-16 group-hover:opacity-100 focus:w-16 focus:opacity-100"
                  />
                </div>
              )}

              {!minimal && (
                <IconButton
                  label={expanded ? "Collapse player" : "Search music"}
                  onClick={() => onExpandedChange(!expanded)}
                  active={expanded}
                >
                  {expanded ? (
                    <ChevronDown className="h-4 w-4" strokeWidth={1.6} />
                  ) : (
                    <Search className="h-4 w-4" strokeWidth={1.6} />
                  )}
                </IconButton>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}

function Artwork({ track, playing }: { track: Track | null; playing: boolean }) {
  return (
    <motion.div
      key={track?.thumbnail ?? "empty"}
      className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl ring-1 ring-cream/15 sm:h-28 sm:w-28"
      initial={{ opacity: 0, scale: 0.94 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.6, ease: EASE }}
    >
      {track?.thumbnail ? (
        <img src={track.thumbnail} alt="" className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-cream/6">
          <ListMusic className="h-5 w-5 text-cream/30" strokeWidth={1.5} />
        </div>
      )}
      {playing && (
        <span className="absolute bottom-1.5 right-1.5">
          <Bars />
        </span>
      )}
    </motion.div>
  );
}

function TabButton({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`label-sm relative py-1 transition-colors duration-300 ${
        active ? "text-ember" : "text-cream/35 hover:text-cream/70"
      }`}
    >
      {label}
      <span
        className={`absolute -bottom-0.5 left-0 h-px bg-ember transition-all duration-500 ${
          active ? "w-full" : "w-0"
        }`}
      />
    </button>
  );
}

function ResultRow({
  track,
  current,
  playing,
  queued,
  onPlay,
  onQueue,
}: {
  track: Track;
  current: boolean;
  playing: boolean;
  queued: boolean;
  onPlay: () => void;
  onQueue: () => void;
}) {
  return (
    <div
      className={`group flex items-center gap-3 rounded-lg px-2 py-2 transition-colors duration-300 ${
        current ? "bg-ember/12" : "hover:bg-cream/6"
      }`}
    >
      <button type="button" onClick={onPlay} className="shrink-0" aria-label={`Play ${track.title}`}>
        <img
          src={track.thumbnail}
          alt=""
          className="h-9 w-9 rounded-md object-cover ring-1 ring-cream/12"
          loading="lazy"
        />
      </button>
      <button type="button" onClick={onPlay} className="min-w-0 flex-1 text-left">
        <span
          className={`block truncate text-[13px] ${current ? "text-offwhite" : "text-cream/75"}`}
        >
          {track.title}
        </span>
        <span className="block truncate text-[11px] text-cream/35">{track.artist}</span>
      </button>
      {track.duration > 0 && (
        <span className="label-sm shrink-0 text-cream/25 tabular-nums">
          {formatTime(track.duration)}
        </span>
      )}
      {current && playing ? (
        <span className="w-7 pl-1.5">
          <Bars />
        </span>
      ) : (
        <div className="flex shrink-0 items-center">
          <MiniButton
            label={queued ? "Added to queue" : `Add ${track.title} to queue`}
            onClick={onQueue}
            active={queued}
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={1.7} />
          </MiniButton>
          <MiniButton label={`Play ${track.title}`} onClick={onPlay}>
            <Play className="h-3.5 w-3.5" strokeWidth={1.7} />
          </MiniButton>
        </div>
      )}
    </div>
  );
}

function QueueRow({
  track,
  position,
  current,
  playing,
  first,
  last,
  onSelect,
  onRemove,
  onMove,
}: {
  track: Track;
  position: number;
  current: boolean;
  playing: boolean;
  first: boolean;
  last: boolean;
  onSelect: () => void;
  onRemove: () => void;
  onMove: (direction: -1 | 1) => void;
}) {
  return (
    <div
      className={`group flex items-center gap-3 rounded-lg px-2 py-2 transition-colors duration-300 ${
        current ? "bg-ember/12" : "hover:bg-cream/6"
      }`}
    >
      <span className={`label-sm w-4 shrink-0 ${current ? "text-ember" : "text-cream/30"}`}>
        {String(position + 1).padStart(2, "0")}
      </span>
      <button type="button" onClick={onSelect} className="min-w-0 flex-1 text-left">
        <span className={`block truncate text-[13px] ${current ? "text-offwhite" : "text-cream/70"}`}>
          {track.title}
        </span>
        <span className="block truncate text-[11px] text-cream/35">{track.artist}</span>
      </button>
      {current && playing && (
        <span className="pr-1">
          <Bars />
        </span>
      )}
      <div className="flex shrink-0 items-center opacity-60 transition-opacity duration-300 group-hover:opacity-100">
        {!first && (
          <MiniButton label="Move up" onClick={() => onMove(-1)}>
            <ChevronUp className="h-3.5 w-3.5" strokeWidth={1.7} />
          </MiniButton>
        )}
        {!last && (
          <MiniButton label="Move down" onClick={() => onMove(1)}>
            <ChevronDown className="h-3.5 w-3.5" strokeWidth={1.7} />
          </MiniButton>
        )}
        <MiniButton label="Remove from queue" onClick={onRemove}>
          <Trash2 className="h-3.5 w-3.5" strokeWidth={1.7} />
        </MiniButton>
      </div>
    </div>
  );
}

function Hint({ children }: { children: React.ReactNode }) {
  return <p className="px-2 py-3 text-[12px] italic leading-relaxed text-cream/35">{children}</p>;
}

function MiniButton({
  children,
  label,
  onClick,
  active,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={`flex h-7 w-7 items-center justify-center rounded-full transition-colors duration-300 ${
        active ? "text-ember" : "text-cream/40 hover:bg-cream/8 hover:text-offwhite"
      }`}
    >
      {children}
    </button>
  );
}

function IconButton({
  children,
  label,
  onClick,
  active,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={`flex h-9 w-9 items-center justify-center rounded-full transition-colors duration-300 ${
        active ? "text-ember" : "text-cream/55 hover:bg-cream/8 hover:text-offwhite"
      }`}
    >
      {children}
    </button>
  );
}

/** Three-bar equalizer for the currently playing row. */
function Bars() {
  return (
    <span className="flex h-3 shrink-0 items-end gap-[2px]">
      {[0, 0.2, 0.4].map((delay) => (
        <motion.span
          key={delay}
          className="w-[2px] rounded-full bg-ember"
          animate={{ height: ["30%", "100%", "45%"] }}
          transition={{ duration: 1, repeat: Infinity, delay, ease: "easeInOut" }}
          style={{ height: "40%" }}
        />
      ))}
    </span>
  );
}
