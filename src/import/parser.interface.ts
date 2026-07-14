import type { RawImportRecord } from "./types.js";

export interface Parser {
  parse(): Promise<RawImportRecord[]>;
}
