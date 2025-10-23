import { ELabFTWDataset, CustomField, ClassificationResult } from '../types/elabftw';

export class ClassificationEngine {
  classifyDataset(dataset: ELabFTWDataset, customFields: Record<string, CustomField>): ClassificationResult {
    if (dataset.genre === 'experiment') {
      return {
        proposed: 'document',
        confidence: 'high',
        justification: 'Experiments are always converted to RSpace documents as they contain experimental procedures and results.',
        reasons: ['Item type: experiment', 'Contains experimental procedures and results']
      };
    }

    const isInstrument = this.isInstrumentResource(dataset, customFields);

    const reasons: string[] = [];
    let confidence: 'high' | 'medium' | 'low' = 'medium';

    const categoryIndicators = ['microscope', 'spectrometer', 'instrument', 'equipment', 'nmr', 'hplc', 'gc-ms'];
    const nameContent = `${dataset.name} ${dataset.textContent} ${dataset.category}`.toLowerCase();

    const hasCategoryIndicator = categoryIndicators.some(indicator => nameContent.includes(indicator));
    if (hasCategoryIndicator) {
      reasons.push(`Category/name contains instrument keywords: ${categoryIndicators.filter(i => nameContent.includes(i)).join(', ')}`);
      confidence = 'high';
    }

    const fieldIndicators = ['serial number', 'model', 'manufacturer', 'calibration', 'maintenance', 'console', 'frequency'];
    const hasInstrumentFields = Object.keys(customFields).some(fieldName =>
      fieldIndicators.some(indicator => fieldName.toLowerCase().includes(indicator))
    );

    if (hasInstrumentFields) {
      const matchingFields = Object.keys(customFields).filter(fieldName =>
        fieldIndicators.some(indicator => fieldName.toLowerCase().includes(indicator))
      );
      reasons.push(`Contains instrument-specific fields: ${matchingFields.join(', ')}`);
      confidence = 'high';
    }

    const materialIndicators = ['reagent', 'chemical', 'cell', 'plasmid', 'sample', 'compound'];
    const hasMaterialIndicator = materialIndicators.some(indicator => nameContent.includes(indicator));

    if (hasMaterialIndicator && !hasCategoryIndicator && !hasInstrumentFields) {
      reasons.push(`Contains material/reagent keywords: ${materialIndicators.filter(i => nameContent.includes(i)).join(', ')}`);
      confidence = 'high';
    }

    const hasQuantityFields = Object.keys(customFields).some(fieldName =>
      ['quantity', 'amount', 'volume', 'mass', 'weight', 'concentration'].some(q => fieldName.toLowerCase().includes(q))
    );

    if (hasQuantityFields && !isInstrument) {
      reasons.push('Contains quantity information (typical for consumable materials)');
    }

    const hasDateFields = Object.keys(customFields).some(fieldName =>
      ['opening', 'acquisition', 'expiry', 'date'].some(d => fieldName.toLowerCase().includes(d))
    );

    if (hasDateFields && !isInstrument) {
      reasons.push('Has date tracking for usage/expiry');
    }

    if (reasons.length === 0) {
      reasons.push('No specific indicators found - using default classification');
      confidence = 'low';
    }

    const justification = isInstrument
      ? `Resource classified as instrument/equipment → RSpace container. ${reasons.join('. ')}.`
      : `Resource classified as material/reagent → RSpace sample. ${reasons.join('. ')}.`;

    return {
      proposed: 'inventory',
      confidence,
      justification,
      isInstrument,
      reasons
    };
  }

  private isInstrumentResource(dataset: ELabFTWDataset, customFields: Record<string, CustomField>): boolean {
    const categoryIndicators = ['microscope', 'spectrometer', 'instrument', 'equipment', 'nmr', 'hplc', 'gc-ms'];
    const fieldIndicators = ['serial number', 'model', 'manufacturer', 'calibration', 'maintenance', 'console', 'frequency'];

    const nameContent = `${dataset.name} ${dataset.textContent} ${dataset.category}`.toLowerCase();

    if (categoryIndicators.some(indicator => nameContent.includes(indicator))) {
      return true;
    }

    return Object.keys(customFields).some(fieldName =>
      fieldIndicators.some(indicator => fieldName.toLowerCase().includes(indicator))
    );
  }
}
