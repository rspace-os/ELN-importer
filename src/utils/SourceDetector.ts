import { ROCrateData } from '../types/eln';

/**
 * P1 IMPROVEMENT: ELN Source Detection
 *
 * Detects which ELN system generated the RO-Crate export
 * Supports: eLabFTW, Chemotion, openBIS, Kadi4Mat, Dataverse, and generic ELNs
 */

export type ELNSource =
  | 'elabftw'
  | 'chemotion'
  | 'openbis'
  | 'kadi4mat'
  | 'dataverse'
  | 'generic';

export interface SourceDetectionResult {
  source: ELNSource;
  confidence: number;  // 0-100
  version?: string;
  indicators: string[];  // List of indicators that led to this detection
}

export class SourceDetector {
  /**
   * Detects the source ELN system from RO-Crate metadata
   *
   * @param crateData - RO-Crate metadata
   * @returns Detection result with source, confidence, and indicators
   */
  detectSource(crateData: ROCrateData | null): SourceDetectionResult {
    if (!crateData || !crateData['@graph']) {
      return {
        source: 'generic',
        confidence: 100,
        indicators: ['No RO-Crate metadata available']
      };
    }

    // Try each detection method in order of specificity
    const detectors = [
      () => this.detectELabFTW(crateData),
      () => this.detectChemotion(crateData),
      () => this.detectOpenBIS(crateData),
      () => this.detectKadi4Mat(crateData),
      () => this.detectDataverse(crateData)
    ];

    for (const detector of detectors) {
      const result = detector();
      if (result && result.confidence >= 70) {
        console.log(`Detected ELN source: ${result.source} (confidence: ${result.confidence}%)`);
        console.log('Detection indicators:', result.indicators);
        return result;
      }
    }

    // Fallback to generic
    return {
      source: 'generic',
      confidence: 100,
      indicators: ['No specific ELN system detected - using generic RO-Crate parser']
    };
  }

  private detectELabFTW(crateData: ROCrateData): SourceDetectionResult | null {
    const indicators: string[] = [];
    let confidence = 0;

    // Check for eLabFTW-specific metadata properties
    for (const item of crateData['@graph']) {
      // Check for elabftw_metadata property
      if (item.elabftw_metadata || (item.variableMeasured?.some((v: any) =>
        v.propertyID === 'elabftw_metadata' || v.elabftw_metadata
      ))) {
        indicators.push('Found elabftw_metadata property');
        confidence += 40;
      }

      // Check for eLabFTW-specific category structure
      if (item['@type'] === 'Thing' && item['@id']?.startsWith('#category-')) {
        indicators.push('Found eLabFTW category structure');
        confidence += 20;
      }

      // Check for eLabFTW-specific generator
      if (item['@type'] === 'SoftwareApplication' &&
          item.name?.toLowerCase().includes('elabftw')) {
        indicators.push(`Found eLabFTW generator: ${item.name}`);
        confidence += 40;
        if (item.version) {
          indicators.push(`Version: ${item.version}`);
        }
      }
    }

    // Check root metadata for generator
    const root = crateData['@graph'].find(item => item['@id'] === 'ro-crate-metadata.json');
    if (root?.about) {
      const about = crateData['@graph'].find(item => item['@id'] === root.about['@id']);
      if (about?.creator?.name?.toLowerCase().includes('elabftw')) {
        indicators.push('Found eLabFTW in creator metadata');
        confidence += 30;
      }
    }

    if (confidence >= 70) {
      return {
        source: 'elabftw',
        confidence: Math.min(confidence, 100),
        indicators
      };
    }

    return null;
  }

