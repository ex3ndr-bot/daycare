import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { agentSystemPrompt } from "./agentSystemPrompt.js";

describe("agentSystemPrompt", () => {
  it("returns the replacement prompt when enabled", async () => {
    const rendered = await agentSystemPrompt({
      replaceSystemPrompt: true,
      agentPrompt: "  custom prompt  "
    });

    expect(rendered).toBe("custom prompt");
  });

  it("throws when replacement is enabled but prompt is empty", async () => {
    await expect(
      agentSystemPrompt({
        replaceSystemPrompt: true,
        agentPrompt: "  "
      })
    ).rejects.toThrow("System prompt replacement requires a non-empty agent prompt.");
  });

  it("renders the bundled templates with provided prompt files", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-system-prompt-build-"));
    try {
      const soulPath = path.join(dir, "SOUL.md");
      const userPath = path.join(dir, "USER.md");
      const agentsPath = path.join(dir, "AGENTS.md");
      const toolsPath = path.join(dir, "TOOLS.md");
      const memoryPath = path.join(dir, "MEMORY.md");

      await writeFile(soulPath, "Soul prompt text\n", "utf8");
      await writeFile(userPath, "User prompt text\n", "utf8");
      await writeFile(agentsPath, "Agents prompt text\n", "utf8");
      await writeFile(toolsPath, "Tools prompt text\n", "utf8");
      await writeFile(memoryPath, "Memory prompt text\n", "utf8");

      const rendered = await agentSystemPrompt({
        provider: "openai",
        model: "gpt-4.1",
        workspace: "/tmp/workspace",
        connector: "telegram",
        channelId: "channel-1",
        userId: "user-1",
        soulPath,
        userPath,
        agentsPath,
        toolsPath,
        memoryPath,
        configDir: "/tmp/.daycare",
        agentKind: "foreground",
        features: {
          noTools: false,
          rlm: false,
          say: false
        }
      });

      expect(rendered).toContain("## Skills");
      expect(rendered).toContain("Connector: telegram, channel: channel-1, user: user-1.");
      expect(rendered).toContain("Soul prompt text");
      expect(rendered).toContain("Tools prompt text");
      expect(rendered).toContain("Memory prompt text");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
