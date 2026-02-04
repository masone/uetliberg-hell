const BASE_URL = "https://storage2.roundshot.com/53aacd05e65407.10715840";
import sharp from "sharp";

export interface WebcamMetadata {
  date: string;
  time: string;
  filename: string;
  timestamp: number;
  nextUpdate: number;
}

function roundTo20Minutes(date: Date): Date {
  const minutes = date.getMinutes();
  const roundedMinutes = Math.floor(minutes / 20) * 20;
  const rounded = new Date(date);
  rounded.setMinutes(roundedMinutes, 0, 0);
  return rounded;
}

function formatDateTime(date: Date): {
  date: string;
  time: string;
  timestamp: number;
  filename: string;
} {
  // Use Zurich time explicitly
  const formatter = new Intl.DateTimeFormat("de-CH", {
    timeZone: "Europe/Zurich",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const getPart = (type: string) =>
    parts.find((p) => p.type === type)?.value || "";

  const year = getPart("year");
  const month = getPart("month");
  const day = getPart("day");
  const hours = getPart("hour");
  const minutes = getPart("minute");

  return {
    date: `${year}-${month}-${day}`,
    time: `${hours}-${minutes}-00`,
    timestamp: date.getTime(),
    filename: `${year}-${month}-${day}-${hours}-${minutes}-00_oneeighth.jpg`,
  };
}

export function originalUrl(metadata: WebcamMetadata): string {
  const { date, time, filename } = metadata;
  return `${BASE_URL}/${date}/${time}/${filename}`;
}

export async function downloadImage(metadata: WebcamMetadata): Promise<Buffer> {
  const url = originalUrl(metadata);
  const response = await fetch(url);

  if (!response.ok) {
    console.log(`Failed to download image`, { url, response });
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  
  // Get image metadata to calculate crop properly
  const image = sharp(buffer);
  const metadata_info = await image.metadata();
  
  if (!metadata_info.width || !metadata_info.height) {
    throw new Error("Unable to read image dimensions");
  }
  
  // Remove leftmost 500px and rightmost 90px, then compress
  const cropLeft = 500;
  const cropRight = 90;
  const cropWidth = metadata_info.width - cropLeft - cropRight;
  return await sharp(buffer)
    .extract({ left: cropLeft, top: 0, width: cropWidth, height: metadata_info.height })
    .jpeg({ quality: 70, progressive: true }) // Compress JPEG
    .toBuffer();
}

export async function latestWebcamMetadata(): Promise<WebcamMetadata> {
  const now = new Date();
  // 5 minute grace period for image upload
  const gracePeriod = 5 * 60 * 1000;
  const adjustedNow = new Date(now.getTime() - gracePeriod);
  const currentTime = roundTo20Minutes(adjustedNow);
  const { date, time, filename, timestamp } = formatDateTime(currentTime);

  console.log(
    `Downloading latest interval: ${date} ${time.replace(/-/g, ":")}...`,
  );

  // The next image is available 20 minutes after the current one + grace period
  const nextUpdate = timestamp + 20 * 60 * 1000 + gracePeriod;

  return { date, time, filename, timestamp, nextUpdate };
}
