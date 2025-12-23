import https from "https";
import fs from "fs";
import path from "path";

const BASE_URL = "https://storage2.roundshot.com/53aacd05e65407.10715840";
const IMAGES_DIR = "images";

// Ensure images directory exists
if (!fs.existsSync(IMAGES_DIR)) {
  fs.mkdirSync(IMAGES_DIR, { recursive: true });
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
  filename: string;
} {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");

  return {
    date: `${year}-${month}-${day}`,
    time: `${hours}-${minutes}-00`,
    filename: `${year}-${month}-${day}-${hours}-${minutes}-00_oneeighth.jpg`,
  };
}

function downloadFile(url: string, filepath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(filepath);

    https
      .get(url, (response) => {
        if (response.statusCode === 200) {
          response.pipe(file);
          file.on("finish", () => {
            file.close();
            resolve();
          });
        } else {
          file.close();
          if (fs.existsSync(filepath)) {
            fs.unlinkSync(filepath);
          }
          reject(new Error(`HTTP ${response.statusCode}`));
        }
      })
      .on("error", (err) => {
        file.close();
        if (fs.existsSync(filepath)) {
          fs.unlinkSync(filepath);
        }
        reject(err);
      });
  });
}

async function fetchLatestWebcam(): Promise<string | null> {
  const now = new Date();
  const currentTime = roundTo20Minutes(now);
  const { date, time, filename } = formatDateTime(currentTime);
  const url = `${BASE_URL}/${date}/${time}/${filename}`;

  console.log(
    `Downloading latest interval: ${date} ${time.replace(/-/g, ":")}...`,
  );

  const filepath = path.join(IMAGES_DIR, filename);

  try {
    await downloadFile(url, filepath);
    console.log(`✓ Successfully downloaded to ${filepath}`);
    return filepath;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Error downloading: ${message}`);
    return null;
  }
}

fetchLatestWebcam().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
