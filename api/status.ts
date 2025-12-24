import type { IncomingMessage, ServerResponse } from "http";
import { isHell } from "..";

export default async function handler(
  _req: IncomingMessage,
  res: ServerResponse,
) {
  try {
    const { clear, originalUrl, nextUpdate } = await isHell();
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");
    // Vercel Edge Cache requires s-maxage to cache content
    const now = Date.now();
    const maxAge = Math.max(0, Math.ceil((nextUpdate - now) / 1000));
    res.setHeader("Cache-Control", `public, s-maxage=${maxAge}`);
    res.end(JSON.stringify({ hell: clear, proof: originalUrl }));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: message }));
  }
}
