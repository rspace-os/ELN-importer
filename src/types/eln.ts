// Generic ELN (Electronic Lab Notebook) type definitions
// Supports RO-Crate 1.1+ format used by eLabFTW, Chemotion, and other ELN systems

export interface ELNDataset {
  id: string;
  name: string;
  genre: 'experiment' | 'resource';
  dateCreated: string;
  dateModified: string;
  textContent: string;
  steps: HowToStep[];
  mentions: string[];
  files: string[];
  variableMeasured: PropertyValue[];
  keywords: string[];
  category?: string;
  categoryColor?: string;
}

export interface PropertyValue {
  '@id': string;
  '@type': string;
  propertyID: string;
  valueReference?: string;
  value: string;
  description?: string;
}

export interface HowToStep {
  '@id': string;
  '@type': string;
  position: number;
  creativeWorkStatus: string;
  itemListElement: {
    '@id': string;
    '@type': string;
    text: string;
  };
}

export interface FileMetadata {
  '@id': string;
  '@type': string;
  name: string;
  alternateName?: string;
  encodingFormat: string;
  contentSize: number | string;  // Accept both per spec (string) and reality (number)
  sha256: string;
}

export interface CustomField {
  type: string;
  value: string;
  description?: string;
  units?: string[];
  options?: string[];
  required?: boolean;
  group_id?: number;
  position?: number;
}

export interface ClassificationResult {
  proposed: 'document' | 'inventory';
  confidence: 'high' | 'medium' | 'low';
  justification: string;
  isInstrument?: boolean;
  reasons: string[];
}

export interface PreviewItem {
  id: string;
  name: string;
  type: 'experiment' | 'resource';
  category: string;
  categoryColor: string;
  proposedClassification: 'document' | 'inventory';
  userClassification: 'document' | 'inventory' | null;
  confidence: 'high' | 'medium' | 'low';
  justification: string;
  reasons: string[];
  metadata: Record<string, CustomField>;
  files: string[];
  crossReferences: string[];
  validationIssues: ValidationIssue[];
  textContent: string;
  steps: HowToStep[];
  keywords: string[];
  dateCreated: string;
  dateModified: string;
  elnMetadata?: any; // Raw ELN-specific metadata as JSON blob
}

export interface ValidationIssue {
  type: 'error' | 'warning' | 'info';
  message: string;
  suggestion?: string;
  field?: string;
}

export interface PreviewSession {
  id: string;
  createdAt: string;
  elnFileName: string;
  totalItems: number;
  items: PreviewItem[];
  fileMetadata: Record<string, FileMetadata>;
  fileBlobs: Map<string, Blob>;
}

export interface ROCrateData {
  '@context': string;
  '@graph': any[];
}

// Legacy type aliases for backward compatibility
/** @deprecated Use ELNDataset instead */
export type ELabFTWDataset = ELNDataset;
