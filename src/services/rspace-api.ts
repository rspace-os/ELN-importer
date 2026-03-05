import { RetryManager } from '../utils/RetryManager';  // P1: Retry logic
import * as fs from 'fs';
import * as path from 'path';

interface RSpaceConfig {
  baseUrl: string;
  apiKey: string;
}

interface RSpaceDocument {
  id: number;
  globalId: string;
  name: string;
}

interface RSpaceInventoryItem {
  id: string;
  globalId?: string;
  name: string;
  type: 'sample' | 'container';
}

interface RSpaceForm {
  id: number;
  name: string;
  fields: Array<{
    name: string;
    type: string;
    mandatory: boolean;
  }>;
}

export class RSpaceService {
  private config: RSpaceConfig;
  private retryManager: RetryManager;  // P1: Retry manager for network operations
  private outputDir: string | null = null;
  private currentInputFile: string | null = null;

  constructor(config: RSpaceConfig) {
    this.config = config;
    this.retryManager = new RetryManager();  // P1: Initialize retry manager
  }

  /**
   * Set the output directory for integration tests
   */
  setIntegrationTestMode(outputDir: string, inputFile: string) {
    this.outputDir = outputDir;
    this.currentInputFile = inputFile;
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
  }

  private writeOutput(payload: any) {
    if (!this.outputDir || !this.currentInputFile) return;

    const baseName = path.basename(this.currentInputFile);
    const outputPath = path.join(this.outputDir, `${baseName}-output.json`);
    
    let existing: any[] = [];
    if (fs.existsSync(outputPath)) {
      try {
        existing = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
      } catch (e) {
        existing = [];
      }
    }
    
    existing.push(payload);
    fs.writeFileSync(outputPath, JSON.stringify(existing, null, 2));
  }

