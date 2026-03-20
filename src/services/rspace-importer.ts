import {FormField, PreviewItem, PreviewSession} from '../types/elabftw.ts';
import { RSpaceService } from './rspace-api';
import {
  prepareFormFields,
  prepareDocumentFieldValues,
  extractQuantityFromMetadata,
  isInstrumentResource,
  prepareTags
} from './rspace-mapper';

export interface ImportProgress {
  current: number;
  total: number;
  currentItem: string;
  status: 'preparing' | 'importing' | 'uploading_files' | 'linking' | 'complete' | 'error' | 'rolling_back';
  results: Array<{ item: string; success: boolean; error?: string; rspaceId?: string }>;
}


export class RSpaceImporter {

  constructor(private rspaceService: RSpaceService) {}

  async importSession(
    session: PreviewSession,
    onProgress: (progress: ImportProgress) => void,
    itemIdsToImport?: Set<string>,
    rocJsonFileId?: number | null
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
        const quantity = extractQuantityFromMetadata(item.metadata, item.chosenQuantityName)[0];//chosenQuantityName defaults to 'Items' if not set in the UI

        progress.current = i + 1;
        progress.currentItem = item.name;
        onProgress(progress);

        try {
          let rspaceId: string;
          let numericId: number;

          let uploadedFiles: Array<{ numericId: number; globalId: string }> = [];
          if (item.files && item.files.length > 0) {
            progress.status = 'uploading_files';
            onProgress(progress);
            uploadedFiles = await this.uploadFilesBeforeDocument(item, session);
          }

          // either type of template can be assigned by the user to 'document'
          const isTemplate = item.type.toLowerCase() === 'experiment template' || item.type.toLowerCase() === 'resource template';
          const uploadedFileIds = uploadedFiles.map(f => f.numericId);
          if (classification === 'document') {
            // Extract numeric IDs for document creation
            const result = await this.createRSpaceDocument(item, uploadedFileIds, isTemplate, rocJsonFileId);
            rspaceId = result.rspaceId;
            numericId = result.numericId;
          } else {
            // Create inventory item
            const result = await this.createRSpaceInventoryItem(item, quantity, isTemplate, uploadedFileIds);
            rspaceId = result.rspaceId;
            numericId = result.numericId;

            // Try attaching files directly to inventory item using sample's globalId
            if (uploadedFiles.length > 0) {
              console.log(`Attaching ${uploadedFiles.length} files to inventory item ${rspaceId}`);
              for (const file of uploadedFiles) {
                try {
                  await this.rspaceService.attachFileToInventoryItem(rspaceId, file.globalId);
                } catch (error) {
                  console.error(`Failed to attach file ${file.globalId} to item ${rspaceId}:`, error);
                  // Continue with other files even if one fails
                }
              }
            }
            if(rocJsonFileId){
              try {
                await this.rspaceService.attachFileToInventoryItem(rspaceId, "GL"+rocJsonFileId);
              } catch (error) {
                console.error(`Failed to attach file json metadata from ${"GL"+rocJsonFileId} to item ${rspaceId}:`, error);
              }
            }

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

        // P0 FIX: Add cross-references for both documents AND inventory items
        if (item.crossReferences && item.crossReferences.length > 0) {
          if (itemMapping.type === 'document') {
            await this.addCrossReferencesForItem(item, itemMapping.numericId, itemIdMap);
          } else {
            // For inventory items, add references to description field
            await this.addCrossReferencesForInventoryItem(item, itemMapping.rspaceId, itemIdMap);
          }
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

  private async createRSpaceDocument (
    item: PreviewItem,
    uploadedFileIds: number[] = [],
    isDocumentTemplate: boolean = false,
    rocJsonFileId?: number | null
  ):Promise<{
    rspaceId: string,
    numericId: number
  }> {
    const formName = `${item.name} ELN ${item.category} (${item.type})`;
    const formFields: FormField[] = prepareFormFields(item, false);
    const isBrowser = typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
    const matchingFormExistsWithID = isBrowser ? localStorage.getItem(JSON.stringify(formFields)) : null;

    function addAttachedFiles(fields, isRawJson: boolean = false) {
      // Add file references to the Content field if files were uploaded
      // Use RSpace's special <fileId=ID> syntax which it will automatically render as proper links
      if (uploadedFileIds.length > 0 || isRawJson) {
        const fileLinks = isRawJson ? `<p><fileId=${rocJsonFileId}></p>\n`:uploadedFileIds.map(fileId =>
            `<p><fileId=${fileId}></p>`
        ).join('\n');
        const contentValue = fields.find(a => a.name === 'Content');
        if (contentValue) { //there is always a content field
          contentValue.content = (contentValue.content || '') + '\n' + fileLinks;
        }
      }
    }

    let formId;
    if (matchingFormExistsWithID && await this.rspaceService.formExists(Number(matchingFormExistsWithID))) {
      formId = Number(matchingFormExistsWithID);
    } else {
      formId = await this.rspaceService.createForm(formName, formFields, isDocumentTemplate);
      if(isBrowser) {
        localStorage.setItem(JSON.stringify(formFields), "" + formId);
      }
    }
    if (isDocumentTemplate && uploadedFileIds.length === 0) {//forms cannot have attached files; elabftw templates *can* have attached files. In that case,we will continue and create a document, attaching the files to the document itself
      return {rspaceId: "FM" + formId, numericId: formId};
    }
    else {
      const fieldValues = prepareDocumentFieldValues(item, formFields);
      addAttachedFiles(fieldValues);
      if(rocJsonFileId) {
        addAttachedFiles(fieldValues, true);
      }
      const tags = prepareTags(item);
      const result =  await this.rspaceService.createDocument(formId, item.name + (item.alternateName ? ` (${item.alternateName})` : ''), fieldValues, tags);
      return {rspaceId: result.globalId || result.id.toString(), numericId: result.id};
    }
  }

  private async createRSpaceInventoryItem(
    item: PreviewItem,
    quantity: {
      value: number;
      unit: string,
      category: string
    },
    isTemplate: boolean = false,
    uploadedFileIds: number[] = []
  ): Promise<{
    rspaceId: string,
    numericId: number
  }> {
    const tags = prepareTags(item);
    const description = item.textContent || `Imported from ELN: ${item.category}`;

    // Create SampleTemplate first
    const templateName = `${item.name} ELN ${item.category} Template`;
    const templateFieldsForm = prepareFormFields(item, false);
    const isBrowser = typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
    const matchingSTExistsWithID = isBrowser ? localStorage.getItem(JSON.stringify(templateFieldsForm)) : null;
    let templateId:number;
    if (matchingSTExistsWithID && await this.rspaceService.sampleTemplateExists(Number(matchingSTExistsWithID))) {
      templateId = Number(matchingSTExistsWithID);
    } else {
      templateId = await this.rspaceService.createSampleTemplate(templateName, templateFieldsForm, quantity, tags, description);
      if(isBrowser) {
        localStorage.setItem(JSON.stringify(templateFieldsForm), ""+templateId);
      }
    }
    if (isTemplate && uploadedFileIds.length === 0) {//sampleTemplates cannot have attached files; we will continue and create a sample for that
      return {rspaceId: "IT" + templateId, numericId: templateId};
    } else {
      const sampleData = {
        name: item.name,
        description,
        tags,
        templateId,
        quantity
      };

      const result = await this.rspaceService.createInventorySample(sampleData);
      return {rspaceId: result.globalId || result.id, numericId: parseInt(result.id)};
    }
  }

  private async uploadFilesBeforeDocument(
    item: PreviewItem,
    session: PreviewSession
  ): Promise<Array<{ numericId: number; globalId: string }>> {
    const uploadedFiles: Array<{ numericId: number; globalId: string }> = [];

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

          // P1: Add retry callback for file upload progress
          const uploadedFile = await this.rspaceService.uploadFile(
            file,
            metadata.name,
            (attempt, delayMs, error) => {
              console.warn(`File upload retry ${attempt}: ${metadata.name} - waiting ${delayMs}ms`);
              console.warn(`Retry reason:`, error.message);
            }
          );
          console.log(`Uploaded file: ${metadata.name} (ID: ${uploadedFile.id}, GlobalID: ${uploadedFile.globalId})`);
          uploadedFiles.push({
            numericId: parseInt(uploadedFile.id),
            globalId: uploadedFile.globalId
          });
        } catch (error) {
          console.warn(`Failed to upload file ${fileId} after retries:`, error);
        }
      }
    } catch (error) {
      console.error(`Failed to upload files for ${item.name}:`, error);
    }

    return uploadedFiles;
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

  // P0 FIX: New method to handle inventory item cross-references
  private async addCrossReferencesForInventoryItem(
    item: PreviewItem,
    inventoryGlobalId: string,
    itemIdMap: Map<string, { rspaceId: string; numericId: number; type: 'document' | 'inventory' }>
  ): Promise<void> {
    try {
      console.log(`Adding ${item.crossReferences.length} cross-references for inventory item ${item.name}`);

      // Build cross-reference links HTML
      const referenceLinks: string[] = [];

      for (const refId of item.crossReferences) {
        const referencedItem = itemIdMap.get(refId);

        if (!referencedItem) {
          console.warn(`Referenced item ${refId} not found in import`);
          continue;
        }

        // Create appropriate link based on referenced item type
        if (referencedItem.type === 'inventory') {
          referenceLinks.push(
            `<a href="${this.rspaceService.config.baseUrl}/globalId/${referencedItem.rspaceId}">` +
            `${referencedItem.rspaceId}</a>`
          );
        } else {
          referenceLinks.push(
            `<a href="${this.rspaceService.config.baseUrl}/globalId/SD${referencedItem.numericId}">` +
            `SD${referencedItem.numericId}</a>`
          );
        }
      }

      if (referenceLinks.length > 0) {
        // Add references section to inventory item description
        const referencesHtml = `<p><strong>Cross-References:</strong> ${referenceLinks.join(', ')}</p>`;

        // Note: RSpace API doesn't currently support updating inventory description after creation
        // This is a known limitation - references would need to be added during initial creation
        console.warn(
          `Cannot add cross-references to inventory item ${inventoryGlobalId} - ` +
          `RSpace API doesn't support updating inventory description post-creation. ` +
          `This is a known limitation.`
        );
      }
    } catch (error) {
      console.error(`Failed to add cross-references for inventory item ${item.name}:`, error);
    }
  }
}
