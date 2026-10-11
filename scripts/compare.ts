// Compares the production model (OpenAI Decisions API) against the legacy
// gpt-4o prompt on every production frame cached in the blob store.
//
//   npm run compare                  # all cached frames
//   npm run compare -- 10            # first 10 frames only
//   npm run compare -- --reuse-gpt4o # keep gpt-4o verdicts from the last run
//
// Scores every model against scripts/labels.json (hand-reviewed frames,
// keyed by timestamp). Frames without a label fall back to the verdict
// stored by production at the time. Writes comparison/results.json.
import dotenv from "dotenv";
import fs from "fs";
import { list } from "@vercel/blob";
import {
  describeWeatherConditions,
  FOG_THRESHOLD,
  verdict,
} from "../lib/weather-conditions";
import { formatDateTime } from "../lib/webcam";
import { describeWithGpt4o } from "./gpt4o";
import labels from "./labels.json";

dotenv.config();

const SUN_THRESHOLDS = [0.5, 0.6, 0.7, 0.75, 0.8, 0.85, 0.9];
const CONCURRENCY = 4;
const OUT_DIR = "comparison";

interface Verdict {
  fogClear: boolean;
  sunshine: boolean;
  clear: boolean;
}

interface Row {
  image: string;
  url: string;
  stored: Verdict;
  gpt4o?: Verdict & { ms: number };
  // pFog/pSun are null when the Decisions API refused to answer that question
  decisions?: Verdict & {
    ms: number;
    pFog: number | null;
    pSun: number | null;
  };
  error?: string;
}

async function timed<T>(fn: () => Promise<T>): Promise<T & { ms: number }> {
  const started = Date.now();
  const result = await fn();
  return { ...result, ms: Date.now() - started };
}

async function loadDataset() {
  const { blobs } = await list({ prefix: "production/images/", limit: 1000 });
  const images = blobs.filter((b) => b.pathname.endsWith(".jpg"));
  const pairs = [];
  for (const result of blobs.filter((b) => b.pathname.includes("/result-"))) {
    const timestamp = Number(result.pathname.match(/result-(\d+)\.json$/)?.[1]);
    const prefix = formatDateTime(new Date(timestamp)).filename.replace(
      /_half\.jpg$/,
      "",
    );
    const image = images.find((b) =>
      b.pathname.split("/").pop()!.startsWith(prefix),
    );
    if (image) pairs.push({ result, image });
  }
  return pairs.sort((a, b) => a.image.pathname.localeCompare(b.image.pathname));
}

async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
) {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: limit }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i]);
      }
    }),
  );
  return out;
}

const fmt = (p: number | null) => (p === null ? "refused" : p.toFixed(2));

const labelOf = (image: string): boolean | undefined =>
  (labels as Record<string, boolean>)[image.replace(/_[a-z]+\.jpg$/, "")];

function summarize(rows: Row[]) {
  const done = rows.filter((r) => r.gpt4o && r.decisions);
  const truth = (r: Row) => labelOf(r.image) ?? r.stored.clear;
  const labeled = done.filter((r) => labelOf(r.image) !== undefined);
  const avg = (xs: number[]) =>
    Math.round(xs.reduce((s, x) => s + x, 0) / xs.length);

  const score = (predict: (r: Row) => boolean) => {
    const tally = (set: Row[]) => {
      const fp = set.filter((r) => predict(r) && !truth(r)).length;
      const fn = set.filter((r) => !predict(r) && truth(r)).length;
      return `${set.length - fp - fn}/${set.length} (fp ${fp}, fn ${fn})`;
    };
    return { "all frames": tally(done), "hand-labeled": tally(labeled) };
  };

  console.log(
    `\nFrames: ${rows.length}, completed: ${done.length}, errors: ${rows.length - done.length}, ` +
      `hand-labeled: ${labeled.length}, hell: ${done.filter(truth).length}`,
  );
  console.table({
    "stored verdict": score((r) => r.stored.clear),
    "gpt-4o": score((r) => r.gpt4o!.clear),
    ...Object.fromEntries(
      SUN_THRESHOLDS.map((t) => [
        `decisions sun>=${t}`,
        score((r) => verdict(r.decisions!.pFog, r.decisions!.pSun, t).clear),
      ]),
    ),
  });

  const refusals = done.filter(
    (r) => r.decisions!.pFog === null || r.decisions!.pSun === null,
  );
  console.log(
    `Decisions refusals (counted as false): ${refusals.map((r) => r.image).join(", ") || "none"}`,
  );
  console.log(
    `Avg latency: gpt-4o ${avg(done.map((r) => r.gpt4o!.ms))} ms, ` +
      `decisions ${avg(done.map((r) => r.decisions!.ms))} ms`,
  );

  // The frames that decide where the sunshine threshold goes
  const fogClear = done.filter(
    (r) => (r.decisions!.pFog ?? 0) >= FOG_THRESHOLD,
  );
  const spread = (hell: boolean) =>
    fogClear
      .filter((r) => truth(r) === hell)
      .map((r) => r.decisions!.pSun ?? 0)
      .sort((a, b) => a - b)
      .map(fmt)
      .join(" ");
  console.log(
    `Sunshine probability, fog-clear frames:\n` +
      `  hell:     ${spread(true)}\n` +
      `  not hell: ${spread(false)}`,
  );
}

async function run() {
  const args = process.argv.slice(2);
  const limit = Number(args.find((a) => /^\d+$/.test(a))) || Infinity;
  const previous: Row[] = args.includes("--reuse-gpt4o")
    ? JSON.parse(fs.readFileSync(`${OUT_DIR}/results.json`, "utf8"))
    : [];
  const pairs = (await loadDataset()).slice(0, limit);
  console.log(`Comparing ${pairs.length} frames...`);

  const rows = await mapLimit(pairs, CONCURRENCY, async ({ result, image }) => {
    const row: Row = {
      image: image.pathname.split("/").pop()!,
      url: image.url,
      stored: await (await fetch(result.url)).json(),
    };
    try {
      const buffer = Buffer.from(await (await fetch(image.url)).arrayBuffer());
      const cached = previous.find((p) => p.image === row.image)?.gpt4o;
      [row.gpt4o, row.decisions] = await Promise.all([
        cached ?? timed(() => describeWithGpt4o(buffer)),
        timed(() => describeWeatherConditions(buffer)),
      ]);
    } catch (err) {
      row.error = err instanceof Error ? err.message : String(err);
      console.error(`  ${row.image}: ${row.error}`);
    }
    process.stdout.write(".");
    return row;
  });

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(`${OUT_DIR}/results.json`, JSON.stringify(rows, null, 2));
  summarize(rows);
  console.log(`\nFull results: ${OUT_DIR}/results.json`);
}

run();
