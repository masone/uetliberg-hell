import { describeWeatherConditions } from "./lib/weather-conditions";
import { latestWebcamMetadata, downloadImage, originalUrl } from "./lib/webcam";
import { getCache } from "./lib/cache";

const IMAGES_DIR = "images";

interface Status {
  clear: boolean;
  originalUrl: string;
}

export async function isHell(): Promise<Status> {
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
  return { clear: result.clear, originalUrl: originalUrl(metadata) };
}
