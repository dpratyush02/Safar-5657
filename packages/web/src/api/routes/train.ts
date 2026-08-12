import { z } from "zod";
import { base } from "../__core/app";
import { getTrainRoute, getTrainStatus, providerInfo } from "../services/trainApi";

const trainNumberInput = z.object({
  trainNumber: z
    .string()
    .trim()
    .regex(/^\d{4,6}$/, "Enter a 4–6 digit train number"),
});

export const train = {
  /** Live position, speed, delay and journey progress for a train number. */
  status: base
    .input(trainNumberInput)
    .handler(({ input }) => getTrainStatus(input.trainNumber)),

  /** Ordered station list with passed / current / upcoming state. */
  route: base
    .input(trainNumberInput)
    .handler(({ input }) => getTrainRoute(input.trainNumber)),

  /** Whether a live provider is wired up, plus how often the server may refresh from it. */
  provider: base.handler(() => providerInfo()),
};
