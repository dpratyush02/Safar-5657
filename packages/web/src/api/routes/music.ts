import { z } from "zod";
import { base } from "../__core/app.js";
import {
  ONBOARD_TRACKS,
  musicProviderInfo,
  searchMusic,
} from "../services/youtubeApi.js";

export const music = {
  /**
   * Search YouTube for music. The API key stays on the server; only normalized
   * metadata reaches the browser.
   */
  search: base
    .input(
      z.object({
        query: z.string().trim().min(1, "Type something to search").max(120),
      }),
    )
    .handler(({ input }) => searchMusic(input.query)),

  /** Whether YouTube search is configured on the server. */
  provider: base.handler(() => musicProviderInfo()),

  /** Onboard royalty-free tracks used as the fallback playlist. */
  onboard: base.handler(() => ({ tracks: [...ONBOARD_TRACKS] })),
};
