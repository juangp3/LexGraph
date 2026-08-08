import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import type { GraphRepository, GraphRelationship } from "../../src/repositories/interfaces.js";

const validUuid = "11111111-1111-1111-8111-111111111111";

const graphRepository: GraphRepository = {
  upsertEdge: async () => undefined,
  findAncestors: async () => [
    {
      edgeId: "edge-1",
      fromWordId: "22222222-2222-2222-8222-222222222222",
      toWordId: validUuid,
      relationType: "EVOLVED_FROM",
      confidence: 0.95,
      method: "manual",
      isDisputed: false,
      evidenceSummary: null,
      conflictType: null,
      conflictDetails: null,
      depth: 1,
      path: ["22222222-2222-2222-8222-222222222222", validUuid],
      sources: [],
    },
  ],
  findDescendants: async () => [
    {
      edgeId: "edge-2",
      fromWordId: validUuid,
      toWordId: "44444444-4444-4444-8444-444444444444",
      relationType: "EVOLVED_FROM",
      confidence: 0.9,
      method: "manual",
      isDisputed: false,
      evidenceSummary: null,
      conflictType: null,
      conflictDetails: null,
      depth: 1,
      path: [validUuid, "44444444-4444-4444-8444-444444444444"],
      sources: [],
    },
  ],
  findBorrowings: async () => [],
  findCognates: async () => [
    {
      edgeId: "edge-cognate",
      fromWordId: validUuid,
      toWordId: "66666666-6666-6666-8666-666666666666",
      relationType: "COGNATE_WITH",
      confidence: 0.86,
      method: "inferred",
      isDisputed: false,
      evidenceSummary: null,
      conflictType: null,
      conflictDetails: null,
      depth: 1,
      path: [validUuid, "66666666-6666-6666-8666-666666666666"],
      sources: [],
    },
  ],
  findRelationships: async (_entityId, _options) => {
    const relationship: GraphRelationship = {
      edgeId: "edge-3",
      fromWordId: validUuid,
      toWordId: "55555555-5555-5555-8555-555555555555",
      relationType: "COGNATE_WITH",
      confidence: 0.88,
      method: "imported",
      isDisputed: false,
      evidenceSummary: null,
      conflictType: null,
      conflictDetails: null,
      direction: "outgoing",
      depth: 1,
      path: [validUuid, "55555555-5555-5555-8555-555555555555"],
      sources: [],
    };

    return [relationship];
  },
};

describe("Phase 7 graph API contract", () => {
  it("returns a request id and structured error for invalid graph requests", async () => {
    const app = createApp({ graphRepository });
    const response = await request(app).get("/v1/graph/not-a-uuid/expand?direction=ancestors");

    expect(response.status).toBe(400);
    expect(response.headers["x-request-id"]).toBeDefined();
    expect(response.body.error).toMatchObject({
      code: "INVALID_REQUEST",
      requestId: response.headers["x-request-id"],
    });
  });

  it("returns a graph expansion payload with nodes and edges", async () => {
    const app = createApp({ graphRepository });
    const response = await request(app).get(`/v1/graph/${validUuid}/expand?direction=ancestors&depth=1`);

    expect(response.status).toBe(200);
    expect(response.body.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: validUuid }),
        expect.objectContaining({ id: "22222222-2222-2222-8222-222222222222" }),
      ])
    );
    expect(response.body.edges).toHaveLength(1);
    expect(response.body.meta.direction).toBe("ancestors");
  });

  it("returns paginated relationships for an entity", async () => {
    const app = createApp({ graphRepository });
    const response = await request(app).get(`/v1/entities/${validUuid}/relationships?limit=1`);

    expect(response.status).toBe(200);
    expect(response.body.relationships).toHaveLength(1);
    expect(response.body.meta.limit).toBe(1);
    expect(response.body.relationships[0]).toMatchObject({ relationType: "COGNATE_WITH" });
  });

  it("supports cursor-based pagination for relationships", async () => {
    const app = createApp({ graphRepository });
    const response = await request(app).get(`/v1/entities/${validUuid}/relationships?limit=1&cursor=abc`);

    expect(response.status).toBe(200);
    expect(response.body.meta.nextCursor).toBeDefined();
  });

  it("supports relationship-type filtering and layered graph metadata", async () => {
    const app = createApp({ graphRepository });
    const response = await request(app).get(`/v1/graph/${validUuid}/expand?direction=ancestors&relationshipTypes=COGNATE_WITH&depth=1`);

    expect(response.status).toBe(200);
    expect(response.body.meta.expansion.relationshipTypes).toEqual(["COGNATE_WITH"]);
    expect(response.body.edges[0]).toMatchObject({ relationshipType: "COGNATE_WITH", layer: "etymology" });
  });

  it("supports expansion pagination and entity type metadata", async () => {
    const pagedRepository: GraphRepository = {
      ...graphRepository,
      findAncestors: async () => [
        {
          edgeId: "edge-1",
          fromWordId: "22222222-2222-2222-8222-222222222222",
          toWordId: validUuid,
          relationType: "EVOLVED_FROM",
          confidence: 0.95,
          method: "manual",
          isDisputed: false,
          evidenceSummary: null,
          conflictType: null,
          conflictDetails: null,
          depth: 1,
          path: ["22222222-2222-2222-8222-222222222222", validUuid],
          sources: [],
        },
        {
          edgeId: "edge-2",
          fromWordId: "33333333-3333-3333-8333-333333333333",
          toWordId: validUuid,
          relationType: "EVOLVED_FROM",
          confidence: 0.9,
          method: "manual",
          isDisputed: false,
          evidenceSummary: null,
          conflictType: null,
          conflictDetails: null,
          depth: 1,
          path: ["33333333-3333-3333-8333-333333333333", validUuid],
          sources: [],
        },
      ],
    };

    const app = createApp({ graphRepository: pagedRepository });
    const firstPage = await request(app).get(`/v1/graph/${validUuid}/expand?direction=ancestors&depth=1&limit=1&entityTypes=word,language`);

    expect(firstPage.status).toBe(200);
    expect(firstPage.body.edges).toHaveLength(1);
    expect(firstPage.body.meta.pagination.limit).toBe(1);
    expect(firstPage.body.meta.pagination.nextCursor).toBeDefined();
    expect(firstPage.body.meta.expansion.entityTypes).toEqual(["word", "language"]);

    const secondPage = await request(app).get(`/v1/graph/${validUuid}/expand?direction=ancestors&depth=1&limit=1&cursor=${firstPage.body.meta.pagination.nextCursor}&entityTypes=word,language`);

    expect(secondPage.status).toBe(200);
    expect(secondPage.body.edges).toHaveLength(1);
    expect(secondPage.body.edges[0].edgeId).toBe("edge-2");
  });

  it("rejects oversized request bodies with 413", async () => {
    const app = createApp({ graphRepository });
    const response = await request(app)
      .post("/v1/graph/query")
      .set("content-type", "application/json")
      .set("content-length", String(1024 * 1024 + 1))
      .send("{}")
      .catch((error) => error.response);

    expect(response.status).toBe(413);
    expect(response.body.error.code).toBe("REQUEST_TOO_LARGE");
  });
});
