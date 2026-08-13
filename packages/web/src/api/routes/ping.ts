import { base } from "../__core/app.js";

export const ping = base.handler(() => ({ message: `Pong! ${Date.now()}` }));
