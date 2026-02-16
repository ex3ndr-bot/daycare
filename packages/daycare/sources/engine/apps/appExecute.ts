import { createId } from "@paralleldrive/cuid2";

import type { ToolExecutionContext } from "@/types";
import { agentStateRead } from "../agents/ops/agentStateRead.js";
import { agentStateWrite } from "../agents/ops/agentStateWrite.js";
import type { AppDescriptor } from "./appTypes.js";
import { appPermissionBuild } from "./appPermissionBuild.js";
import { appReviewProvidersResolve } from "./appReviewProvidersResolve.js";
import { appToolExecutorBuild } from "./appToolExecutorBuild.js";

type AppExecuteInput = {
  app: AppDescriptor;
  prompt: string;
  context: ToolExecutionContext;
};

/**
 * Executes an app as a one-shot subagent with reviewed tool access.
 * Expects: app descriptor is discovered/validated; prompt is non-empty.
 */
export async function appExecute(input: AppExecuteInput): Promise<string | null> {
  const agentSystem = input.context.agentSystem;
  const config = agentSystem.config.current;
  const appPermissions = await appPermissionBuild(config.workspaceDir, input.app.id);

  const descriptor = {
    type: "subagent" as const,
    id: createId(),
    parentAgentId: input.context.agent.id,
    name: `app:${input.app.id}`,
    systemPrompt: input.app.manifest.systemPrompt,
    appId: input.app.id
  };

  const agentId = await agentSystem.agentIdForTarget({ descriptor });
  const state = await agentStateRead(config, agentId);
  if (!state) {
    throw new Error(`App subagent state not found: ${agentId}`);
  }
  const updatedAt = Date.now();
  const nextState = {
    ...state,
    permissions: appPermissions,
    updatedAt
  };
  await agentStateWrite(config, agentId, nextState);
  agentSystem.updateAgentPermissions(agentId, appPermissions, updatedAt);

  const reviewProviders = appReviewProvidersResolve(config, input.app.manifest.model);
  const reviewedExecutor = appToolExecutorBuild({
    appId: input.app.id,
    appName: input.app.manifest.name,
    sourceIntent: input.app.permissions.sourceIntent,
    rules: input.app.permissions.rules,
    inferenceRouter: agentSystem.inferenceRouter,
    toolResolver: agentSystem.toolResolver,
    providersOverride: reviewProviders
  });

  const result = await agentSystem.postAndAwait(
    { agentId },
    {
      type: "message",
      message: { text: input.prompt },
      context: {},
      toolResolverOverride: reviewedExecutor
    }
  );
  if (result.type !== "message") {
    return null;
  }
  return result.responseText;
}
