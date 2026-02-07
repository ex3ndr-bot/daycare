export type SignalSource =
  | { type: "system" }
  | { type: "agent"; id: string }
  | { type: "webhook"; id?: string }
  | { type: "process"; id?: string };

export type SignalGenerateInput = {
  type: string;
  source?: SignalSource;
  data?: unknown;
};

export type Signal = {
  id: string;
  type: string;
  source: SignalSource;
  data?: unknown;
  createdAt: number;
};

export type SignalSubscription = {
  agentId: string;
  pattern: string;
  silent: boolean;
  createdAt: number;
  updatedAt: number;
};

export type SignalSubscribeInput = {
  agentId: string;
  pattern: string;
  silent?: boolean;
};

export type SignalUnsubscribeInput = {
  agentId: string;
  pattern: string;
};
