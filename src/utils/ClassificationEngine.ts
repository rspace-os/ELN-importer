import { ELabFTWDataset, CustomField, ClassificationResult } from '../types/elabftw';
import {extractQuantityFromMetadata} from "../services/rspace-mapper.ts";

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
    const quantity = extractQuantityFromMetadata(customFields);
    // only units that are volume or mass can be handled by Inventory.
    if(quantity && (quantity.category === 'volume' || quantity.category === 'mass')) {
      return {
        proposed: 'inventory',
        confidence: 'high',
        justification: 'This resource has a quantity field and is classified as inventory.',
        reasons: ['Item type: resource', 'Contains a quantity field that maps to Inventory']
      };
    } else if (quantity?.category){
      return {
        proposed: 'document',
        confidence: 'high',
        justification: 'This resource has a quantity field that cannot be mapped to Inventory. Inventory can only handle volume, mass, and dimensionless quantities. It is classified as document.',
        reasons: ['Item type: resource', 'Contains a quantity field that does not maps to Inventory. Inventory can only handle volume, mass, and dimensionless quantities.']
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
      return {
        proposed: 'document',
        confidence: 'high',
        justification: 'This resource appears to be an instrument. Inventory will handle instruments in a future release.',
        reasons: ['Item type: resource', 'This resource appears to be an instrument. Inventory will handle instruments in a future release.']
      };
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
