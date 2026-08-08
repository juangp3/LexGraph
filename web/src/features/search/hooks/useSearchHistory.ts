"use client";

import { useCallback, useEffect, useState } from "react";
import type { SearchResult } from "../types/search";

const STORAGE_KEY = "lexgraph:search-history";
const MAX_HISTORY = 20;

export interface SearchHistoryEntry {
  id: string;
  text: string;
  language: string | null;
  type: string;
  wordId: string;
  searchedAt: number;
}

function loadHistory(): SearchHistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as SearchHistoryEntry[];
  } catch {
    return [];
  }
}

function saveHistory(entries: SearchHistoryEntry[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // storage may be full or unavailable
  }
}

export function useSearchHistory() {
  const [history, setHistory] = useState<SearchHistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
  }, []);

  const addEntry = useCallback((result: SearchResult) => {
    setHistory((prev) => {
      // Deduplicate by wordId
      const filtered = prev.filter((e) => e.wordId !== result.wordId);
      const entry: SearchHistoryEntry = {
        id: result.id,
        text: result.text,
        language: result.language,
        type: result.type,
        wordId: result.wordId,
        searchedAt: Date.now(),
      };
      const next = [entry, ...filtered].slice(0, MAX_HISTORY);
      saveHistory(next);
      return next;
    });
  }, []);

  const removeEntry = useCallback((wordId: string) => {
    setHistory((prev) => {
      const next = prev.filter((e) => e.wordId !== wordId);
      saveHistory(next);
      return next;
    });
  }, []);

  const clearHistory = useCallback(() => {
    setHistory([]);
    saveHistory([]);
  }, []);

  return { history, addEntry, removeEntry, clearHistory };
}
