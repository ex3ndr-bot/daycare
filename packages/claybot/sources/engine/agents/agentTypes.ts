import type { ConnectorMessage, MessageContext } from "../modules/connectors/types.js";
import type { SessionDescriptor } from "../sessions/descriptor.js";
import type { SessionMessage } from "../sessions/types.js";

export type AgentInboundMessage = {
  source: string;
  message: ConnectorMessage;
  context: MessageContext;
};

export type AgentDescriptor = SessionDescriptor;

export type AgentReceiveResult = SessionMessage;
