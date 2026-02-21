import type { UserHome } from "../../users/userHome.js";
import type { AgentPromptFilesPaths } from "./agentPromptFilesEnsure.js";

/**
 * Resolves prompt file paths from a concrete user home.
 * Expects: userHome points to an initialized users/<id> directory.
 */
export function agentPromptPathsResolve(userHome: UserHome): AgentPromptFilesPaths {
    return userHome.knowledgePaths();
}
