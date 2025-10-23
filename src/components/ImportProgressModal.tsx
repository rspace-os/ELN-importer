import React from 'react';
import { 
  X, 
  Upload, 
  CheckCircle, 
  AlertTriangle, 
  Clock,
  ExternalLink
} from 'lucide-react';
import clsx from 'clsx';

interface ImportProgressModalProps {
  isOpen: boolean;
  progress: {
    current: number;
    total: number;
    currentItem: string;
    status: 'preparing' | 'importing' | 'uploading_files' | 'linking' | 'complete' | 'error';
    results: Array<{ item: string; success: boolean; error?: string; rspaceId?: string }>;
  } | null;
  onClose: () => void;
}

export function ImportProgressModal({ isOpen, progress, onClose }: ImportProgressModalProps) {
  if (!isOpen || !progress) return null;

  const progressPercentage = progress.total > 0 ? (progress.current / progress.total) * 100 : 0;

  console.log('ImportProgressModal render:', {
    isOpen,
    current: progress.current,
    total: progress.total,
    percentage: progressPercentage,
    status: progress.status
  });
  const successCount = progress.results.filter(r => r.success).length;
  const failureCount = progress.results.filter(r => !r.success).length;

  const getStatusIcon = () => {
    switch (progress.status) {
      case 'preparing':
        return <Clock className="h-6 w-6 text-blue-600 animate-pulse" />;
      case 'importing':
      case 'uploading_files':
      case 'linking':
        return <Upload className="h-6 w-6 text-blue-600 animate-bounce" />;
      case 'complete':
        return <CheckCircle className="h-6 w-6 text-green-600" />;
      case 'error':
        return <AlertTriangle className="h-6 w-6 text-red-600" />;
      default:
        return <Clock className="h-6 w-6 text-gray-400" />;
    }
  };

  const getStatusText = () => {
    switch (progress.status) {
      case 'preparing':
        return 'Preparing import...';
      case 'importing':
        return `Importing ${progress.currentItem}...`;
      case 'uploading_files':
        return `${progress.currentItem}...`;
      case 'linking':
        return 'Adding cross-references...';
      case 'complete':
        return 'Import completed!';
      case 'error':
        return 'Import failed';
      default:
        return 'Processing...';
    }
  };

  const canClose = progress.status === 'complete' || progress.status === 'error';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            {getStatusIcon()}
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                Importing to RSpace
              </h2>
              <p className="text-sm text-gray-600">{getStatusText()}</p>
            </div>
          </div>
          {canClose && (
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <X className="h-5 w-5 text-gray-400" />
            </button>
          )}
        </div>

        {/* Progress */}
        <div className="p-6">
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">
                Progress: {progress.current} of {progress.total}
              </span>
              <span className="text-sm text-gray-500">
                {Math.round(progressPercentage)}%
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className={clsx(
                  'h-2 rounded-full transition-all duration-300',
                  progress.status === 'error' ? 'bg-red-500' : 'bg-blue-600'
                )}
                style={{ width: `${progressPercentage}%` }}
              />
            </div>
          </div>

          {/* Current Item */}
          {(progress.status === 'importing' || progress.status === 'uploading_files' || progress.status === 'linking') && progress.currentItem && (
            <div className="mb-4 p-3 bg-blue-50 rounded-lg">
              <div className="text-sm text-blue-800">
                <strong>Currently processing:</strong> {progress.currentItem}
              </div>
            </div>
          )}

          {/* Results Summary */}
          {progress.results.length > 0 && (
            <div className="mb-4">
              <h3 className="text-sm font-medium text-gray-900 mb-2">Import Summary</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="flex items-center space-x-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span className="text-green-700">
                    {successCount} successful
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <AlertTriangle className="h-4 w-4 text-red-500" />
                  <span className="text-red-700">
                    {failureCount} failed
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Detailed Results */}
          {progress.status === 'complete' && progress.results.length > 0 && (
            <div className="max-h-60 overflow-y-auto">
              <h3 className="text-sm font-medium text-gray-900 mb-2">Detailed Results</h3>
              <div className="space-y-2">
                {progress.results.map((result, index) => (
                  <div
                    key={index}
                    className={clsx(
                      'flex items-center justify-between p-3 rounded-lg text-sm',
                      result.success
                        ? 'bg-green-50 border border-green-200'
                        : 'bg-red-50 border border-red-200'
                    )}
                  >
                    <div className="flex items-center space-x-2">
                      {result.success ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : (
                        <AlertTriangle className="h-4 w-4 text-red-500" />
                      )}
                      <span className={result.success ? 'text-green-800' : 'text-red-800'}>
                        {result.item}
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                      {result.success && result.rspaceId && (
                        <span className="text-xs text-green-600 font-mono">
                          {result.rspaceId}
                        </span>
                      )}
                      {result.error && (
                        <span className="text-xs text-red-600" title={result.error}>
                          Error
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Error Details */}
          {progress.status === 'error' && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center space-x-2 mb-2">
                <AlertTriangle className="h-5 w-5 text-red-500" />
                <span className="font-medium text-red-800">Import Failed</span>
              </div>
              <p className="text-sm text-red-700">
                The import process encountered an error. Please check your RSpace configuration and try again.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        {canClose && (
          <div className="flex items-center justify-between px-6 py-4 bg-gray-50 border-t border-gray-200">
            <div className="text-sm text-gray-600">
              {progress.status === 'complete' 
                ? `Import completed: ${successCount} successful, ${failureCount} failed`
                : 'Import process stopped due to error'
              }
            </div>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
}