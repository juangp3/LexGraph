import { normalizeInput } from "../domain/normalizer.js";
import type { WordRepository } from "../repositories/interfaces.js";

export class WordService {
  constructor(private readonly words: WordRepository) {}

  async findExisting(languageId: string, rawText: string, lemma?: string) {
    const textNormalized = normalizeInput(rawText);
    return this.words.findByNormalized(languageId, textNormalized, lemma);
  }
}
