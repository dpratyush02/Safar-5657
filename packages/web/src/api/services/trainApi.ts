/**
 * Train status service layer.
 *
 * All train knowledge lives here — UI components never talk to a provider and never see a key.
 *
 *   Browser -> oRPC route (`api/routes/train.ts`) -> this service -> RailRadar -> normalized model
 *
 * Provider: RailRadar (https://railradar.in/docs)
 *   GET {TRAIN_API_URL}/v1/trains/{number}/live?haltsOnly=true&includeCoordinates=true
 *   Authorization: Bearer {TRAIN_API_KEY}
 *
 * Configure `TRAIN_API_KEY` (server-side only, no VITE_ prefix) in the root `.env` to get live
 * data. With it unset the service returns the deterministic demo journeys in `data/mock-trains.ts`
 * so the whole experience still works offline. Any provider failure also falls back to demo data.
 *
 * RailRadar's free tier allows ~50 requests/day, so upstream calls are cached per train for
 * `TRAIN_STATUS_REFRESH_MS` (default 120s) and de-duplicated across concurrent requests. The UI can
 * poll every few seconds without generating upstream traffic: between refreshes the cached position
 * is advanced by dead reckoning (last known speed × elapsed time, clamped at the next halt).
 */

import { findMockTrain, type MockTrain } from "../data/mock-trains.js";

export type StationStatus = "passed" | "current" | "upcoming";

export type DataSource = "live" | "demo";

export type RouteStation = {
  name: string;
  code: string;
  km: number;
  scheduled: string;
  status: StationStatus;
};

export type TrainRoute = {
  trainNumber: string;
  trainName: string;
  from: string;
  to: string;
  totalKm: number;
  stations: RouteStation[];
  /** Index of the station the train is at / has most recently left. */
  currentIndex: number;
  /** 0–100. */
  progress: number;
  source: DataSource;
};

export type TrainStatus = {
  trainNumber: string;
  trainName: string;
  from: string;
  fromCode: string;
  to: string;
  toCode: string;
  currentStation: string;
  previousStation: string;
  nextStation: string;
  /** km/h. */
  speed: number;
  /** Minutes late; 0 means on time. */
  delayMinutes: number;
  /** "HH:MM" IST expected arrival at destination. */
  expectedArrival: string;
  /** 0–100 journey completion. */
  progress: number;
  /** Distance covered so far, km. */
  distanceCovered: number;
  totalKm: number;
  /** Coordinates when the provider supplies them — the route map can plot this later. */
  position: { lat: number; lng: number } | null;
  /** Provider timestamp (ms) of the position we are showing. */
  updatedAt: number;
  source: DataSource;
  /** Soft, user-safe message when live data could not be used. Never a raw provider error. */
  notice: string | null;
};

type Snapshot = { status: TrainStatus; route: TrainRoute };

/* ------------------------------------------------------------------ config */

const DEFAULT_BASE_URL = "https://api.railradar.in";
const DEFAULT_REFRESH_MS = 120_000;
const MIN_REFRESH_MS = 15_000;
const REQUEST_TIMEOUT_MS = 10_000;
/** After an auth / rate-limit error, stop calling the provider for a while. */
const HARD_COOLDOWN_MS = 10 * 60_000;

const NOTICE_UNAVAILABLE = "Live data temporarily unavailable — showing a demo journey";
const NOTICE_NOT_FOUND = "No live running data for this train today — showing a demo journey";
const NOTICE_STALE = "Live data temporarily unavailable — showing the last known position";
const NOTICE_NOT_STARTED = "This train hasn't departed yet — showing the scheduled run";
const NOTICE_COMPLETED = "This journey has completed — showing the final run";

function providerBaseUrl(): string {
  const raw = (typeof process !== "undefined" && process?.env?.TRAIN_API_URL ? process.env.TRAIN_API_URL.trim() : "") || DEFAULT_BASE_URL;
  // Tolerate both "https://api.railradar.in" and "https://api.railradar.in/v1".
  return raw.replace(/\/+$/, "").replace(/\/v1$/, "");
}

