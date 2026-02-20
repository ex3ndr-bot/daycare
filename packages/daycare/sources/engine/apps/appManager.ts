import { promises as fs } from "node:fs";
import path from "node:path";
import type { ToolResolver } from "../modules/toolResolver.js";
import { appDiscover } from "./appDiscover.js";
import { appToolBuild } from "./appToolBuild.js";
import { appToolNameFormat } from "./appToolNameFormat.js";
import type { AppDescriptor } from "./appTypes.js";

const APP_TOOLS_PLUGIN_ID = "core.apps";

type AppsOptions = {
    appsDir: string;
    usersDir?: string;
};

export class Apps {
    private readonly appsDir: string;
    private readonly usersDir: string | undefined;
    private descriptors: AppDescriptor[] = [];
    private toolNames = new Set<string>();

    constructor(options: AppsOptions) {
        this.appsDir = options.appsDir;
        this.usersDir = options.usersDir;
    }

    async discover(): Promise<AppDescriptor[]> {
        const roots = await appRootsList(this.appsDir, this.usersDir);
        const discovered = await Promise.all(roots.map((root) => appDiscover(root)));
        const descriptorsById = new Map<string, AppDescriptor>();
        for (const entries of discovered) {
            for (const descriptor of entries) {
                if (!descriptorsById.has(descriptor.id)) {
                    descriptorsById.set(descriptor.id, descriptor);
                }
            }
        }
        this.descriptors = [...descriptorsById.values()].sort((left, right) => left.id.localeCompare(right.id));
        return this.list();
    }

    registerTools(toolResolver: ToolResolver): void {
        this.unregisterTools(toolResolver);
        for (const descriptor of this.descriptors) {
            const definition = appToolBuild(descriptor);
            toolResolver.register(APP_TOOLS_PLUGIN_ID, definition);
            this.toolNames.add(definition.tool.name);
        }
    }

    unregisterTools(toolResolver: ToolResolver): void {
        for (const toolName of this.toolNames) {
            toolResolver.unregister(toolName);
        }
        this.toolNames.clear();
    }

    list(): AppDescriptor[] {
        return [...this.descriptors].sort((left, right) => left.id.localeCompare(right.id));
    }

    get(id: string): AppDescriptor | null {
        for (const descriptor of this.descriptors) {
            if (descriptor.id === id) {
                return descriptor;
            }
        }
        return null;
    }

    toolNameFor(id: string): string {
        return appToolNameFormat(id);
    }
}

async function appRootsList(globalAppsDir: string, usersDir?: string): Promise<string[]> {
    const roots = [path.resolve(globalAppsDir)];
    const resolvedUsersDir = usersDir?.trim() ? path.resolve(usersDir) : "";
    if (!resolvedUsersDir) {
        return roots;
    }
    let entries: import("node:fs").Dirent[] = [];
    try {
        entries = await fs.readdir(resolvedUsersDir, { withFileTypes: true });
    } catch (error) {
        const code = (error as NodeJS.ErrnoException).code;
        if (code === "ENOENT" || code === "ENOTDIR") {
            return roots;
        }
        throw error;
    }
    for (const entry of entries) {
        if (!entry.isDirectory()) {
            continue;
        }
        roots.push(path.join(resolvedUsersDir, entry.name, "apps"));
    }
    return Array.from(new Set(roots));
}