  private async makeRequest(endpoint: string, options: RequestInit = {}): Promise<Response> {
    const url = `${this.config.baseUrl}${endpoint}`;

    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'apiKey': this.config.apiKey,
      ...options.headers,
    };

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`API Error Response (${response.status}):`, errorText);
      throw new Error(`RSpace API error (${response.status}): ${errorText}`);
    }

    return response;
  }

  async testConnection(): Promise<boolean> {
    if (this.outputDir) return true;
    try {
      const response = await this.makeRequest('/api/v1/status');
      return response.ok;
    } catch (error) {
      console.error('RSpace connection test failed:', error);
      return false;
    }
  }

  async searchDocuments(query: string, exactMatch = false): Promise<RSpaceDocument[]> {
    try {
      const params = new URLSearchParams({
        query: exactMatch ? `"${query}"` : query,
        pageSize: '10'
      });
      
      const response = await this.makeRequest(`/api/v1/documents?${params}`);
      const data = await response.json();
      
      return data.documents || [];
    } catch (error) {
      console.error('Document search failed:', error);
      return [];
    }
  }

  async searchInventoryItems(query: string): Promise<RSpaceInventoryItem[]> {
    try {
      const params = new URLSearchParams({
        query,
        pageSize: '10'
      });
      
      // Try both samples and containers
      const [samplesResponse, containersResponse] = await Promise.all([
        this.makeRequest(`/api/inventory/v1/samples?${params}`).catch(() => null),
        this.makeRequest(`/api/inventory/v1/containers?${params}`).catch(() => null)
      ]);

      const items: RSpaceInventoryItem[] = [];

      if (samplesResponse?.ok) {
        const samplesData = await samplesResponse.json();
        items.push(...(samplesData.samples || []).map((s: any) => ({ ...s, type: 'sample' as const })));
      }

      if (containersResponse?.ok) {
        const containersData = await containersResponse.json();
        items.push(...(containersData.containers || []).map((c: any) => ({ ...c, type: 'container' as const })));
      }

      return items;
    } catch (error) {
      console.error('Inventory search failed:', error);
      return [];
    }
  }

  async getForms(): Promise<RSpaceForm[]> {
    try {
      const response = await this.makeRequest('/api/v1/forms');
      const data = await response.json();
      return data.forms || [];
    } catch (error) {
      console.error('Forms retrieval failed:', error);
      return [];
    }
  }

  async createForm(name: string, fields: Array<{ name: string; type: string; mandatory?: boolean; showAsPickList?: boolean; options?: string[] }>): Promise<number> {
    try {
      const formData = {
        name: name.substring(0, 50),
        tags: 'elabftw-import',
        fields: fields.map(field => ({
          name: field.name.substring(0, 50),
          type: field.type,
          mandatory: field.mandatory || false,
          ...(field.options && { options: field.options }),
          ...(field.showAsPickList && { showAsPickList: true }),
        }))
      };

      if (this.outputDir) {
        this.writeOutput({ type: 'createForm', data: formData });
        return 999; // Mock ID
      }

      const response = await this.makeRequest('/api/v1/forms', {
        method: 'POST',
        body: JSON.stringify(formData)
      });

      const result = await response.json();
      const formId = result.id;

      // Publish the form
      if (this.outputDir) return formId;

      await this.makeRequest(`/api/v1/forms/${formId}/publish`, {
        method: 'PUT'
      });

      return formId;
    } catch (error) {
      console.error('Form creation failed:', error);
      if (error instanceof Error) {
        console.error('Error details:', error.message);
      }
      throw error;
    }
  }

  async createDocument(formId: number, name: string, fieldValues: Array<{ name: string, content: string, description?: string }>, tags: string[] = []): Promise<RSpaceDocument> {
   fieldValues.map(field => {
     if (field.description) {
       field.content = "<p>Description: "+field.description+"</p><br/>"+field.content;
     }
     return field;
   })
    try {
      const docData = {
        name,
        tags: tags.join(','),
        form: { id: formId },
        fields: fieldValues
      };

      if (this.outputDir) {
        this.writeOutput({ type: 'createDocument', data: docData });
        return { id: 888, globalId: 'DOC888', name: name }; // Mock result
      }

      console.log('Creating document:', { name, formId, tags, fieldCount: Object.keys(fieldValues).length });
      console.log('Document data:', JSON.stringify(docData, null, 2));

      const response = await this.makeRequest('/api/v1/documents', {
        method: 'POST',
        body: JSON.stringify(docData)
      });

      const result = await response.json();
      console.log('Document created:', result);
      return result;
    } catch (error) {
      console.error('Document creation failed:', error);
      if (error instanceof Error) {
        console.error('Error details:', error.message);
      }
      throw error;
    }
  }

  async createInventorySample(data: {
    name: string;
    description?: string;
    tags?: string[];
    quantity?: { value: number; unit: string };
    customFields?: Record<string, any>;
  }): Promise<RSpaceInventoryItem> {
    try {
      const sampleData: any = {
        name: data.name,
        subsample_count: 1
      };

      if (data.description) {
        sampleData.description = data.description;
      }

      if (data.tags) {
        sampleData.tags = data.tags.map(tag => ({ value: tag }));
      }

      // Add quantity to the first subsample
      if (data.quantity) {
        sampleData.subSamples = [{
          name: data.name,
          quantity: {
            numericValue: data.quantity.value,
            unitId: this.getUnitId(data.quantity.unit)
          }
        }];
      }

      // Add custom fields as extraFields
      if (data.customFields && Object.keys(data.customFields).length > 0) {
        sampleData.extraFields = this.prepareExtraFields(data.customFields);
      }

      console.log('Creating inventory sample:', data.name);
      console.log('Sample data:', JSON.stringify(sampleData, null, 2));

      if (this.outputDir) {
        this.writeOutput({ type: 'createInventorySample', data: sampleData });
        return { id: '999', globalId: 'SA999', name: data.name, type: 'sample' };
      }

      const response = await this.makeRequest('/api/inventory/v1/samples', {
        method: 'POST',
        body: JSON.stringify(sampleData)
      });

      const result = await response.json();
      console.log('Sample created:', result);
      console.log('DEBUG - Sample result keys:', Object.keys(result));
      console.log('DEBUG - Sample result.id:', result.id);
      console.log('DEBUG - Sample result.globalId:', result.globalId);
      console.log('DEBUG - Sample result.subSamples:', result.subSamples);

      return { ...result, type: 'sample' as const };
    } catch (error) {
      console.error('Sample creation failed:', error);
      if (error instanceof Error) {
        console.error('Error details:', error.message);
      }
      throw error;
    }
  }

  async createInventoryContainer(data: {
    name: string;
    description?: string;
    tags?: string[];
    customFields?: Record<string, any>;
  }): Promise<RSpaceInventoryItem> {
    try {
      const containerData: any = {
        name: data.name,
        cType: 'LIST',
        can_store_containers: true,
        can_store_samples: true
      };

      if (data.description) {
        containerData.description = data.description;
      }

      if (data.tags) {
        containerData.tags = data.tags.map(tag => ({ value: tag }));
      }

      // Add custom fields as extraFields
      if (data.customFields && Object.keys(data.customFields).length > 0) {
        containerData.extraFields = this.prepareExtraFields(data.customFields);
      }

      console.log('Creating inventory container:', data.name);
      console.log('Container data:', JSON.stringify(containerData, null, 2));

      if (this.outputDir) {
        this.writeOutput({ type: 'createInventoryContainer', data: containerData });
        return { id: '888', globalId: 'IC888', name: data.name, type: 'container' };
      }

      const response = await this.makeRequest('/api/inventory/v1/containers', {
        method: 'POST',
        body: JSON.stringify(containerData)
      });

      const result = await response.json();
      console.log('Container created:', result);

      // Note: Custom fields are included in the description field
      // The extraFields API has CORS issues, so we skip it

      return { ...result, type: 'container' as const };
    } catch (error) {
      console.error('Container creation failed:', error);
      if (error instanceof Error) {
        console.error('Error details:', error.message);
      }
      throw error;
    }
  }

  private prepareExtraFields(customFields: Record<string, any>): any[] {
    return Object.entries(customFields).map(([name, value]) => ({
      name: name.substring(0, 50),
      type: typeof value === 'number' ? 'number' : 'text',
      content: String(value)
    }));
  }

  private getUnitId(unit: string): number {
    // RSpace unit IDs - common units
    const unitMap: Record<string, number> = {
      'ml': 7,
      'l': 8,
      'µl': 6,
      'ul': 6,
      'g': 1,
      'mg': 2,
      'kg': 3,
      'µg': 4,
      'ug': 4,
      'moles': 11,
      'mmol': 12,
      'µmol': 13,
      'umol': 13,
      'units': 14,
      'items': 14
    };

    return unitMap[unit.toLowerCase()] || 14; // Default to 'items'
  }

  async addCustomFieldsToInventoryItem(itemId: string, customFields: Record<string, any>): Promise<void> {
    // This method is now deprecated as custom fields are added during creation
    console.log('Custom fields are now added during item creation');
  }

  /**
   * P1 IMPROVEMENT: File upload with retry logic
   * Wraps file upload in RetryManager for automatic retry on transient failures
   *
   * @param file - File to upload
   * @param caption - Optional caption for the file
   * @param onRetry - Optional callback for retry progress updates
   * @returns Upload result with file ID and name
   */
  async uploadFile(
    file: File,
    caption?: string,
    onRetry?: (attempt: number, delayMs: number, error: any) => void
  ): Promise<{ id: string; globalId: string; name: string }> {
    console.log(`Uploading file: ${file.name} (${file.size} bytes)`);

    // P1: Wrap upload in retry manager
    const result = await this.retryManager.executeWithRetry(
      async () => {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('caption', caption || file.name);

        const response = await fetch(`${this.config.baseUrl}/api/v1/files`, {
          method: 'POST',
          headers: {
            'apiKey': this.config.apiKey
          },
          body: formData
        });

        if (!response.ok) {
          // Create error with status code for retry decision
          const error: any = new Error(`File upload failed: ${response.status}`);
          error.status = response.status;
          error.response = { status: response.status };
          throw error;
        }

        const uploadResult = await response.json();
        console.log('File upload response:', uploadResult);
        console.log('DEBUG - Upload result keys:', Object.keys(uploadResult));
        console.log('DEBUG - Upload result.id:', uploadResult.id);
        console.log('DEBUG - Upload result.globalId:', uploadResult.globalId);
        return {
          id: uploadResult.id,
          globalId: uploadResult.globalId,
          name: uploadResult.name || file.name
        };
      },
      {
        maxAttempts: 5,
        initialDelayMs: 1000,
        maxDelayMs: 16000,
        timeoutMs: 120000  // 2 minutes total for large files
      },
      onRetry
    );

    if (result.success) {
      console.log(`File uploaded successfully after ${result.attempts} attempt(s)`);
      return result.result!;
    } else {
      console.error(`File upload failed after ${result.attempts} attempts:`, result.error);
      throw result.error!;
    }
  }

  async attachFileToDocument(documentId: number, fileId: number): Promise<void> {
    try {
      console.log(`Attaching file ${fileId} to document ${documentId} using /api/v1/records/${documentId}/attachments`);

      const response = await this.makeRequest(`/api/v1/records/${documentId}/attachments`, {
        method: 'POST',
        body: JSON.stringify({
          fileId: fileId
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to attach file: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      console.log(`Successfully attached file ${fileId} to document ${documentId}:`, result);
    } catch (error) {
      console.error(`Failed to attach file ${fileId} to document ${documentId}:`, error);
      throw error;
    }
  }

  /**
   * Attach an uploaded Gallery file to an inventory item (sample or container)
   * Uses the /api/inventory/v1/attachments endpoint
   *
   * @param itemGlobalId - Global ID of inventory item (e.g., "SA12345" or "IC67890")
   * @param fileGlobalId - Global ID of the Gallery file (e.g., "GL123")
   */
  async attachFileToInventoryItem(itemGlobalId: string, fileGlobalId: string): Promise<void> {
    try {
      console.log(`=== ATTACHMENT DEBUG ===`);
      console.log(`Attaching Gallery file ${fileGlobalId} to inventory item ${itemGlobalId}`);

      const requestBody = {
        parentGlobalId: itemGlobalId,
        mediaFileGlobalId: fileGlobalId
      };
      console.log('Request body:', JSON.stringify(requestBody, null, 2));

      const response = await this.makeRequest(
        '/api/inventory/v1/attachments',
        {
          method: 'POST',
          body: JSON.stringify(requestBody)
        }
      );

      console.log('Response status:', response.status);
      console.log('Response ok:', response.ok);
      console.log('Response headers:', Array.from(response.headers.entries()));

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error response body:', errorText);
        throw new Error(`Failed to attach file to inventory item: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      console.log('Attachment API response:', JSON.stringify(result, null, 2));
      console.log('DEBUG - Attachment result keys:', Object.keys(result));
      console.log(`Successfully attached file ${fileGlobalId} to inventory item ${itemGlobalId}`);
    } catch (error) {
      console.error(`Failed to attach file ${fileGlobalId} to inventory item ${itemGlobalId}:`, error);
      throw error;
    }
  }

  async getDocument(documentId: number): Promise<any> {
    try {
      const response = await this.makeRequest(`/api/v1/documents/${documentId}`);
      return await response.json();
    } catch (error) {
      console.error(`Failed to get document ${documentId}:`, error);
      throw error;
    }
  }

  async updateDocumentField(documentId: number, fieldName: string, content: string): Promise<void> {
    try {
      const doc = await this.getDocument(documentId);
      console.log(`Document ${documentId} fields:`, doc.fields?.map((f: any) => f.name));

      const field = doc.fields?.find((f: any) => f.name === fieldName);

      if (!field) {
        console.error(`Field '${fieldName}' not found in document ${documentId}. Available fields:`, doc.fields?.map((f: any) => f.name));
        return;
      }

      console.log(`Updating field '${fieldName}' (id: ${field.id}) in document ${documentId}`);
      const response = await this.makeRequest(`/api/v1/documents/${documentId}`, {
        method: 'PUT',
        body: JSON.stringify({
          fields: [{
            id: field.id,
            content: field.content + '\n' + content
          }]
        })
      });

      console.log(`Successfully updated field '${fieldName}' in document ${documentId}`);
    } catch (error) {
      console.error(`Failed to update field ${fieldName} in document ${documentId}:`, error);
    }
  }

  async addInternalLinkToDocument(documentId: number, linkedId: number | string, linkText: string, isInventoryItem: boolean = false): Promise<void> {
    try {
      let linkHtml: string;

      if (isInventoryItem && typeof linkedId === 'string') {
        // For inventory items, use globalId with a regular hyperlink
        linkHtml = `<p>See also: <a href="${this.config.baseUrl}/globalId/${linkedId}">${linkText}</a></p>`;
      } else {
        // For documents, use RSpace's decorated link format: <docId=X>
        // This creates a smart link that RSpace tracks in its metadata and shows in "Linked Documents"
        linkHtml = `<p>See also: <docId=${linkedId}></p>`;
      }

      await this.updateDocumentField(documentId, 'References', linkHtml);
    } catch (error) {
      console.warn(`Failed to add internal link to document ${documentId}:`, error);
    }
  }

  // P0 FIX: Delete methods for rollback support
  async deleteDocument(documentId: number): Promise<void> {
    try {
      console.log(`Deleting document ${documentId}`);
      const response = await this.makeRequest(`/api/v1/documents/${documentId}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        throw new Error(`Failed to delete document: ${response.statusText}`);
      }

      console.log(`Document ${documentId} deleted successfully`);
    } catch (error) {
      console.error(`Failed to delete document ${documentId}:`, error);
      throw error;
    }
  }

  async deleteInventoryItem(globalId: string): Promise<void> {
    try {
      console.log(`Deleting inventory item ${globalId}`);

      // RSpace inventory API uses globalId for deletion
      // Format: /api/inventory/v1/samples/{id} or /api/inventory/v1/containers/{id}
      // Try sample first, then container
      let response = await this.makeRequest(`/api/inventory/v1/samples/${globalId}`, {
        method: 'DELETE'
      });

      if (!response.ok && response.status === 404) {
        // Try as container if sample deletion failed
        response = await this.makeRequest(`/api/inventory/v1/containers/${globalId}`, {
          method: 'DELETE'
        });
      }

      if (!response.ok) {
        throw new Error(`Failed to delete inventory item: ${response.statusText}`);
      }

      console.log(`Inventory item ${globalId} deleted successfully`);
    } catch (error) {
      console.error(`Failed to delete inventory item ${globalId}:`, error);
      throw error;
    }
  }
}

export type { RSpaceConfig };