import { skillSort } from "./skillSort.js";
import type { AgentSkill } from "./skillTypes.js";
import { xmlEscape } from "../../util/xmlEscape.js";

/**
 * Formats available skills into an XML prompt segment for the system prompt.
 *
 * Expects: skills may include duplicates; the first entry per path is used.
 */
export function skillPromptFormat(skills: AgentSkill[]): string {
  const unique = new Map<string, AgentSkill>();
  for (const skill of skills) {
    if (!unique.has(skill.path)) {
      unique.set(skill.path, skill);
    }
  }
  const ordered = skillSort(Array.from(unique.values()));

  if (ordered.length === 0) {
    return "";
  }

  const lines = [
    "## Skills (mandatory)",
    "",
    "Before replying, scan the skill descriptions below:",
    "- If exactly one skill clearly applies: call the `skill` tool with that skill name.",
    "- If multiple could apply: choose the most specific one, then call `skill` once.",
    "- If none clearly apply: do not call `skill`.",
    "",
    "Tool behavior:",
    "- Non-sandbox skill: `skill` returns instructions. Follow them in this context.",
    "- Sandbox skill (`<sandbox>true</sandbox>`): `skill` runs autonomously and returns results.",
    "",
    "<available_skills>"
  ];

  for (const skill of ordered) {
    const sourceLabel =
      skill.source === "plugin"
        ? `plugin:${skill.pluginId ?? "unknown"}`
        : skill.source;
    const name = xmlEscape(skill.name);
    const description = skill.description ? xmlEscape(skill.description) : "";
    lines.push("  <skill>");
    lines.push(`    <name>${name}</name>`);
    if (description.length > 0) {
      lines.push(`    <description>${description}</description>`);
    }
    lines.push(`    <source>${xmlEscape(sourceLabel)}</source>`);
    if (skill.sandbox === true) {
      lines.push("    <sandbox>true</sandbox>");
    }
    lines.push("  </skill>");
  }

  lines.push("</available_skills>");

  return lines.join("\n");
}
