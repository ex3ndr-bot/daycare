import { describe, it, expect, beforeEach } from "vitest";
import { PendingPermissionProxy } from "./pendingPermissionProxy.js";

describe("PendingPermissionProxy", () => {
  let proxy: PendingPermissionProxy;

  beforeEach(() => {
    proxy = new PendingPermissionProxy();
  });

  it("registers and resolves a proxied request", () => {
    proxy.register("token-1", "agent-background-1");

    expect(proxy.resolve("token-1")).toBe("agent-background-1");
  });

  it("returns null for unknown tokens", () => {
    expect(proxy.resolve("unknown-token")).toBeNull();
  });

  it("removes resolved tokens", () => {
    proxy.register("token-1", "agent-background-1");
    proxy.remove("token-1");

    expect(proxy.resolve("token-1")).toBeNull();
  });

  it("handles multiple registrations", () => {
    proxy.register("token-1", "agent-1");
    proxy.register("token-2", "agent-2");

    expect(proxy.resolve("token-1")).toBe("agent-1");
    expect(proxy.resolve("token-2")).toBe("agent-2");
  });

  it("overwrites registration for same token", () => {
    proxy.register("token-1", "agent-1");
    proxy.register("token-1", "agent-2");

    expect(proxy.resolve("token-1")).toBe("agent-2");
  });
});
