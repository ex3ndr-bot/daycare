import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { sendEngineEvent } from "../engine/ipc/client.js";
import { eventCommand } from "./event.js";

vi.mock("../engine/ipc/client.js", () => ({
  sendEngineEvent: vi.fn()
}));

describe("eventCommand", () => {
  const sendEngineEventMock = vi.mocked(sendEngineEvent);

  beforeEach(() => {
    sendEngineEventMock.mockReset();
    process.exitCode = undefined;
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("sends the provided event type and parsed payload", async () => {
    await eventCommand("demo.event", "{\"ok\":true}");

    expect(sendEngineEventMock).toHaveBeenCalledWith("demo.event", { ok: true });
    expect(process.exitCode).toBeUndefined();
  });

  it("sets a non-zero exit code when socket send fails", async () => {
    sendEngineEventMock.mockRejectedValueOnce(new Error("connect ENOENT"));

    await eventCommand("demo.event");

    expect(process.exitCode).toBe(1);
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining("Failed to send event: connect ENOENT")
    );
  });

  it("sets a non-zero exit code when payload is invalid JSON", async () => {
    await eventCommand("demo.event", "{not-json");

    expect(sendEngineEventMock).not.toHaveBeenCalled();
    expect(process.exitCode).toBe(1);
    expect(console.error).toHaveBeenCalledWith(
      "Failed to send event: Payload must be valid JSON."
    );
  });
});
