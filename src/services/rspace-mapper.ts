import { PreviewItem } from '../types/eln';

/**
 * P1 IMPROVEMENT: Renamed parameter from elabftwType to fieldType
 * Maps field types from any ELN source to RSpace field types
 *
 * @param fieldType - Field type from source ELN (generic, not eLabFTW-specific)
 * @returns RSpace-compatible field type
 */
export function mapFieldTypeForRSpace(fieldType: string): string {
  const typeMapping: Record<string, string> = {
    'number': 'Number',
    'date': 'Date',
    'datetime': 'Date',
    'time': 'Time',
    'checkbox': 'Radio',  // P0: Checkboxes map to Radio with Yes/No options
    'select': 'Choice',
    'radio': 'Radio',
    'textarea': 'Text',
    'url': 'String',
    'email': 'String',
    'text': 'String'
  };

  return typeMapping[fieldType] || 'Text';
}

export function prepareFormFields(item: PreviewItem) {
  // P0 FIX: Track used field names to prevent collisions
  const usedFieldNames = new Set<string>();

  // Helper function to get unique field name
  const getUniqueFieldName = (baseName: string): string => {
    let fieldName = baseName.substring(0, 50);
    let counter = 1;

    // If name already exists, append counter
    while (usedFieldNames.has(fieldName)) {
      const suffix = `_${counter}`;
      const maxLength = 50 - suffix.length;
      fieldName = baseName.substring(0, maxLength) + suffix;
      counter++;
    }

    usedFieldNames.add(fieldName);
    return fieldName;
  };

  const formFields = [
    { name: getUniqueFieldName('Content'), type: 'Text', mandatory: false },
  ];

  // Add individual step fields with deduplication
  if (item.steps && item.steps.length > 0) {
    item.steps.forEach((step, index) => {
      // P0 FIX: Use index instead of position to avoid duplicate field names
      const stepName = getUniqueFieldName(`Step ${index + 1}`);
      formFields.push({
        name: stepName,
        type: 'Text',
        mandatory: false
      });
    });
  }

  formFields.push(
    { name: getUniqueFieldName('References'), type: 'Text', mandatory: false },
    { name: getUniqueFieldName('Keywords'), type: 'Text', mandatory: false },
    { name: getUniqueFieldName('Source ELN ID'), type: 'String', mandatory: false },  // P1: Generic name
    { name: getUniqueFieldName('Category'), type: 'String', mandatory: false },
    { name: getUniqueFieldName('Date Created'), type: 'Date', mandatory: false },
    { name: getUniqueFieldName('Date Modified'), type: 'Date', mandatory: false }
  );

  // P1 IMPROVEMENT: Define metadata fields to skip (not just elabftw_metadata)
  const metadataFieldsToSkip = new Set([
    'elabftw_metadata',   // eLabFTW internal metadata
    'source_metadata',    // Generic internal metadata
    'extra_fields',       // Already extracted
    'custom_fields',      // Already extracted
    '_internal'           // Internal fields
  ]);

  Object.entries(item.metadata).forEach(([fieldName, field]) => {
    if (!metadataFieldsToSkip.has(fieldName)) {
      const mappedType = mapFieldTypeForRSpace(field.type);

      // P0 FIX: Checkbox fields mapped to Radio need Yes/No options
      const fieldOptions = field.options ||
        (field.type === 'checkbox' && mappedType === 'Radio' ? ['Yes', 'No'] : undefined);

      formFields.push({
        name: getUniqueFieldName(fieldName),
        type: mappedType,
        mandatory: field.required || false,
        ...(fieldOptions && { options: fieldOptions })
      } as any);
    }
  });

  return formFields;
}

