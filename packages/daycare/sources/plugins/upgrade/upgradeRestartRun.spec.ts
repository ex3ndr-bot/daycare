import { beforeEach, describe, expect, it, vi } from "vitest";

const execFileMock = vi.fn();

vi.mock("node:child_process", () => ({
  execFile: (...args: unknown[]) => execFileMock(...args)
}));

import { upgradeRestartRun } from "./upgradeRestartRun.js";

function execSucceed(): void {
  execFileMock.mockImplementationOnce(
    (
      _command: string,
      _args: string[],
      _options: { windowsHide: boolean },
      callback: (error: Error | null) => void
    ) => {
      callback(null);
      return undefined;
    }
  );
}

function execFail(error: Error): void {
  execFileMock.mockImplementationOnce(
    (
      _command: string,
      _args: string[],
      _options: { windowsHide: boolean },
      callback: (error: Error | null) => void
    ) => {
      callback(error);
      return undefined;
    }
  );
}

describe("upgradeRestartRun", () => {
  beforeEach(() => {
    execFileMock.mockReset();
  });

  it("restarts pm2 process and reports status", async () => {
    execSucceed();
    const sendStatus = vi.fn<[string], Promise<void>>(async () => undefined);

    await upgradeRestartRun({
      strategy: "pm2",
      processName: "daycare",
      sendStatus
    });

    expect(execFileMock).toHaveBeenCalledWith(
      "pm2",
      ["restart", "daycare"],
      { windowsHide: true },
      expect.any(Function)
    );
    expect(sendStatus.mock.calls.map((call) => call[0])).toEqual([
      "Restarting process \"daycare\" via pm2..."
    ]);
  });

  it("reports restart failures", async () => {
    const error = Object.assign(new Error("restart failed"), {
      stderr: "pm2 not found"
    });
    execFail(error);
    const sendStatus = vi.fn<[string], Promise<void>>(async () => undefined);

    await expect(
      upgradeRestartRun({
        strategy: "pm2",
        processName: "daycare",
        sendStatus
      })
    ).rejects.toThrow(
      'Restart failed while restarting PM2 process "daycare": pm2 not found'
    );

    expect(execFileMock).toHaveBeenCalledTimes(1);
    expect(sendStatus).toHaveBeenCalledWith(
      'Restart failed while restarting PM2 process "daycare": pm2 not found'
    );
  });
});
