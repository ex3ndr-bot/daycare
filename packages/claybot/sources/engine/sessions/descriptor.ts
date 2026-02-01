export type SessionDescriptor =
  | { type: "user"; connector: string; userId: string; channelId: string }
  | { type: "cron"; id: string }
  | { type: "heartbeat"; id: string }
  | { type: "background"; id: string; parentSessionId?: string; name?: string };

export function normalizeSessionDescriptor(value: unknown): SessionDescriptor | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }
  const candidate = value as {
    type?: unknown;
    connector?: unknown;
    userId?: unknown;
    channelId?: unknown;
    id?: unknown;
    parentSessionId?: unknown;
    name?: unknown;
  };
  if (candidate.type === "user") {
    if (
      typeof candidate.connector === "string" &&
      typeof candidate.userId === "string" &&
      typeof candidate.channelId === "string"
    ) {
      return {
        type: "user",
        connector: candidate.connector,
        userId: candidate.userId,
        channelId: candidate.channelId
      };
    }
    return undefined;
  }
  if (candidate.type === "cron") {
    if (typeof candidate.id === "string") {
      return { type: "cron", id: candidate.id };
    }
    return undefined;
  }
  if (candidate.type === "heartbeat") {
    if (typeof candidate.id === "string") {
      return { type: "heartbeat", id: candidate.id };
    }
    return undefined;
  }
  if (candidate.type === "background") {
    if (typeof candidate.id !== "string") {
      return undefined;
    }
    return {
      type: "background",
      id: candidate.id,
      parentSessionId:
        typeof candidate.parentSessionId === "string" ? candidate.parentSessionId : undefined,
      name: typeof candidate.name === "string" ? candidate.name : undefined
    };
  }
  if (candidate.type === "system") {
    if (typeof candidate.id === "string") {
      return { type: "background", id: candidate.id };
    }
    return undefined;
  }
  return undefined;
}

export function sessionDescriptorMatches(
  left: SessionDescriptor,
  right: SessionDescriptor
): boolean {
  if (left.type !== right.type) {
    return false;
  }
  switch (left.type) {
    case "user":
      return (
        left.connector === (right as typeof left).connector &&
        left.userId === (right as typeof left).userId &&
        left.channelId === (right as typeof left).channelId
      );
    case "cron":
    case "heartbeat":
    case "background":
      return left.id === (right as typeof left).id;
    default:
      return false;
  }
}
