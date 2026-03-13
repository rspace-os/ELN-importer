import {FormField, PreviewItem} from '../types/elabftw';
import {RSpaceService} from "./rspace-api.ts";
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
    { name: getUniqueFieldName('Owner'), type: 'String', mandatory: false, fullName: 'Owner', content: item.authorName },
    { name: getUniqueFieldName('Content'), type: 'Text', mandatory: false,  fullName: 'Content' },
  ];

  if (item.steps && item.steps.length > 0) {
    item.steps.forEach((step) => {
      const fullName = makeStepName(step.itemListElement.text);
      const deadlineName = makeStepDeadlineName(step.itemListElement.text);
      const stepName = getUniqueFieldName(fullName);
      formFields.push({
        name: stepName,
        fullName: fullName,
        type: 'Radio',
        mandatory: false,
        options: ['finished','unfinished']
      });
      formFields.push({
        name: getUniqueFieldName(deadlineName),
        fullName: deadlineName,
        type: 'String',//TODO - make this map to a time or a date instead?
        mandatory: false,
        isSecondary:true
      });
    });
}

  formFields.push(
    { name: getUniqueFieldName('References'), type: 'Text', mandatory: false, fullName: 'References' },
    { name: getUniqueFieldName('Source ELN ID'), type: 'String', mandatory: false, fullName: 'Source ELN ID' , content:item.id},  // P1: Generic name
    { name: getUniqueFieldName('Category'), type: 'String', mandatory: false, fullName: 'Category', content: item.category },
    { name: getUniqueFieldName('Date Created'), type: 'Date', mandatory: false, fullName: 'Date Created', content: formatDateForRSpace(item.dateCreated) },
    { name: getUniqueFieldName('Date Modified'), type: 'Date', mandatory: false, fullName: 'Date Modified', content: formatDateForRSpace(item.dateModified) }
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
      const primaryFormField : FormField = {
        name: getUniqueFieldName(fieldName),
        fullName: fieldName,
        type: mappedType,
        mandatory: field.required || false,
        ...(fieldOptions && { options: fieldOptions }),
        ...(fieldOptions && field.value && {'selectedOptions': [field.value]}),
        ...(showAsPickList && { showAsPickList: true }),
      };
      formFields.push(primaryFormField);
      if(field.description && mappedType !== 'Text') {
        const description = {
          name: getUniqueFieldName("Description: "+fieldName),
          fullName: "Description: "+fieldName,
          type: 'Text',
          mandatory: false,
          isSecondary:true,
          content: field.description
        };
        primaryFormField.descriptionName = description.name;
        formFields.push(description);
      }
      if(field.units && field.units.length > 0) {
        const units = {
          name: getUniqueFieldName("Units: "+fieldName),
          fullName: "Units: "+fieldName,
          type: 'Radio',
          mandatory: false,
          showAsPickList: true,
          isSecondary:true,
          options: field.units.map(unit => unit.toString()),
          selectedOptions: [field.value ? field.value: field.unitText],
        };
        primaryFormField.unitsName = units.name;
        formFields.push(units);
      }
    }
  });
  const formFieldsCopy = [...formFields];
  formFieldsCopy.forEach(field => {
    if(field.fullName.length > MAX_FIELDNAME_LENGTH && !field.isSecondary) {
      const fullNameField = {type: "Text", name:getUniqueFieldName("FullName: "+field.fullName), fullName:"FullName: "+field.fullName, mandatory:false};
      formFields.splice(formFields.indexOf(field)+1,0,fullNameField);
      field.fullNameName = fullNameField.name;
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

const makeStepName = name => `Step: ${name}`;
const makeStepDeadlineName = name => `Deadline: ${name}`;
const formatDateForRSpace = (dateString?: string): string => {
  if (!dateString) return '';
  try {
    const date = new Date(dateString);
    return date.toISOString().split('T')[0];
  } catch {
    return '';
  }
};
export function prepareDocumentFieldValues(item: PreviewItem, formFields: FormField []): Array<{ name: string, content: string, description?: string }> {

type ObjectWithAtLeastOneString = {
    [key: string]: string;
  };
  const preFieldValues: Array<ObjectWithAtLeastOneString> = [
      {'Owner': item.authorName || ''},
    {'Content': item.textContent || 'No content'},
  ];

  if (item.steps && item.steps.length > 0) {
    item.steps.forEach((step) => {
      const fullName = makeStepName(step.itemListElement.text);
      const deadlineName = makeStepDeadlineName(step.itemListElement.text);
      preFieldValues.push({[fullName]: step.creativeWorkStatus});
      preFieldValues.push({[deadlineName]: step.expires ? new Date(step.expires).toLocaleString():""});
    });
  }

  preFieldValues.push({'References' :''});
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
          name: field.name, content:  aValue[field.fullName]
        });
        orderedFieldValues.push({
          name: field.descriptionName || '', content: descriptionValue
        });
      } else {
        orderedFieldValues.push({
          name: field.name, content: aValue[field.fullName]
        });
      }
      if(aValue.unitText) {
        orderedFieldValues.push({
          name: field.unitsName || '', content: aValue.unitText
        });
      }
      if(aValue && field.fullName.length > MAX_FIELDNAME_LENGTH &&!field.isSecondary) {
        orderedFieldValues.push({
          name: field.fullNameName || '', content: field.fullName
        });
      }
    }
  });
  return orderedFieldValues;
}