function providerKey(): string | undefined {
  const key = typeof process !== "undefined" && process?.env?.TRAIN_API_KEY ? process.env.TRAIN_API_KEY.trim() : undefined;
  return key ? key : undefined;
}

function refreshMs(): number {
  const raw = typeof process !== "undefined" && process?.env?.TRAIN_STATUS_REFRESH_MS ? process.env.TRAIN_STATUS_REFRESH_MS.trim() : "";
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_REFRESH_MS;
  return Math.max(MIN_REFRESH_MS, Math.round(parsed));
}

export function isLiveProviderConfigured(): boolean {
  return Boolean(providerKey());
}

export function providerInfo() {
  return { live: isLiveProviderConfigured(), refreshMs: refreshMs() };
}

/* -------------------------------------------------------------- demo data */

/** Where the demo train sits on its route right now, as a 0–1 fraction of total distance. */
function demoFraction(train: MockTrain): number {
  const cycle = train.demoCycleMs;
  const elapsed = (Date.now() + train.demoSeed * cycle) % cycle;
  return elapsed / cycle;
}

function addMinutes(time: string, minutes: number): string {
  const [h = 0, m = 0] = time.split(":").map(Number);
  const total = (h * 60 + m + minutes + 1440) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

function resolveDemoPosition(train: MockTrain) {
  const totalKm = train.stations[train.stations.length - 1]!.km;
  const fraction = demoFraction(train);
  const distanceCovered = Math.round(totalKm * fraction);

  let currentIndex = 0;
  for (let i = 0; i < train.stations.length; i++) {
    if (train.stations[i]!.km <= distanceCovered) currentIndex = i;
  }
  const nextIndex = Math.min(currentIndex + 1, train.stations.length - 1);

  // Speed drifts a little every few seconds so the readout feels alive, and drops near a stop.
  const nearStation =
    Math.abs(train.stations[nextIndex]!.km - distanceCovered) < totalKm * 0.012 ||
    Math.abs(distanceCovered - train.stations[currentIndex]!.km) < totalKm * 0.008;
  const drift = Math.sin(Date.now() / 9000 + train.demoSeed * 10) * 9;
  const speed = Math.max(0, Math.round(nearStation ? 18 + drift * 0.4 : train.avgSpeed + drift));

  return { totalKm, fraction, distanceCovered, currentIndex, nextIndex, speed };
}

function demoSnapshot(trainNumber: string, notice: string | null = null): Snapshot {
  const train = findMockTrain(trainNumber);
  const p = resolveDemoPosition(train);
  const destination = train.stations[train.stations.length - 1]!;
  const prevIndex = Math.max(0, p.currentIndex - 1);

  const status: TrainStatus = {
    trainNumber: train.number,
    trainName: train.name,
    from: train.from,
    fromCode: train.fromCode,
    to: train.to,
    toCode: train.toCode,
    currentStation: train.stations[p.currentIndex]!.name,
    previousStation: train.stations[prevIndex]!.name,
    nextStation: train.stations[p.nextIndex]!.name,
    speed: p.speed,
    delayMinutes: train.delayMinutes,
    expectedArrival: addMinutes(destination.scheduled, train.delayMinutes),
    progress: Math.round(p.fraction * 1000) / 10,
    distanceCovered: p.distanceCovered,
    totalKm: p.totalKm,
    position: null,
    updatedAt: Date.now(),
    source: "demo",
    notice,
  };

  const route: TrainRoute = {
    trainNumber: train.number,
    trainName: train.name,
    from: train.from,
    to: train.to,
    totalKm: p.totalKm,
    currentIndex: p.currentIndex,
    progress: status.progress,
    stations: train.stations.map((s, i) => ({
      name: s.name,
      code: s.code,
      km: s.km,
      scheduled: addMinutes(s.scheduled, i <= p.currentIndex ? 0 : train.delayMinutes),
      status: i < p.currentIndex ? "passed" : i === p.currentIndex ? "current" : "upcoming",
    })),
    source: "demo",
  };

  return { status, route };
}

/* ----------------------------------------------------- RailRadar contract */

type RailRadarStop = {
  sequence?: number | null;
  stationCode?: string | null;
  stationName?: string | null;
  isHalt?: boolean | null;
  lat?: number | null;
  lng?: number | null;
  scheduledArrival?: string | null;
  scheduledDeparture?: string | null;
  actualArrival?: string | null;
  actualDeparture?: string | null;
  delayArrival?: number | null;
  delayDeparture?: number | null;
  status?: string | null;
  distance?: number | null;
  speedToNextStationKmph?: number | null;
};

type RailRadarLive = {
  trainNumber?: string | null;
  trainName?: string | null;
  delayMinutes?: number | null;
  lastUpdatedAt?: string | null;
  status?: string | null;
  isLive?: boolean | null;
  train?: {
    number?: string | null;
    name?: string | null;
    distance?: number | null;
    avgSpeed?: number | null;
    source?: { code?: string | null; name?: string | null } | null;
    destination?: { code?: string | null; name?: string | null } | null;
  } | null;
  currentLocation?: {
    stationCode?: string | null;
    sequence?: number | null;
    status?: string | null;
    segmentProgress?: number | null;
    speedKmh?: number | null;
  } | null;
  previousHalt?: { stationCode?: string | null; stationName?: string | null } | null;
  nextHalt?: { stationCode?: string | null; stationName?: string | null } | null;
  route?: RailRadarStop[] | null;
};

type RailRadarEnvelope = {
  success?: boolean;
  data?: RailRadarLive | null;
  error?: { code?: string | null; message?: string | null } | null;
};

type FailureKind = "not-found" | "auth" | "rate-limit" | "timeout" | "server" | "malformed";

class ProviderFailure extends Error {
  constructor(readonly kind: FailureKind, message: string) {
    super(message);
  }
}

const IST_TIME = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Kolkata",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

function istTime(iso: string | null | undefined, plusMinutes = 0): string | null {
  if (!iso) return null;
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return null;
  return IST_TIME.format(new Date(ms + plusMinutes * 60_000));
}

/** Live data can be a scheduled run (not departed) or a finished one — say so, gently. */
function lifecycleNotice(status: string | null | undefined): string | null {
  if (status === "not-started" || status === "not-departed") return NOTICE_NOT_STARTED;
  if (status === "completed" || status === "terminated" || status === "arrived") {
    return NOTICE_COMPLETED;
  }
  return null;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Railway feeds mix "Indore Junction" with "INDORE JUNCTION". Leave mixed-case values alone and
 * only soften SHOUTED ones, so the typographic design keeps working.
 */
function titleCase(value: string): string {
  if (/[a-z]/.test(value)) return value;
  return value
    .toLowerCase()
    .split(/\s+/)
    .map((word) => (word ? word[0]!.toUpperCase() + word.slice(1) : word))
    .join(" ");
}

function safeTimeoutSignal(ms: number): AbortSignal {
  if (typeof AbortSignal !== "undefined" && typeof (AbortSignal as any).timeout === "function") {
    return (AbortSignal as any).timeout(ms);
  }
  const controller = new AbortController();
  setTimeout(() => controller.abort(), ms);
  return controller.signal;
}

/** One upstream call per train per refresh window. */
async function fetchLive(trainNumber: string): Promise<RailRadarLive> {
  const url = `${providerBaseUrl()}/v1/trains/${encodeURIComponent(trainNumber)}/live?haltsOnly=true&includeCoordinates=true`;

  let res: Response;
  try {
    res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${providerKey()}`,
        Accept: "application/json",
      },
      signal: safeTimeoutSignal(REQUEST_TIMEOUT_MS),
    });
  } catch {
    throw new ProviderFailure("timeout", "provider unreachable or timed out");
  }

  if (res.status === 401 || res.status === 403) {
    throw new ProviderFailure("auth", `provider rejected the credentials (${res.status})`);
  }
  if (res.status === 404) throw new ProviderFailure("not-found", "train not found for today");
  if (res.status === 429) throw new ProviderFailure("rate-limit", "provider rate limit reached");
  if (!res.ok) throw new ProviderFailure("server", `provider responded ${res.status}`);

  let body: RailRadarEnvelope;
  try {
    body = (await res.json()) as RailRadarEnvelope;
  } catch {
    throw new ProviderFailure("malformed", "provider returned a non-JSON body");
  }

  if (body.success === false || !body.data) {
    const code = body.error?.code ?? "";
    if (code === "NOT_FOUND") throw new ProviderFailure("not-found", "train not found for today");
    if (code === "RATE_LIMITED") throw new ProviderFailure("rate-limit", "provider rate limit reached");
    throw new ProviderFailure("malformed", "provider returned an unsuccessful envelope");
  }

  return body.data;
}

/** Turn RailRadar's payload into our own model. All provider-specific parsing stops here. */
function normalize(trainNumber: string, data: RailRadarLive): Snapshot {
  const stops = (data.route ?? [])
    .filter((s): s is RailRadarStop => Boolean(s && (s.stationName || s.stationCode)))
    .slice()
    .sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0));

  if (stops.length < 2) throw new ProviderFailure("malformed", "route has too few stations");

  // Distances can be null on some stops — carry the last known value forward so maths stays sane.
  let lastKm = 0;
  const km = stops.map((s) => {
    const value = typeof s.distance === "number" && s.distance >= lastKm ? s.distance : lastKm;
    lastKm = value;
    return value;
  });
  const totalKm = Math.max(km[km.length - 1]!, data.train?.distance ?? 0, 1);

  // RailRadar stop states seen in the wild: "departed" | "arrived" | "passed" | "at-station" |
  // "upcoming". Anything the train has already reached anchors the current position.
  const isBehind = (status: string | null | undefined) =>
    status === "departed" || status === "arrived" || status === "passed";
  const isReached = (status: string | null | undefined) =>
    isBehind(status) || status === "at-station";

  let currentIndex = 0;
  for (let i = 0; i < stops.length; i++) {
    if (isReached(stops[i]!.status)) currentIndex = i;
  }
  const locIndex = stops.findIndex(
    (s) =>
      (data.currentLocation?.sequence != null && s.sequence === data.currentLocation.sequence) ||
      (data.currentLocation?.stationCode != null && s.stationCode === data.currentLocation.stationCode),
  );
  if (locIndex >= 0 && isReached(data.currentLocation?.status)) currentIndex = locIndex;

  const nextIndex = Math.min(currentIndex + 1, stops.length - 1);
  const standing = !isBehind(stops[currentIndex]!.status);
  // segmentProgress only arrives with real-time GPS; standing at a halt means no progress yet.
  const segmentProgress =
    locIndex === currentIndex && !standing
      ? clamp(data.currentLocation?.segmentProgress ?? 0, 0, 1)
      : 0;

  const currentKm = km[currentIndex]!;
  const nextKm = km[nextIndex]!;
  const distanceCovered = Math.round(currentKm + segmentProgress * Math.max(0, nextKm - currentKm));
  const progress = Math.round((clamp(distanceCovered / totalKm, 0, 1) * 1000)) / 10;

  const stationName = (stop: RailRadarStop) =>
    titleCase((stop.stationName ?? stop.stationCode ?? "Unknown").trim());

  const current = stops[currentIndex]!;
  const destination = stops[stops.length - 1]!;
  const origin = stops[0]!;
  // With `haltsOnly=true` RailRadar still injects the train's current position even when it is a
  // non-halt station, so previous/next must skip those pseudo-stops to name real halts.
  const isHaltStop = (stop: RailRadarStop) => stop.isHalt !== false;
  const next =
    stops.slice(currentIndex + 1).find(isHaltStop) ?? stops[nextIndex] ?? destination;
  const previous =
    stops
      .slice(0, currentIndex)
      .reverse()
      .find(isHaltStop) ?? origin;

  const delayMinutes = Math.max(
    0,
    Math.round(data.delayMinutes ?? current.delayDeparture ?? current.delayArrival ?? 0),
  );

  const expectedArrival =
    istTime(destination.actualArrival) ??
    istTime(destination.scheduledArrival, delayMinutes) ??
    istTime(destination.scheduledDeparture, delayMinutes) ??
    "--:--";

  const position = (() => {
    const a = current.lat != null && current.lng != null ? { lat: current.lat, lng: current.lng } : null;
    const b = next.lat != null && next.lng != null ? { lat: next.lat, lng: next.lng } : null;
    if (a && b) {
      return {
        lat: a.lat + (b.lat - a.lat) * segmentProgress,
        lng: a.lng + (b.lng - a.lng) * segmentProgress,
      };
    }
    return a ?? b;
  })();

  const number = (data.trainNumber ?? data.train?.number ?? trainNumber).toString();
  const name = titleCase((data.trainName ?? data.train?.name ?? `Train ${number}`).trim());
  const fromName = titleCase((data.train?.source?.name ?? stationName(origin)).trim());
  const toName = titleCase((data.train?.destination?.name ?? stationName(destination)).trim());

  // GPS speed when RailRadar has it; otherwise the timetable speed for the segment being run.
  // A train standing at a halt reads 0.
  const speed = Math.max(
    0,
    Math.round(
      data.currentLocation?.speedKmh ??
        (standing
          ? 0
          : (current.speedToNextStationKmph ?? data.train?.avgSpeed ?? 0)),
    ),
  );

  const status: TrainStatus = {
    trainNumber: number,
    trainName: name,
    from: fromName,
    fromCode: (data.train?.source?.code ?? origin.stationCode ?? "").toUpperCase(),
    to: toName,
    toCode: (data.train?.destination?.code ?? destination.stationCode ?? "").toUpperCase(),
    currentStation: stationName(current),
    previousStation: stationName(previous),
    nextStation:
      currentIndex === nextIndex
        ? stationName(destination)
        : stationName(next) ||
          titleCase((data.nextHalt?.stationName ?? data.nextHalt?.stationCode ?? "").trim()),
    speed,
    delayMinutes,
    expectedArrival,
    progress,
    distanceCovered,
    totalKm: Math.round(totalKm),
    position,
    updatedAt: Date.parse(data.lastUpdatedAt ?? "") || Date.now(),
    source: "live",
    notice: lifecycleNotice(data.status),
  };

  // The route visualization shows scheduled halts. Positional pseudo-stops are dropped here (they
  // already drive `distanceCovered`), and the marker sits on the last halt the train has reached.
  const haltStops = stops
    .map((stop, i) => ({ stop, km: km[i]! }))
    .filter(({ stop }) => stop.isHalt !== false);
  const routeStops = haltStops.length >= 2 ? haltStops : stops.map((stop, i) => ({ stop, km: km[i]! }));

  let routeIndex = 0;
  for (let i = 0; i < routeStops.length; i++) {
    if (routeStops[i]!.km <= distanceCovered) routeIndex = i;
  }

  const route: TrainRoute = {
    trainNumber: number,
    trainName: name,
    from: fromName,
    to: toName,
    totalKm: Math.round(totalKm),
    currentIndex: routeIndex,
    progress,
    stations: routeStops.map(({ stop, km: stopKm }, i) => ({
      name: stationName(stop),
      code: (stop.stationCode ?? "").toUpperCase(),
      km: Math.round(stopKm),
      scheduled:
        istTime(stop.actualArrival) ??
        istTime(stop.scheduledArrival) ??
        istTime(stop.scheduledDeparture) ??
        "--:--",
      status: i < routeIndex ? "passed" : i === routeIndex ? "current" : "upcoming",
    })),
    source: "live",
  };

  return { status, route };
}

/* --------------------------------------------------- cache + dead reckoning */

type CacheEntry = { snapshot: Snapshot; fetchedAt: number };

const cache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<CacheEntry>>();
/** Set after auth / rate-limit failures so we stop hammering a provider that is saying no. */
let cooldownUntil = 0;

/**
 * Advance a cached position by last known speed so the UI keeps moving smoothly between the
 * (much rarer) upstream refreshes. Never crosses the next halt — station changes only ever come
 * from real provider data, so announcements stay truthful.
 */
function project(entry: CacheEntry, now: number, notice: string | null = null): Snapshot {
  const { status, route } = entry.snapshot;
  const elapsedHours = Math.max(0, now - entry.fetchedAt) / 3_600_000;
  const nextKm = route.stations[Math.min(route.currentIndex + 1, route.stations.length - 1)]!.km;
  const ceilingKm = Math.max(status.distanceCovered, nextKm - 0.5);
  const distanceCovered = Math.round(
    clamp(status.distanceCovered + status.speed * elapsedHours, 0, Math.min(ceilingKm, status.totalKm)),
  );
  const progress = Math.round(clamp(distanceCovered / Math.max(status.totalKm, 1), 0, 1) * 1000) / 10;

  return {
    status: { ...status, distanceCovered, progress, notice: notice ?? status.notice },
    route: { ...route, progress },
  };
}

function withNotice(snapshot: Snapshot, notice: string): Snapshot {
  return { status: { ...snapshot.status, notice }, route: snapshot.route };
}

function noticeFor(kind: FailureKind): string {
  return kind === "not-found" ? NOTICE_NOT_FOUND : NOTICE_UNAVAILABLE;
}

async function loadLive(trainNumber: string): Promise<CacheEntry> {
  const existing = inflight.get(trainNumber);
  if (existing) return existing;

  const task = (async () => {
    const data = await fetchLive(trainNumber);
    const entry: CacheEntry = { snapshot: normalize(trainNumber, data), fetchedAt: Date.now() };
    cache.set(trainNumber, entry);
    return entry;
  })().finally(() => inflight.delete(trainNumber));

  inflight.set(trainNumber, task);
  return task;
}

/**
 * Current snapshot for a train number: live when a provider is configured and healthy, otherwise
 * the demo journey. Never throws and never leaks a provider error to the caller.
 */
async function getSnapshot(trainNumber: string): Promise<Snapshot> {
  if (!isLiveProviderConfigured()) return demoSnapshot(trainNumber);

  const now = Date.now();
  const cached = cache.get(trainNumber);
  if (cached && now - cached.fetchedAt < refreshMs()) return project(cached, now);

  // RailRadar only knows 5-digit numbers; anything else stays on demo data.
  if (!/^\d{5}$/.test(trainNumber)) return withNotice(demoSnapshot(trainNumber), NOTICE_NOT_FOUND);

  if (now < cooldownUntil) {
    return cached
      ? project(cached, now, NOTICE_STALE)
      : withNotice(demoSnapshot(trainNumber), NOTICE_UNAVAILABLE);
  }

  try {
    const entry = await loadLive(trainNumber);
    return project(entry, Date.now());
  } catch (error) {
    const kind = error instanceof ProviderFailure ? error.kind : "server";
    if (kind === "auth" || kind === "rate-limit") cooldownUntil = Date.now() + HARD_COOLDOWN_MS;
    // Safe, key-free diagnostics only.
    console.warn(`[trainApi] live lookup failed (${kind}) for ${trainNumber}`);
    return cached
      ? project(cached, now, NOTICE_STALE)
      : withNotice(demoSnapshot(trainNumber), noticeFor(kind));
  }
}

/** Live position, speed, delay and journey progress. */
export async function getTrainStatus(trainNumber: string): Promise<TrainStatus> {
  return (await getSnapshot(trainNumber)).status;
}

/** Ordered station list with passed / current / upcoming state for the route visualization. */
export async function getTrainRoute(trainNumber: string): Promise<TrainRoute> {
  return (await getSnapshot(trainNumber)).route;
}
