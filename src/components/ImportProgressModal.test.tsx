import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ImportProgressModal } from './ImportProgressModal';
import React from 'react';

const mockProgress = {
  current: 2,
  total: 5,
  currentItem: 'Test Item',
  status: 'importing' as const,
  results: [
    { item: 'Item 1', success: true, rspaceId: '123' },
    { item: 'Item 2', success: false, error: 'Failed' }
  ]
};

describe('ImportProgressModal', () => {
  it('renders nothing when isOpen is false', () => {
    const { container } = render(
      <ImportProgressModal
        isOpen={false}
        progress={mockProgress}
        onClose={() => {}}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when progress is null', () => {
    const { container } = render(
      <ImportProgressModal
        isOpen={true}
        progress={null}
        onClose={() => {}}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders progress information when open', () => {
    render(
      <ImportProgressModal
        isOpen={true}
        progress={mockProgress}
        onClose={() => {}}
      />
    );

    expect(screen.getByText('Importing to RSpace')).toBeInTheDocument();
    expect(screen.getByText('Importing Test Item...')).toBeInTheDocument();
    expect(screen.getByText('Progress: 2 of 5')).toBeInTheDocument();
    expect(screen.getByText('40%')).toBeInTheDocument();
  });

  it('displays results list', () => {
    render(
      <ImportProgressModal
        isOpen={true}
        progress={{ ...mockProgress, status: 'complete' }}
        onClose={() => {}}
      />
    );

    expect(screen.getByText('Item 1')).toBeInTheDocument();
    expect(screen.getByText('Item 2')).toBeInTheDocument();
  });

  it('shows close button only when complete or error', () => {
    const onClose = vi.fn();
    const { rerender } = render(
      <ImportProgressModal
        isOpen={true}
        progress={mockProgress}
        onClose={onClose}
      />
    );

    // Should not have close button (no X icon button found by role easily without aria-label)
    // But we can check for the button tag if it exists.
    // In our component, {canClose && <button ...><X .../></button>}
    
    // Status is 'importing', canClose is false
    // There might be other buttons (e.g. if we add some in the body), 
    // but in current implementation, the close button is the only one and it's conditional.
    // Let's check for the X icon or button.
    const buttons = screen.queryAllByRole('button');
    expect(buttons.length).toBe(0);

    // Change status to complete
    rerender(
      <ImportProgressModal
        isOpen={true}
        progress={{ ...mockProgress, status: 'complete' }}
        onClose={onClose}
      />
    );

    const closeButtons = screen.getAllByRole('button');
    // There might be two buttons if footer also has one.
    fireEvent.click(closeButtons[0]);
    expect(onClose).toHaveBeenCalled();
  });
});
