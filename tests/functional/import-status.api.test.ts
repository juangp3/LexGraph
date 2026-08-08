import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";

describe("GET /v1/import-status", () => {
  it("returns the latest import-job summary", async () => {
    const app = createApp();
    const response = await request(app).get("/v1/import-status");

    expect(response.status).toBe(200);
    expect(response.body).toEqual(
      expect.objectContaining({
        latest: expect.anything(),
        failures: expect.any(Array)
      })
    );
  });
});
