import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RSpaceImporter } from './rspace-importer';
import { RSpaceService } from './rspace-api';
import { PreviewItem, PreviewSession } from '../types/eln';

describe('RSpaceImporter', () => {
  let importer: RSpaceImporter;
  let mockRSpaceService: any;
  let onProgress: any;

  beforeEach(() => {
    mockRSpaceService = {
      testConnection: vi.fn().mockResolvedValue(true),
      createForm: vi.fn().mockResolvedValue(101),
      createDocument: vi.fn().mockResolvedValue({ id: 201, globalId: 'DOC201', name: 'Doc 1' }),
      createInventorySample: vi.fn().mockResolvedValue({ id: 'S301', globalId: 'SA301', name: 'Sample 1' }),
      createInventoryContainer: vi.fn().mockResolvedValue({ id: 'C401', globalId: 'IC401', name: 'Container 1' }),
      uploadFile: vi.fn().mockResolvedValue({ id: '501', globalId: 'GL501', name: 'file.txt' }),
      addInternalLinkToDocument: vi.fn().mockResolvedValue(undefined),
    };
    importer = new RSpaceImporter(mockRSpaceService as unknown as RSpaceService);
    onProgress = vi.fn();
  });

  it('imports a document session successfully', async () => {
    const item: PreviewItem = {
      id: 'item1',
      name: 'Test Experiment',
      type: 'experiment',
      category: 'Experiments',
      categoryColor: '#000000',
      proposedClassification: 'document',
      userClassification: null,
      confidence: 'high',
      justification: '',
      reasons: [],
      files: [],
      crossReferences: [],
      validationIssues: [],
      metadata: {},
      textContent: 'Main content',
      steps: [],
      keywords: [],
      dateCreated: '',
      dateModified: ''
    };

    const session: PreviewSession = {
      id: 'sess',
      createdAt: '',
      elnFileName: 'f.eln',
      totalItems: 1,
      items: [item],
      fileBlobs: new Map(),
      fileMetadata: {}
    };

    const result = await importer.importSession(session, onProgress, new Set(['item1']));
    expect(mockRSpaceService.createDocument).toHaveBeenCalledWith(
      101,
      'Test Experiment',
      expect.any(Object),
      expect.any(Array)
    );
    const lastCall = onProgress.mock.calls[onProgress.mock.calls.length - 1][0];
    expect(lastCall.status).toBe('complete');
    expect(lastCall.total).toBe(1);
    expect(result.results[0].success).toBe(true);
  });

  it('imports an inventory item successfully', async () => {
    const item: PreviewItem = {
      id: 'item2',
      name: 'Test Sample',
      type: 'resource',
      category: 'Reagents',
      categoryColor: '#000',
      proposedClassification: 'inventory',
      userClassification: null,
      confidence: 'high',
      justification: 'sample',
      reasons: [],
      files: [],
      crossReferences: [],
      validationIssues: [],
      metadata: {
        'quantity': { value: '10', type: 'text', units: ['ml'] }
      },
      textContent: '',
      steps: [],
      keywords: [],
      dateCreated: '',
      dateModified: ''
    };

    const session: PreviewSession = {
      id: 'sess', createdAt: '', elnFileName: 'f.eln', totalItems: 1,
      items: [item],
      fileBlobs: new Map(),
      fileMetadata: {}
    };

    const result = await importer.importSession(session, onProgress, new Set(['item2']));
    const last = onProgress.mock.calls[onProgress.mock.calls.length - 1][0];
    expect(last.status).toBe('complete');
    expect(result.results[0].success).toBe(true);
  });

  it('handles file uploads during document import', async () => {
    const blob = new Blob(['hello'], { type: 'text/plain' });
    const item: PreviewItem = {
      id: 'item1',
      name: 'Doc with File',
      type: 'experiment',
      category: 'Experiments',
      categoryColor: '#000',
      proposedClassification: 'document',
      userClassification: null,
      confidence: 'high',
      justification: '',
      reasons: [],
      files: ['file1'],
      crossReferences: [],
      validationIssues: [],
      metadata: {},
      textContent: 'c',
      steps: [],
      keywords: [],
      dateCreated: '',
      dateModified: ''
    };

    const session: PreviewSession = {
      id: 'sess', createdAt: '', elnFileName: 'f.eln', totalItems: 1,
      items: [item],
      fileBlobs: new Map([['file1', blob]]),
      fileMetadata: {
        'file1': { name: 'test.txt', encodingFormat: 'text/plain', '@id': 'file1', '@type': 'File', contentSize: 5, sha256: 'x' }
      }
    };

    await importer.importSession(session, onProgress, new Set(['item1']));

    expect(mockRSpaceService.uploadFile).toHaveBeenCalled();
    expect(mockRSpaceService.createDocument).toHaveBeenCalled();
    // Verify file syntax was added to content
    const callArgs = mockRSpaceService.createDocument.mock.calls[0];
    expect(callArgs[2].Content).toContain('<fileId=501>');
  });

  it('reports errors during import', async () => {
    mockRSpaceService.createForm.mockRejectedValue(new Error('API Down'));
    
    const item: PreviewItem = {
      id: 'item1', name: 'Bad', type: 'experiment', category: 'Experiments', categoryColor: '#000',
      proposedClassification: 'document', userClassification: null, confidence: 'high', justification: '', reasons: [],
      files: [], crossReferences: [], validationIssues: [], metadata: {}, textContent: '', steps: [], keywords: [], dateCreated: '', dateModified: ''
    };
    const session: PreviewSession = {
      id: 's', createdAt: '', elnFileName: 'f.eln', totalItems: 1,
      items: [item],
      fileBlobs: new Map(),
      fileMetadata: {}
    };

    const result = await importer.importSession(session, onProgress, new Set(['item1']));
    // Should complete overall but record the failure for the item
    expect(result.results[0].success).toBe(false);
    const lastProgress = onProgress.mock.calls[onProgress.mock.calls.length - 1][0];
    expect(lastProgress.status).toBe('complete');
  });
});
