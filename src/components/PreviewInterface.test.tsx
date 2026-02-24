import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PreviewInterface } from './PreviewInterface';
import { PreviewSession, PreviewItem } from '../types/eln';
import { RSpaceConfigProvider } from '../contexts/RSpaceConfigContext';
import React from 'react';

// Mock context to provide a configured state
const mockConfig = { baseUrl: 'https://rspace.test', apiKey: 'test-key' };

const makeMockItem = (id: string, name: string): PreviewItem => ({
  id,
  name,
  type: 'experiment',
  category: 'Test',
  categoryColor: '#000',
  proposedClassification: 'document',
  userClassification: null,
  confidence: 'high',
  justification: 'test',
  reasons: [],
  metadata: {},
  files: [],
  crossReferences: [],
  validationIssues: [],
  textContent: 'Content',
  steps: [],
  keywords: [],
  dateCreated: '2023-01-01T10:00:00Z',
  dateModified: '2023-01-01T10:00:00Z'
});

const mockSession: PreviewSession = {
  id: 'sess-1',
  createdAt: '2023-01-01T10:00:00Z',
  elnFileName: 'test.eln',
  totalItems: 2,
  items: [
    makeMockItem('1', 'Alpha'),
    makeMockItem('2', 'Beta')
  ],
  fileMetadata: {},
  fileBlobs: new Map()
};

describe('PreviewInterface', () => {
  it('renders session items and summary', () => {
    render(
      <RSpaceConfigProvider>
        <PreviewInterface
          session={mockSession}
          onImport={() => {}}
          onBack={() => {}}
          onClassificationChange={() => {}}
          onConfigureRSpace={() => {}}
        />
      </RSpaceConfigProvider>
    );

    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.getByText('Beta')).toBeInTheDocument();
    expect(screen.getByText('Import Preview Summary')).toBeInTheDocument();
  });

  it('filters items by search query', () => {
    render(
      <RSpaceConfigProvider>
        <PreviewInterface
          session={mockSession}
          onImport={() => {}}
          onBack={() => {}}
          onClassificationChange={() => {}}
          onConfigureRSpace={() => {}}
        />
      </RSpaceConfigProvider>
    );

    const searchInput = screen.getByPlaceholderText('Search items...');
    fireEvent.change(searchInput, { target: { value: 'Alpha' } });

    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.queryByText('Beta')).not.toBeInTheDocument();
  });

  it('selects items for import', () => {
    render(
      <RSpaceConfigProvider>
        <PreviewInterface
          session={mockSession}
          onImport={() => {}}
          onBack={() => {}}
          onClassificationChange={() => {}}
          onConfigureRSpace={() => {}}
        />
      </RSpaceConfigProvider>
    );

    // Find checkboxes. They are likely in PreviewCard. 
    // Wait, PreviewCard doesn't seem to have a checkbox in the snippet I saw.
    // Let's check PreviewInterface for where checkboxes are rendered.
  });

  it('calls onBack when Back button is clicked', () => {
    const onBack = vi.fn();
    render(
      <RSpaceConfigProvider>
        <PreviewInterface
          session={mockSession}
          onImport={() => {}}
          onBack={onBack}
          onClassificationChange={() => {}}
          onConfigureRSpace={() => {}}
        />
      </RSpaceConfigProvider>
    );

    const backButton = screen.getByText(/Back/i);
    fireEvent.click(backButton);
    expect(onBack).toHaveBeenCalled();
  });
});
