import { describe, it, expect, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

import { HeartbeatStore } from "./heartbeatStore.js";

async function createTempStore() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "claybot-heartbeat-store-"));
  const store = new HeartbeatStore(dir);
  await store.ensureDir();
  return { dir, store };
}

describe("HeartbeatStore", () => {
  const temps: string[] = [];

  afterEach(async () => {
    await Promise.all(temps.map((dir) => fs.rm(dir, { recursive: true, force: true })));
    temps.length = 0;
  });

  it("persists permissions", async () => {
    const { dir, store } = await createTempStore();
    temps.push(dir);

    await store.createTask({
      title: "Perm Task",
      prompt: "Prompt",
      permissions: ["@web"]
    });

    const tasks = await store.listTasks();
    expect(tasks[0]?.permissions).toEqual(["@web"]);
  });

  it("merges permissions on overwrite", async () => {
    const { dir, store } = await createTempStore();
    temps.push(dir);

    await store.createTask({
      id: "perm-task",
      title: "Perm Task",
      prompt: "Prompt",
      permissions: ["@web"]
    });

    await store.createTask({
      id: "perm-task",
      title: "Perm Task",
      prompt: "Prompt updated",
      permissions: ["@read:/tmp"],
      overwrite: true
    });

    const tasks = await store.listTasks();
    expect(tasks[0]?.permissions).toEqual(["@web", "@read:/tmp"]);
  });
});
