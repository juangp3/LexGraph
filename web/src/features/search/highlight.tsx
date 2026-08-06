import type { ReactNode } from "react";

export function highlightMatch(text: string, query: string): ReactNode {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) {
    return text;
  }

  const lowerText = text.toLowerCase();
  const lowerQuery = trimmedQuery.toLowerCase();
  const matchIndex = lowerText.indexOf(lowerQuery);

  if (matchIndex === -1) {
    return text;
  }

  const matchEnd = matchIndex + trimmedQuery.length;

  return (
    <>
      {text.slice(0, matchIndex)}
      <mark className="rounded bg-primary/15 px-0.5 text-foreground">{text.slice(matchIndex, matchEnd)}</mark>
      {text.slice(matchEnd)}
    </>
  );
}