import type { AgentHistoryRecord, Config } from "@/types";

import { contextEstimateTokens } from "./contextEstimateTokens.js";

const DEFAULT_EMERGENCY_CONTEXT_LIMIT = 200_000;

/**
 * Checks if the current history exceeds the emergency context limit.
 * Expects: config.settings.agents.emergencyContextLimit is a positive integer when set.
 */
export function contextNeedsEmergencyReset(
  config: Config,
  history: AgentHistoryRecord[]
): boolean {
  const limit = resolveEmergencyContextLimit(config);
  return contextEstimateTokens(history) >= limit;
}

function resolveEmergencyContextLimit(config: Config): number {
  const configured = config.settings.agents?.emergencyContextLimit;
  if (typeof configured === "number" && Number.isFinite(configured) && configured > 0) {
    return configured;
  }
  return DEFAULT_EMERGENCY_CONTEXT_LIMIT;
}
