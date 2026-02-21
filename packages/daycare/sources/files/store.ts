import { promises as fs } from "node:fs";
import path from "node:path";

import { createId } from "@paralleldrive/cuid2";
import { sanitizeFilename } from "../util/filename.js";
import type { StoredFile } from "./types.js";

export class FileStore {
    private basePath: string;

    constructor(basePath: string) {
        this.basePath = basePath;
    }

    resolvePath(): string {
        return path.resolve(this.basePath);
    }

    async ensureDir(): Promise<void> {
        await fs.mkdir(this.resolvePath(), { recursive: true });
    }

    async saveBuffer(options: { name: string; mimeType: string; data: Buffer }): Promise<StoredFile> {
        await this.ensureDir();
        const id = createId();
        const filename = `${id}__${sanitizeFilename(options.name)}`;
        const filePath = path.join(this.resolvePath(), filename);
        await fs.writeFile(filePath, options.data);
        const stats = await fs.stat(filePath);
        return {
            id,
            name: options.name,
            path: filePath,
            mimeType: options.mimeType,
            size: stats.size
        };
    }

    async saveFromPath(options: { name: string; mimeType: string; path: string }): Promise<StoredFile> {
        await this.ensureDir();
        const id = createId();
        const filename = `${id}__${sanitizeFilename(options.name)}`;
        const filePath = path.join(this.resolvePath(), filename);
        await fs.copyFile(options.path, filePath);
        const stats = await fs.stat(filePath);
        return {
            id,
            name: options.name,
            path: filePath,
            mimeType: options.mimeType,
            size: stats.size
        };
    }
}
