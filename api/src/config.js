import dotenv from "dotenv";
import { fileURLToPath } from "node:url";

dotenv.config({ path: fileURLToPath(new URL("../.env", import.meta.url)) });

const port = Number(process.env.PORT ?? 3000);
const jwtSecret = process.env.JWT_SECRET;

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("PORT must be an integer between 1 and 65535.");
}

if (!jwtSecret || jwtSecret.length < 32) {
  throw new Error("Set JWT_SECRET to a secret of at least 32 characters.");
}

export const config = { port, jwtSecret };
