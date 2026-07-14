import { describe, expect, it } from "vitest";

describe("integration: database", () => {
  it("is configured to run when RUN_INTEGRATION=true", () => {
    if (process.env.RUN_INTEGRATION !== "true") {
      expect(true).toBe(true);
      return;
    }

    // Week 1 scaffold note:
    // Real DB container bootstrapping lands in Week 2 as schema becomes concrete.
    expect(process.env.RUN_INTEGRATION).toBe("true");
  });
});
