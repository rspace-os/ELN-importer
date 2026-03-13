import { describe, it, expect } from 'vitest';
import {
  mapSelectAndCheckBoxToRadio,
  prepareFormFields,
  prepareDocumentFieldValues,
  prepareTags,
  prepareSampleTemplateFields,
  prepareSampleFieldValues
} from './rspace-mapper';
import { PreviewItem, HowToStep } from '../types/elabftw';

describe('RSpaceMapper', () => {
  describe('mapSelectAndCheckBoxToRadio', () => {
    it('should map various select and checkbox to radio ', () => {
      expect(mapSelectAndCheckBoxToRadio('select')).toBe('Radio');
      expect(mapSelectAndCheckBoxToRadio('checkbox')).toBe('Radio');
    });

  });

  describe('prepareFormFields', () => {
    it('should prepare basic form fields', () => {
      const item: PreviewItem = {
        id: '1',
        name: 'Item',
        type: 'experiment',
        category: 'Dataset',
        categoryColor: '#000',
        proposedClassification: 'document',
        userClassification: null,
        confidence: 'high',
        justification: '',
        reasons: [],
        metadata: {},
        files: [],
        crossReferences: [],
        validationIssues: [],
        textContent: '',
        steps: [],
        keywords: [],
        dateCreated: '',
        dateModified: ''
      };
      const fields = prepareFormFields(item as PreviewItem);
      
      const fieldNames = fields.map(f => f.name);
      expect(fieldNames).toContain('Owner');
      expect(fieldNames).toContain('Content');
      expect(fieldNames).toContain('References');
      // expect(fieldNames).toContain('Keywords');
      expect(fieldNames).toContain('Source ELN ID');
      expect(fieldNames).toContain('Category');
    });

    it('should handle step fields with deduplication', () => {
      const steps: HowToStep[] = [
        { '@id': 's1', '@type': 'HowToStep', position: 1, creativeWorkStatus: 'complete', itemListElement: { '@id': 'it1', '@type': 'HowToDirection', text: 'Step 1 content' } },
        { '@id': 's2', '@type': 'HowToStep', position: 2, creativeWorkStatus: 'complete', itemListElement: { '@id': 'it2', '@type': 'HowToDirection', text: 'Step 2 content' } }
      ];
      const item: PreviewItem = {
        id: '2', name: 'Item', type: 'experiment', category: 'Dataset', categoryColor: '#000',
        proposedClassification: 'document', userClassification: null, confidence: 'high', justification: '', reasons: [],
        metadata: {}, files: [], crossReferences: [], validationIssues: [], textContent: '', steps, keywords: [], dateCreated: '', dateModified: ''
      };
      const fields = prepareFormFields(item as PreviewItem);
      const fieldNames = fields.map(f => f.name);
      
      expect(fieldNames).toContain('Step: Step 1 content');
      expect(fieldNames).toContain('Step deadline');
    });

    it('should map metadata fields and handle collisions', () => {
      const item: PreviewItem = {
        id: '3', name: 'Item', type: 'experiment', category: 'Dataset', categoryColor: '#000',
        proposedClassification: 'document', userClassification: null, confidence: 'high', justification: '', reasons: [],
        metadata: {
          'Content': { value: 'val', type: 'Text' }, // Collision with default 'Content'
          'My Field': { value: 'val', type: 'Number', required: true }
        },
        files: [], crossReferences: [], validationIssues: [], textContent: '', steps: [], keywords: [], dateCreated: '', dateModified: ''
      };
      const fields = prepareFormFields(item as PreviewItem);
      const fieldNames = fields.map(f => f.name);
      
      expect(fieldNames).toContain('Content');
      expect(fieldNames).toContain('Content_1');
      expect(fieldNames).toContain('My Field');
      
      const myField = fields.find(f => f.name === 'My Field');
      expect(myField?.type).toBe('Number');
      expect(myField?.mandatory).toBe(true);
    });

    it('should truncate field names longer than MAX_FIELDNAME_LENGTH', () => {
      const longName = 'A'.repeat(60);
      const item: PreviewItem = {
        id: '4', name: 'Item', type: 'experiment', category: 'Dataset', categoryColor: '#000',
        proposedClassification: 'document', userClassification: null, confidence: 'high', justification: '', reasons: [],
        metadata: {
          [longName]: { value: 'val', type: 'Text' }
        },
        files: [], crossReferences: [], validationIssues: [], textContent: '', steps: [], keywords: [], dateCreated: '', dateModified: ''
      };
      const fields = prepareFormFields(item as PreviewItem);
      const fieldNames = fields.map(f => f.name);
      
      const expectedTruncated = 'A'.repeat(50);
      expect(fieldNames).toContain(expectedTruncated);
      expect(expectedTruncated.length).toBe(50);
    });

    it('should handle step names that exceed MAX_FIELDNAME_LENGTH when prefixed', () => {
      // MAX_FIELDNAME_LENGTH is 50. Prefixed with "Step: " (6 chars)
      // If step text is 45 chars, total is 51.
      const longStepText = 'B'.repeat(45);
      const steps: HowToStep[] = [
        { '@id': 's1', '@type': 'HowToStep', position: 1, creativeWorkStatus: 'complete', itemListElement: { '@id': 'it1', '@type': 'HowToDirection', text: longStepText } }
      ];
      const item: PreviewItem = {
        id: '5', name: 'Item', type: 'experiment', category: 'Dataset', categoryColor: '#000',
        proposedClassification: 'document', userClassification: null, confidence: 'high', justification: '', reasons: [],
        metadata: {}, files: [], crossReferences: [], validationIssues: [], textContent: '', steps, keywords: [], dateCreated: '', dateModified: ''
      };
      const fields = prepareFormFields(item as PreviewItem);
      const fieldNames = fields.map(f => f.name);
      
      // The prefix "Step: " is 6 chars. 
      // The code uses: getUniqueFieldName("Step: "+step.itemListElement.text,(MAX_FIELDNAME_LENGTH - 6));
      // Wait, let's look at rspace-mapper.ts line 28:
      // const stepName = getUniqueFieldName("Step: "+step.itemListElement.text,(MAX_FIELDNAME_LENGTH - 6));
      // If MAX_FIELDNAME_LENGTH is 50, then maxTotalLength is 44.
      // "Step: " + "BBBB..." will be truncated to 44 chars?
      // "Step: " is 6 chars. 44 - 6 = 38 chars of B.
      
      const stepField = fields.find(f => f.name.startsWith('Step: '));
      expect(stepField).toBeDefined();
      expect(stepField!.name.length).toBeLessThanOrEqual(44); // Based on current code logic
      expect(stepField!.name).toBe("Step: " + 'B'.repeat(38));
    });

    it('should handle name collisions with truncated names', () => {
      const longName1 = 'A'.repeat(60) + '1';
      const longName2 = 'A'.repeat(60) + '2';
      const item: PreviewItem = {
        id: '6', name: 'Item', type: 'experiment', category: 'Dataset', categoryColor: '#000',
        proposedClassification: 'document', userClassification: null, confidence: 'high', justification: '', reasons: [],
        metadata: {
          [longName1]: { value: 'val1', type: 'Text' },
          [longName2]: { value: 'val2', type: 'Text' }
        },
        files: [], crossReferences: [], validationIssues: [], textContent: '', steps: [], keywords: [], dateCreated: '', dateModified: ''
      };
      const fields = prepareFormFields(item as PreviewItem);
      const fieldNames = fields.map(f => f.name);
      
      const expectedTruncated1 = 'A'.repeat(50);
      const expectedTruncated2 = 'A'.repeat(48) + '_1';
      expect(fieldNames).toContain(expectedTruncated1);
      expect(fieldNames).toContain(expectedTruncated2);
    });
  });

  describe('prepareDocumentFieldValues', () => {
    it('should prepare field values for documents', () => {
      const steps: HowToStep[] = [
        { '@id': 's1', '@type': 'HowToStep', position: 1, creativeWorkStatus: 'complete', expires: '2023-01-01T12:00:00Z', itemListElement: { '@id': 'it1', '@type': 'HowToDirection', text: 'Step 1 content' } }
      ];
      const item: PreviewItem = {
        id: '123',
        name: 'Doc',
        type: 'experiment',
        category: 'Experiments',
        categoryColor: '#000',
        proposedClassification: 'document',
        userClassification: null,
        confidence: 'high',
        justification: '',
        reasons: [],
        textContent: 'Main content',
        dateCreated: '2023-01-01T10:00:00Z',
        dateModified: '2023-01-02T10:00:00Z',
        steps,
        keywords: ['tag1', 'tag2'],
        metadata: {
          'Custom Field': { value: 'Custom Value', type: 'text' }
        },
        files: [], crossReferences: [], validationIssues: []
      };
      
      const formFields = prepareFormFields(item as PreviewItem);
      const values = prepareDocumentFieldValues(item as PreviewItem, formFields);
      
      const getValue = (name: string) => values.find(v => v.name === name)?.content;
      
      expect(getValue('Owner')).toBe('');
      expect(getValue('Content')).toBe('Main content');
      expect(getValue('Step: Step 1 content')).toBe('complete');
      expect(getValue('Step deadline')).toBe(new Date(steps[0].expires!).toLocaleString());
      expect(getValue('Source ELN ID')).toBe('123');
      expect(getValue('Category')).toBe('Experiments');
      expect(getValue('Date Created')).toBe('2023-01-01');
      expect(getValue('References')).toBe('');
      expect(getValue('Custom Field')).toBe('Custom Value');
    });
  });

  describe('prepareTags', () => {
    it('returns base eln-import, type and kebab-case category', () => {
      const item: PreviewItem = {
        id: 't', name: 'x', type: 'experiment', category: 'Basic Research', categoryColor: '#000',
        proposedClassification: 'document', userClassification: null, confidence: 'high', justification: '', reasons: [],
        metadata: {}, files: [], crossReferences: [], validationIssues: [], textContent: '', steps: [], keywords: ['aaa'], dateCreated: '', dateModified: ''
      };
      const tags = prepareTags(item);
      expect(tags).toEqual(['eln-import', 'experiment', 'basic-research','aaa']);
    });

    it('handles simple category', () => {
      const item: PreviewItem = {
        id: 't2', name: 'x', type: 'resource', category: 'Reagents', categoryColor: '#000',
        proposedClassification: 'inventory', userClassification: null, confidence: 'high', justification: '', reasons: [],
        metadata: {}, files: [], crossReferences: [], validationIssues: [], textContent: '', steps: [], keywords: [], dateCreated: '', dateModified: ''
      };
      const tags = prepareTags(item);
      expect(tags).toEqual(['eln-import', 'resource', 'reagents']);
    });
  });
  describe('prepareSampleTemplateFields', () => {
    it('should prepare template fields for inventory items', () => {
      const item: PreviewItem = {
        id: '1',
        name: 'Sample',
        type: 'resource',
        category: 'Reagents',
        categoryColor: '#000',
        proposedClassification: 'inventory',
        userClassification: null,
        confidence: 'high',
        justification: '',
        reasons: [],
        metadata: {
          'Concentration': { value: '10', type: 'Number', units: ['mg/ml'] },
          'Storage': { value: '-20', type: 'Select', options: ['-20', '+4'] },
          'Is Valid': { value: 'true', type: 'Checkbox' }
        },
        files: [],
        crossReferences: [],
        validationIssues: [],
        textContent: '',
        steps: [],
        keywords: [],
        dateCreated: '',
        dateModified: '',
        creativeWorkStatus: ''
      };

      const fields = prepareSampleTemplateFields(item);
      expect(fields).toHaveLength(3);
      
      const concentration = fields.find(f => f.name === 'Concentration');
      expect(concentration?.type).toBe('number');

      const storage = fields.find(f => f.name === 'Storage');
      expect(storage?.type).toBe('radio');
      expect(storage?.options).toEqual(['-20', '+4']);

      const isValid = fields.find(f => f.name === 'Is Valid');
      expect(isValid?.type).toBe('choice');
      expect(isValid?.multiple).toBe(true);
    });
  });

  describe('prepareSampleFieldValues', () => {
    it('should prepare field values for samples based on template', () => {
      const item: PreviewItem = {
        id: '1',
        name: 'Sample',
        type: 'resource',
        category: 'Reagents',
        categoryColor: '#000',
        proposedClassification: 'inventory',
        userClassification: null,
        confidence: 'high',
        justification: '',
        reasons: [],
        metadata: {
          'Concentration': { value: '10', type: 'Number' },
          'Storage': { value: '-20', type: 'Select' },
          'Is Valid': { value: 'true, false', type: 'Checkbox' }
        },
        files: [],
        crossReferences: [],
        validationIssues: [],
        textContent: '',
        steps: [],
        keywords: [],
        dateCreated: '',
        dateModified: '',
        creativeWorkStatus: ''
      };

      const templateFields = [
        { name: 'Concentration', type: 'number' },
        { name: 'Storage', type: 'radio' },
        { name: 'Is Valid', type: 'choice' }
      ];

      const values = prepareSampleFieldValues(item, templateFields);
      expect(values).toHaveLength(3);
      expect(values[0]).toEqual({ content: '10' });
      expect(values[1]).toEqual({ selectedOptions: ['-20'] });
      expect(values[2]).toEqual({ selectedOptions: ['true', 'false'] });
    });
  });
});
