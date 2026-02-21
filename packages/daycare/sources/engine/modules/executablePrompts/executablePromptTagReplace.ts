/**
 * Replaces a specific `<run_python>...</run_python>` match within a prompt string.
 * Expects: `tagMatch` comes from `String.prototype.matchAll()` on the original prompt.
 */
export function executablePromptTagReplace(prompt: string, tagMatch: RegExpMatchArray, replacement: string): string {
    if (tagMatch.index === undefined || typeof tagMatch[0] !== "string") {
        return prompt;
    }
    const start = tagMatch.index;
    const end = start + tagMatch[0].length;
    return `${prompt.slice(0, start)}${replacement}${prompt.slice(end)}`;
}
