import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ClassificationToggle } from './ClassificationToggle';
import React from 'react';

describe('ClassificationToggle', () => {
  it('renders both buttons', () => {
    render(
      <ClassificationToggle
        currentClassification="document"
        onClassificationChange={() => {}}
      />
    );
    expect(screen.getByText('Document')).toBeInTheDocument();
    expect(screen.getByText('Inventory')).toBeInTheDocument();
  });

  it('highlights the active classification', () => {
    const { rerender } = render(
      <ClassificationToggle
        currentClassification="document"
        onClassificationChange={() => {}}
      />
    );
    
    // Document button should have blue background
    expect(screen.getByText('Document')).toHaveClass('bg-blue-600');
    expect(screen.getByText('Inventory')).not.toHaveClass('bg-purple-600');

    rerender(
      <ClassificationToggle
        currentClassification="inventory"
        onClassificationChange={() => {}}
      />
    );

    // Inventory button should have purple background
    expect(screen.getByText('Inventory')).toHaveClass('bg-purple-600');
    expect(screen.getByText('Document')).not.toHaveClass('bg-blue-600');
  });

  it('calls onClassificationChange when buttons are clicked', () => {
    const handleChange = vi.fn();
    render(
      <ClassificationToggle
        currentClassification="document"
        onClassificationChange={handleChange}
      />
    );

    fireEvent.click(screen.getByText('Inventory'));
    expect(handleChange).toHaveBeenCalledWith('inventory');

    fireEvent.click(screen.getByText('Document'));
    expect(handleChange).toHaveBeenCalledWith('document');
  });

  it('applies size classes correctly', () => {
    const { rerender } = render(
      <ClassificationToggle
        currentClassification="document"
        onClassificationChange={() => {}}
        size="small"
      />
    );
    expect(screen.getByText('Document')).toHaveClass('text-xs');

    rerender(
      <ClassificationToggle
        currentClassification="document"
        onClassificationChange={() => {}}
        size="large"
      />
    );
    expect(screen.getByText('Document')).toHaveClass('px-4');
  });
});
