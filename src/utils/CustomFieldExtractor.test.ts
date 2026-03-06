import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CustomFieldExtractor } from './CustomFieldExtractor';
import { ROCrateData } from '../types/elabftw';

describe('CustomFieldExtractor', () => {
  let extractor: CustomFieldExtractor;

  beforeEach(() => {
    extractor = new CustomFieldExtractor();
  });

  describe('mapFieldType', () => {
    it('maps all supported types correctly', () => {
      expect(extractor.mapFieldType('number')).toBe('Number');
      expect(extractor.mapFieldType('date')).toBe('Date');
      expect(extractor.mapFieldType('datetime')).toBe('Date');
      expect(extractor.mapFieldType('time')).toBe('Time');
      expect(extractor.mapFieldType('checkbox')).toBe('checkbox');
      expect(extractor.mapFieldType('select')).toBe('select');
      expect(extractor.mapFieldType('radio')).toBe('Radio');
      expect(extractor.mapFieldType('textarea')).toBe('Text');
      expect(extractor.mapFieldType('url')).toBe('Uri');
      expect(extractor.mapFieldType('email')).toBe('Uri');
      expect(extractor.mapFieldType('text')).toBe('Text');
    });

    it('returns Text for unknown types', () => {
      expect(extractor.mapFieldType('unknown')).toBe('Text');
    });
  });

  describe('extractCustomFields', () => {
    it('returns empty object if crateData is missing', () => {
      const result = extractor.extractCustomFields([], null);
      expect(result).toEqual({});
    });

    it('extracts from elabftw_metadata JSON string', () => {
      const elabMetadata = {
        extra_fields: {
          'Field 1': { type: 'text', value: 'Val 1', description: 'Desc 1' },
          'Field 2': { type: 'number', value: '42', unit: 'cm', units: ['cm', 'mm'] }
        }
      };
      
      const variableMeasured = [
        {
          propertyID: 'elabftw_metadata',
          value: JSON.stringify(elabMetadata)
        }
      ];
      
      const crateData: ROCrateData = {
        '@context': '...',
        '@graph': []
      };

      const result = extractor.extractCustomFields(variableMeasured, crateData);
      
      expect(result['Field 1']).toBeDefined();
      expect(result['Field 1'].value).toBe('Val 1');
      expect(result['Field 1'].type).toBe('Text');
      
      expect(result['Field 2']).toBeDefined();
      expect(result['Field 2'].value).toBe('42');
      expect(result['Field 2'].type).toBe('Number');
      expect(result['Field 2'].unitText).toBe('cm');
    });

    it('resolves @id references from crate graph', () => {
      const crateData: ROCrateData = {
        '@context': '...',
        '@graph': [
          {
            '@id': 'pv://ref1',
            propertyID: 'External Field',
            value: 'Resolved Value',
            valueReference: 'text'
          }
        ]
      };

      const variableMeasured = [
        { '@id': 'pv://ref1' }
      ];

      const result = extractor.extractCustomFields(variableMeasured, crateData);
      expect(result['External Field']).toBeDefined();
      expect(result['External Field'].value).toBe('Resolved Value');
    });

    it('handles checkbox special mapping', () => {
      const elabMetadata = {
        fields: {
          'My Checkbox': { type: 'checkbox', value: 'on' }
        }
      };
      
      const variableMeasured = [
        {
          propertyID: 'elabftw_metadata',
          value: JSON.stringify(elabMetadata)
        }
      ];
      
      const result = extractor.extractCustomFields(variableMeasured, { '@graph': [] } as any);
      expect(result['My Checkbox'].options).toEqual(['Yes', 'No']);
    });

    it('filters empty options in select fields', () => {
      const elabMetadata = {
        fields: {
          'My Select': { 
            type: 'select', 
            value: 'A', 
            options: ['A', 'B', '', null, undefined] 
          }
        }
      };
      
      const result = extractor.extractCustomFields([
        { propertyID: 'elabftw_metadata', value: JSON.stringify(elabMetadata) }
      ], { '@graph': [] } as any);
      
      expect(result['My Select'].options).toEqual(['A', 'B']);
    });

    it('extracts standard PropertyValue as fallback', () => {
      const variableMeasured = [
        {
          propertyID: 'Standard Prop',
          value: 'Prop Value',
          description: 'A standard property',
          unitText: 'ml'
        }
      ];
      
      const result = extractor.extractCustomFields(variableMeasured, { '@graph': [] } as any);
      expect(result['Standard Prop']).toBeDefined();
      expect(result['Standard Prop'].value).toBe('Prop Value');
      expect(result['Standard Prop'].units).toEqual(['ml']);
    });

    it('extracts name-value pairs as final fallback', () => {
      const variableMeasured = [
        {
          name: 'Simple Name',
          value: 'Simple Value'
        }
      ];
      
      const result = extractor.extractCustomFields(variableMeasured, { '@graph': [] } as any);
      expect(result['Simple Name']).toBeDefined();
      expect(result['Simple Name'].value).toBe('Simple Value');
    });

    it('handles unit mapping when units array is present but unit is missing', () => {
      const elabMetadata = {
        fields: {
          'Unit Field': { type: 'number', value: '10', units: ['kg'] }
        }
      };
      
      const result = extractor.extractCustomFields([
        { propertyID: 'elabftw_metadata', value: JSON.stringify(elabMetadata) }
      ], { '@graph': [] } as any);
      
      expect(result['Unit Field'].unitText).toBe('kg');
    });
  });
});
