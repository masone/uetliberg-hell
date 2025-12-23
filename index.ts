import path from "path";
import { existsSync, writeFileSync, readFileSync } from "fs";
import { describeWeatherConditions } from "./lib/weather-conditions";
import { latestWebcamMetadata, downloadImage } from "./lib/webcam";

const IMAGES_DIR = "images";

export async function isHell(): Promise<boolean> {
  const metadata = await latestWebcamMetadata();
  const filepath = path.join(IMAGES_DIR, metadata.filename);
  const buffer = await getCache(filepath, () => downloadImage(metadata));

  const resultCachePath = path.join(
    IMAGES_DIR,
    `result-${metadata.timestamp}.json`,
  );

  const resultJson = await getCache(resultCachePath, async () => {
    const res = await describeWeatherConditions(buffer);
    return JSON.stringify(res);
  });
  const result = JSON.parse(resultJson.toString());

  console.log({ metadata, filepath, result });
  return result.clear;
}

async function getCache(
  filepath: string,
  fetchFn: () => Promise<Buffer | string>,
): Promise<Buffer> {
  if (existsSync(filepath)) {
    console.log(`Reading from cache: ${filepath}`);
    return readFileSync(filepath);
  }

  console.log(`Fetching new data: ${filepath}`);
  const data = await fetchFn();
  writeFileSync(filepath, data);
  return Buffer.from(data);
}
