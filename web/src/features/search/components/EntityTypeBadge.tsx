import type { SearchEntityType } from "../types/search";

interface EntityTypeBadgeProps {
  type: SearchEntityType;
  stage?: string | null;
  className?: string;
}

const LABELS: Record<SearchEntityType, string> = {
  word: "WORD",
  root: "ROOT",
  language: "LANGUAGE",
  family: "FAMILY",
};

const COLORS: Record<SearchEntityType, string> = {
  word: "text-blue-400 bg-blue-400/10 border-blue-400/20",
  root: "text-yellow-400 bg-yellow-400/10 border-yellow-400/20",
  language: "text-green-400 bg-green-400/10 border-green-400/20",
  family: "text-purple-400 bg-purple-400/10 border-purple-400/20",
};

export function EntityTypeBadge({ type, stage, className = "" }: EntityTypeBadgeProps) {
  const label = stage === "Proto" ? "PROTO" : LABELS[type];
  const color = COLORS[type];

  return (
    <span
      className={`inline-flex items-center rounded border px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-widest ${color} ${className}`}
    >
      {label}
    </span>
  );
}
