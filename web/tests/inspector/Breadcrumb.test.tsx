import React from 'react';
import { render, screen } from '@testing-library/react';
import Breadcrumb from '@/features/inspector/Breadcrumb';

describe('Breadcrumb', () => {
  it('renders ancestry items with language + stage labels', () => {
    render(
      <Breadcrumb
        ancestry={[
          { language: 'Proto-Indo-European', stage: '*ph2ter' },
          { language: 'Modern English', stage: 'father' },
        ]}
      />
    );

    expect(screen.getByLabelText('Language ancestry')).toBeInTheDocument();
    expect(screen.getByText('Proto-Indo-European')).toBeInTheDocument();
    expect(screen.getByText('*ph2ter')).toBeInTheDocument();
    expect(screen.getByText('Modern English')).toBeInTheDocument();
    expect(screen.getByText('father')).toBeInTheDocument();
  });

  it('renders all steps in order', () => {
    render(
      <Breadcrumb
        ancestry={[
          { language: 'Latin', stage: 'antecessor' },
          { language: 'Old French', stage: 'ancestre' },
          { language: 'Modern English', stage: 'ancestor' },
        ]}
      />
    );

    const list = screen.getByRole('list');
    expect(list.textContent).toContain('Latinantecessor');
    expect(list.textContent).toContain('Old Frenchancestre');
    expect(list.textContent).toContain('Modern Englishancestor');
  });
});
