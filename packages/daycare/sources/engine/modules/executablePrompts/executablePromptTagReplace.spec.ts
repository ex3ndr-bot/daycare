import { describe, expect, it } from "vitest";
import { executablePromptTagReplace } from "./executablePromptTagReplace.js";

describe("executablePromptTagReplace", () => {
    it("replaces a single run_python block", () => {
        const prompt = "before <run_python>echo()</run_python> after";
        const match = [...prompt.matchAll(/<run_python(\s[^>]*)?>[\s\S]*?<\/run_python\s*>/gi)][0];
        if (!match) {
            throw new Error("expected run_python match");
        }
        const replaced = executablePromptTagReplace(prompt, match, "RESULT");
        expect(replaced).toBe("before RESULT after");
    });

    it("supports multiple replacements when applied from last to first", () => {
        const prompt = "<run_python>a()</run_python> + <run_python>b()</run_python>";
        const matches = [...prompt.matchAll(/<run_python(\s[^>]*)?>[\s\S]*?<\/run_python\s*>/gi)];
        if (matches.length !== 2) {
            throw new Error("expected two run_python matches");
        }

        let replaced = executablePromptTagReplace(prompt, matches[1]!, "B");
        replaced = executablePromptTagReplace(replaced, matches[0]!, "A");
        expect(replaced).toBe("A + B");
    });

    it("supports empty replacement text", () => {
        const prompt = "x<run_python>noop()</run_python>y";
        const match = [...prompt.matchAll(/<run_python(\s[^>]*)?>[\s\S]*?<\/run_python\s*>/gi)][0];
        if (!match) {
            throw new Error("expected run_python match");
        }
        const replaced = executablePromptTagReplace(prompt, match, "");
        expect(replaced).toBe("xy");
    });

    it("replaces multiline tags with attributes", () => {
        const prompt = ["start", '<run_python mode="safe">', "value = 1", "value", "</run_python>", "end"].join("\n");
        const match = [...prompt.matchAll(/<run_python(\s[^>]*)?>[\s\S]*?<\/run_python\s*>/gi)][0];
        if (!match) {
            throw new Error("expected run_python match");
        }
        const replaced = executablePromptTagReplace(prompt, match, "42");
        expect(replaced).toBe("start\n42\nend");
    });
});
