import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

import { appPermissionBuild } from "./appPermissionBuild.js";

describe("appPermissionBuild", () => {
  let workspaceDir: string;

  beforeEach(async () => {
    workspaceDir = await fs.mkdtemp(path.join(os.tmpdir(), "daycare-app-permissions-"));
  });

  afterEach(async () => {
    await fs.rm(workspaceDir, { recursive: true, force: true });
  });

  it("builds app-scoped permissions and creates data dir", async () => {
    const permissions = await appPermissionBuild(workspaceDir, "github-reviewer");
    const expectedDataDir = path.join(workspaceDir, "apps", "github-reviewer", "data");

    expect(permissions).toEqual({
      workingDir: expectedDataDir,
      writeDirs: [expectedDataDir],
      readDirs: [path.resolve(workspaceDir)],
      network: false,
      events: false
    });

    const stat = await fs.stat(expectedDataDir);
    expect(stat.isDirectory()).toBe(true);
  });
});
