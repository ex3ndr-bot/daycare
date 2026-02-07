import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import type { Signal } from "@/types";
import { EngineEventBus } from "../ipc/events.js";
import { Signals } from "./signals.js";

describe("Signals", () => {
  it("persists and reads signal events", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-signals-"));
    try {
      const eventBus = new EngineEventBus();
      const signals = new Signals({ eventBus, configDir: dir });
      const events: Array<{ type: string; payload: unknown }> = [];

      const unsubscribe = eventBus.onEvent((event) => {
        events.push({ type: event.type, payload: event.payload });
      });

      await signals.ensureDir();
      const signal = await signals.generate({
        type: "build.completed",
        source: { type: "process", id: "main-runtime" },
        data: { ok: true }
      });
      unsubscribe();

      expect(signal.id.length).toBeGreaterThan(0);
      expect(signal.createdAt).toBeGreaterThan(0);
      expect(signal.type).toBe("build.completed");
      expect(signal.source).toEqual({ type: "process", id: "main-runtime" });
      expect(signal.data).toEqual({ ok: true });

      const generated = events.find((event) => event.type === "signal.generated");
      expect(generated).toBeDefined();
      expect(generated?.payload as Signal).toEqual(signal);

      const filePath = path.join(dir, "signals", "events.jsonl");
      const raw = await readFile(filePath, "utf8");
      expect(raw.includes('"type":"build.completed"')).toBe(true);

      const recent = await signals.listRecent(10);
      expect(recent).toHaveLength(1);
      expect(recent[0]?.id).toBe(signal.id);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
