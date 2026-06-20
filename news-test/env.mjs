// Synchronously load ../demo/.env into process.env (without overwriting values
// already set in the real environment). Imported FIRST so downstream modules
// see the keys at evaluation time.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

try {
  const env = readFileSync(join(__dirname, "..", "demo", ".env"), "utf8");
  for (const line of env.split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].trim();
  }
} catch {
  /* no demo/.env — rely on the real environment */
}
