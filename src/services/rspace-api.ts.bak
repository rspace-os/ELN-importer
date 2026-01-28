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

  constructor(config: RSpaceConfig) {
    this.config = config;
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
      timeout: 30000,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`API Error Response (${response.status}):`, errorText);
      throw new Error(`RSpace API error (${response.status}): ${errorText}`);
    }

    return response;
  }

  async testConnection(): Promise<boolean> {
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

  async createForm(name: string, fields: Array<{ name: string; type: string; mandatory?: boolean; options?: string[] }>): Promise<number> {
    try {
      const formData = {
        name: name.substring(0, 50),
        tags: 'elabftw-import',
        fields: fields.map(field => ({
          name: field.name.substring(0, 50),
          type: field.type,
          mandatory: field.mandatory || false,
          ...(field.options && { options: field.options })
        }))
      };

      const response = await this.makeRequest('/api/v1/forms', {
        method: 'POST',
        body: JSON.stringify(formData)
      });

      const result = await response.json();
      const formId = result.id;

      // Publish the form
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

  async createDocument(formId: number, name: string, fieldValues: Record<string, string>, tags: string[] = []): Promise<RSpaceDocument> {
    try {
      const docData = {
        name,
        tags: tags.join(','),
        form: { id: formId },
        fields: Object.entries(fieldValues).map(([name, content]) => ({
          name,
          content
        }))
      };

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

      const response = await this.makeRequest('/api/inventory/v1/samples', {
        method: 'POST',
        body: JSON.stringify(sampleData)
      });

      const result = await response.json();
      console.log('Sample created:', result);

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

  async uploadFile(file: File, caption?: string): Promise<{ id: string; name: string }> {
    try {
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
        throw new Error(`File upload failed: ${response.status}`);
      }

      const result = await response.json();
      console.log('File upload response:', result);
      return {
        id: result.id,
        name: result.name || file.name
      };
    } catch (error) {
      console.error('File upload failed:', error);
      throw error;
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
}

export type { RSpaceConfig };