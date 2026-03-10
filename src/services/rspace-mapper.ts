import {FormField, PreviewItem} from '../types/elabftw';
const MAX_FIELDNAME_LENGTH = 50;

export function prepareFormFields(item: PreviewItem) : FormField[] {
  const usedFieldNames = new Set<string>();
  const getUniqueFieldName = (baseName: string, maxTotalLength?: number): string => {
    let fieldName = baseName.substring(0, (maxTotalLength? maxTotalLength: MAX_FIELDNAME_LENGTH));
    let counter = 1;

    // If name already exists, append counter
    while (usedFieldNames.has(fieldName)) {
      const suffix = `_${counter}`;
      const maxLength = (maxTotalLength? maxTotalLength: MAX_FIELDNAME_LENGTH) - suffix.length;
      fieldName = baseName.substring(0, maxLength) + suffix;
      counter++;
    }

    usedFieldNames.add(fieldName);
    return fieldName;
  };
  const formFields: FormField[] = [
    { name: getUniqueFieldName('Owner'), type: 'String', mandatory: false, fullName: 'Owner' },
    { name: getUniqueFieldName('Content'), type: 'Text', mandatory: false,  fullName: 'Content' },
  ];

  if (item.steps && item.steps.length > 0) {
    item.steps.forEach((step) => {
      const stepName = getUniqueFieldName("Step: "+step.itemListElement.text,(MAX_FIELDNAME_LENGTH - 6));
      formFields.push({
        name: stepName,
        fullName: "Step: "+step.itemListElement.text,
        type: 'Radio',
        mandatory: false,
        options: ['finished','unfinished']
      });
      formFields.push({
        name: "Step deadline",
        fullName: step.itemListElement.text+"_deadline",
        type: 'String',//TODO - make this map to a time or a date instead?
        mandatory: false
      });
    });
  }

  formFields.push(
    { name: getUniqueFieldName('References'), type: 'Text', mandatory: false, fullName: 'References' },
    { name: getUniqueFieldName('Source ELN ID'), type: 'String', mandatory: false, fullName: 'Source ELN ID' },  // P1: Generic name
    { name: getUniqueFieldName('Category'), type: 'String', mandatory: false, fullName: 'Category' },
    { name: getUniqueFieldName('Date Created'), type: 'Date', mandatory: false, fullName: 'Date Created' },
    { name: getUniqueFieldName('Date Modified'), type: 'Date', mandatory: false, fullName: 'Date Modified' }
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
      const mappedType = mapSelectAndCheckBoxToRadio(field.type);
      const showAsPickList = field.type === 'select';
      const fieldOptions = field.options;
      const request = {
        name: getUniqueFieldName(fieldName),
        fullName: fieldName,
        type: mappedType,
        mandatory: field.required || false,
        ...(fieldOptions && { options: fieldOptions }),
        ...(showAsPickList && { showAsPickList: true }),
      };
      formFields.push(request);
      if(field.description && mappedType !== 'Text') {
        const description = {
          name: getUniqueFieldName(fieldName+" description:"),
          fullName: fieldName+" description:",
          type: 'Text',
          mandatory: false,
        };
        formFields.push(description);
      }
      if(field.units ) {
        const units = {
          name: getUniqueFieldName(fieldName+" units:"),
          fullName: fieldName+" units:",
          type: 'Radio',
          mandatory: false,
          showAsPickList: true,
          options: field.units.map(unit => unit.toString()),
        };
        formFields.push(units);
      }
    }
  });
  const formFieldsCopy = [...formFields];
  formFieldsCopy.forEach(field => {
    if(field.fullName.length > MAX_FIELDNAME_LENGTH) {
      formFields.splice(formFields.indexOf(field)+1,0,{type: "Text", name:"FullName", fullName:"FullName", mandatory:false});
    }
  })
  return formFields;
}

export function mapSelectAndCheckBoxToRadio(fieldType: string): string {
  if (fieldType === 'checkbox' || fieldType === 'select') {
    return 'Radio';
  }
  return fieldType;
}

export function prepareDocumentFieldValues(item: PreviewItem, formFields: { name: string, fullName:string, type:string}[]): Array<{ name: string, content: string, description?: string }> {
  const formatDateForRSpace = (dateString?: string): string => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      return date.toISOString().split('T')[0];
    } catch {
      return '';
    }
  };


  type ObjectWithAtLeastOneString = {
    [key: string]: string;
  };
  const preFieldValues: Array<ObjectWithAtLeastOneString> = [
      {'Owner': item.authorName || ''},
    {'Content': item.textContent || 'No content'},
  ];

  if (item.steps && item.steps.length > 0) {
    item.steps.forEach((step, index) => {
      preFieldValues.push({["Step: "+step.itemListElement.text]: step.creativeWorkStatus});
      preFieldValues.push({[step.itemListElement.text+'_deadline']: step.expires ? new Date(step.expires).toLocaleString():""});
    });
  }

  preFieldValues.push({'References' :''});
  // preFieldValues.push({'Keywords': item.keywords.join(', ')});
  preFieldValues.push({'Source ELN ID':item.id});  // P1: Generic name
  preFieldValues.push({'Category': item.category});
  preFieldValues.push({'Date Created': formatDateForRSpace(item.dateCreated)});
  preFieldValues.push({'Date Modified': formatDateForRSpace(item.dateModified)});

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

      // Convert checkbox values to Choice format
      if (field.type === 'checkbox') {
        const truthy = ['on', 'true', '1', 'checked', 'yes'];
        fieldValue = truthy.includes(String(field.value).toLowerCase()) ? 'Yes' : 'No';
      }
      preFieldValues.push({[fieldName]: fieldValue, description: field.description || '', unitText: field.unitText || ''});
    }
  });
  const orderedFieldValues :{name:string,content:string, description?:string} [] = [];
  formFields.forEach(field => {
    const aValue = preFieldValues.find(v=> v[field.fullName] !== undefined);
    if(aValue) {
      const descriptionValue = (aValue['description'] || '').replace('Extra field:', '') ;
      if(field.type === 'Text' && descriptionValue) {
        orderedFieldValues.push({
          name: field.name, content: aValue[field.fullName],
          description: (descriptionValue)
        });
      } else if (descriptionValue) {
        orderedFieldValues.push({
          name: field.name, content: aValue ? aValue[field.fullName] : ""
        });
        orderedFieldValues.push({
          name: field.name+" description:", content: descriptionValue
        });
      } else {
        orderedFieldValues.push({
          name: field.name, content: aValue ? aValue[field.fullName] : ""
        });
      }
      if(aValue.unitText) {
        orderedFieldValues.push({
          name: field.name+" units:", content: aValue.unitText
        });
      }
      if(aValue && field.fullName.length > MAX_FIELDNAME_LENGTH) {
        orderedFieldValues.push({
          name: "FullName", content: field.fullName
        });
      }
    }
  });
  return orderedFieldValues;
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
  const tags: string[] = [];
  tags.push('eln-import');
  tags.push(item.type);
  tags.push(item.category.toLowerCase().replace(/\s+/g, '-'));
  if(item.keywords && item.keywords.length > 0) {
    tags.push(item.keywords.join(','));
  }
  if (item.creativeWorkStatus) {
    tags.push(item.creativeWorkStatus);
  }
  return tags;
}
