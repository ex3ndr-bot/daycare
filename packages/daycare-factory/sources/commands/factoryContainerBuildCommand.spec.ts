import { mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  FACTORY_BUILD_COMMAND_ENV,
  FACTORY_OUT_ENV,
  FACTORY_TASK_ENV
} from "../constants.js";
import { factoryContainerBuildCommand } from "./factoryContainerBuildCommand.js";

const tempDirectories: string[] = [];

afterEach(async () => {
  for (const directory of tempDirectories.splice(0, tempDirectories.length)) {
    await rm(directory, { recursive: true, force: true });
  }
  delete process.env[FACTORY_BUILD_COMMAND_ENV];
});

describe("factoryContainerBuildCommand", () => {
  it("rejects when not running inside Docker", async () => {
    const directory = await mkdtemp(join(tmpdir(), "factory-no-docker-"));
    tempDirectories.push(directory);
    const taskPath = join(directory, "TASK.md");
    await writeFile(taskPath, "# task\n");

    await expect(
      factoryContainerBuildCommand(taskPath, join(directory, "out"), {
        dockerEnvironmentIs: async () => false
      })
    ).rejects.toThrow("inside Docker");
  });

  it("runs configured build command and sets task/out env vars", async () => {
    const directory = await mkdtemp(join(tmpdir(), "factory-docker-"));
    tempDirectories.push(directory);
    const taskPath = join(directory, "TASK.md");
    const outPath = join(directory, "out");
    await writeFile(taskPath, "# task\n");
    process.env[FACTORY_BUILD_COMMAND_ENV] = JSON.stringify([
      "npm",
      "run",
      "build"
    ]);

    const runSpy = vi.fn().mockResolvedValue(0);

    await factoryContainerBuildCommand(taskPath, outPath, {
      dockerEnvironmentIs: async () => true,
      buildCommandRun: runSpy
    });

    expect(runSpy).toHaveBeenCalledTimes(1);
    expect(runSpy.mock.calls[0]?.[0]).toEqual(["npm", "run", "build"]);
    expect(runSpy.mock.calls[0]?.[1]?.[FACTORY_TASK_ENV]).toBe(taskPath);
    expect(runSpy.mock.calls[0]?.[1]?.[FACTORY_OUT_ENV]).toBe(outPath);
    const outStat = await stat(outPath);
    expect(outStat.isDirectory()).toBe(true);
  });
});
