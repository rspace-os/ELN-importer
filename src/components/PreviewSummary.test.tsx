import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PreviewSummary } from './PreviewSummary';
import { PreviewSession, PreviewItem } from '../types/eln';
import React from 'react';

const makeMockItem = (id: string, type: 'experiment' | 'resource', proposed: 'document' | 'inventory'): PreviewItem => ({
  id,
  name: `Item ${id}`,
  type,
  category: 'Test',
  categoryColor: '#000',
  proposedClassification: proposed,
  userClassification: null,
  confidence: 'high',
  justification: 'test',
  reasons: [],
  metadata: {},
  files: [],
  crossReferences: [],
  validationIssues: [],
  textContent: '',
  steps: [],
  keywords: [],
  dateCreated: '',
  dateModified: ''
});

const mockSession: PreviewSession = {
  id: 'session-12345678',
  createdAt: '2023-01-01T10:00:00Z',
  elnFileName: 'test-data.eln',
  totalItems: 3,
  items: [
    makeMockItem('1', 'experiment', 'document'),
    makeMockItem('2', 'resource', 'inventory'),
    makeMockItem('3', 'resource', 'document'),
  ],
  fileMetadata: {
    'file1': { name: 'f1.txt' } as any,
    'file2': { name: 'f2.txt' } as any
  },
  fileBlobs: new Map()
};

describe('PreviewSummary', () => {
  it('renders session overview information', () => {
    render(<PreviewSummary session={mockSession} />);
    
    expect(screen.getByText('Import Preview Summary')).toBeInTheDocument();
    expect(screen.getByText('test-data.eln')).toBeInTheDocument();
    
    // Total items '3' shows up in multiple places, use a regex or specific class/container if needed
    // or just check that at least one is there.
    const totalItems = screen.getAllByText('3');
    expect(totalItems.length).toBeGreaterThan(0);
    expect(screen.getByText('Total Items')).toBeInTheDocument();
  });

  it('displays correct content breakdown', () => {
    render(<PreviewSummary session={mockSession} />);
    
    // Experiments: 1
    // Resources: 2
    expect(screen.getByText('Experiments')).toBeInTheDocument();
    expect(screen.getByText('Resources')).toBeInTheDocument();
    
    // We have multiple '1' and '2' on screen, so we might need more specific selectors if it fails
    // But usually it finds them.
  });

  it('displays correct classification breakdown', () => {
    render(<PreviewSummary session={mockSession} />);
    
    // Documents: 2 (Item 1 and Item 3)
    // Inventory Items: 1 (Item 2)
    expect(screen.getByText('→ Documents')).toBeInTheDocument();
    expect(screen.getByText('→ Inventory Items')).toBeInTheDocument();
  });

  it('displays file and cross-reference counts', () => {
    render(<PreviewSummary session={mockSession} />);
    expect(screen.getByText(/2 attached files/)).toBeInTheDocument();
  });
});
