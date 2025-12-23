import dotenv from "dotenv";
import type { IncomingMessage, ServerResponse } from "http";
import { isHell } from "..";

dotenv.config();

export default async function handler(
  _req: IncomingMessage,
  res: ServerResponse,
) {
  try {
    const result = await isHell();
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(result));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: message }));
  }
}
