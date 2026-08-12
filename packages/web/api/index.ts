import { handle } from "hono/vercel";
import app from "../src/api";

export default handle(app);
