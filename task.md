# SAFAR — build scratchpad

App at /home/user/safar (managed template). Web only, port 4200.

## Done
- app_init, motion installed
- assets: public/images/train-interior.jpg (hero, untouched artwork), art-*.png (album art cropped from artwork), public/audio/*.mp3 (3 generated royalty-free instrumentals)
- design.md written
- API: data/mock-trains.ts, services/trainApi.ts (RailRadar /v1/trains/{n}/live -> normalized TrainStatus/TrainRoute, cached TRAIN_STATUS_REFRESH_MS + dead reckoning, demo fallback on missing key/any failure), routes/train.ts (status/route/provider), composed in api/index.ts
- .env + .env.template: TRAIN_API_URL=https://api.railradar.in, TRAIN_API_KEY (empty -> demo), TRAIN_STATUS_REFRESH_MS=120000 (server-side only, no VITE_)
- scripts/check-train-api.ts: 45-check harness against a stub RailRadar (all passing)
- styles.css: warm palette tokens, Fraunces + Karla, grain/breathe/pulse/rail utilities
- index.html meta + preload
- web: data/songs.ts, hooks/use-audio.ts, hooks/use-journey-announcements.ts, queries/train.ts, lib/api-types.ts
- components: hero-scene, navigation, train-route, music-player

## Next
- components: train-tracker (overlay), about-overlay, journey announcement layer
- pages/index.tsx orchestration (overlay state, journey mode, track-my-train button)
- bun run build + lint, start dev on 4200, verify with screenshots, deliver

## Final verification (Aug 11)
- Playwright: 0 console/page errors on desktop + mobile, journey mode announcements confirmed.
- Mobile nav now horizontal row + journey pill; tagline hidden < sm; "Track my train" at top-36.
- `bun run build` clean; dev server on 4200; /api/rpc/train/status verified for 12951 + 18402.
- Delivered as website artifact.
