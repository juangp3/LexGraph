import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";

describe("graph endpoint validation", () => {
  it("rejects placeholder wordId with 400", async () => {
    const app = createApp();
    const response = await request(app).get("/v1/graph/ancestors/%7BwordId%7D?depth=4");

    expect(response.status).toBe(400);
    expect(response.body.message).toContain("Invalid wordId");
  });

  it("rejects out-of-range depth with 400", async () => {
    const app = createApp();
    const validUuid = "11111111-1111-1111-8111-111111111111";
    const response = await request(app).get(`/v1/graph/ancestors/${validUuid}?depth=99`);

    expect(response.status).toBe(400);
    expect(response.body.message).toContain("Invalid depth");
  });
});
