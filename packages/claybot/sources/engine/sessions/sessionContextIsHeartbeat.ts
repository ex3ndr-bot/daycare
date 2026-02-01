import type { MessageContext } from "../modules/connectors/types.js";
import type { SessionDescriptor } from "./descriptor.js";

export function sessionContextIsHeartbeat(
  context: MessageContext,
  session?: SessionDescriptor
): boolean {
  return !!context.heartbeat || session?.type === "heartbeat";
}
