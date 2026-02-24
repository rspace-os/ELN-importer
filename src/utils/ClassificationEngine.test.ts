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

  it('classifies instruments as inventory with high confidence', () => {
    const result = engine.classifyDataset(
      { name: 'Zeiss Microscope', genre: 'resource' } as any,
      {}
    );
    expect(result.proposed).toBe('inventory');
    expect(result.isInstrument).toBe(true);
    expect(result.confidence).toBe('high');
  });

  it('classifies materials as inventory with high confidence', () => {
    const result = engine.classifyDataset(
      { name: 'Buffer Solution', genre: 'resource', textContent: '', category: 'Reagents' } as any,
      { 'quantity': { value: '500', type: 'text', units: ['ml'] } } as any
    );
    expect(result.proposed).toBe('inventory');
    expect(result.isInstrument).toBe(false);
    // Quantity-related reason is expected for consumables
    expect(result.reasons.some(r => r.toLowerCase().includes('quantity'))).toBe(true);
  });

  it('detects instruments by custom fields', () => {
    const result = engine.classifyDataset(
      { name: 'Device X', genre: 'resource' } as any,
      { 'Serial Number': { value: '123', type: 'text' } } as any
    );
    expect(result.proposed).toBe('inventory');
    expect(result.isInstrument).toBe(true);
  });
});
