import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { databasePathResolve } from "../databasePathResolve.js";
import type { Migration } from "./migrationTypes.js";

export const migration20260222ImportExpose: Migration = {
    name: "20260222_import_expose",
    up(db): void {
        const dbPath = databasePathResolve(db);
        if (!dbPath) {
            return;
        }

        const configDir = path.dirname(dbPath);
        const endpointsDir = path.join(configDir, "expose", "endpoints");
        if (!existsSync(endpointsDir)) {
            return;
        }

        const ownerUserId = ownerUserIdResolve(db);
        const entries = readdirSync(endpointsDir, { withFileTypes: true });
        for (const entry of entries) {
            if (!entry.isFile() || !entry.name.endsWith(".json")) {
                continue;
            }
            const endpoint = endpointRead(path.join(endpointsDir, entry.name));
            if (!endpoint) {
                continue;
            }

            db.prepare(
                `
                  INSERT OR IGNORE INTO expose_endpoints (
                    id,
                    user_id,
                    target,
                    provider,
                    domain,
                    mode,
                    auth,
                    created_at,
                    updated_at
                  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                `
            ).run(
                endpoint.id,
                ownerUserId,
                JSON.stringify(endpoint.target),
                endpoint.provider,
                endpoint.domain,
                endpoint.mode,
                endpoint.auth ? JSON.stringify(endpoint.auth) : null,
                endpoint.createdAt,
                endpoint.updatedAt
            );
        }
    }
};

function ownerUserIdResolve(db: { prepare: (sql: string) => { get: () => unknown } }): string {
    const row = db.prepare("SELECT id FROM users WHERE is_owner = 1 LIMIT 1").get() as { id?: unknown } | undefined;
    const ownerId = typeof row?.id === "string" ? row.id.trim() : "";
    return ownerId || "owner";
}

function endpointRead(filePath: string): {
    id: string;
    target: unknown;
    provider: string;
    domain: string;
    mode: string;
    auth: unknown;
    createdAt: number;
    updatedAt: number;
} | null {
    try {
        const parsed = JSON.parse(readFileSync(filePath, "utf8")) as {
            id?: unknown;
            target?: unknown;
            provider?: unknown;
            domain?: unknown;
            mode?: unknown;
            auth?: unknown;
            createdAt?: unknown;
            updatedAt?: unknown;
        };
        const id = stringOrNull(parsed.id);
        const provider = stringOrNull(parsed.provider);
        const domain = stringOrNull(parsed.domain);
        const mode = stringOrNull(parsed.mode);
        if (!id || !provider || !domain || !mode || parsed.target === undefined) {
            return null;
        }
        return {
            id,
            target: parsed.target,
            provider,
            domain,
            mode,
            auth: parsed.auth ?? null,
            createdAt: numberOrNow(parsed.createdAt),
            updatedAt: numberOrNow(parsed.updatedAt)
        };
    } catch {
        return null;
    }
}

function stringOrNull(value: unknown): string | null {
    if (typeof value !== "string") {
        return null;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
}

function numberOrNow(value: unknown): number {
    if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
        return Math.floor(value);
    }
    return Date.now();
}
