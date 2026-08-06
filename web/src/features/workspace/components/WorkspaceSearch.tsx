"use client";

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";

interface SearchResult {
  id: string;
  word: string;
  language: string;
}

interface SearchResponse {
  total: number;
  results: SearchResult[];
}

async function searchWords(query: string): Promise<SearchResponse> {
  if (!query) {
    return { total: 0, results: [] };
  }
  const response = await fetch(`${API_BASE}/v1/search?q=${encodeURIComponent(query)}`);
  if (!response.ok) {
    throw new Error("Network response was not ok");
  }
  return response.json();
}

export function WorkspaceSearch() {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const router = useRouter();

  const { data, isLoading } = useQuery<SearchResponse>({
    queryKey: ["search", query],
    queryFn: () => searchWords(query),
    enabled: open && query.length > 0,
  });

  const handleSelect = (word: string, wordId: string) => {
    setOpen(false);
    setQuery("");
    router.push(`/workspace?word=${encodeURIComponent(word)}&wordId=${wordId}`);
  };

  return (
    <div className="relative w-full max-w-sm">
      <Command className="rounded-lg border shadow-md">
        <CommandInput
          placeholder="Search words..."
          value={query}
          onValueChange={setQuery}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
        />
        {open && (
          <CommandList className="max-h-64 overflow-y-auto">
            {isLoading && <CommandEmpty>Loading...</CommandEmpty>}
            {!isLoading && query && !data?.results.length && (
              <CommandEmpty>No results found.</CommandEmpty>
            )}
            {!isLoading && query && data?.results && (
              <CommandGroup heading="Results">
                {data.results.map((item) => (
                  <CommandItem
                    key={item.id}
                    onSelect={() => handleSelect(item.word, item.id)}
                    value={`${item.word} (${item.language})`}
                  >
                    <span>{item.word}</span>
                    <span className="ml-2 text-xs text-gray-500">{item.language}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        )}
      </Command>
    </div>
  );
}