export function prepareSampleTemplateFields(item: PreviewItem): Array<{ name: string; type: string; options?: string[]; multiple?: boolean }> {
  const fields: Array<{ name: string; type: string; options?: string[]; multiple?: boolean }> = [];
  const metadataFieldsToSkip = new Set([
    'elabftw_metadata',
    'source_metadata',
    'extra_fields',
    'custom_fields',
    '_internal'
  ]);

  Object.entries(item.metadata).forEach(([fieldName, field]) => {
    if (!metadataFieldsToSkip.has(fieldName)) {
      const type = mapFieldTypeForInventory(field.type);
      fields.push({
        name: fieldName,
        type: type,
        ...(field.options && { options: field.options }),
        ...(field.type.toLowerCase() === 'checkbox' && { multiple: true })
      });
    }
  });

  return fields;
}

export function prepareSampleFieldValues(item: PreviewItem, templateFields: Array<{ name: string; type: string }>): Array<{ content?: string; selectedOptions?: string[] }> {
  const metadataFieldsToSkip = new Set([
    'elabftw_metadata',
    'source_metadata',
    'extra_fields',
    'custom_fields',
    '_internal'
  ]);

  return templateFields.map(templateField => {
    const field = item.metadata[templateField.name];
    if (!field || field.value === undefined || field.value === null) {
      return {};
    }

    if (templateField.type === 'choice' || templateField.type === 'radio') {
      const value = String(field.value);
      // For choice/checkbox, value might be comma-separated or a single string
      const options = value.split(',').map(v => v.trim()).filter(Boolean);
      return { selectedOptions: options.length > 0 ? options : [value] };
    }

    return { content: String(field.value) };
  });
}

function mapFieldTypeForInventory(fieldType: string): string {
  const mapping: Record<string, string> = {
    'text': 'text',
    'textarea': 'text',
    'string': 'string',
    'number': 'number',
    'date': 'date',
    'datetime': 'date',
    'time': 'time',
    'checkbox': 'choice',
    'select': 'radio',
    'radio': 'radio',
    'url': 'uri',
    'email': 'uri'
  };
  return mapping[fieldType.toLowerCase()] || 'string';
}

export function extractQuantityFromMetadata(item: PreviewItem): { value: number; unit: string } | undefined {
  const quantityFields = Object.entries(item.metadata).find(([fieldName, field]) =>
    ['quantity', 'amount', 'volume', 'mass', 'weight', 'concentration'].some(q =>
      fieldName.toLowerCase().includes(q)
    ) && field.value
  );

  if (quantityFields) {
    const parseDescriptionForUnits  = (description?: string) => {
      let unitValue = '';
      if(description) {
        const descriptionParts = description.split(' ');
        descriptionParts.forEach((part) => {
          const testValue = part.toLowerCase().replaceAll("μ", "µ");
          if (RSpaceService.unitMap[testValue]) {
            unitValue =  testValue;
          }
        })
      }
      return unitValue;
    }
    const [_, field] = quantityFields;
    const numericValue = parseFloat(field.value);
    if (!isNaN(numericValue)) {
      const unit = field.unitText || parseDescriptionForUnits(field.description) || '';
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
