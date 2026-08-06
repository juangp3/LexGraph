import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import { useGraphStore } from '@/features/graph/graph.store';

function TestComponent() {
  const { relationFilters, toggleFilter, resetRelationFilters } = useGraphStore();

  return (
    <div>
      <pre data-testid="filters">{JSON.stringify(relationFilters)}</pre>
      <button onClick={() => toggleFilter('ancestors')}>toggle-anc</button>
      <button onClick={() => resetRelationFilters()}>reset</button>
    </div>
  );
}

describe('graph.store', () => {
  it('toggles and resets relation filters', async () => {
    render(<TestComponent />);

    const pre = screen.getByTestId('filters');
    expect(pre).toBeTruthy();
    // initial should include ancestors true
    expect(pre.textContent).toContain('"ancestors":true');

    const toggle = screen.getByText('toggle-anc');
    fireEvent.click(toggle);
    // after toggle, ancestors should be false
    expect(pre.textContent).toContain('"ancestors":false');

    const reset = screen.getByText('reset');
    fireEvent.click(reset);
    expect(pre.textContent).toContain('"ancestors":true');
  });
});