export function prepareDocumentFieldValues(item: PreviewItem): Record<string, string> {
  const formatDateForRSpace = (dateString?: string): string => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      return date.toISOString().split('T')[0];
    } catch {
      return '';
    }
  };

  const fieldValues: Record<string, string> = {
    'Content': item.textContent || 'No content',
  };

  // Add individual step values
  // P0 FIX: Use index instead of position to match field names from prepareFormFields
  if (item.steps && item.steps.length > 0) {
    item.steps.forEach((step, index) => {
      fieldValues[`Step ${index + 1}`] = step.itemListElement.text;
    });
  }

  fieldValues['References'] = '';
  fieldValues['Keywords'] = item.keywords.join(', ');
  fieldValues['Source ELN ID'] = item.id;  // P1: Generic name
  fieldValues['Category'] = item.category;
  fieldValues['Date Created'] = formatDateForRSpace(item.dateCreated);
  fieldValues['Date Modified'] = formatDateForRSpace(item.dateModified);

  // P1 IMPROVEMENT: Define metadata fields to skip (not just elabftw_metadata)
  const metadataFieldsToSkip = new Set([
    'elabftw_metadata',
    'source_metadata',
    'extra_fields',
    'custom_fields',
    '_internal'
  ]);

  Object.entries(item.metadata).forEach(([fieldName, field]) => {
    if (!metadataFieldsToSkip.has(fieldName)) {
      let fieldValue = field.value || '';

      // P0 FIX: Convert checkbox values to Yes/No for Radio buttons
      if (field.type === 'checkbox') {
        // Convert checkbox values: 'on', 'true', '1', 'checked' → 'Yes', otherwise 'No'
        const truthy = ['on', 'true', '1', 'checked', 'yes'];
        fieldValue = truthy.includes(String(field.value).toLowerCase()) ? 'Yes' : 'No';
      }

      fieldValues[fieldName.substring(0, 50)] = fieldValue;
    }
  });

  return fieldValues;
}

export function prepareInventoryCustomFields(item: PreviewItem): Record<string, string> {
  const customFields: Record<string, any> = {};

  // P1 IMPROVEMENT: Define metadata fields to skip (not just elabftw_metadata)
  const metadataFieldsToSkip = new Set([
    'elabftw_metadata',
    'source_metadata',
    'extra_fields',
    'custom_fields',
    '_internal'
  ]);

  // BUG FIX: RSpace reserved field names for inventory
  const reservedFieldNames = new Set([
    'name',
    'description',
    'expiry date',
    'expirydate',
    'source',
    'tags'
  ]);

  Object.entries(item.metadata).forEach(([fieldName, field]) => {
    const fieldNameLower = fieldName.toLowerCase().trim();

    // Skip metadata container fields
    if (metadataFieldsToSkip.has(fieldName)) {
      return;
    }

    // Skip empty values
    if (field.value === undefined || field.value === null) {
      return;
    }

    // BUG FIX: Rename reserved field names to preserve data
    let finalFieldName = fieldName;
    if (reservedFieldNames.has(fieldNameLower)) {
      finalFieldName = `metadata_${fieldName}`;
      console.log(`Renamed reserved field: "${fieldName}" → "${finalFieldName}"`);
    }

    // BUG FIX: Convert all values to strings for RSpace API
    // Handles: booleans (true/false), numbers (5.0, 0.1), strings, objects
    let stringValue: string;
    if (typeof field.value === 'object') {
      try {
        stringValue = JSON.stringify(field.value);
      } catch (error) {
        // Handle circular references or other JSON.stringify errors
        console.warn(`Failed to stringify field "${fieldName}":`, error);
        stringValue = String(field.value); // Fallback to toString()
      }
    } else {
      stringValue = String(field.value);
    }

    customFields[finalFieldName] = stringValue;
  });

  customFields['Source ELN ID'] = String(item.id);  // P1: Generic name
  customFields['Category'] = String(item.category);
  customFields['Date Created'] = String(item.dateCreated || '');
  customFields['Keywords'] = item.keywords.join(', ');

  return customFields;
}

export function extractQuantityFromMetadata(item: PreviewItem): { value: number; unit: string } | undefined {
  const quantityFields = Object.entries(item.metadata).find(([fieldName, field]) =>
    ['quantity', 'amount', 'volume', 'mass', 'weight', 'concentration'].some(q =>
      fieldName.toLowerCase().includes(q)
    ) && field.value
  );

  if (quantityFields) {
    const [fieldName, field] = quantityFields;
    const numericValue = parseFloat(field.value);
    if (!isNaN(numericValue)) {
      const unit = field.units?.[0] || 'units';
      return { value: numericValue, unit };
    }
  }

  return undefined;
}

export function isInstrumentResource(item: PreviewItem): boolean {
  return item.justification.includes('instrument') ||
         item.justification.includes('equipment');
}

/**
 * P1 IMPROVEMENT: Changed from 'elabftw-import' to generic 'eln-import' tag
 * Prepares tags for RSpace items based on classification and metadata
 *
 * @param item - Preview item to generate tags for
 * @returns Array of tags for RSpace
 */
export function prepareTags(item: PreviewItem): string[] {
  return [
    'eln-import',  // P1: Generic tag instead of 'elabftw-import'
    item.type,
    item.category.toLowerCase().replace(/\s+/g, '-')
  ];
}
