import { execFile } from "node:child_process";

type UpgradeRestartRunOptions = {
  strategy: "pm2";
  processName: string;
  sendStatus: (text: string) => Promise<void>;
};

/**
 * Restarts the configured Daycare process without running upgrade install steps.
 * Expects: strategy is supported and processName is a non-empty PM2 process identifier.
 */
export async function upgradeRestartRun(options: UpgradeRestartRunOptions): Promise<void> {
  if (options.strategy !== "pm2") {
    const text = `Restart failed: unsupported strategy ${options.strategy}`;
    await options.sendStatus(text);
    throw new Error(text);
  }

  await options.sendStatus(`Restarting process \"${options.processName}\" via pm2...`);

  try {
    await commandRun("pm2", ["restart", options.processName]);
  } catch (error) {
    const text = `Restart failed while restarting PM2 process \"${options.processName}\": ${errorTextBuild(error)}`;
    await options.sendStatus(text);
    throw new Error(text);
  }

  await options.sendStatus(`Restart complete. PM2 process \"${options.processName}\" restarted.`);
}

function commandRun(command: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile(
      command,
      args,
      {
        windowsHide: true
      },
      (error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      }
    );
  });
}

function errorTextBuild(error: unknown): string {
  if (!(error instanceof Error)) {
    return "Unknown error";
  }
  const withOutput = error as Error & {
    stderr?: string | Buffer;
    stdout?: string | Buffer;
  };
  const details = [
    String(withOutput.stderr ?? "").trim(),
    String(withOutput.stdout ?? "").trim()
  ].find((entry) => entry.length > 0);
  if (details) {
    return details;
  }
  return error.message || "Unknown error";
}
