import dotenv from "dotenv";
import { isHell } from "../index.js";

dotenv.config();

async function run() {
  console.log("Checking if it's hell...");
  const result = await isHell();
  console.log({ result });
}

run();
