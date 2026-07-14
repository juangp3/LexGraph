export interface WordDetails {
  word: string;
  language: string;
  meaning: string;
  sources: string[];
  timeline: string;
  ancestry: {
    stage: string;
    language: string;
  }[];
}
