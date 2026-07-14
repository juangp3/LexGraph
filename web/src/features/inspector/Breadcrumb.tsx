import React from 'react';
import { WordDetails } from '@/types/word-details';

interface BreadcrumbProps {
  ancestry: WordDetails['ancestry'];
}

const Breadcrumb: React.FC<BreadcrumbProps> = ({ ancestry }) => {
  return (
    <nav aria-label="Language ancestry">
      <ol className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        {ancestry.map((item, index) => (
          <li key={`${item.language}-${item.stage}`} className="flex items-center gap-2">
            <span className="rounded-full border border-border px-2 py-1">
              {item.language}
            </span>
            <span>{item.stage}</span>
            {index < ancestry.length - 1 && <span aria-hidden>{'>'}</span>}
          </li>
        ))}
      </ol>
    </nav>
  );
};

export default Breadcrumb;
