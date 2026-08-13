/**
 * YouTube search — server side only.
 *
 * The browser never sees `YOUTUBE_API_KEY`: the web app calls our own `music.search`
 * procedure, we call the official YouTube Data API v3 here, and only normalized
 * metadata (id, title, channel, duration, thumbnail) goes back over the wire.
 *
 * Playback is handled entirely by the official YouTube IFrame player in the browser —
 * we never download, extract or proxy audio.
 *
 * Quota note: `search.list` costs 100 units of the default 10,000/day quota, so results
 * are cached per normalized query for `SEARCH_CACHE_MS` and concurrent identical
 * searches share one upstream call.
 */

export type YoutubeTrack = {
  /** YouTube video id — the IFrame player loads this. */
  videoId: string;
  title: string;
  /** Channel name, shown where an artist would be. */
  artist: string;
  /** Seconds, 0 when YouTube does not report a usable duration. */
  duration: number;
  thumbnail: string;
};

export type MusicSearchResult = {
  tracks: YoutubeTrack[];
  /** "live" when results came from YouTube, "demo" when we fell back to onboard tracks. */
  source: "live" | "demo";
  /** User-safe line for the UI. Never a raw provider error. */
  notice: string | null;
};

export type MusicProviderInfo = {
  /** True when a YouTube key is configured on the server. */
  live: boolean;
};

const API_BASE = "https://www.googleapis.com/youtube/v3";
const SEARCH_CACHE_MS = 10 * 60 * 1000;
/** After an auth/quota failure, stop calling YouTube for a while. */
const COOLDOWN_MS = 10 * 60 * 1000;
const MAX_RESULTS = 12;
const REQUEST_TIMEOUT_MS = 10_000;

type FailureKind = "auth" | "quota" | "timeout" | "server" | "malformed" | "network";

class ProviderFailure extends Error {
  constructor(
    readonly kind: FailureKind,
    message: string,
  ) {
    super(message);
    this.name = "YoutubeProviderFailure";
  }
}

const NOTICES: Record<FailureKind, string> = {
  auth: "Music search isn't available right now — showing the onboard tracks.",
  quota: "Music search has hit today's limit — showing the onboard tracks.",
  timeout: "Music search is taking too long — showing the onboard tracks.",
  server: "Music search isn't available right now — showing the onboard tracks.",
  malformed: "Music search isn't available right now — showing the onboard tracks.",
  network: "Music search couldn't be reached — showing the onboard tracks.",
};

/**
 * Fallback playlist: original royalty-free instrumentals shipped with the site.
 * Used when no key is configured or YouTube is unreachable, so the player is never empty.
 */
export const ONBOARD_TRACKS = [
  {
    id: "safarnama",
    title: "Safarnama",
    artist: "Coach S7 Sessions",
    src: "/audio/safarnama.mp3",
    thumbnail: "/images/art-safarnama.png",
    duration: 0,
  },
  {
    id: "chai-break",
    title: "Chai Break",
    artist: "Platform Tapes",
    src: "/audio/chai-break.mp3",
    thumbnail: "/images/art-chai-break.png",
    duration: 0,
  },
  {
    id: "platform-four",
    title: "Platform Four",
    artist: "Tanpura Local",
    src: "/audio/platform-four.mp3",
    thumbnail: "/images/art-platform-four.png",
    duration: 0,
  },
] as const;

const cache = new Map<string, { at: number; tracks: YoutubeTrack[] }>();
const inflight = new Map<string, Promise<YoutubeTrack[]>>();
let cooldownUntil = 0;

function apiKey(): string | null {
  const key = typeof process !== "undefined" && process?.env?.YOUTUBE_API_KEY
    ? process.env.YOUTUBE_API_KEY.trim()
    : null;
  return key && key.length > 0 ? key : null;
}

export function musicProviderInfo(): MusicProviderInfo {
  return { live: apiKey() !== null };
}

/** ISO-8601 duration (`PT4M13S`) → seconds. */
function parseIsoDuration(iso: string | undefined): number {
  if (!iso) return 0;
  const m = /^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(iso);
  if (!m) return 0;
  const [, d, h, min, s] = m;
  return (
    Number(d ?? 0) * 86400 + Number(h ?? 0) * 3600 + Number(min ?? 0) * 60 + Number(s ?? 0)
  );
}

