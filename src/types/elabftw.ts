export interface ELabFTWDataset {
  id: string;
  name: string;
  alternateName: string
  genre: 'experiment' | 'resource';
  dateCreated: string;
  dateModified: string;
  textContent: string;
  steps: HowToStep[];
  mentions: string[];
  files: string[];
  variableMeasured: PropertyValue[];
  keywords: string[];
  authorName?: string;
  category: string;
  categoryColor: string;
  creativeWorkStatus: string;
}

export interface FormField {
  name: string;
  fullName: string;
  description?: string;
  type: string;
  mandatory: boolean;
  options?: string[];
  showAsPickList?: boolean;
  units?: string[];
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
  expires?: string;
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
  contentSize: number;
  sha256: string;
}

export interface CustomField {
  unitText?: string;
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
  alternateName: string;
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
  authorName?: string;
  elabftwMetadata?: any; // Raw ELN metadata as JSON blob
  creativeWorkStatus: string;
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