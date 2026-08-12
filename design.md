# SAFAR — Design

An immersive single-page web experience: you open the site and you are sitting inside an Indian
train coach, looking down the aisle, listening to music while the journey moves around you.
Web only (desktop-first, fully responsive). Artistic / experimental-web feel — the supplied
train-interior painting is the hero and is never redesigned, only framed by minimal UI.

Reference atmosphere: minimalist experimental sites (saloon.wtf) + emotional warmth of Indian railways.
Original design, no cloning.

## Brand & Colors

CSS variables in `packages/web/src/web/styles.css` (single token set, warm dark).

| Token | Value | Use |
|-------|-------|-----|
| `--ink` | #16110E | Deepest charcoal — overlay backdrops |
| `--brown` | #2A1B12 | Deep brown — panel fills |
| `--cream` | #F4EBDD | Primary type on artwork |
| `--offwhite` | #FBF6EE | Highest-contrast type (song titles, numbers) |
| `--ember` | #D98A4B | Muted orange accent (active states, progress, current station) |
| `--rust` | #C9743A | Deeper accent, hover / borders |
| `--live` | #8CBE86 | Subtle green LIVE dot only |

Rules: no neon, no blue travel-app UI, no multi-stop gradients. Surfaces are `rgba(22,17,14,.55)`
with `backdrop-blur` and a 1px `rgba(244,235,221,.14)` hairline — glass used sparingly.
Readability comes from dark vignette + top/bottom scrims over the artwork, never from solid cards.

## Typography

- **Display**: Fraunces (editorial serif) — SAFAR wordmark, station names, overlay titles.
- **Body / UI**: Karla — labels in uppercase with `0.18em` tracking, small sizes (10–12px).
- Numerals (speed, delay, time) use Karla tabular-ish sizing for stability.

## Layout & Motion

- Full-viewport artwork (`object-cover`, center) + film grain overlay + slow 1.04 breathing scale
  and pointer parallax (max 12px translate) — never a "cheap moving background".
- UI anchored to the edges: brand top-left, nav top-right, floating player bottom-center,
  train ticker above the player. Centre of the frame (the aisle) stays clear.
- Motion library (`motion/react`): fade + slide-up reveals, blur-in overlays, staggered page load,
  pulsing current-station dot. Durations 0.4–0.9s, ease `[0.22, 1, 0.36, 1]`.
- **Journey Mode**: nav + brand fade out, player collapses to a slim bar, only station
  announcements ("Now passing Balasore" → "Next stop: Kharagpur") drift in and out.

## Pages & Components

- **Web — Home** (`src/web/pages/index.tsx`) — the whole experience, one page.
- `components/hero-scene.tsx` — artwork, grain, parallax, scrims.
- `components/navigation.tsx` — SAFAR + tagline, TRAIN / MUSIC / ABOUT.
- `components/music-player.tsx` — art, title, artist, prev/play/next, progress + times, volume,
  playlist; compact bottom sheet on mobile.
- `components/train-tracker.tsx` — full-screen overlay: train number input, live status, progress.
- `components/train-route.tsx` — stylized vertical railway route, pulsing "YOU ARE HERE".
- `components/journey-ticker.tsx` — "LISTENING WHILE TRAVELLING" + "Somewhere between A and B".
- `components/about-overlay.tsx` — one-paragraph minimal overlay.
- `hooks/use-audio.ts` — real `<audio>` playback over demo tracks in `public/audio/`.

## Key User Flows

1. Open → artwork fades in → minimal UI reveals → user plays a demo track from the floating player.
2. TRACK MY TRAIN / TRAIN → overlay → enter a train number (e.g. 18402) → live status + route.
3. Toggle JOURNEY MODE → UI recedes, station announcements appear as the train advances.

## Architecture

- **Train data is server-side**: `src/api/services/trainApi.ts` exposes `getTrainStatus(trainNumber)`
  and `getTrainRoute(trainNumber)`. Live data comes from RailRadar
  (`GET {TRAIN_API_URL}/v1/trains/{number}/live`, https://railradar.in/docs) whenever
  `TRAIN_API_KEY` is set in the root `.env`; without it — or on any provider failure — it returns
  the demo journeys in `src/api/data/mock-trains.ts`. No API logic and no keys ever live in UI
  components, and the env vars are deliberately *not* `VITE_`-prefixed so they stay on the server.
- **Normalized model**: RailRadar's payload is parsed only inside `trainApi.ts` and mapped to our
  own `TrainStatus` / `TrainRoute` types (station names, km, delay, speed, ETA, progress,
  coordinates, `source: "live" | "demo"`, plus a user-safe `notice`). The UI never sees provider
  fields, so swapping providers touches one file.
- **Refresh budget**: RailRadar's free tier is ~50 requests/day, so the server caches each train's
  snapshot for `TRAIN_STATUS_REFRESH_MS` (default 120000) and de-duplicates concurrent calls.
  Between refreshes the position is advanced by dead reckoning (last known speed × elapsed time,
  never past the next halt), so the UI can keep animating without extra upstream traffic. After an
  auth or rate-limit error the service backs off for 10 minutes.
- **Transport**: oRPC procedures in `src/api/routes/train.ts` (`train.status`, `train.route`,
  `train.provider`), consumed through hooks in `src/web/queries/train.ts`. The UI polls our own
  server every 5s (route every 15s) — that is a UI tick, not a provider call.
- **Verification**: `bun scripts/check-train-api.ts` runs the service against a local RailRadar
  stub — demo mode, live normalization, caching, 401/404/429/500, malformed bodies, timeouts.
- Songs are static demo data in `src/web/data/songs.ts` (generated royalty-free instrumentals).
