import { describeWeatherConditions } from "./lib/weather-conditions";
import { latestWebcamMetadata, downloadImage } from "./lib/webcam";
import { getCache } from "./lib/cache";

const IMAGES_DIR = "images";

export async function isHell(): Promise<boolean> {
  const metadata = await latestWebcamMetadata();
  const filepath = `${IMAGES_DIR}/${metadata.filename}`;
  const buffer = await getCache(filepath, () => downloadImage(metadata));

  const resultCachePath = `${IMAGES_DIR}/result-${metadata.timestamp}.json`;

  const resultJson = await getCache(resultCachePath, async () => {
    const res = await describeWeatherConditions(buffer);
    return JSON.stringify(res);
  });
  const result = JSON.parse(resultJson.toString());

  console.log({ metadata, filepath, result });
  return result.clear;
}
