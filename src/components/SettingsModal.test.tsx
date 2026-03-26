import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SettingsModal } from './SettingsModal';
import { RSpaceConfigProvider } from '../contexts/RSpaceConfigContext';
import React from 'react';

const renderWithProvider = (ui: React.ReactElement) => {
  return render(
    <RSpaceConfigProvider>
      {ui}
    </RSpaceConfigProvider>
  );
};

describe('SettingsModal', () => {
  it('renders nothing when isOpen is false', () => {
    const { container } = renderWithProvider(
      <SettingsModal isOpen={false} onClose={() => {}} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders form when open', () => {
    renderWithProvider(<SettingsModal isOpen={true} onClose={() => {}} />);
    
    expect(screen.getByText('RSpace Configuration')).toBeInTheDocument();
    expect(screen.getByLabelText('RSpace Base URL')).toBeInTheDocument();
    expect(screen.getByLabelText('API Key')).toBeInTheDocument();
  });

  it('allows entering and saving configuration', async () => {
    const onClose = vi.fn();
    renderWithProvider(<SettingsModal isOpen={true} onClose={onClose} />);

    const urlInput = screen.getByLabelText('RSpace Base URL');
    const keyInput = screen.getByLabelText('API Key');
    const saveButton = screen.getByText('Save Configuration');

    fireEvent.change(urlInput, { target: { value: 'https://test.rspace.com' } });
    fireEvent.change(keyInput, { target: { value: 'test-api-key' } });

    fireEvent.click(saveButton);

    expect(screen.getByText('Configuration saved!')).toBeInTheDocument();
    
    // Should call onClose after timeout
    await waitFor(() => expect(onClose).toHaveBeenCalled(), { timeout: 2000 });
  });

  it('disables save button when inputs are empty', () => {
    renderWithProvider(<SettingsModal isOpen={true} onClose={() => {}} />);
    
    const urlInput = screen.getByLabelText('RSpace Base URL');
    const keyInput = screen.getByLabelText('API Key');
    const saveButton = screen.getByText('Save Configuration') as HTMLButtonElement;

    fireEvent.change(urlInput, { target: { value: '' } });
    fireEvent.change(keyInput, { target: { value: '' } });

    expect(saveButton.disabled).toBe(true);
  });
});
