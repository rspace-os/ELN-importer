import React, { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileText, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';

interface FileUploadProps {
  onFileSelect: (file: File) => void;
  isProcessing: boolean;
}

export function FileUpload({ onFileSelect, isProcessing }: FileUploadProps) {
  const onDrop = useCallback((acceptedFiles: File[], rejectedFiles: any[]) => {
    if (rejectedFiles.length > 0) {
      const rejection = rejectedFiles[0];
      if (rejection.errors.some((e: any) => e.code === 'file-invalid-type')) {
        toast.error('Please select a .eln file');
      } else if (rejection.errors.some((e: any) => e.code === 'file-too-large')) {
        toast.error('File is too large. Maximum size is 100MB');
      } else {
        toast.error('Invalid file selected');
      }
      return;
    }

    if (acceptedFiles.length > 0) {
      const file = acceptedFiles[0];
      console.log('File selected:', file.name, 'Size:', file.size);
      onFileSelect(file);
    }
  }, [onFileSelect]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/zip': ['.eln'],
      'application/x-zip-compressed': ['.eln']
    },
    maxFiles: 1,
    maxSize: 100 * 1024 * 1024, // 100MB
    disabled: isProcessing
  });

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div
        {...getRootProps()}
        className={`
          border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all duration-200
          ${isDragActive 
            ? 'border-blue-400 bg-blue-50 scale-105' 
            : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
          }
          ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}
        `}
      >
        <input {...getInputProps()} />
        
        <div className="flex flex-col items-center space-y-4">
          {isProcessing ? (
            <>
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
              <div className="text-lg font-medium text-gray-700">Processing ELN file...</div>
              <div className="text-sm text-gray-500">This may take a few moments</div>
            </>
          ) : (
            <>
              <div className="flex items-center space-x-2">
                <Upload className="h-12 w-12 text-gray-400" />
                <FileText className="h-8 w-8 text-blue-500" />
              </div>
              
              <div className="space-y-2">
                <div className="text-lg font-medium text-gray-700">
                  {isDragActive ? 'Drop your ELN file here' : 'Upload .ELN Export'}
                </div>
                <div className="text-sm text-gray-500">
                  Drag and drop your .eln file here, or click to browse
                </div>
              </div>
              
              <div className="flex items-center space-x-2 text-xs text-gray-400">
                <AlertCircle className="h-4 w-4" />
                <span>Maximum file size: 100MB</span>
              </div>
            </>
          )}
        </div>
      </div>
      
      <div className="mt-6 text-center">
        <div className="text-sm text-gray-600 mb-2">
          <strong>What happens next:</strong>
        </div>
        <div className="text-xs text-gray-500 space-y-1">
          <div>• Extract experiments and resources from your .eln file</div>
          <div>• Parse RO-Crate metadata and custom fields</div>
          <div>• Classify items as documents or inventory with confidence scoring</div>
          <div>• Show detailed preview with validation and cross-references</div>
          <div>• Allow modifications before importing to RSpace</div>
        </div>
      </div>
    </div>
  );
}