import { describe, expect, it, vi } from "vitest";
import type { WordRepository } from "../../src/repositories/interfaces.js";
import { WordService } from "../../src/services/word.service.js";

describe("WordService", () => {
  it("queries repository with normalized input", async () => {
    const findByNormalized = vi.fn().mockResolvedValue(null);

    const repo: WordRepository = {
      upsertWord: vi.fn(),
      findByNormalized,
      attachSource: vi.fn()
    };

    const service = new WordService(repo);
    await service.findExisting("lang-1", " Fader ");

    expect(findByNormalized).toHaveBeenCalledWith("lang-1", "fader", undefined);
  });
});
