import { time } from "console";

const BASE_URL = "https://storage2.roundshot.com/53aacd05e65407.10715840";

export interface WebcamMetadata {
  date: string;
  time: string;
  filename: string;
  timestamp: number;
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
  const getPart = (type: string) => parts.find((p) => p.type === type)?.value || "";

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
  return Buffer.from(arrayBuffer);
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

  return { date, time, filename, timestamp };
}
