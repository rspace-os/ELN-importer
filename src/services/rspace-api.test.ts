import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RSpaceService } from './rspace-api';
import { FormField } from '../types/elabftw';

describe('RSpaceService', () => {
  const config = {
    baseUrl: 'http://localhost:8080',
    apiKey: 'test-key'
  };
  let service: RSpaceService;

  beforeEach(() => {
    service = new RSpaceService(config);
    // Mock fetch globally
    global.fetch = vi.fn();
  });

  describe('createSampleTemplate', () => {
    it('sends correct payload to create sample template', async () => {
      const fields: FormField[] = [
        { name: 'Field 1', type: 'String', mandatory: true, fullName: 'Field 1' },
        { name: 'Field 2', type: 'Choice', mandatory: false, fullName: 'Field 2', options: ['A', 'B'], multiple: true }
      ];
      const quantity = { value: 10, unit: 'ml' };

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ id: 777 })
      });

      const result = await service.createSampleTemplate('Test Template', fields, quantity);

      expect(result).toBe(777);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/inventory/v1/sampleTemplates'),
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"name":"Test Template"')
        })
      );

      const lastCall = (global.fetch as any).mock.calls[0];
      const body = JSON.parse(lastCall[1].body);
      expect(body.defaultUnitId).toBe(3); // ml maps to 3
      expect(body.fields).toHaveLength(2);
      expect(body.fields[0].name).toBe('Field 1');
      expect(body.fields[1].definition.multiple).toBe(true);
    });
  });

  describe('createInventorySample', () => {
    it('sends correct payload with templateId and fields', async () => {
      const sampleData = {
        name: 'Test Sample',
        templateId: 777,
        fields: [{ content: 'Val 1' }, { selectedOptions: ['A'] }],
        tags: ['tag1']
      };

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ id: 'SA1', globalId: 'SA1', name: 'Test Sample' })
      });

      const result = await service.createInventorySample(sampleData);

      expect(result.id).toBe('SA1');
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/inventory/v1/samples'),
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"templateId":777')
        })
      );

      const body = JSON.parse((global.fetch as any).mock.calls[0][1].body);
      expect(body.fields).toEqual(sampleData.fields);
      expect(body.tags).toEqual([{ value: 'tag1' }]);
    });
  });

  describe('attachFileToInventoryItem', () => {
    it('sends correct payload to attach file', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        headers: new Headers(),
        json: async () => ({ success: true })
      });

      await service.attachFileToInventoryItem('SA1', 'GL1');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/inventory/v1/attachments'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            parentGlobalId: 'SA1',
            mediaFileGlobalId: 'GL1'
          })
        })
      );
    });
  });
});
