/**
 * Registry for tracking proxied permission requests from background agents.
 * When a background agent requests permission via a foreground agent,
 * the token is registered here so the decision can be routed back correctly.
 */
export class PendingPermissionProxy {
  private entries = new Map<string, string>();

  /**
   * Registers a proxied permission request.
   * Expects: token is unique (cuid2); backgroundAgentId is valid agent id.
   */
  register(token: string, backgroundAgentId: string): void {
    this.entries.set(token, backgroundAgentId);
  }

  /**
   * Resolves a token to its background agent id if proxied.
   * Returns null if the token was not proxied.
   */
  resolve(token: string): string | null {
    return this.entries.get(token) ?? null;
  }

  /**
   * Removes a resolved token from the registry.
   * Called after the decision has been routed.
   */
  remove(token: string): void {
    this.entries.delete(token);
  }
}
