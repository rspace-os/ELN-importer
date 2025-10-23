import { PreviewItem } from '../types/elabftw';

export function mapFieldTypeForRSpace(elabftwType: string): string {
  const typeMapping: Record<string, string> = {
    'number': 'Number',
    'date': 'Date',
    'datetime': 'Date',
    'checkbox': 'Radio',
    'select': 'Choice',
    'textarea': 'Text',
    'url': 'String',
    'email': 'String'
  };

  return typeMapping[elabftwType] || 'Text';
}

export function prepareFormFields(item: PreviewItem) {
  const formFields = [
    { name: 'Content', type: 'Text', mandatory: false },
  ];

  // Add individual step fields
  if (item.steps && item.steps.length > 0) {
    item.steps.forEach((step, index) => {
      formFields.push({
        name: `Step ${step.position}`,
        type: 'Text',
        mandatory: false
      });
    });
  }

  formFields.push(
    { name: 'References', type: 'Text', mandatory: false },
    { name: 'Keywords', type: 'Text', mandatory: false },
    { name: 'ELN ID', type: 'String', mandatory: false },
    { name: 'Category', type: 'String', mandatory: false },
    { name: 'Date Created', type: 'Date', mandatory: false },
    { name: 'Date Modified', type: 'Date', mandatory: false }
  );

  Object.entries(item.metadata).forEach(([fieldName, field]) => {
    if (fieldName !== 'elabftw_metadata') {
      formFields.push({
        name: fieldName.substring(0, 50),
        type: mapFieldTypeForRSpace(field.type),
        mandatory: field.required || false,
        ...(field.options && { options: field.options })
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
  if (item.steps && item.steps.length > 0) {
    item.steps.forEach((step) => {
      fieldValues[`Step ${step.position}`] = step.itemListElement.text;
    });
  }

  fieldValues['References'] = '';
  fieldValues['Keywords'] = item.keywords.join(', ');
  fieldValues['ELN ID'] = item.id;
  fieldValues['Category'] = item.category;
  fieldValues['Date Created'] = formatDateForRSpace(item.dateCreated);
  fieldValues['Date Modified'] = formatDateForRSpace(item.dateModified);

  Object.entries(item.metadata).forEach(([fieldName, field]) => {
    if (fieldName !== 'elabftw_metadata') {
      fieldValues[fieldName.substring(0, 50)] = field.value || '';
    }
  });

  return fieldValues;
}

export function prepareInventoryCustomFields(item: PreviewItem): Record<string, any> {
  const customFields: Record<string, any> = {};

  Object.entries(item.metadata).forEach(([fieldName, field]) => {
    if (fieldName !== 'elabftw_metadata' && field.value) {
      customFields[fieldName] = field.value;
    }
  });

  customFields['eLabFTW ID'] = item.id;
  customFields['Category'] = item.category;
  customFields['Date Created'] = item.dateCreated;
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

export function prepareTags(item: PreviewItem): string[] {
  return ['elabftw-import', item.type, item.category.toLowerCase().replace(/\s+/g, '-')];
}
