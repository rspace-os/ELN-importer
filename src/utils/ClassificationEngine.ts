import { ELabFTWDataset, CustomField, ClassificationResult } from '../types/elabftw';
import {extractQuantityFromMetadata} from "../services/rspace-mapper.ts";

export class ClassificationEngine {
  classifyDataset(dataset: ELabFTWDataset, customFields: Record<string, CustomField>): ClassificationResult {
    if (dataset.genre === 'experiment' || dataset.genre === 'experiment template') {
      return {
        proposed: 'document',
        confidence: 'high',
        justification: 'Experiments are always converted to RSpace documents as they contain experimental procedures and results.',
        reasons: ['Item type: experiment', 'Contains experimental procedures and results']
      };
    }
    const allQuantites = extractQuantityFromMetadata(customFields);
    // only units that are volume or mass can be handled by Inventory.
    for(const quantity of allQuantites) {
      if (quantity && (quantity.category === 'volume' || quantity.category === 'mass')) {
        return {
          proposed: 'inventory',
          confidence: 'high',
          justification: 'This resource has a quantity field and is classified as inventory.',
          reasons: ['Item type: resource', 'Contains a quantity field that maps to mass or volume in Inventory.']
        };
      }
    }
    const metaData = Object.entries(customFields);
    const quantityFields = metaData.filter(([fieldName, _field]) =>
        ['quantity', 'amount', 'volume', 'mass', 'weight', 'concentration', 'numeric'].some(q =>
            fieldName.toLowerCase().includes(q)
        )
    );
    if (quantityFields.length > 0) {
      return {
        proposed: 'inventory',
        confidence: 'medium',
        justification: 'This resource has quantity information (typical for consumable materials) but will need to be handled as Dimensionless Items by Inventory.',
        reasons: ['Item type: resource', 'Contains quantity information']
      };
    }

    const isInstrument = this.isInstrumentResource(dataset, customFields);

    if (isInstrument) {
      return {
        proposed: 'document',
        confidence: 'high',
        justification: 'This resource appears to be an instrument. Inventory will handle instruments in a future release.',
        reasons: ['Item type: resource', 'This resource appears to be an instrument. Inventory will handle instruments in a future release.']
      };
    }
    const reasons: string[] = [];
    let confidence :'medium' | 'high' | 'low' = 'low';
    const nameContent = `${dataset.name} ${dataset.textContent} ${dataset.category}`.toLowerCase();
    const materialIndicators = ['reagent', 'chemical', 'cell', 'plasmid', 'sample', 'compound','buffer'];
    const hasMaterialIndicator = materialIndicators.some(indicator => nameContent.includes(indicator));

    if (hasMaterialIndicator ) {
      reasons.push(`Contains material/reagent keywords: ${materialIndicators.filter(i => nameContent.includes(i)).join(', ')}`);
      confidence = 'medium';
    }

    const hasDateFields = Object.keys(customFields).some(fieldName =>
      ['opening', 'acquisition', 'expiry', 'date'].some(d => fieldName.toLowerCase().includes(d))
    );

    if (hasDateFields) {
      reasons.push('Has date tracking for usage/expiry');
    }

    if (reasons.length === 0) {
      reasons.push('No specific indicators found - using default classification');
    }

    const justification = `Resource classified as material/reagent → RSpace sample. ${reasons.join('. ')}.`;

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
