import { describe, expect, it } from "vitest";

import { channelNameNormalize } from "./channelNameNormalize.js";

describe("channelNameNormalize", () => {
    it("normalizes valid channel names", () => {
        expect(channelNameNormalize(" Dev_Team ")).toBe("dev_team");
    });

    it("throws for invalid channel names", () => {
        expect(() => channelNameNormalize("bad.name")).toThrow("Channel name must be Slack-style");
    });
});
