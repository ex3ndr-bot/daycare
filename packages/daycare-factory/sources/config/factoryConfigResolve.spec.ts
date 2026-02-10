import { describe, expect, it } from "vitest";
import { FACTORY_INTERNAL_COMMAND } from "../constants.js";
import { factoryConfigResolve } from "./factoryConfigResolve.js";

describe("factoryConfigResolve", () => {
  it("applies defaults for mount paths and command", () => {
    const result = factoryConfigResolve({
      image: "daycare/factory:latest",
      buildCommand: ["npm", "run", "build"]
    });

    expect(result.taskMountPath).toBe("/workspace/TASK.md");
    expect(result.outMountPath).toBe("/workspace/out");
    expect(result.buildCommand).toEqual(["npm", "run", "build"]);
    expect(result.testCommand).toBeUndefined();
    expect(result.command).toEqual([
      "daycare-factory",
      FACTORY_INTERNAL_COMMAND,
      "--task",
      "/workspace/TASK.md",
      "--out",
      "/workspace/out"
    ]);
    expect(result.removeExistingContainer).toBe(true);
    expect(result.removeContainerOnExit).toBe(true);
  });

  it("builds default command from custom mount paths", () => {
    const result = factoryConfigResolve({
      image: "daycare/factory:latest",
      buildCommand: ["pnpm", "build"],
      taskMountPath: "/custom/TASK.md",
      outMountPath: "/custom/out"
    });

    expect(result.command).toEqual([
      "daycare-factory",
      FACTORY_INTERNAL_COMMAND,
      "--task",
      "/custom/TASK.md",
      "--out",
      "/custom/out"
    ]);
  });

  it("keeps optional test command", () => {
    const result = factoryConfigResolve({
      image: "daycare/factory:latest",
      buildCommand: ["pnpm", "build"],
      testCommand: ["pnpm", "test"]
    });

    expect(result.testCommand).toEqual(["pnpm", "test"]);
  });

  it("requires buildCommand in config", () => {
    expect(() =>
      factoryConfigResolve({
        image: "daycare/factory:latest"
      })
    ).toThrow();
  });
});
