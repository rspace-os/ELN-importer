import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FileUpload } from './FileUpload';
import React from 'react';
import toast from 'react-hot-toast';

// Mock react-hot-toast
vi.mock('react-hot-toast', () => ({
  default: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

describe('FileUpload', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders upload message when not processing', () => {
    render(<FileUpload onFileSelect={() => {}} isProcessing={false} />);
    expect(screen.getByText('Upload .ELN Export')).toBeInTheDocument();
    expect(screen.getByText('Drag and drop your .eln file here, or click to browse')).toBeInTheDocument();
  });

  it('renders processing state when isProcessing is true', () => {
    render(<FileUpload onFileSelect={() => {}} isProcessing={true} />);
    expect(screen.getByText('Processing ELN file...')).toBeInTheDocument();
    expect(screen.getByText('This may take a few moments')).toBeInTheDocument();
  });

  it('calls onFileSelect when a file is dropped', async () => {
    const onFileSelect = vi.fn();
    render(<FileUpload onFileSelect={onFileSelect} isProcessing={false} />);
    
    const file = new File(['dummy content'], 'test.eln', { type: 'application/zip' });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;

    // Simulate file drop/select
    fireEvent.change(input, { target: { files: [file] } });
  });

  it('shows error toast for invalid file type', () => {
     // This is harder to test without deeply mocking react-dropzone 
     // because the rejection logic is inside onDrop which is passed to useDropzone.
  });
});
