import React, { useState, useEffect } from 'react';
import { X, Settings, Check, AlertCircle } from 'lucide-react';
import { useRSpaceConfig } from '../contexts/RSpaceConfigContext';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const { config, setConfig } = useRSpaceConfig();
  const [baseUrl, setBaseUrl] = useState('https://demos.researchspace.com');
  const [apiKey, setApiKey] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    if (config) {
      setBaseUrl(config.baseUrl);
      setApiKey(config.apiKey);
    }
  }, [config]);

  if (!isOpen) return null;

  const handleSave = () => {
    const trimmedUrl = baseUrl.trim().replace(/\/$/, '');
    const trimmedKey = apiKey.trim();

    if (!trimmedUrl || !trimmedKey) {
      return;
    }

    setConfig({
      baseUrl: trimmedUrl,
      apiKey: trimmedKey,
    });

    setShowSuccess(true);
    setTimeout(() => {
      setShowSuccess(false);
      onClose();
    }, 1500);
  };

  const handleClear = () => {
    setConfig(null);
    setBaseUrl('');
    setApiKey('');
  };

  const isValid = baseUrl.trim() !== '' && apiKey.trim() !== '';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Settings className="w-6 h-6 text-blue-600" />
            <h2 className="text-xl font-semibold text-gray-900">RSpace Configuration</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6">
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg flex gap-3">
            <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-900">
              <p className="font-medium mb-1">Session-Only Storage</p>
              <p className="text-blue-700">
                Your credentials are stored only in browser memory and will be cleared when you refresh
                the page. They are never sent to any server or stored permanently.
              </p>
            </div>
          </div>

          <div className="space-y-5">
            <div>
              <label htmlFor="baseUrl" className="block text-sm font-medium text-gray-700 mb-2">
                RSpace Base URL
              </label>
              <input
                id="baseUrl"
                type="text"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder="https://your-rspace-instance.com"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
              />
              <p className="mt-1.5 text-xs text-gray-500">
                The base URL of your RSpace instance (without trailing slash)
              </p>
            </div>

            <div>
              <label htmlFor="apiKey" className="block text-sm font-medium text-gray-700 mb-2">
                API Key
              </label>
              <input
                id="apiKey"
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Enter your RSpace API key"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all font-mono text-sm"
              />
              <p className="mt-1.5 text-xs text-gray-500">
                Your RSpace API key (found in your RSpace account settings)
              </p>
            </div>
          </div>

          {showSuccess && (
            <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-3">
              <Check className="w-5 h-5 text-green-600" />
              <span className="text-sm font-medium text-green-900">Configuration saved!</span>
            </div>
          )}

          <div className="mt-8 flex items-center justify-between gap-4">
            <button
              onClick={handleClear}
              disabled={!config}
              className="px-4 py-2 text-sm font-medium text-red-600 hover:text-red-700 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              Clear Configuration
            </button>

            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="px-5 py-2.5 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={!isValid}
                className="px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                Save Configuration
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
