# Import pipeline usage

## Purpose

The import pipeline is the project’s Phase 4 ingestion workflow. It is designed to:

- load a dataset into the graph-backed database
- validate and normalize input records
- persist a raw copy of each source payload before canonical records are written
- create an import job so the run can be monitored and resumed
- record counts for accepted, rejected, and upserted rows
- produce a rejection log for records that could not be imported

This workflow is implemented by the importer in [src/import/importer.ts](src/import/importer.ts) and exposed through the scripts in [scripts/import-week4.ts](scripts/import-week4.ts), [scripts/resume-import.ts](scripts/resume-import.ts), and [scripts/report-import-status.ts](scripts/report-import-status.ts).

## When to use it

Use the import pipeline when you want to:

- seed or refresh the sample dataset
- re-run an import after a failure or interruption
- inspect the latest import health summary
- review rejected records that need follow-up

## Prerequisites

Before running the pipeline, make sure:

- the database stack is available
- Prisma migrations are applied
- dependencies are installed with `npm install`

## Quick start

1. Start the local infrastructure if needed:
   ```bash
   npm run infra:up
   ```
2. Run the importer:
   ```bash
   npm run import:data
   ```
3. Review the latest import-job rows:
   ```bash
   npm run report:import-status
   ```
4. If a previous run failed, resume it:
   ```bash
   npm run resume:import
   ```

## Example: running a fresh import

Command:

```bash
npm run import:data
```

Expected result:

```json
{
  "jobId": "<uuid>",
  "processed": 6,
  "accepted": 3,
  "rejected": 3,
  "upsertedWords": 3,
  "upsertedEdges": 2,
  "rejectionLogPath": "logs/import-rejections.ndjson"
}
```

What this means:

- `processed` is the number of input records seen by the pipeline
- `accepted` is the number of records that were persisted successfully
- `rejected` is the number of records that failed validation or normalization
- `upsertedWords` and `upsertedEdges` show how many canonical graph entities were written
- the rejection log is written to [logs/import-rejections.ndjson](logs/import-rejections.ndjson)

## Example: checking recent import status

Command:

```bash
npm run report:import-status
```

Expected result:

```json
[
  {
    "id": "<uuid>",
    "status": "COMPLETED",
    "processed_count": 6,
    "accepted_count": 3,
    "rejected_count": 3,
    "upserted_words": 3,
    "upserted_edges": 2,
    "summary": "{...}",
    "created_at": "..."
  }
]
```

This gives a quick operational view of the latest import runs.

## Example: resuming a failed import

Command:

```bash
npm run resume:import
```

Expected behavior:

- if there is a failed import job, the script will resume from the latest failed job and report the resumed job id plus the new run result
- if no failed job exists, the script prints:

```text
No failed import job found to resume.
```

## Notes

- The importer uses the sample fixture at [tests/fixtures/week4-import-dataset.json](tests/fixtures/week4-import-dataset.json).
- The command name is intentionally generic: `npm run import:data` is the main entrypoint for this workflow.
- Rejected records are preserved in the rejection log so they can be inspected without being silently dropped.
