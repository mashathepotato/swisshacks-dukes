import path from "path";

// Compiled file lives in demo/dist/... or is run via ts-node from src/backend/data.
// DATA_DIR overrides; default points at the repo-root data/ folder.
export function dataDir(): string {
  if (process.env.DATA_DIR) return process.env.DATA_DIR;
  return path.resolve(__dirname, "../../../../data");
}

export function frozenDir(): string {
  return path.resolve(__dirname, "frozen");
}
