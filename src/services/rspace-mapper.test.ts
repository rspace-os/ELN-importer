import { describe, it, expect } from 'vitest';
import { mapFieldTypeForRSpace, prepareFormFields, prepareDocumentFieldValues, prepareTags } from './rspace-mapper';
import { PreviewItem, HowToStep } from '../types/eln';

describe('RSpaceMapper', () => {
  describe('mapFieldTypeForRSpace', () => {
    it('should map various field types correctly', () => {
      expect(mapFieldTypeForRSpace('number')).toBe('Number');
      expect(mapFieldTypeForRSpace('date')).toBe('Date');
      expect(mapFieldTypeForRSpace('datetime')).toBe('Date');
      expect(mapFieldTypeForRSpace('time')).toBe('Time');
      expect(mapFieldTypeForRSpace('checkbox')).toBe('Radio');
      expect(mapFieldTypeForRSpace('select')).toBe('Radio');
      expect(mapFieldTypeForRSpace('radio')).toBe('Radio');
      expect(mapFieldTypeForRSpace('textarea')).toBe('Text');
      expect(mapFieldTypeForRSpace('url')).toBe('Uri');
      expect(mapFieldTypeForRSpace('email')).toBe('Uri');
      expect(mapFieldTypeForRSpace('text')).toBe('String');
    });

    it('should return Text for unknown field types', () => {
      expect(mapFieldTypeForRSpace('unknown')).toBe('Text');
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
      expect(fieldNames).toContain('Keywords');
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
      
      expect(fieldNames).toContain('Step 1 content');
      expect(fieldNames).toContain('Step 2 content');
    });

    it('should map metadata fields and handle collisions', () => {
      const item: PreviewItem = {
        id: '3', name: 'Item', type: 'experiment', category: 'Dataset', categoryColor: '#000',
        proposedClassification: 'document', userClassification: null, confidence: 'high', justification: '', reasons: [],
        metadata: {
          'Content': { value: 'val', type: 'text' }, // Collision with default 'Content'
          'My Field': { value: 'val', type: 'number', required: true }
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
      expect(getValue('Step 1 content')).toBe('complete');
      expect(getValue('Step 1 content_deadline')).toBe(new Date(steps[0].expires!).toLocaleString());
      expect(getValue('Source ELN ID')).toBe('123');
      expect(getValue('Category')).toBe('Experiments');
      expect(getValue('Date Created')).toBe('2023-01-01');
      expect(getValue('Keywords')).toContain('tag1');
      expect(getValue('Keywords')).toContain('tag2');
      expect(getValue('References')).toBe('');
      expect(getValue('Custom Field')).toBe('Custom Value');
    });
  });

  describe('prepareTags', () => {
    it('returns base eln-import, type and kebab-case category', () => {
      const item: PreviewItem = {
        id: 't', name: 'x', type: 'experiment', category: 'Basic Research', categoryColor: '#000',
        proposedClassification: 'document', userClassification: null, confidence: 'high', justification: '', reasons: [],
        metadata: {}, files: [], crossReferences: [], validationIssues: [], textContent: '', steps: [], keywords: [], dateCreated: '', dateModified: ''
      };
      const tags = prepareTags(item);
      expect(tags).toEqual(['eln-import', 'experiment', 'basic-research']);
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
});
