import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";

describe("GET /v1/import-status", () => {
  it("returns the latest import-job summary", async () => {
    const app = createApp({
      importJobStore: {
        getLatestImportJob: async () => ({
          id: "job-1",
          status: "COMPLETED",
          sourceName: "fixture",
          sourceVersion: "2026-08",
          processedCount: 3,
          acceptedCount: 2,
          rejectedCount: 1,
          upsertedWords: 2,
          upsertedEdges: 1,
          summary: { sourceVersion: "2026-08", warnings: 2, errors: 0 },
        }),
        getRecentImportFailures: async () => [{ id: "job-2", status: "FAILED" }],
        getImportJobDetails: async () => null as never,
        getImportJobRawRecords: async () => [],
      },
    });
    const response = await request(app).get("/v1/import-status");

    expect(response.status).toBe(200);
    expect(response.body).toEqual(
      expect.objectContaining({
        latest: expect.anything(),
        failures: expect.any(Array),
        report: expect.objectContaining({
          sourceName: "fixture",
          sourceVersion: "2026-08",
          processedCount: 3,
          acceptedCount: 2,
          rejectedCount: 1,
          upsertedWords: 2,
          upsertedEdges: 1,
        })
      })
    );
  });
});
