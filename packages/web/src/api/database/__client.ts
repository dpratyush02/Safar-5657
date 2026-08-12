// TEMPLATE-MANAGED (__ prefix) — do not edit. Define tables in ./schema.ts
// and query via: import { db } from "./database";
import { drizzle } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";
import * as schema from "./schema";

const dbUrl = typeof process !== "undefined" && process?.env?.DATABASE_URL ? process.env.DATABASE_URL : "file:local.db";
const authToken = typeof process !== "undefined" && process?.env?.DATABASE_AUTH_TOKEN ? process.env.DATABASE_AUTH_TOKEN : undefined;

const client = createClient({
  url: dbUrl,
  authToken,
});

export const db = drizzle(client, { schema });
