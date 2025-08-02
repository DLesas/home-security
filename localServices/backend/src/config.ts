import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

// Only load .env file when not running in Docker
if (!process.env.DOCKER_ENV) {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);

  const envPath = path.resolve(__dirname, "../../.env");
  console.log("Attempting to load .env file from:", envPath);

  const result = dotenv.config({ path: envPath });

  if (result.error) {
    console.error("Error loading .env file:", result.error);
  } else {
    console.log(".env file loaded successfully");
  }
} else {
  console.log(
    "Running in Docker environment - using environment variables from Docker Compose"
  );
}

// Debug: Log current environment variables (you can remove this later)
console.log("POSTGRES_USER:", process.env.POSTGRES_USER);
console.log("POSTGRES_HOST:", process.env.POSTGRES_HOST);
console.log("POSTGRES_DB:", process.env.POSTGRES_DB);

// Alarm cooldown configuration
export const ALARM_COOLDOWN_SECONDS = parseInt(
  process.env.ALARM_COOLDOWN_SECONDS || "30",
  10
);
console.log("ALARM_COOLDOWN_SECONDS:", ALARM_COOLDOWN_SECONDS);
