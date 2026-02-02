import type { ToolCall, ToolResultMessage } from "@mariozechner/pi-ai";

import type { AgentHistoryRecord } from "@/types";

const SYMBOLS_PER_TOKEN = 4;

/**
 * Estimates token usage from history records using a symbols/4 heuristic.
 * Expects: records are ordered and contain valid user/assistant/tool entries.
 */
export function contextEstimateTokens(records: AgentHistoryRecord[]): number {
  const symbols = records.reduce((total, record) => total + estimateRecordSymbols(record), 0);
  if (symbols <= 0) {
    return 0;
  }
  return Math.ceil(symbols / SYMBOLS_PER_TOKEN);
}

function estimateRecordSymbols(record: AgentHistoryRecord): number {
  if (record.type === "user_message") {
    return record.text.length;
  }
  if (record.type === "assistant_message") {
    return record.text.length + estimateToolCallsSymbols(record.toolCalls);
  }
  if (record.type === "tool_result") {
    return estimateToolMessageSymbols(record.output.toolMessage);
  }
  return 0;
}

function estimateToolCallsSymbols(toolCalls: ToolCall[]): number {
  return toolCalls.reduce((total, toolCall) => total + safeStringLength(toolCall), 0);
}

function estimateToolMessageSymbols(message: ToolResultMessage): number {
  return estimateToolMessageContentSymbols(message.content);
}

function estimateToolMessageContentSymbols(content: unknown): number {
  if (typeof content === "string") {
    return content.length;
  }
  if (Array.isArray(content)) {
    return content.reduce((total, item) => total + estimateContentItemSymbols(item), 0);
  }
  return safeStringLength(content);
}

function estimateContentItemSymbols(item: unknown): number {
  if (item && typeof item === "object") {
    const maybeText = item as { type?: string; text?: unknown };
    if (maybeText.type === "text" && typeof maybeText.text === "string") {
      return maybeText.text.length;
    }
  }
  return safeStringLength(item);
}

function safeStringLength(value: unknown): number {
  if (typeof value === "string") {
    return value.length;
  }
  try {
    const encoded = JSON.stringify(value);
    return encoded ? encoded.length : 0;
  } catch {
    return 0;
  }
}
