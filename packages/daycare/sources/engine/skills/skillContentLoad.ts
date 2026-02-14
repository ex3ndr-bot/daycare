import path from "node:path";
import { promises as fs } from "node:fs";

/**
 * Loads SKILL.md body content and strips optional YAML frontmatter.
 *
 * Expects: filePath points to a readable markdown file.
 */
export async function skillContentLoad(filePath: string): Promise<string> {
  const content = await fs.readFile(path.resolve(filePath), "utf8");
  return skillFrontmatterStrip(content).trim();
}

function skillFrontmatterStrip(content: string): string {
  const lines = content.split(/\r?\n/);
  if ((lines[0] ?? "").trim() !== "---") {
    return content;
  }

  for (let i = 1; i < lines.length; i += 1) {
    const line = lines[i]?.trim() ?? "";
    if (line === "---" || line === "...") {
      return lines.slice(i + 1).join("\n");
    }
  }

  return content;
}
