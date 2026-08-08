import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { getLatestImportJob, getPendingRecords, getRecentImportFailures, persistRawRecords } from "../../src/import/job-store.js";

describe("import job store", () => {
  it("persists raw payloads with stable hashes for auditing", async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] });

    const result = await persistRawRecords(
      { query } as never,
      "job-123",
      [
        {
          payload: {
            family: "Indo-European",
            language: "English",
            stage: "Modern English",
            word: "father",
            sourceTitle: "Fixture"
          },
          sourceKey: "fixture-1"
        },
        {
          payload: {
            family: "Indo-European",
            language: "English",
            stage: "Old English",
            word: "fæder",
            sourceTitle: "Fixture"
          },
          sourceKey: "fixture-2"
        }
      ]
    );

    expect(result).toBe(2);
    expect(query).toHaveBeenCalledTimes(4);
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO raw_import_records"),
      expect.arrayContaining(["job-123", "fixture-1", expect.any(String), expect.any(String)])
    );
  });

  it("returns only records that have not already been seen", () => {
    const seenHash = createHash("sha256").update(JSON.stringify({ family: "Indo-European" })).digest("hex");
    const pending = getPendingRecords(
      [
        { payload: { family: "Indo-European" }, sourceKey: "fixture-1" },
        { payload: { family: "Germanic" }, sourceKey: "fixture-2" }
      ],
      new Set([seenHash])
    );

    expect(pending).toEqual([{ payload: { family: "Germanic" }, sourceKey: "fixture-2" }]);
  });

  it("skips records already persisted for the same job when resuming", async () => {
    const query = vi.fn()
      .mockResolvedValueOnce({ rows: [{ id: "existing-record" }] })
      .mockResolvedValueOnce({ rows: [] });

    const inserted = await persistRawRecords(
      { query } as never,
      "job-123",
      [
        {
          payload: { family: "Indo-European" },
          sourceKey: "fixture-1"
        },
        {
          payload: { family: "Germanic" },
          sourceKey: "fixture-2"
        }
      ]
    );

    expect(inserted).toBe(1);
    expect(query).toHaveBeenCalledWith(expect.stringContaining("SELECT id FROM raw_import_records"), ["job-123", expect.any(String)]);
  });

  it("returns the latest import job and recent failures from the store", async () => {
    const query = vi.fn()
      .mockResolvedValueOnce({ rows: [{ id: "job-123", status: "COMPLETED" }] })
      .mockResolvedValueOnce({ rows: [{ id: "job-999", status: "FAILED", summary: { error: "boom" } }] });

    const latest = await getLatestImportJob({ query } as never);
    const failures = await getRecentImportFailures({ query } as never, 1);

    expect(latest).toEqual({ id: "job-123", status: "COMPLETED" });
    expect(failures).toEqual([{ id: "job-999", status: "FAILED", summary: { error: "boom" } }]);
  });
});
