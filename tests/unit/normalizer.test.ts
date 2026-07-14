import { describe, expect, it } from "vitest";
import { normalizeInput } from "../../src/domain/normalizer.js";

describe("normalizeInput", () => {
  it("normalizes accents, case, and spaces", () => {
    expect(normalizeInput("  Fader  ")).toBe("fader");
  });

  it("normalizes diacritics", () => {
    expect(normalizeInput("fæder")).toBe("fæder");
  });
});
