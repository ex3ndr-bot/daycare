import type { AssistantMessage } from "@mariozechner/pi-ai";
import { describe, expect, it, vi } from "vitest";

import type { InferenceRouter } from "../modules/inference/router.js";
import { appToolReview } from "./appToolReview.js";

describe("appToolReview", () => {
  it("returns allowed=true for ALLOW response", async () => {
    const review = await appToolReview({
      appId: "github-reviewer",
      appName: "GitHub Reviewer",
      sourceIntent: "Review pull requests safely.",
      toolCall: { id: "t1", name: "read", type: "toolCall", arguments: { path: "/tmp/file" } },
      rules: { allow: [], deny: [] },
      inferenceRouter: inferenceRouterBuild(assistantMessageBuild("ALLOW"))
    });

    expect(review).toEqual({ allowed: true });
  });

  it("returns denied with reason for DENY response", async () => {
    const review = await appToolReview({
      appId: "github-reviewer",
      appName: "GitHub Reviewer",
      sourceIntent: "Review pull requests safely.",
      toolCall: { id: "t1", name: "exec", type: "toolCall", arguments: { command: "rm -rf ." } },
      rules: { allow: [], deny: [] },
      inferenceRouter: inferenceRouterBuild(assistantMessageBuild("DENY: destructive command"))
    });

    expect(review).toEqual({ allowed: false, reason: "destructive command" });
  });

  it("denies malformed responses", async () => {
    const review = await appToolReview({
      appId: "github-reviewer",
      appName: "GitHub Reviewer",
      sourceIntent: "Review pull requests safely.",
      toolCall: { id: "t1", name: "exec", type: "toolCall", arguments: { command: "echo ok" } },
      rules: { allow: [], deny: [] },
      inferenceRouter: inferenceRouterBuild(assistantMessageBuild("maybe"))
    });

    expect(review.allowed).toBe(false);
    expect(review.reason).toContain("invalid decision");
  });
});

function inferenceRouterBuild(message: AssistantMessage): InferenceRouter {
  return {
    complete: vi.fn(async () => ({
      message,
      providerId: "provider-1",
      modelId: "model-1"
    }))
  } as unknown as InferenceRouter;
}

function assistantMessageBuild(text: string): AssistantMessage {
  return {
    role: "assistant",
    content: [{ type: "text", text }],
    api: "openai-responses",
    provider: "test-provider",
    model: "test-model",
    usage: {
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
      totalTokens: 0,
      cost: {
        input: 0,
        output: 0,
        cacheRead: 0,
        cacheWrite: 0,
        total: 0
      }
    },
    stopReason: "stop",
    timestamp: Date.now()
  };
}
