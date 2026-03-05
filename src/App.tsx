import React, { useState } from 'react';
import { Toaster } from 'react-hot-toast';
import toast from 'react-hot-toast';
import { Settings } from 'lucide-react';
import { RSpaceConfigProvider, useRSpaceConfig } from './contexts/RSpaceConfigContext';
import { SettingsModal } from './components/SettingsModal';
import { FileUpload } from './components/FileUpload';
import { PreviewInterface } from './components/PreviewInterface';
import { ELabFTWParser, convertDatasetsToPreviewItems } from './utils/elabftw-parser';
import { PreviewSession } from './types/elabftw';
import { PreviewSessionService } from './services/preview-session';

type AppState = 'upload' | 'preview';

function AppContent() {
  const { isConfigured } = useRSpaceConfig();
  const [currentState, setCurrentState] = useState<AppState>('upload');
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentSession, setCurrentSession] = useState<PreviewSession | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  const handleFileSelect = async (file: File) => {
    console.log('=== FILE UPLOAD STARTED ===');
    console.log('File:', file.name, 'Size:', file.size);
    
    setIsProcessing(true);
    
    try {
      // Parse the ELN file
      console.log('Creating parser...');
      const parser = new ELabFTWParser();

      console.log('Parsing ELN file...');
      const { datasets, fileMetadata, fileIndex } = await parser.parseELNFile(file);

      console.log('Parsed datasets:', datasets.length);
      console.log('File metadata:', Object.keys(fileMetadata).length);
      console.log('Files in ZIP:', fileIndex.size);

      // Convert JSZip entries to Blobs
      const fileBlobs = new Map<string, Blob>();
      for (const [fileId, zipEntry] of fileIndex.entries()) {
        try {
          const blob = await zipEntry.async('blob');
          fileBlobs.set(fileId, blob);
        } catch (error) {
          console.warn(`Failed to extract file ${fileId}:`, error);
        }
      }
      
      if (datasets.length === 0) {
        toast.error('No datasets found in the ELN file');
        return;
      }

      // Convert to preview items
      console.log('Converting to preview items...');
      const previewItems = convertDatasetsToPreviewItems(
        datasets, 
        fileMetadata, 
        parser.getCrateData()
      );
      
      console.log('Preview items created:', previewItems.length);

      // Create session
      const session: PreviewSession = {
        id: `session-${Date.now()}`,
        createdAt: new Date().toISOString(),
        elnFileName: file.name,
        totalItems: previewItems.length,
        items: previewItems,
        fileMetadata,
        fileBlobs
      };

      console.log('Session created:', session.id);

      // Save session
      PreviewSessionService.saveSession(session);
      setCurrentSession(session);
      setCurrentState('preview');
      
      toast.success(`Successfully loaded ${previewItems.length} items`);
      
    } catch (error) {
      console.error('File processing error:', error);
      toast.error(`File processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClassificationChange = (itemId: string, classification: 'document' | 'inventory') => {
    if (!currentSession) return;
    
    console.log(`Changing classification for ${itemId} to ${classification}`);
    
    // Update the session
    const updatedSession = {
      ...currentSession,
      items: currentSession.items.map(item => 
        item.id === itemId 
          ? { ...item, userClassification: classification }
          : item
      )
    };
    
    setCurrentSession(updatedSession);
    PreviewSessionService.saveSession(updatedSession);
  };

  const handleImport = async (session: PreviewSession) => {
    // This is now handled by PreviewInterface
    console.log('Import completed for session:', session.id);
  };

  const handleBack = () => {
    setCurrentState('upload');
    setCurrentSession(null);
  };

  console.log('App rendering, state:', currentState);

  return (
    <div className="min-h-screen bg-gray-50">
      <Toaster position="top-right" />
      <SettingsModal isOpen={showSettings} onClose={() => setShowSettings(false)} />

      {currentState === 'upload' && (
        <div className="min-h-screen flex items-center justify-center p-4">
          <div className="max-w-4xl w-full">
            <div className="absolute top-6 right-6">
              <button
                onClick={() => setShowSettings(true)}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors shadow-sm"
              >
                <Settings className="w-4 h-4 text-gray-600" />
                <span className="text-sm font-medium text-gray-700">
                  {isConfigured ? 'RSpace Connected' : 'Configure RSpace'}
                </span>
                {isConfigured && (
                  <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                )}
              </button>
            </div>

            <div className="text-center mb-8">
              <h1 className="text-4xl font-bold text-gray-900 mb-4">
                .ELN Import Tool
              </h1>
              <p className="text-lg text-gray-600 mb-8">
                Import your ELN experiments and resources into RSpace
              </p>
            </div>

            <FileUpload
              onFileSelect={handleFileSelect}
              isProcessing={isProcessing}
            />
          </div>
        </div>
      )}
      
      {currentState === 'preview' && currentSession && (
        <PreviewInterface
          session={currentSession}
          onImport={handleImport}
          onBack={handleBack}
          onClassificationChange={handleClassificationChange}
          onConfigureRSpace={() => setShowSettings(true)}
        />
      )}
    </div>
  );
}

function App() {
  return (
    <RSpaceConfigProvider>
      <AppContent />
    </RSpaceConfigProvider>
  );
}

export default App;