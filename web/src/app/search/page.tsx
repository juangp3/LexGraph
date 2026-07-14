"use client";

import { useState } from "react";

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query) return;

    setLoading(true);
    try {
      const response = await fetch(`http://localhost:3001/v1/search?q=${query}`);
      const data = await response.json();
      setResults(data.results);
    } catch (error) {
      console.error("Search failed:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center p-24 bg-gray-900 text-white">
      <header className="w-full max-w-5xl items-center justify-between font-mono text-sm lg:flex">
        <a href="/" className="fixed left-0 top-0 flex w-full justify-center border-b border-gray-300 bg-gradient-to-b from-zinc-200 pb-6 pt-8 backdrop-blur-2xl dark:border-neutral-800 dark:bg-zinc-800/30 dark:from-inherit lg:static lg:w-auto  lg:rounded-xl lg:border lg:bg-gray-200 lg:p-4 lg:dark:bg-zinc-800/30">
          LexGraph
        </a>
      </header>

      <main className="flex-1 flex flex-col items-center w-full max-w-5xl pt-16">
        <h1 className="text-4xl font-bold mb-8">Search</h1>
        <form onSubmit={handleSearch} className="w-full flex gap-2">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search for a word..."
            className="flex-grow p-2 rounded-md bg-gray-800 border border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="submit"
            disabled={loading}
            className="p-2 px-4 rounded-md bg-blue-600 hover:bg-blue-700 disabled:bg-gray-500"
          >
            {loading ? "Searching..." : "Search"}
          </button>
        </form>

        <div className="mt-8 w-full">
          {results.length > 0 && (
            <ul>
              {results.map((result: any) => (
                <li key={result.wordId} className="border-b border-gray-700 py-2">
                  <a href={`/words/${result.wordId}`} className="hover:underline">
                    <h3 className="text-xl">{result.textOriginal}</h3>
                    <p className="text-gray-400">{result.language}</p>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
    </div>
  );
}
