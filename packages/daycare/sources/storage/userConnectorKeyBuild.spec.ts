import { describe, expect, it } from "vitest";

import { userConnectorKeyBuild } from "./userConnectorKeyBuild.js";

describe("userConnectorKeyBuild", () => {
  it("builds connector keys from connector and userId", () => {
    expect(userConnectorKeyBuild("telegram", "123")).toBe("telegram:123");
  });

  it("trims inputs", () => {
    expect(userConnectorKeyBuild(" telegram ", " 123 ")).toBe("telegram:123");
  });

  it("throws for empty connector", () => {
    expect(() => userConnectorKeyBuild("", "123")).toThrow("Connector is required");
  });

  it("throws for empty userId", () => {
    expect(() => userConnectorKeyBuild("telegram", "   ")).toThrow(
      "Connector userId is required"
    );
  });
});