/** YouTube titles arrive with encoded entities and noisy decorations. */
function cleanTitle(raw: string): string {
  return raw
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s*[\(\[][^\)\]]*(official|video|audio|lyrics?|hd|4k|full song)[^\)\]]*[\)\]]/gi, "")
    .replace(/\s*\|\s*(official|full)[^|]*$/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function cleanChannel(raw: string): string {
  return raw
    .replace(/&amp;/g, "&")
    .replace(/\s*-\s*Topic$/i, "")
    .replace(/VEVO$/i, "")
    .trim();
}

function safeTimeoutSignal(ms: number): AbortSignal {
  if (typeof AbortSignal !== "undefined" && typeof (AbortSignal as any).timeout === "function") {
    return (AbortSignal as any).timeout(ms);
  }
  const controller = new AbortController();
  setTimeout(() => controller.abort(), ms);
  return controller.signal;
}

async function call(path: string, params: Record<string, string>): Promise<unknown> {
  const key = apiKey();
  if (!key) throw new ProviderFailure("auth", "missing key");

  const url = new URL(`${API_BASE}/${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  // Key stays in a server-side request only — it is never returned to the browser.
  url.searchParams.set("key", key);

  let response: Response;
  try {
    response = await fetch(url, {
      headers: { accept: "application/json" },
      signal: safeTimeoutSignal(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    const aborted = error instanceof Error && error.name === "TimeoutError";
    throw new ProviderFailure(aborted ? "timeout" : "network", "request failed");
  }

  if (!response.ok) {
    if (response.status === 400 || response.status === 401 || response.status === 403) {
      // 403 covers both a disabled/invalid key and an exhausted quota.
      const body = await response.text().catch(() => "");
      const quota = /quota/i.test(body);
      throw new ProviderFailure(quota ? "quota" : "auth", `status ${response.status}`);
    }
    if (response.status === 429) throw new ProviderFailure("quota", "rate limited");
    throw new ProviderFailure("server", `status ${response.status}`);
  }

  try {
    return (await response.json()) as unknown;
  } catch {
    throw new ProviderFailure("malformed", "invalid json");
  }
}

type SearchItem = {
  id?: { videoId?: string };
  snippet?: {
    title?: string;
    channelTitle?: string;
    thumbnails?: Record<string, { url?: string } | undefined>;
  };
};

type VideoItem = {
  id?: string;
  contentDetails?: { duration?: string };
  snippet?: { title?: string; channelTitle?: string };
  status?: { embeddable?: boolean };
};

function thumbnailOf(item: SearchItem): string {
  const t = item.snippet?.thumbnails ?? {};
  return t.medium?.url ?? t.high?.url ?? t.default?.url ?? "";
}

async function fetchFromYoutube(query: string): Promise<YoutubeTrack[]> {
  let search = (await call("search", {
    part: "snippet",
    type: "video",
    // 10 = Music category, keeps results musical instead of vlogs and reactions.
    videoCategoryId: "10",
    videoEmbeddable: "true",
    maxResults: String(MAX_RESULTS),
    q: query,
  })) as { items?: SearchItem[] };

  let items = Array.isArray(search.items) ? search.items : [];
  if (items.length === 0) {
    search = (await call("search", {
      part: "snippet",
      type: "video",
      videoEmbeddable: "true",
      maxResults: String(MAX_RESULTS),
      q: query,
    })) as { items?: SearchItem[] };
    items = Array.isArray(search.items) ? search.items : [];
  }

  const base = items
    .map((item) => ({
      videoId: item.id?.videoId ?? "",
      title: cleanTitle(item.snippet?.title ?? ""),
      artist: cleanChannel(item.snippet?.channelTitle ?? ""),
      thumbnail: thumbnailOf(item),
      duration: 0,
    }))
    .filter((track) => track.videoId !== "" && track.title !== "");

  if (base.length === 0) return [];

  // One extra cheap call (1 unit) enriches durations and drops non-embeddable videos.
  let durations = new Map<string, number>();
  let embeddable = new Set<string>();
  try {
    const details = (await call("videos", {
      part: "contentDetails,status",
      id: base.map((t) => t.videoId).join(","),
    })) as { items?: VideoItem[] };
    for (const item of details.items ?? []) {
      if (!item.id) continue;
      durations.set(item.id, parseIsoDuration(item.contentDetails?.duration));
      if (item.status?.embeddable !== false) embeddable.add(item.id);
    }
  } catch {
    // Durations are optional — keep the search results if the enrichment call fails.
    durations = new Map();
    embeddable = new Set(base.map((t) => t.videoId));
  }

  return base
    .filter((track) => embeddable.size === 0 || embeddable.has(track.videoId))
    .map((track) => ({ ...track, duration: durations.get(track.videoId) ?? 0 }));
}

/** Search YouTube for music, cached and quota-aware. Never throws. */
export async function searchMusic(rawQuery: string): Promise<MusicSearchResult> {
  const query = rawQuery.trim().replace(/\s{2,}/g, " ");
  if (query.length === 0) return { tracks: [], source: "live", notice: null };

  if (apiKey() === null) {
    return {
      tracks: [],
      source: "demo",
      notice: "Music search isn't configured yet — showing the onboard tracks.",
    };
  }

  const key = query.toLowerCase();
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < SEARCH_CACHE_MS) {
    return { tracks: hit.tracks, source: "live", notice: notFoundNotice(hit.tracks) };
  }

  if (Date.now() < cooldownUntil) {
    return { tracks: [], source: "demo", notice: NOTICES.quota };
  }

  let pending = inflight.get(key);
  if (!pending) {
    pending = fetchFromYoutube(query);
    inflight.set(key, pending);
    pending.finally(() => inflight.delete(key)).catch(() => {});
  }

  try {
    const tracks = await pending;
    cache.set(key, { at: Date.now(), tracks });
    return { tracks, source: "live", notice: notFoundNotice(tracks) };
  } catch (error) {
    const kind: FailureKind = error instanceof ProviderFailure ? error.kind : "server";
    if (kind === "auth" || kind === "quota") cooldownUntil = Date.now() + COOLDOWN_MS;
    // Log the kind only — never the key or the raw upstream body.
    console.warn(`[youtube] search failed (${kind})`);
    return { tracks: [], source: "demo", notice: NOTICES[kind] };
  }
}

function notFoundNotice(tracks: YoutubeTrack[]): string | null {
  return tracks.length === 0 ? "No tracks found." : null;
}
