import { handle } from "hono/vercel";
import app from "../src/api/index.js";

export default handle(app);
