import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";

describe("GET /v1/search", () => {
  it("returns scaffolded payload", async () => {
    const app = createApp();
    const response = await request(app).get("/v1/search?q=father");

    expect(response.status).toBe(200);
    expect(response.body.query).toBe("father");
    expect(Array.isArray(response.body.results)).toBe(true);
  });
});
