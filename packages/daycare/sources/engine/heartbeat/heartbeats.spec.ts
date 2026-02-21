import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Context } from "@/types";

import { configResolve } from "../../config/configResolve.js";
import { Storage } from "../../storage/storage.js";
import { ConfigModule } from "../config/configModule.js";
import { Heartbeats, type HeartbeatsOptions } from "./heartbeats.js";

const { gatePermissionRequestMock } = vi.hoisted(() => ({
    gatePermissionRequestMock: vi.fn()
}));

vi.mock("../scheduling/gatePermissionRequest.js", () => ({
    gatePermissionRequest: gatePermissionRequestMock
}));

describe("Heartbeats", () => {
    const tempDirs: string[] = [];

    afterEach(async () => {
        await Promise.all(tempDirs.map((dir) => fs.rm(dir, { recursive: true, force: true })));
        tempDirs.length = 0;
        gatePermissionRequestMock.mockReset();
    });

    it("wires onGatePermissionRequest to gatePermissionRequest", async () => {
        const dir = await fs.mkdtemp(path.join(os.tmpdir(), "daycare-heartbeats-facade-"));
        tempDirs.push(dir);
        gatePermissionRequestMock.mockResolvedValue({ granted: true });

        const connectorRegistry = {} as HeartbeatsOptions["connectorRegistry"];
        const permissionRequestRegistry = {} as HeartbeatsOptions["permissionRequestRegistry"];
        const agentSystemMock = {
            permissionsForTarget: vi.fn(async () => ({
                workingDir: dir,
                writeDirs: [],
                readDirs: [],
                network: false,
                events: false
            })),
            agentIdForTarget: vi.fn(async () => "heartbeat-agent"),
            updateAgentPermissions: vi.fn(),
            postAndAwait: vi.fn(async () => ({ status: "completed" })),
            post: vi.fn(async () => undefined)
        };
        const agentSystem = agentSystemMock as unknown as HeartbeatsOptions["agentSystem"];
        const storage = Storage.open(":memory:");
        try {
            const heartbeats = new Heartbeats({
                config: new ConfigModule(configResolve({ engine: { dataDir: dir } }, path.join(dir, "settings.json"))),
                storage,
                eventBus: { emit: vi.fn() } as unknown as HeartbeatsOptions["eventBus"],
                agentSystem,
                connectorRegistry,
                permissionRequestRegistry
            });

            const callback = (
                heartbeats as unknown as {
                    scheduler: { onGatePermissionRequest?: (task: unknown, missing: string[]) => Promise<boolean> };
                }
            ).scheduler.onGatePermissionRequest;
            expect(callback).toBeTypeOf("function");

            const granted = await callback?.(
                {
                    id: "heartbeat-task-1",
                    title: "Morning check",
                    prompt: "Run checks",
                    gate: null,
                    lastRunAt: null,
                    createdAt: 1,
                    updatedAt: 1
                },
                ["@network"]
            );

            expect(granted).toBe(true);
            expect(gatePermissionRequestMock).toHaveBeenCalledWith(
                expect.objectContaining({
                    missing: ["@network"],
                    taskLabel: 'heartbeat task "Morning check" (heartbeat-task-1)',
                    agentId: "heartbeat-agent",
                    connectorRegistry,
                    permissionRequestRegistry
                })
            );
        } finally {
            storage.close();
        }
    });

    it("requires ctx for add/remove and scopes deletion by ctx user", async () => {
        const dir = await fs.mkdtemp(path.join(os.tmpdir(), "daycare-heartbeats-add-remove-"));
        tempDirs.push(dir);
        const connectorRegistry = {} as HeartbeatsOptions["connectorRegistry"];
        const permissionRequestRegistry = {} as HeartbeatsOptions["permissionRequestRegistry"];
        const agentSystem = {
            permissionsForTarget: vi.fn(async () => ({
                workingDir: dir,
                writeDirs: [],
                readDirs: [],
                network: false,
                events: false
            })),
            agentIdForTarget: vi.fn(async () => "heartbeat-agent"),
            updateAgentPermissions: vi.fn(),
            postAndAwait: vi.fn(async () => ({ status: "completed" })),
            post: vi.fn(async () => undefined)
        } as unknown as HeartbeatsOptions["agentSystem"];
        const storage = Storage.open(":memory:");
        try {
            const heartbeats = new Heartbeats({
                config: new ConfigModule(configResolve({ engine: { dataDir: dir } }, path.join(dir, "settings.json"))),
                storage,
                eventBus: { emit: vi.fn() } as unknown as HeartbeatsOptions["eventBus"],
                agentSystem,
                connectorRegistry,
                permissionRequestRegistry
            });
            const ctxA = contextBuild("user-a");
            const ctxB = contextBuild("user-b");
            const task = await heartbeats.addTask(ctxA, {
                title: "Scoped heartbeat",
                prompt: "Run scoped heartbeat"
            });

            await expect(heartbeats.removeTask(ctxB, task.id)).resolves.toBe(false);
            await expect(heartbeats.removeTask(ctxA, task.id)).resolves.toBe(true);
        } finally {
            storage.close();
        }
    });

    it("posts executable system_message for heartbeat batches", async () => {
        const dir = await fs.mkdtemp(path.join(os.tmpdir(), "daycare-heartbeats-execute-"));
        tempDirs.push(dir);

        const connectorRegistry = {} as HeartbeatsOptions["connectorRegistry"];
        const permissionRequestRegistry = {} as HeartbeatsOptions["permissionRequestRegistry"];
        const agentSystemMock = {
            permissionsForTarget: vi.fn(async () => ({
                workingDir: dir,
                writeDirs: [],
                readDirs: [],
                network: false,
                events: false
            })),
            agentIdForTarget: vi.fn(async () => "heartbeat-agent"),
            agentContextForAgentId: vi.fn(async () => ({ agentId: "heartbeat-agent", userId: "user-1" })),
            updateAgentPermissions: vi.fn(),
            postAndAwait: vi.fn(async () => ({ type: "system_message", responseText: null })),
            post: vi.fn(async () => undefined)
        };
        const agentSystem = agentSystemMock as unknown as HeartbeatsOptions["agentSystem"];
        const storage = Storage.open(":memory:");
        try {
            const heartbeats = new Heartbeats({
                config: new ConfigModule(configResolve({ engine: { dataDir: dir } }, path.join(dir, "settings.json"))),
                storage,
                eventBus: { emit: vi.fn() } as unknown as HeartbeatsOptions["eventBus"],
                agentSystem,
                connectorRegistry,
                permissionRequestRegistry
            });

            const callback = (
                heartbeats as unknown as {
                    scheduler: {
                        onRun?: (tasks: Array<{ id: string; title: string; prompt: string }>) => Promise<void>;
                    };
                }
            ).scheduler.onRun;
            expect(callback).toBeTypeOf("function");

            await callback?.([{ id: "hb-1", title: "Morning check", prompt: "Collect status." }]);

            expect(agentSystemMock.postAndAwait).toHaveBeenCalledTimes(1);
            expect(agentSystemMock.postAndAwait).toHaveBeenCalledWith(
                { descriptor: { type: "system", tag: "heartbeat" } },
                {
                    type: "system_message",
                    text: "Collect status.",
                    origin: "heartbeat",
                    execute: true
                }
            );
        } finally {
            storage.close();
        }
    });
});

function contextBuild(userId: string): Context {
    return {
        agentId: "agent-1",
        userId
    };
}
