import { PreviewItem, PreviewSession } from '../types/elabftw';
import { RSpaceService } from './rspace-api';
import {
  prepareFormFields,
  prepareDocumentFieldValues,
  prepareInventoryCustomFields,
  extractQuantityFromMetadata,
  isInstrumentResource,
  prepareTags
} from './rspace-mapper';

export interface ImportProgress {
  current: number;
  total: number;
  currentItem: string;
  status: 'preparing' | 'importing' | 'uploading_files' | 'linking' | 'complete' | 'error';
  results: Array<{ item: string; success: boolean; error?: string; rspaceId?: string }>;
}

export class RSpaceImporter {
  constructor(private rspaceService: RSpaceService) {}

  async importSession(
    session: PreviewSession,
    onProgress: (progress: ImportProgress) => void,
    itemIdsToImport?: Set<string>
  ): Promise<ImportProgress> {
    // Filter items if specific IDs provided
    const itemsToImport = itemIdsToImport
      ? session.items.filter(item => itemIdsToImport.has(item.id))
      : session.items;

    const progress: ImportProgress = {
      current: 0,
      total: itemsToImport.length,
      currentItem: '',
      status: 'preparing',
      results: []
    };

    onProgress(progress);

    const itemIdMap = new Map<string, { rspaceId: string; numericId: number; type: 'document' | 'inventory' }>();

    try {
      const connectionOk = await this.rspaceService.testConnection();
      if (!connectionOk) {
        throw new Error('Cannot connect to RSpace. Please check your API credentials.');
      }

      // PASS 1: Create all items
      progress.status = 'importing';
      onProgress(progress);

      for (let i = 0; i < itemsToImport.length; i++) {
        const item = itemsToImport[i];
        const classification = item.userClassification || item.proposedClassification;

        progress.current = i + 1;
        progress.currentItem = item.name;
        onProgress(progress);

        try {
          let rspaceId: string;
          let numericId: number;

          // Upload files first if this is a document with files
          let uploadedFileIds: number[] = [];
          if (classification === 'document' && item.files && item.files.length > 0) {
            uploadedFileIds = await this.uploadFilesBeforeDocument(item, session);
          }

          if (classification === 'document') {
            const result = await this.createRSpaceDocument(item, uploadedFileIds);
            rspaceId = result.globalId || result.id.toString();
            numericId = result.id;
          } else {
            const result = await this.createRSpaceInventoryItem(item);
            rspaceId = result.globalId || result.id;
            numericId = parseInt(result.id);
          }

          itemIdMap.set(item.id, { rspaceId, numericId, type: classification });

          progress.results.push({
            item: item.name,
            success: true,
            rspaceId
          });
        } catch (error) {
          console.error(`Failed to import ${item.name}:`, error);
          progress.results.push({
            item: item.name,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }

        await new Promise(resolve => setTimeout(resolve, 500));
      }

      // PASS 2: Add cross-references
      progress.status = 'adding_links';
      progress.current = 0;
      progress.total = itemsToImport.length;
      onProgress(progress);

      for (let i = 0; i < itemsToImport.length; i++) {
        const item = itemsToImport[i];
        const itemMapping = itemIdMap.get(item.id);

        if (!itemMapping) continue;

        progress.current = i + 1;
        progress.currentItem = `Adding links to ${item.name}`;
        onProgress(progress);

        // Add cross-references
        if (item.crossReferences && item.crossReferences.length > 0 && itemMapping.type === 'document') {
          await this.addCrossReferencesForItem(item, itemMapping.numericId, itemIdMap);
        }

        await new Promise(resolve => setTimeout(resolve, 300));
      }

      progress.status = 'complete';
      onProgress(progress);

      return progress;
    } catch (error) {
      console.error('Import failed:', error);
      progress.status = 'error';
      onProgress(progress);
      throw error;
    }
  }

  private async createRSpaceDocument(item: PreviewItem, uploadedFileIds: number[] = []) {
    const formName = `ELN ${item.category} (${item.type})`;
    const formFields = prepareFormFields(item);
    const formId = await this.rspaceService.createForm(formName, formFields);
    const fieldValues = prepareDocumentFieldValues(item);
    const tags = prepareTags(item);

    // Add file references to the Content field if files were uploaded
    // Use RSpace's special <fileId=ID> syntax which it will automatically render as proper links
    if (uploadedFileIds.length > 0) {
      const fileLinks = uploadedFileIds.map(fileId =>
        `<p><fileId=${fileId}></p>`
      ).join('\n');
      fieldValues['Content'] = (fieldValues['Content'] || '') + '\n' + fileLinks;
    }

    return await this.rspaceService.createDocument(formId, item.name, fieldValues, tags);
  }

  private async createRSpaceInventoryItem(item: PreviewItem) {
    const isInstrument = isInstrumentResource(item);
    const customFields = prepareInventoryCustomFields(item);
    const tags = prepareTags(item);

    let description = item.textContent || `Imported from ELN: ${item.category}`;

    const commonData = {
      name: item.name,
      description,
      tags,
      customFields
    };

    let result;
    if (isInstrument) {
      result = await this.rspaceService.createInventoryContainer(commonData);
    } else {
      const quantity = extractQuantityFromMetadata(item);
      result = await this.rspaceService.createInventorySample({
        ...commonData,
        quantity
      });
    }

    // Custom fields are now added during item creation
    return result;
  }

  private async uploadFilesBeforeDocument(
    item: PreviewItem,
    session: PreviewSession
  ): Promise<number[]> {
    const uploadedFileIds: number[] = [];

    try {
      console.log(`Uploading ${item.files.length} files for ${item.name}`);
      console.log('File IDs to upload:', item.files);
      console.log('Available file blobs:', Array.from(session.fileBlobs.keys()));
      console.log('Available file metadata:', Object.keys(session.fileMetadata));

      for (const fileId of item.files) {
        const blob = session.fileBlobs.get(fileId);
        const metadata = session.fileMetadata[fileId];

        if (!blob || !metadata) {
          console.warn(`File ${fileId} not found in session - blob: ${!!blob}, metadata: ${!!metadata}`);
          continue;
        }

        try {
          const file = new File([blob], metadata.name, {
            type: metadata.encodingFormat
          });

          const uploadedFile = await this.rspaceService.uploadFile(file, metadata.name);
          console.log(`Uploaded file: ${metadata.name} (${uploadedFile.id})`);
          uploadedFileIds.push(parseInt(uploadedFile.id));
        } catch (error) {
          console.warn(`Failed to upload file ${fileId}:`, error);
        }
      }
    } catch (error) {
      console.error(`Failed to upload files for ${item.name}:`, error);
    }

    return uploadedFileIds;
  }

  private async addCrossReferencesForItem(
    item: PreviewItem,
    documentId: number,
    itemIdMap: Map<string, { rspaceId: string; numericId: number; type: 'document' | 'inventory' }>
  ): Promise<void> {
    try {
      console.log(`Adding ${item.crossReferences.length} cross-references for ${item.name}`);

      for (const refId of item.crossReferences) {
        const referencedItem = itemIdMap.get(refId);

        if (!referencedItem) {
          console.warn(`Referenced item ${refId} not found in import`);
          continue;
        }

        try {
          // Use decorated link <docId=X> for documents, globalId URL for inventory items
          if (referencedItem.type === 'inventory') {
            await this.rspaceService.addInternalLinkToDocument(
              documentId,
              referencedItem.rspaceId,
              `Link to ${refId}`,
              true
            );
          } else {
            await this.rspaceService.addInternalLinkToDocument(
              documentId,
              referencedItem.numericId,
              `Link to ${refId}`,
              false
            );
          }
        } catch (error) {
          console.warn(`Failed to add cross-reference to ${refId}:`, error);
        }
      }
    } catch (error) {
      console.error(`Failed to add cross-references for ${item.name}:`, error);
    }
  }
}
