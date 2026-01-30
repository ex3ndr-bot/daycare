import { promises as fs } from "node:fs";
import path from "node:path";

const DEFAULT_SOCKET_PATH = ".scout/scout.sock";

function resolveWorkspaceRoot(rootDir: string) {
  const parent = path.resolve(rootDir, "..");
  if (path.basename(parent) === "packages") {
    return path.resolve(parent, "..");
  }
  return rootDir;
}

async function pathExists(targetPath: string) {
  try {
    await fs.stat(targetPath);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return false;
    }
    throw error;
  }
}

export async function resolveSocketPath() {
  const override = process.env.SCOUT_ENGINE_SOCKET;
  if (override) {
    return path.resolve(override);
  }

  const rootDir = process.cwd();
  const workspaceRoot = resolveWorkspaceRoot(rootDir);
  const candidates = [
    path.resolve(process.cwd(), DEFAULT_SOCKET_PATH),
    path.resolve(rootDir, DEFAULT_SOCKET_PATH),
    path.resolve(workspaceRoot, DEFAULT_SOCKET_PATH),
    path.resolve(workspaceRoot, "packages", "gram", DEFAULT_SOCKET_PATH)
  ];

  for (const candidate of candidates) {
    if (await pathExists(candidate)) {
      return candidate;
    }
  }

  return candidates[0];
}
