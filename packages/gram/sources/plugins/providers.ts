export type ProviderAuth = "apiKey" | "oauth" | "mixed" | "none";
export type ProviderKind = "pi-ai" | "openai-compatible";

export type ProviderDefinition = {
  id: string;
  label: string;
  auth: ProviderAuth;
  kind: ProviderKind;
};

export const PROVIDER_DEFINITIONS: ProviderDefinition[] = [
  { id: "openai", label: "OpenAI", auth: "apiKey", kind: "pi-ai" }
];
