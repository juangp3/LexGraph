import React from 'react';
import { render, screen } from '@testing-library/react';
import InspectorPanel from '@/features/inspector/InspectorPanel';
import { vi } from 'vitest';

const mockUseWordDetails = vi.fn();

vi.mock('@/features/inspector/useWordDetails', () => ({
  useWordDetails: (word: string | null) => mockUseWordDetails(word),
}));

describe('InspectorPanel', () => {
  it('shows loading state', () => {
    mockUseWordDetails.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
    });

    render(<InspectorPanel word="father" />);
    expect(screen.getByText('Loading metadata...')).toBeInTheDocument();
  });

  it('shows error state', () => {
    mockUseWordDetails.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
    });

    render(<InspectorPanel word="father" />);
    expect(screen.getByText('Unable to fetch metadata.')).toBeInTheDocument();
  });

  it('shows empty state when no selection is available', () => {
    mockUseWordDetails.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: false,
    });

    render(<InspectorPanel word={null} />);
    expect(
      screen.getByText('Select a node to inspect metadata.')
    ).toBeInTheDocument();
  });

  it('renders meaning, timeline, sources, and ancestry for loaded metadata', () => {
    mockUseWordDetails.mockReturnValue({
      data: {
        word: 'father',
        language: 'English',
        meaning: 'A male parent.',
        timeline: 'Proto-Indo-European -> Modern English',
        sources: ['Oxford English Dictionary', 'Etymonline'],
        ancestry: [
          { language: 'Proto-Indo-European', stage: '*ph2ter' },
          { language: 'Modern English', stage: 'father' },
        ],
      },
      isLoading: false,
      isError: false,
    });

    render(<InspectorPanel word="father" />);

    expect(
      screen.getByRole('heading', { name: 'father', level: 2 })
    ).toBeInTheDocument();
    expect(screen.getByText('English')).toBeInTheDocument();
    expect(screen.getByText('A male parent.')).toBeInTheDocument();
    expect(
      screen.getByText('Proto-Indo-European -> Modern English')
    ).toBeInTheDocument();
    expect(screen.getByText('Oxford English Dictionary')).toBeInTheDocument();
    expect(screen.getByText('*ph2ter')).toBeInTheDocument();
  });
});
