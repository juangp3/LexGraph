import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";

describe("GET /v1/import-jobs/:jobId", () => {
  it("returns import job details and raw-record metadata", async () => {
    const jobId = "11111111-1111-1111-8111-111111111111";
    const mockStore = {
      getLatestImportJob: async () => null,
      getRecentImportFailures: async () => [],
      getImportJobDetails: async (_client: unknown, id: string) => ({
        id,
        status: "COMPLETED",
        sourceName: "fixture",
        processedCount: 2,
        acceptedCount: 2,
        rejectedCount: 0,
        upsertedWords: 2,
        upsertedEdges: 1,
        summary: { acceptedCount: 2 },
        startedAt: "2026-08-09T00:00:00.000Z",
        completedAt: "2026-08-09T00:01:00.000Z",
        rawRecords: [
          {
            id: "raw-1",
            sourceKey: "fixture-1",
            sourceHash: "hash-1",
            createdAt: "2026-08-09T00:00:00.000Z",
            payload: { word: "father", sourceTitle: "Fixture" },
          },
        ],
      }),
      getImportJobRawRecords: async () => [
        {
          id: "raw-1",
          sourceKey: "fixture-1",
          sourceHash: "hash-1",
          createdAt: "2026-08-09T00:00:00.000Z",
          payload: { word: "father", sourceTitle: "Fixture" },
        },
      ],
    };

    const app = createApp({ importJobStore: mockStore as never });
    const response = await request(app).get(`/v1/import-jobs/${jobId}`);

    expect(response.status).toBe(200);
    expect(response.body.job.id).toBe(jobId);
    expect(response.body.job.status).toBe("COMPLETED");
    expect(response.body.job.rawRecords).toHaveLength(1);
    expect(response.body.job.rawRecords[0].sourceKey).toBe("fixture-1");
  });

  it("returns 404 when the import job cannot be found", async () => {
    const mockStore = {
      getLatestImportJob: async () => null,
      getRecentImportFailures: async () => [],
      getImportJobDetails: async () => null,
      getImportJobRawRecords: async () => [],
    };

    const app = createApp({ importJobStore: mockStore as never });
    const response = await request(app).get("/v1/import-jobs/11111111-1111-1111-8111-111111111111");

    expect(response.status).toBe(404);
    expect(response.body.message).toContain("Import job not found");
  });
});
