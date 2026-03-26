import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ItemDetailModal } from './ItemDetailModal';
import { PreviewItem } from '../types/eln';
import React from 'react';

const mockItem: PreviewItem = {
  id: 'item-1',
  name: 'Detailed Test Item',
  type: 'experiment',
  category: 'Experiments',
  categoryColor: '#3b82f6',
  proposedClassification: 'document',
  userClassification: null,
  confidence: 'high',
  justification: 'Justification for detailed item.',
  reasons: ['Reason 1'],
  metadata: {
    'Field A': { value: 'Value A', type: 'text', description: 'Desc A' }
  },
  files: ['file-1.png'],
  crossReferences: ['ref-1'],
  validationIssues: [
    { type: 'warning', message: 'Detail warning' }
  ],
  textContent: 'Some detailed content here.',
  steps: [],
  keywords: ['k1'],
  dateCreated: '2023-01-01T10:00:00Z',
  dateModified: '2023-01-01T10:00:00Z'
};

describe('ItemDetailModal', () => {
  it('renders nothing when isOpen is false', () => {
    const { container } = render(
      <ItemDetailModal
        item={mockItem}
        isOpen={false}
        onClose={() => {}}
        onClassificationChange={() => {}}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders basic item info when open and shows author', () => {
    render(
      <ItemDetailModal
        item={{ ...mockItem, authorName: 'John Author' }}
        isOpen={true}
        onClose={() => {}}
        onClassificationChange={() => {}}
      />
    );

    expect(screen.getByText('Detailed Test Item')).toBeInTheDocument();
    expect(screen.getByText(/Author:/)).toBeInTheDocument();
    expect(screen.getByText('John Author')).toBeInTheDocument();
  });

  it('renders step with expires field', () => {
    const itemWithExpires: PreviewItem = {
      ...mockItem,
      steps: [
        {
          '@id': 'step-1',
          '@type': 'HowToStep',
          position: 1,
          creativeWorkStatus: 'unfinished',
          expires: '2026-02-25T17:42:10Z',
          itemListElement: {
            '@id': 'dir-1',
            '@type': 'HowToDirection',
            text: 'Step with deadline'
          }
        }
      ]
    };
    render(
      <ItemDetailModal
        item={itemWithExpires}
        isOpen={true}
        onClose={() => {}}
        onClassificationChange={() => {}}
      />
    );

    expect(screen.getByText('Step with deadline')).toBeInTheDocument();
    expect(screen.getByText(/Expires:/)).toBeInTheDocument();
    expect(screen.getByText(/2\/25\/2026/)).toBeInTheDocument();
  });

  it('switches tabs correctly', () => {
    render(
      <ItemDetailModal
        item={mockItem}
        isOpen={true}
        onClose={() => {}}
        onClassificationChange={() => {}}
      />
    );

    // Initial tab is Overview
    expect(screen.getByText('Some detailed content here.')).toBeInTheDocument();

    // Click Metadata tab
    const metadataTab = screen.getByText('Metadata');
    fireEvent.click(metadataTab);

    expect(screen.getByText('Field A')).toBeInTheDocument();
    expect(screen.getByText('Value A')).toBeInTheDocument();
    expect(screen.queryByText('Some detailed content here.')).not.toBeInTheDocument();

    // Click Files tab
    const filesTab = screen.getByText('Files');
    fireEvent.click(filesTab);
    expect(screen.getByText('file-1.png')).toBeInTheDocument();
  });

  it('calls onClassificationChange from toggle', () => {
    const onClassificationChange = vi.fn();
    render(
      <ItemDetailModal
        item={mockItem}
        isOpen={true}
        onClose={() => {}}
        onClassificationChange={onClassificationChange}
      />
    );

    const inventoryButton = screen.getByText('Inventory');
    fireEvent.click(inventoryButton);

    expect(onClassificationChange).toHaveBeenCalledWith('item-1', 'inventory');
  });

  it('calls onClose when close button clicked', () => {
    const onClose = vi.fn();
    render(
      <ItemDetailModal
        item={mockItem}
        isOpen={true}
        onClose={onClose}
        onClassificationChange={() => {}}
      />
    );

    // Find close button (the one with X icon)
    // It's the only button in the header usually, or we can use getAllByRole
    const buttons = screen.getAllByRole('button');
    // Button 0: Document
    // Button 1: Inventory
    // Button 2: Close X
    
    // Let's be safer and find the one that has no text if possible, or just click 2.
    // Let's find the button by its Lucide icon or just try other indices.
    // X icon is often the only one in the header with no text.
    const closeButton = buttons.find(b => b.querySelector('svg'));
    if (closeButton) {
        fireEvent.click(closeButton);
    } else {
        fireEvent.click(buttons[buttons.length - 1]); // Try last button
    }
    expect(onClose).toHaveBeenCalled();
  });
});
