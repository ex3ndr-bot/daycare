import { intro, outro } from "@clack/prompts";

import { setAuth } from "../engine/client.js";

export async function setAuthCommand(
  id: string,
  key: string,
  value: string
): Promise<void> {
  intro("gram auth");
  await setAuth(id, key, value);
  outro(`Stored ${key} for ${id}.`);
}
