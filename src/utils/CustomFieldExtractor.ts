import { CustomField, ROCrateData } from '../types/elabftw';

export class CustomFieldExtractor {
  extractCustomFields(variableMeasured: any[], crateData?: ROCrateData | null): Record<string, CustomField> {
    if (!crateData || !crateData['@graph'] || !Array.isArray(crateData['@graph'])) {
      console.warn('No valid crateData available for field extraction');
      return {};
    }

    const customFields: Record<string, CustomField> = {};

    const graphMap = new Map();
    crateData['@graph'].forEach(item => {
      if (item['@id']) {
        graphMap.set(item['@id'], item);
      }
    });

    variableMeasured.forEach((variable, index) => {
      let actualVariable = variable;
      if (variable['@id'] && Object.keys(variable).length <= 2) {
        const resolved = graphMap.get(variable['@id']);
        if (resolved) {
          actualVariable = resolved;
        }
      }

      const metadataPropertyNames = [
        'elabftw_metadata',    // eLabFTW format
        'source_metadata',     // Generic format
        'extra_fields',        // Generic format
        'custom_fields'        // Generic format
      ];

      // Extract from any recognized metadata property
      let metadataExtracted = false;
      for (const propName of metadataPropertyNames) {
        if (actualVariable.propertyID === propName && actualVariable.value) {
          this.extractFromSourceMetadata(actualVariable.value, customFields, propName);
          metadataExtracted = true;
          break;
        } else if (actualVariable[propName]) {
          this.extractFromSourceMetadata(actualVariable[propName], customFields, propName);
          metadataExtracted = true;
          break;
        }
      }

      // Extract standard PropertyValue fields (if not metadata container)
      if (actualVariable.propertyID && actualVariable.value && !metadataExtracted) {
        this.extractPropertyValue(actualVariable, customFields);
      }

      // Extract name-value pairs (fallback for simple fields)
      if (actualVariable.name && actualVariable.value && !actualVariable.propertyID) {
        this.extractNameValuePair(actualVariable, customFields);
      }
    });

    return customFields;
  }

  /**
   *
   * @param metadataValue - Raw metadata value (string or object)
   * @param customFields - Output object for extracted fields
   * @param sourceName - Name of the metadata property (for logging)
   */
  private extractFromSourceMetadata(
    metadataValue: string | any,
    customFields: Record<string, CustomField>,
    sourceName: string = 'unknown'
  ): void {
    let metadata;
    try {
      metadata = typeof metadataValue === 'string' ? JSON.parse(metadataValue) : metadataValue;
    } catch (error) {
      console.error(`Failed to parse ${sourceName} JSON:`, error);
      return;
    }

    console.log(`Extracting fields from ${sourceName}:`, metadata);

    let extraFields = null;

    // P1 IMPROVEMENT: Support multiple metadata structures
    // Try different paths to find extra fields
    const possiblePaths = [
      metadata.elabftw?.extra_fields,  // eLabFTW nested format
      metadata.extra_fields,           // Direct extra_fields
      metadata.custom_fields,          // Generic custom_fields
      metadata.fields,                 // Generic fields
      metadata                         // Flat structure (fields at root)
    ];

    for (const path of possiblePaths) {
      if (path && typeof path === 'object') {
        extraFields = path;
        break;
      }
    }

    if (extraFields) {
      console.log(`Found extra fields in ${sourceName}:`, Object.keys(extraFields));
      Object.entries(extraFields).forEach(([fieldName, fieldData]: [string, any]) => {
        this.processExtraField({ name: fieldName, ...fieldData }, customFields);
      });
    } else {
      console.warn(`No extra fields found in ${sourceName} metadata`);
    }
  }

  private processExtraField(field: any, customFields: Record<string, CustomField>): void {
    if (field.name && (field.value !== undefined && field.value !== null)) {
      const fieldValue = field.value.toString();
      if (field.options) {
        field.options = field.options.filter(option => option !== undefined && option !== null && option !== "");
      }
      if (field.type === 'checkbox') {
        field.options = ['Yes', 'No'];
      }
      customFields[field.name] = {
        type: this.mapFieldType(field.type) || 'text',
        value: fieldValue,
        description: field.description,
        required: field.required || false,
        ...(field.options && { options: field.options }),
        ...(field.units && { units: field.units }),
        ...(field.units && field.unit && { unitText: field.unit }),
        ...(field.units && !field.unit && { unitText: field.units[0] }),//observation showed that when there was only one value for 'units', the 'unit' field was dropped from the ElabFTW json.
        ...(field.group_id && { group_id: field.group_id })
      };
    }
  }

  private extractPropertyValue(variable: any, customFields: Record<string, CustomField>): void {
    const fieldName = variable.propertyID?.toString().trim();
    const fieldValue = variable.value?.toString().trim();

    if (!fieldName || !fieldValue) return;

    const fieldType = variable.valueReference || 'text';
    if(!customFields[fieldName]) {
      customFields[fieldName] = {
        type: fieldType,
        value: fieldValue,
        description: variable.description || `Property: ${fieldName}`,
        ...(variable.unitCode && {units: [variable.unitCode]}),
        ...(variable.unitText && {units: [variable.unitText]})
      };
    }

  }

  private extractNameValuePair(variable: any, customFields: Record<string, CustomField>): void {
    const fieldName = variable.name?.toString().trim();
    const fieldValue = variable.value?.toString().trim();
    if(!customFields[fieldName]) {
      if (!fieldName || !fieldValue) return;
      customFields[fieldName] = {
        type: variable.valueReference || 'text',
        value: fieldValue,
        description: variable.description || `Field: ${fieldName}`
      };
    }
  }

  /**
   * P1 IMPROVEMENT: Renamed parameter from elabftwType to fieldType
   * Maps field types from any ELN source to RSpace field types
   *
   * @param fieldType - Field type from source ELN (generic, not eLabFTW-specific)
   * @returns RSpace-compatible field type
   */
   mapFieldType(fieldType: string): string {
    const typeMapping: Record<string, string> = {
      'number': 'Number',
      'date': 'Date',
      'datetime': 'Date',
      'time': 'Time',
      'checkbox': 'checkbox',  // P0: Checkboxes map to Radio with Yes/No options
      'select': 'select',
      'radio': 'Radio',
      'textarea': 'Text',
      'url': 'Uri',         // Improved: Use Uri type
      'email': 'Uri',       // Improved: Use Uri type
      'text': 'Text'
    };

    return typeMapping[fieldType] || 'Text';
  }
}