  private detectChemotion(crateData: ROCrateData): SourceDetectionResult | null {
    const indicators: string[] = [];
    let confidence = 0;

    for (const item of crateData['@graph']) {
      // Check for Chemotion-specific generator
      if (item['@type'] === 'SoftwareApplication' &&
          item.name?.toLowerCase().includes('chemotion')) {
        indicators.push(`Found Chemotion generator: ${item.name}`);
        confidence += 50;
      }

      // Check for Chemotion-specific properties
      if (item.reactionScheme || item.molecularStructure || item.rxnFile) {
        indicators.push('Found Chemotion chemistry properties');
        confidence += 30;
      }

      // Check for Chemotion-specific types
      if (item['@type'] === 'Reaction' || item['@type'] === 'Sample') {
        indicators.push('Found Chemotion-specific types');
        confidence += 20;
      }
    }

    if (confidence >= 70) {
      return {
        source: 'chemotion',
        confidence: Math.min(confidence, 100),
        indicators
      };
    }

    return null;
  }

  private detectOpenBIS(crateData: ROCrateData): SourceDetectionResult | null {
    const indicators: string[] = [];
    let confidence = 0;

    for (const item of crateData['@graph']) {
      // Check for openBIS generator
      if (item['@type'] === 'SoftwareApplication' &&
          item.name?.toLowerCase().includes('openbis')) {
        indicators.push(`Found openBIS generator: ${item.name}`);
        confidence += 50;
      }

      // Check for openBIS-specific properties
      if (item.permId || item.spaceCode || item.projectCode) {
        indicators.push('Found openBIS identifier properties');
        confidence += 30;
      }

      // Check for openBIS-specific types
      if (item['@type']?.includes('OpenBIS')) {
        indicators.push('Found openBIS-specific types');
        confidence += 20;
      }
    }

    if (confidence >= 70) {
      return {
        source: 'openbis',
        confidence: Math.min(confidence, 100),
        indicators
      };
    }

    return null;
  }

  private detectKadi4Mat(crateData: ROCrateData): SourceDetectionResult | null {
    const indicators: string[] = [];
    let confidence = 0;

    for (const item of crateData['@graph']) {
      // Check for Kadi4Mat generator
      if (item['@type'] === 'SoftwareApplication' &&
          (item.name?.toLowerCase().includes('kadi') ||
           item.url?.includes('kadi4mat'))) {
        indicators.push(`Found Kadi4Mat generator: ${item.name}`);
        confidence += 50;
      }

      // Check for Kadi4Mat-specific properties
      if (item.kadiIdentifier || item.recordType) {
        indicators.push('Found Kadi4Mat properties');
        confidence += 30;
      }
    }

    if (confidence >= 70) {
      return {
        source: 'kadi4mat',
        confidence: Math.min(confidence, 100),
        indicators
      };
    }

    return null;
  }

  private detectDataverse(crateData: ROCrateData): SourceDetectionResult | null {
    const indicators: string[] = [];
    let confidence = 0;

    for (const item of crateData['@graph']) {
      // Check for Dataverse generator
      if (item['@type'] === 'SoftwareApplication' &&
          item.name?.toLowerCase().includes('dataverse')) {
        indicators.push(`Found Dataverse generator: ${item.name}`);
        confidence += 50;
      }

      // Check for Dataverse-specific properties
      if (item.persistentId || item.protocol === 'doi') {
        indicators.push('Found Dataverse identifier properties');
        confidence += 20;
      }

      // Check for Dataverse-specific structure
      if (item.fileMetadata || item.datasetVersion) {
        indicators.push('Found Dataverse structure');
        confidence += 30;
      }
    }

    if (confidence >= 70) {
      return {
        source: 'dataverse',
        confidence: Math.min(confidence, 100),
        indicators
      };
    }

    return null;
  }

  /**
   * Gets a human-readable source name
   */
  getSourceDisplayName(source: ELNSource): string {
    const names: Record<ELNSource, string> = {
      'elabftw': 'eLabFTW',
      'chemotion': 'Chemotion ELN',
      'openbis': 'openBIS',
      'kadi4mat': 'Kadi4Mat',
      'dataverse': 'Dataverse',
      'generic': 'Generic ELN'
    };

    return names[source];
  }

  /**
   * Checks if source-specific handling is needed
   */
  requiresSourceSpecificHandling(source: ELNSource): boolean {
    // Currently only eLabFTW has legacy-specific handling needs
    // Other sources use generic RO-Crate patterns
    return source === 'elabftw';
  }
}
