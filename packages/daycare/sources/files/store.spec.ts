import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { FileStore } from "./store.js";

describe("FileStore", () => {
    let rootDir: string;

    beforeEach(async () => {
        rootDir = await mkdtemp(path.join(os.tmpdir(), "daycare-file-store-"));
    });

    afterEach(async () => {
        await rm(rootDir, { recursive: true, force: true });
    });

    it("stores files under a direct base path", async () => {
        const basePath = path.join(rootDir, "user-home", "desktop");
        const store = new FileStore(basePath);
        const saved = await store.saveBuffer({
            name: "hello.txt",
            mimeType: "text/plain",
            data: Buffer.from("hello"),
            source: "test"
        });

        expect(saved.path.startsWith(path.resolve(basePath))).toBe(true);
        expect(saved.name).toBe("hello.txt");
    });
});
