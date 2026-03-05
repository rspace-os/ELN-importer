import { describe, it, expect } from 'vitest';
import { ValidationEngine } from './ValidationEngine';
import { PreviewItem } from '../types/elabftw';

describe('ValidationEngine', () => {
  const engine = new ValidationEngine();

  function makeBaseItem(overrides: Partial<PreviewItem> = {}): PreviewItem {
    return {
      id: 'id',
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
      dateModified: '',
      ...overrides,
    };
  }

  it('validates a clean item successfully', () => {
    const item = makeBaseItem({
      name: 'Clean Item',
      textContent: 'Some content',
      metadata: { 'Field1': { value: 'Valid', type: 'text' } },
    });
    const issues = engine.validateItem(item);
    expect(ValidationEngine.canProceed(issues)).toBe(true);
    expect(issues.length).toBe(0);
  });

  it('detects missing name and empty document content (warning)', () => {
    const item = makeBaseItem({ name: '', textContent: '', steps: [] });
    const issues = engine.validateItem(item);
    expect(issues.some(i => i.message.includes('Item name is required'))).toBe(true);
    expect(issues.some(i => i.message.includes('Document has no content or steps'))).toBe(true);
  });

  it('detects long field names', () => {
    const longFieldName = 'A'.repeat(51);
    const item = makeBaseItem({
      metadata: {
        [longFieldName]: { value: 'Valid', type: 'text' }
      }
    });
    // @ts-ignore access private for targeted test
    const issues: any[] = [];
    // @ts-ignore
    engine.validateFieldNames(item as any, issues);
    expect(issues.some(i => i.type === 'warning' && i.message.includes('exceeds'))).toBe(true);
  });

  it('flags too many files', () => {
    const files = Array.from({ length: 51 }, (_, i) => `f${i}`);
    const item = makeBaseItem({ files });
    // @ts-ignore access private for targeted test
    const issues: any[] = [];
    // @ts-ignore
    engine.validateFiles(item as any, issues);
    expect(issues.some(i => i.type === 'error' && i.message.includes('Too many files'))).toBe(true);
  });
});
