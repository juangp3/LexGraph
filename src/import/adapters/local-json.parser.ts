import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Parser } from "../parser.interface.js";
import type { RawImportRecord } from "../types.js";

interface LocalJsonDataset {
  records: RawImportRecord[];
}

export class LocalJsonParser implements Parser {
  constructor(private readonly datasetPath: string) {}

  async parse(): Promise<RawImportRecord[]> {
    const absolutePath = resolve(this.datasetPath);
    const raw = readFileSync(absolutePath, "utf8");
    const dataset = JSON.parse(raw) as LocalJsonDataset;

    if (!Array.isArray(dataset.records)) {
      throw new Error("Invalid dataset format: expected records array");
    }

    return dataset.records;
  }
}
