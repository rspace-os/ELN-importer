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

  describe('formExists', () => {
    it('returns true if form exists', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ id: 123, name: 'Form 123' })
      });

      const exists = await service.formExists(123);
      expect(exists).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/forms/123'),
        expect.any(Object)
      );
    });

    it('returns false if form does not exist', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: false,
        status: 404,
        text: async () => 'Not Found'
      });

      const exists = await service.formExists(456);
      expect(exists).toBe(false);
    });
  });
});

// Additional coverage for RSpaceService
import * as fs from 'fs';
import * as path from 'path';
import os from 'os';

describe('RSpaceService - extended', () => {
  const config = { baseUrl: 'http://localhost:8080', apiKey: 'key' };
  let service: RSpaceService;

  beforeEach(() => {
    service = new RSpaceService(config as any);
    global.fetch = vi.fn();
  });

  it('testConnection returns true in integration test mode', async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rspace-'));
    service.setIntegrationTestMode(tmp, 'input.json');
    const ok = await service.testConnection();
    expect(ok).toBe(true);
  });

  it('createForm writes payload in integration test mode and returns mock id', async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rspace-'));
    service.setIntegrationTestMode(tmp, 'input.json');

    const id = await service.createForm('My Form', [
      { name: 'Field A', type: 'String', mandatory: false }
    ] as any);

    expect(id).toBe(999);
    const outFile = path.join(tmp, 'input.json-output.json');
    expect(fs.existsSync(outFile)).toBe(true);
    const arr = JSON.parse(fs.readFileSync(outFile, 'utf8'));
    const entry = arr.find((e: any) => e.type === 'createForm');
    expect(entry).toBeTruthy();
    expect(entry.data.name).toBe('My Form');
    expect(entry.data.fields[0].name).toBe('Field A');
  });

  it('createDocument writes payload in integration test mode and applies description formatting', async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rspace-'));
    service.setIntegrationTestMode(tmp, 'input.json');

    const fieldValues = [
      { name: 'Content', content: 'Body' },
      { name: 'Custom', content: 'X', description: 'Details' }
    ];

    const res = await service.createDocument(42, 'DocName', fieldValues as any, ['t1','t2']);
    expect(res.id).toBe(888);

    const outFile = path.join(tmp, 'input.json-output.json');
    const arr = JSON.parse(fs.readFileSync(outFile, 'utf8'));
    const doc = arr.find((e: any) => e.type === 'createDocument');
    expect(doc).toBeTruthy();
    expect(doc.data.form.id).toBe(42);
    expect(doc.data.tags).toBe('t1,t2');
    const fv = doc.data.fields.find((f: any) => f.name === 'Custom');
    expect(fv.content.startsWith('<p>Description: Details</p><br/>')).toBe(true);
  });

  it('uploadFile retries on first failure then succeeds', async () => {
    const file = new File([new Blob(['abc'])], 'a.txt', { type: 'text/plain' });
    (global.fetch as any)
      .mockResolvedValueOnce({ ok: false, status: 503 })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: '1', globalId: 'GL1', name: 'a.txt' }) });

    const result = await service.uploadFile(file);
    expect(result.id).toBe('1');
    expect((global.fetch as any).mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it('attachFileToDocument calls records attachments endpoint', async () => {
    (global.fetch as any).mockResolvedValue({ ok: true, json: async () => ({}) });
    await service.attachFileToDocument(123, 456);
    const [url, opts] = (global.fetch as any).mock.calls[0];
    expect(url).toContain('/api/v1/records/123/attachments');
    expect(JSON.parse(opts.body)).toEqual({ fileId: 456 });
  });

  it('createInventoryContainer maps tags to objects', async () => {
    (global.fetch as any).mockResolvedValue({ ok: true, json: async () => ({ id: 'IC1', globalId: 'IC1' }) });
    const res = await service.createInventoryContainer({ name: 'Instr', tags: ['x','y'] });
    expect(res.id).toBe('IC1');
    const body = JSON.parse((global.fetch as any).mock.calls[0][1].body);
    expect(body.tags).toEqual([{ value: 'x' }, { value: 'y' }]);
  });

  it('sampleTemplateExists returns true/false based on fetch', async () => {
    (global.fetch as any).mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ id: 1 }) });
    expect(await service.sampleTemplateExists(1)).toBe(true);
    (global.fetch as any).mockResolvedValueOnce({ ok: false, status: 404, text: async () => 'Not Found' });
    expect(await service.sampleTemplateExists(2)).toBe(false);
  });

  it('getForms returns parsed forms list', async () => {
    (global.fetch as any).mockResolvedValue({ ok: true, json: async () => ({ forms: [{ id: 1, name: 'F1' }] }) });
    const forms = await service.getForms();
    expect(forms[0].id).toBe(1);
  });

  it('getDocument returns parsed document', async () => {
    (global.fetch as any).mockResolvedValue({ ok: true, json: async () => ({ id: 10, fields: [] }) });
    const doc = await service.getDocument(10);
    expect(doc.id).toBe(10);
  });

  it('deleteDocument calls DELETE and succeeds', async () => {
    (global.fetch as any).mockResolvedValue({ ok: true, status: 204 });
    await expect(service.deleteDocument(9)).resolves.toBeUndefined();
    const [url, opts] = (global.fetch as any).mock.calls[0];
    expect(url).toContain('/api/v1/documents/9');
    expect(opts.method).toBe('DELETE');
  });

  it('deleteInventoryItem deletes a sample by global id', async () => {
    (global.fetch as any).mockResolvedValue({ ok: true, status: 204 });
    await expect(service.deleteInventoryItem('SA123')).resolves.toBeUndefined();
    const [url, opts] = (global.fetch as any).mock.calls[0];
    expect(url).toContain('/api/inventory/v1/samples/SA123');
    expect(opts.method).toBe('DELETE');
  });
});
