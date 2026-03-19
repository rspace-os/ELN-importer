import { describe, it, expect } from 'vitest';
import { ClassificationEngine } from './ClassificationEngine';

describe('ClassificationEngine', () => {
  const engine = new ClassificationEngine();

  it('classifies experiments as documents with high confidence', () => {
    const result = engine.classifyDataset(
      { name: 'My Exp', genre: 'experiment' } as any,
      {}
    );
    expect(result.proposed).toBe('document');
    expect(result.confidence).toBe('high');
  });

  it('classifies instruments as documents with high confidence', () => {
    const result = engine.classifyDataset(
      { name: 'Zeiss Microscope', genre: 'resource' } as any,
      {}
    );
    expect(result.proposed).toBe('document');
    expect(result.confidence).toBe('high');
  });

  it('classifies quantities that map to mass or volumne as inventory with high confidence', () => {
    const result = engine.classifyDataset(
      { name: 'Buffer Solution', genre: 'resource', textContent: '', category: 'Reagents' } as any,
      { 'quantity': { value: '500', type: 'text',unitText: 'ml', units: ['ml'] } } as any
    );
    expect(result.proposed).toBe('inventory');
    expect(result.confidence).toBe('high');
    // Quantity-related reason is expected for consumables
    expect(result.reasons.some(r => r.toLowerCase().includes('quantity'))).toBe(true);
  });

  it('classifies quantities that do not map to mass or volume as inventory with medium confidence', () => {
    const result = engine.classifyDataset(
        { name: 'name', genre: 'resource', textContent: '', category: 'a category' } as any,
        { 'quantity': { value: '500', type: 'text', unitText: 'ug/l', units: ['ug/l'] } } as any
    );
    expect(result.proposed).toBe('inventory');
    expect(result.confidence).toBe('medium');
    // Quantity-related reason is expected for consumables
    expect(result.reasons.some(r => r.toLowerCase().includes('quantity'))).toBe(true);
  });

  it('classifies resource without quantity but having reagents as inventory with medium confidence', () => {
    const result = engine.classifyDataset(
        { name: 'Buffer', genre: 'resource', textContent: '', category: 'category' } as any,{}
    );
    expect(result.proposed).toBe('inventory');
    expect(result.confidence).toBe('medium');
  });

  it('classifies resource without quantity or reagents as inventory with low confidence', () => {
    const result = engine.classifyDataset(
        { name: 'Stuff', genre: 'resource', textContent: '', category: 'acategory' } as any,{}
    );
    expect(result.proposed).toBe('inventory');
    expect(result.confidence).toBe('low');
  });


  it('detects instruments by custom fields', () => {
    const result = engine.classifyDataset(
      { name: 'Device X', genre: 'resource' } as any,
      { 'Serial Number': { value: '123', type: 'text' } } as any
    );
    expect(result.proposed).toBe('document');
  });
});
