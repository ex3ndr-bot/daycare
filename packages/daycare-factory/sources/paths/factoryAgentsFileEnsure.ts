import { stat } from "node:fs/promises";

/**
 * Validates that AGENTS.md exists and is a file.
 * Expects: agentsFilePath points to the environment instruction file for the build.
 */
export async function factoryAgentsFileEnsure(
  agentsFilePath: string
): Promise<void> {
  let agentsFileStat;
  try {
    agentsFileStat = await stat(agentsFilePath);
  } catch {
    throw new Error(`AGENTS.md not found at ${agentsFilePath}`);
  }

  if (!agentsFileStat.isFile()) {
    throw new Error(`AGENTS.md is not a file: ${agentsFilePath}`);
  }
}
