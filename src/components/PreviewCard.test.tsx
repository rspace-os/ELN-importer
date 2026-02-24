import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PreviewCard } from './PreviewCard';
import { PreviewItem } from '../types/eln';
import React from 'react';

const mockItem: PreviewItem = {
  id: 'item-1',
  name: 'Test Experiment',
  type: 'experiment',
  category: 'Experiments',
  categoryColor: '#3b82f6',
  proposedClassification: 'document',
  userClassification: null,
  confidence: 'high',
  justification: 'This is a test experiment justification.',
  reasons: ['Reason 1', 'Reason 2'],
  metadata: {
    'Field 1': { value: 'Value 1', type: 'text' }
  },
  files: ['file-1'],
  crossReferences: ['ref-1'],
  validationIssues: [
    { type: 'warning', message: 'Test warning' }
  ],
  textContent: 'Test content',
  steps: [],
  keywords: ['key1', 'key2'],
  dateCreated: '2023-01-01T10:00:00Z',
  dateModified: '2023-01-01T10:00:00Z'
};

describe('PreviewCard', () => {
  it('renders item basic information', () => {
    render(
      <PreviewCard
        item={mockItem}
        onClassificationChange={() => {}}
        onItemClick={() => {}}
      />
    );

    expect(screen.getByText('Test Experiment')).toBeInTheDocument();
    expect(screen.getByText('Experiments')).toBeInTheDocument();
    expect(screen.getByText('high confidence')).toBeInTheDocument();
    expect(screen.getByText('key1, key2')).toBeInTheDocument();
  });

  it('calls onClassificationChange when toggle is used', () => {
    const onClassificationChange = vi.fn();
    render(
      <PreviewCard
        item={mockItem}
        onClassificationChange={onClassificationChange}
        onItemClick={() => {}}
      />
    );

    // ClassificationToggle buttons
    const inventoryButton = screen.getByText('Inventory');
    fireEvent.click(inventoryButton);

    expect(onClassificationChange).toHaveBeenCalledWith('item-1', 'inventory');
  });

  it('calls onItemClick when "View Details" is clicked', () => {
    const onItemClick = vi.fn();
    render(
      <PreviewCard
        item={mockItem}
        onClassificationChange={() => {}}
        onItemClick={onItemClick}
      />
    );

    const viewButton = screen.getByText('View Details');
    fireEvent.click(viewButton);

    expect(onItemClick).toHaveBeenCalledWith(mockItem);
  });

  it('shows/hides justification when chevron is clicked', () => {
    render(
      <PreviewCard
        item={mockItem}
        onClassificationChange={() => {}}
        onItemClick={() => {}}
      />
    );

    // Initially justification might not be visible or hidden by CSS
    // The component uses state `isExpanded`
    
    // In our component, if isExpanded is true, it renders some extra info.
    // Let's check for the justification text which is in the expanded section.
    
    expect(screen.queryByText('Justification:')).not.toBeInTheDocument();
    
    const chevronButton = screen.getByRole('button', { name: '' }); // The one with chevron icon
    // Actually, looking at the code, the button doesn't have an aria-label. 
    // It's the one with `onClick={() => setIsExpanded(!isExpanded)}`.
    
    // Let's click the expand toggle button.
    const buttons = screen.getAllByRole('button');
    // From the component code:
    // Button 0: Document
    // Button 1: Inventory
    // Button 2: Expand/Collapse Chevron
    // Button 3: View Details
    
    fireEvent.click(buttons[2]);
    
    expect(screen.getByText('Content Preview')).toBeInTheDocument();
  });
});
