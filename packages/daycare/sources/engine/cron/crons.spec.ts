import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Context } from "@/types";

import { configResolve } from "../../config/configResolve.js";
import { Storage } from "../../storage/storage.js";
import { ConfigModule } from "../config/configModule.js";
import { Crons, type CronsOptions } from "./crons.js";

const { gatePermissionRequestMock } = vi.hoisted(() => ({
    gatePermissionRequestMock: vi.fn()
}));

vi.mock("../scheduling/gatePermissionRequest.js", () => ({
    gatePermissionRequest: gatePermissionRequestMock
}));

describe("Crons", () => {
    const tempDirs: string[] = [];

    afterEach(async () => {
        await Promise.all(tempDirs.map((dir) => fs.rm(dir, { recursive: true, force: true })));
        tempDirs.length = 0;
        gatePermissionRequestMock.mockReset();
    });

    it("wires onGatePermissionRequest to gatePermissionRequest", async () => {
        const dir = await fs.mkdtemp(path.join(os.tmpdir(), "daycare-crons-facade-"));
        tempDirs.push(dir);
        gatePermissionRequestMock.mockResolvedValue({ granted: true });

        const connectorRegistry = {} as CronsOptions["connectorRegistry"];
        const permissionRequestRegistry = {} as CronsOptions["permissionRequestRegistry"];
        const agentSystemMock = {
            permissionsForTarget: vi.fn(async () => ({
                workingDir: dir,
                writeDirs: [],
                readDirs: [],
                network: false,
                events: false
            })),
            agentIdForTarget: vi.fn(async () => "cron-agent"),
            updateAgentPermissions: vi.fn(),
            postAndAwait: vi.fn(async () => ({ status: "completed" })),
            post: vi.fn(async () => undefined)
        };
        const agentSystem = agentSystemMock as unknown as CronsOptions["agentSystem"];
        const storage = Storage.open(":memory:");
        try {
            const crons = new Crons({
                config: new ConfigModule(configResolve({ engine: { dataDir: dir } }, path.join(dir, "settings.json"))),
                storage,
                eventBus: { emit: vi.fn() } as unknown as CronsOptions["eventBus"],
                agentSystem,
                connectorRegistry,
                permissionRequestRegistry
            });

            const callback = (
                crons as unknown as {
                    scheduler: {
                        onGatePermissionRequest?: (task: unknown, missing: string[]) => Promise<boolean>;
                    };
                }
            ).scheduler.onGatePermissionRequest;
            expect(callback).toBeTypeOf("function");

            const granted = await callback?.(
                {
                    id: "cron-task-1",
                    taskUid: "uid-1",
                    name: "Nightly sync",
                    prompt: "Sync now",
                    schedule: "* * * * *",
                    enabled: true,
                    deleteAfterRun: false,
                    userId: null,
                    agentId: null,
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
                    taskLabel: 'cron task "Nightly sync" (cron-task-1)',
                    agentId: "cron-agent",
                    connectorRegistry,
                    permissionRequestRegistry
                })
            );
            expect(agentSystemMock.agentIdForTarget).toHaveBeenCalledWith({
                descriptor: { type: "cron", id: "uid-1", name: "Nightly sync" }
            });
        } finally {
            storage.close();
        }
    });

    it("requires ctx for add/delete and scopes deletion by ctx user", async () => {
        const dir = await fs.mkdtemp(path.join(os.tmpdir(), "daycare-crons-add-delete-"));
        tempDirs.push(dir);
        const connectorRegistry = {} as CronsOptions["connectorRegistry"];
        const permissionRequestRegistry = {} as CronsOptions["permissionRequestRegistry"];
        const agentSystem = {
            permissionsForTarget: vi.fn(async () => ({
                workingDir: dir,
                writeDirs: [],
                readDirs: [],
                network: false,
                events: false
            })),
            agentIdForTarget: vi.fn(async () => "cron-agent"),
            updateAgentPermissions: vi.fn(),
            postAndAwait: vi.fn(async () => ({ status: "completed" })),
            post: vi.fn(async () => undefined)
        } as unknown as CronsOptions["agentSystem"];
        const storage = Storage.open(":memory:");
        try {
            const crons = new Crons({
                config: new ConfigModule(configResolve({ engine: { dataDir: dir } }, path.join(dir, "settings.json"))),
                storage,
                eventBus: { emit: vi.fn() } as unknown as CronsOptions["eventBus"],
                agentSystem,
                connectorRegistry,
                permissionRequestRegistry
            });
            const ctxA = contextBuild("user-a");
            const ctxB = contextBuild("user-b");
            const task = await crons.addTask(ctxA, {
                name: "Scoped task",
                schedule: "* * * * *",
                prompt: "Run scoped task"
            });

            await expect(crons.deleteTask(ctxB, task.id)).resolves.toBe(false);
            await expect(crons.deleteTask(ctxA, task.id)).resolves.toBe(true);
        } finally {
            storage.close();
        }
    });

    it("normalizes ctx userId for cron add/delete", async () => {
        const dir = await fs.mkdtemp(path.join(os.tmpdir(), "daycare-crons-userid-trim-"));
        tempDirs.push(dir);
        const connectorRegistry = {} as CronsOptions["connectorRegistry"];
        const permissionRequestRegistry = {} as CronsOptions["permissionRequestRegistry"];
        const agentSystem = {
            permissionsForTarget: vi.fn(async () => ({
                workingDir: dir,
                writeDirs: [],
                readDirs: [],
                network: false,
                events: false
            })),
            agentIdForTarget: vi.fn(async () => "cron-agent"),
            updateAgentPermissions: vi.fn(),
            postAndAwait: vi.fn(async () => ({ status: "completed" })),
            post: vi.fn(async () => undefined)
        } as unknown as CronsOptions["agentSystem"];
        const storage = Storage.open(":memory:");
        try {
            const crons = new Crons({
                config: new ConfigModule(configResolve({ engine: { dataDir: dir } }, path.join(dir, "settings.json"))),
                storage,
                eventBus: { emit: vi.fn() } as unknown as CronsOptions["eventBus"],
                agentSystem,
                connectorRegistry,
                permissionRequestRegistry
            });
            const task = await crons.addTask(contextBuild("  user-a  "), {
                name: "Normalized user",
                schedule: "* * * * *",
                prompt: "Run normalized user task"
            });

            await expect(crons.deleteTask(contextBuild("user-a"), task.id)).resolves.toBe(true);
        } finally {
            storage.close();
        }
    });

    it("posts executable system_message for cron task runs", async () => {
        const dir = await fs.mkdtemp(path.join(os.tmpdir(), "daycare-crons-execute-"));
        tempDirs.push(dir);

        const connectorRegistry = {} as CronsOptions["connectorRegistry"];
        const permissionRequestRegistry = {} as CronsOptions["permissionRequestRegistry"];
        const agentSystemMock = {
            permissionsForTarget: vi.fn(async () => ({
                workingDir: dir,
                writeDirs: [],
                readDirs: [],
                network: false,
                events: false
            })),
            agentIdForTarget: vi.fn(async () => "cron-agent"),
            agentContextForAgentId: vi.fn(async () => ({ agentId: "cron-agent", userId: "user-1" })),
            updateAgentPermissions: vi.fn(),
            postAndAwait: vi.fn(async () => ({ type: "system_message", responseText: null })),
            post: vi.fn(async () => undefined)
        };
        const agentSystem = agentSystemMock as unknown as CronsOptions["agentSystem"];
        const storage = Storage.open(":memory:");
        try {
            const crons = new Crons({
                config: new ConfigModule(configResolve({ engine: { dataDir: dir } }, path.join(dir, "settings.json"))),
                storage,
                eventBus: { emit: vi.fn() } as unknown as CronsOptions["eventBus"],
                agentSystem,
                connectorRegistry,
                permissionRequestRegistry
            });

            const callback = (
                crons as unknown as {
                    scheduler: {
                        onTask?: (
                            task: {
                                taskId: string;
                                taskUid: string;
                                taskName: string;
                                prompt: string;
                                agentId?: string;
                                userId?: string;
                            },
                            messageContext: { messageId?: string; permissionTags?: string[] }
                        ) => Promise<void>;
                    };
                }
            ).scheduler.onTask;
            expect(callback).toBeTypeOf("function");

            const messageContext = { messageId: "msg-1", permissionTags: ["@network"] };
            await callback?.(
                {
                    taskId: "task-1",
                    taskUid: "uid-1",
                    taskName: "Nightly sync",
                    prompt: "Run checks",
                    userId: "user-1"
                },
                messageContext
            );

            expect(agentSystemMock.postAndAwait).toHaveBeenCalledTimes(1);
            expect(agentSystemMock.postAndAwait).toHaveBeenCalledWith(
                { descriptor: { type: "system", tag: "cron" } },
                expect.objectContaining({
                    type: "system_message",
                    origin: "cron",
                    execute: true,
                    context: messageContext
                })
            );

            const posted = (agentSystemMock.postAndAwait.mock.calls[0] as unknown as [unknown, { text: string }])[1];
            expect(posted.text).toContain("[cron]");
            expect(posted.text).toContain("taskId: task-1");
            expect(posted.text).toContain("taskUid: uid-1");
            expect(posted.text).toContain("taskName: Nightly sync");
            expect(posted.text).toContain("Run checks");
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
