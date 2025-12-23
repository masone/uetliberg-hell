import type { IncomingMessage, ServerResponse } from "http";
import { isHell } from "..";

export default async function handler(
  _req: IncomingMessage,
  res: ServerResponse,
) {
  try {
    const result = await isHell();
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");    
    if(process.env.NODE_ENV === "production"){
      res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate");
    }
    res.end(JSON.stringify({ hell: result }));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: message }));
  }
}
