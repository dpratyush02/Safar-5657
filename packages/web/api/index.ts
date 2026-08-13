import app from "../src/api/index.js";

async function toWebRequest(req: any): Promise<Request> {
  const host = req.headers["x-forwarded-host"] || req.headers.host || "localhost";
  const proto = req.headers["x-forwarded-proto"] || "https";
  const url = new URL(req.url || "/", `${proto}://${host}`);

  const headers = new Headers();
  const FORBIDDEN = new Set(["host", "connection", "transfer-encoding", "content-length"]);
  for (const [key, val] of Object.entries(req.headers)) {
    if (!val || FORBIDDEN.has(key.toLowerCase())) continue;
    if (Array.isArray(val)) {
      for (const v of val) headers.append(key, v);
    } else {
      headers.set(key, val as string);
    }
  }

  const hasBody = req.method !== "GET" && req.method !== "HEAD";
  let body: Uint8Array | undefined = undefined;
  if (hasBody) {
    const chunks: Uint8Array[] = [];
    for await (const chunk of req) {
      chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
    }
    body = Buffer.concat(chunks);
  }

  return new Request(url.toString(), {
    method: req.method,
    headers,
    body: hasBody ? body : undefined,
  });
}

export default async function handler(req: any, res: any) {
  try {
    const webReq = await toWebRequest(req);
    const webRes = await app.fetch(webReq);

    res.statusCode = webRes.status;
    webRes.headers.forEach((value: string, key: string) => {
      if (key.toLowerCase() !== "set-cookie") {
        res.setHeader(key, value);
      }
    });

    const setCookies = webRes.headers.getSetCookie?.();
    if (setCookies?.length) {
      res.setHeader("set-cookie", setCookies);
    }

    const arrayBuffer = await webRes.arrayBuffer();
    res.end(Buffer.from(arrayBuffer));
  } catch (err: any) {
    console.error("[Vercel Handler Error]:", err);
    res.statusCode = 500;
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ error: err?.message || String(err), stack: err?.stack }));
  }
}
