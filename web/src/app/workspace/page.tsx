"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function Workspace() {
  const searchParams = useSearchParams();
  const wordId = searchParams.get("wordId");

  return (
    <div className="container mx-auto p-4" key={wordId}>
      <h1 className="text-2xl font-bold">Workspace</h1>
      {wordId ? (
        <p>Displaying information for word ID: {wordId}</p>
      ) : (
        <p>No word selected. Use the search to find a word.</p>
      )}
    </div>
  );
}

export default function WorkspacePage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <Workspace />
    </Suspense>
  );
}
