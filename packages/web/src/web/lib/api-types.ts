import type { InferRouterOutputs } from "@orpc/server";
import type { AppRouter } from "../../api";

/** Shared response types for the API, e.g. RouterOutputs["train"]["status"]. */
export type RouterOutputs = InferRouterOutputs<AppRouter>;
