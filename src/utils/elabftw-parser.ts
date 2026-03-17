import {
  ELabFTWDataset,
  PropertyValue,
  HowToStep,
  FileMetadata,
  PreviewItem,
  ROCrateData
} from '../types/elabftw';
import { CustomFieldExtractor } from './CustomFieldExtractor';
import { ClassificationEngine } from './ClassificationEngine';
import { ValidationEngine } from './ValidationEngine';
import { SourceDetector, ELNSource } from './SourceDetector';  // P1: Source detection

export class ELabFTWParser {
  private crateData: ROCrateData | null = null;
  private fileIndex: Map<string, any> = new Map();
  private detectedSource: ELNSource = 'generic';  // P1: Track detected source
  private sourceDetector = new SourceDetector();  // P1: Source detector instance

  getCrateData(): ROCrateData | null {
    return this.crateData;
  }

  /**
   * P1 IMPROVEMENT: Get detected ELN source
   * @returns The detected source ELN system
   */
  getDetectedSource(): ELNSource {
    return this.detectedSource;
  }

  async parseELNFile(file: File): Promise<{
    datasets: ELabFTWDataset[];
    fileMetadata: Record<string, FileMetadata>;
    fileIndex: Map<string, Blob>;
  }> {
    console.log('=== STARTING ELN FILE PARSING ===');
    console.log('File name:', file.name);
    console.log('File size:', file.size);
    
    // Reset state
    this.crateData = null;
    this.fileIndex.clear();

    // Read the ZIP file
    const JSZip = (await import('jszip')).default;
    let zip;
    try {
      zip = await JSZip.loadAsync(file);
    } catch (error) {
      console.error('Failed to load ZIP file:', error);
      throw new Error('Invalid .eln file format. Please ensure the file is a valid ELN export.');
    }
    
    // Find the base directory and ro-crate-metadata.json
    let baseDirectory = '';
    let crateFile = null;
    
    // First, try to find ro-crate-metadata.json and determine the base directory
    zip.forEach((relativePath, zipEntry) => {
      if (relativePath.endsWith('ro-crate-metadata.json')) {
        crateFile = zipEntry;
        // Extract base directory from the path
        const pathParts = relativePath.split('/');
        if (pathParts.length > 1) {
          baseDirectory = pathParts.slice(0, -1).join('/') + '/';
        }
      }
    });

    if (!crateFile) {
      console.error('Available files in archive:', Object.keys(zip.files));
      throw new Error('ro-crate-metadata.json not found in ELN archive. This may not be a valid ELN export.');
    }

    // Build file index with correct paths matching @id format in ro-crate
    zip.forEach((relativePath, zipEntry) => {
      if (!zipEntry.dir && relativePath.startsWith(baseDirectory)) {
        // Store with the @id format: "./" + full path (e.g., "./2025-09-19-090444-export/dir/file.png")
        const fileIdWithDot = `./${relativePath}`;
        this.fileIndex.set(fileIdWithDot, zipEntry);

        // Also store without "./" for flexibility
        this.fileIndex.set(relativePath, zipEntry);

        // Store with path relative to base directory (this matches @id in @graph)
        const pathRelativeToBase = relativePath.substring(baseDirectory.length);
        if (pathRelativeToBase) {
          // This is the key format used in the @graph (e.g., "./Molecular-biology - Cloning - 6300f19f/test.png")
          this.fileIndex.set(`./${pathRelativeToBase}`, zipEntry);
          this.fileIndex.set(pathRelativeToBase, zipEntry);
        }
      }
    });

    let crateContent;
    try {
      crateContent = await crateFile.async('text');
      console.log('Raw crate content length:', crateContent.length);
      this.crateData = JSON.parse(crateContent);
      console.log('Parsed crate data:', this.crateData);
      console.log('Graph items count:', this.crateData['@graph']?.length || 0);
    } catch (error) {
      console.error('Failed to parse ro-crate-metadata.json:', error);
      throw new Error('Invalid ro-crate-metadata.json format in ELN archive.');
    }

    // P1 IMPROVEMENT: Detect ELN source system
    const sourceDetection = this.sourceDetector.detectSource(this.crateData);
    this.detectedSource = sourceDetection.source;
    console.log('=== ELN SOURCE DETECTION ===');
    console.log(`Detected source: ${this.sourceDetector.getSourceDisplayName(sourceDetection.source)}`);
    console.log(`Confidence: ${sourceDetection.confidence}%`);
    console.log('Indicators:', sourceDetection.indicators);
    if (sourceDetection.version) {
      console.log(`Version: ${sourceDetection.version}`);
    }

    // Extract datasets and file metadata
    const datasets = this.extractDatasets(this.crateData);
    const fileMetadata = this.extractFileMetadata(this.crateData);

    console.log('=== PARSING RESULTS ===');
    console.log(`Extracted ${datasets.length} datasets`);
    console.log(`Extracted ${Object.keys(fileMetadata).length} files`);
    console.log('Datasets:', datasets);
    console.log('File metadata:', fileMetadata);
    
    return { datasets, fileMetadata, fileIndex: this.fileIndex };
  }

  private extractDatasets(crateData: ROCrateData | null | undefined): ELabFTWDataset[] {
    if (!crateData || !crateData['@graph'] || !Array.isArray(crateData['@graph'])) {
      console.warn('Invalid or missing crateData for dataset extraction');
      return [];
    }

    const datasets: ELabFTWDataset[] = [];
    const categories = this.extractCategories(crateData);

    console.log('=== DEBUGGING DATASET EXTRACTION ===');
    console.log('Total items in @graph:', crateData['@graph'].length);

    for (const item of crateData['@graph']) {
      // P0 FIX: Skip the root dataset metadata (usually with id "./")
      if (item['@id'] === './') {
        continue;
      }

      if (item['@type'] === 'Dataset') {
        // Determine genre with fallback (assume experiment if not specified)
        const genre = item.genre || 'experiment';
        console.log('\n--- Processing Dataset ---');
        console.log('Dataset ID:', item['@id']);
        console.log('Dataset name:', item.name);
        console.log('Dataset type:', item['@type']);
        console.log('Dataset genre:', genre, item.genre ? '(from data)' : '(fallback)');
        console.log('Raw variableMeasured:', item.variableMeasured);
        console.log('variableMeasured length:', (item.variableMeasured || []).length);
        
        // Log each variableMeasured item in detail
        if (item.variableMeasured && item.variableMeasured.length > 0) {
          item.variableMeasured.forEach((variable, index) => {
            console.log(`variableMeasured[${index}]:`, variable);
            console.log(`  - Type: ${typeof variable}`);
            console.log(`  - Keys:`, Object.keys(variable));
            if (variable['@id']) {
              console.log(`  - @id: ${variable['@id']}`);
            }
          });
        }
        
        // Log all properties of the dataset item
        console.log('All dataset properties:', Object.keys(item));
        
        const dataset: ELabFTWDataset = {
          id: item['@id'],
          name: item.name || 'Untitled',
          alternateName: item.alternateName || '',
          genre: genre,
          dateCreated: item.dateCreated || '',
          dateModified: item.dateModified || '',
          textContent: item.text || '',
          steps: this.extractSteps(item.step || [], crateData),
          mentions: this.extractMentions(item.mentions || []),
          files: this.extractFiles(item.hasPart || []),
          variableMeasured: item.variableMeasured || [],
          keywords: this.extractKeywords(item.keywords || ''),
          authorName: this.extractAuthorName(item.author, crateData),
          category: this.getCategoryName(item.about?.['@id'], categories),
          categoryColor: this.getCategoryColor(item.about?.['@id'], categories),
          creativeWorkStatus: item.creativeWorkStatus || '',
        };

        // Cleanup textContent
        dataset.textContent = this.cleanupTextContent(dataset.textContent);

        console.log('Final dataset variableMeasured:', dataset.variableMeasured);
        console.log('--- End Dataset ---\n');

        datasets.push(dataset);
      }
    }

    return datasets;
  }

  private extractCategories(crateData: ROCrateData | null | undefined): Record<string, { name: string; color: string }> {
    if (!crateData || !crateData['@graph'] || !Array.isArray(crateData['@graph'])) {
      return {};
    }

    const categories: Record<string, { name: string; color: string }> = {};
    
    for (const item of crateData['@graph']) {
      if (item['@type'] === 'Thing' && item['@id'].startsWith('#category-')) {
        categories[item['@id']] = {
          name: item.name || '',
          color: item.color || '#666666'
        };
      }
    }

    return categories;
  }

  private getCategoryName(categoryId: string | undefined, categories: Record<string, { name: string; color: string }>): string {
    if (!categoryId) return 'Uncategorized';
    return categories[categoryId]?.name || 'Unknown';
  }

  private getCategoryColor(categoryId: string | undefined, categories: Record<string, { name: string; color: string }>): string {
    if (!categoryId) return '#666666';
    return categories[categoryId]?.color || '#666666';
  }

  private extractSteps(stepRefs: any[], crateData: ROCrateData | null | undefined): HowToStep[] {
    if (!crateData || !crateData['@graph'] || !Array.isArray(crateData['@graph'])) {
      return [];
    }

    const steps: HowToStep[] = [];
    
    for (const stepRef of stepRefs) {
      const stepId = typeof stepRef === 'string' ? stepRef : stepRef['@id'];
      const stepItem = crateData['@graph'].find(item => item['@id'] === stepId);
      
      // Try to parse elabftw_metadata if it exists
      let metadata = null;
      try {
        if (stepItem?.elabftw_metadata) {
          metadata = typeof stepItem.elabftw_metadata === 'string' 
            ? JSON.parse(stepItem.elabftw_metadata) 
            : stepItem.elabftw_metadata;
        }
      } catch (error) {
        // Silently skip parsing errors
        console.warn('Failed to parse elabftw_metadata:', error);
      }
      
      if (stepItem && stepItem['@type'] === 'HowToStep') {
        const directionId = stepItem.itemListElement?.['@id'];
        const directionItem = crateData['@graph'].find(item => item['@id'] === directionId);
        
        steps.push({
          '@id': stepItem['@id'],
          '@type': stepItem['@type'],
          position: stepItem.position || 0,
          creativeWorkStatus: stepItem.creativeWorkStatus || '',
          expires: stepItem.expires || '',
          itemListElement: {
            '@id': directionId || '',
            '@type': directionItem?.['@type'] || 'HowToDirection',
            text: directionItem?.text || ''
          }
        });
      }
    }

    return steps.sort((a, b) => a.position - b.position);
  }

  private extractMentions(mentions: any[]): string[] {
    return mentions
      .map(mention => typeof mention === 'string' ? mention : mention['@id'] || mention.name)
      .filter(Boolean);
  }

  private extractFiles(hasPart: any[]): string[] {
    return hasPart
      .map(part => typeof part === 'string' ? part : part['@id'])
      .filter(Boolean);
  }

  private extractKeywords(keywords: string | string[]): string[] {
    if (Array.isArray(keywords)) {
      return keywords;
    }
    if (typeof keywords === 'string') {
      return keywords.split(',').map(k => k.trim()).filter(Boolean);
    }
    return [];
  }

  private extractAuthorName(authorRef: any, crateData: ROCrateData): string {
    if (!authorRef) return '';
    
    const authorId = typeof authorRef === 'string' ? authorRef : authorRef['@id'];
    if (!authorId) return '';

    const authorItem = crateData['@graph'].find(item => item['@id'] === authorId);
    if (authorItem && authorItem['@type'] === 'Person') {
      const givenName = authorItem.givenName || '';
      const familyName = authorItem.familyName || '';
      return `${givenName} ${familyName}`.trim();
    }

    return '';
  }

  private extractFileMetadata(crateData: ROCrateData | null | undefined): Record<string, FileMetadata> {
    if (!crateData || !crateData['@graph'] || !Array.isArray(crateData['@graph'])) {
      return {};
    }

    const fileMetadata: Record<string, FileMetadata> = {};
    
    for (const item of crateData['@graph']) {
      if (item['@type'] === 'File') {
        // Normalize contentSize to number (handles both string and number per spec)
        const contentSize = typeof item.contentSize === 'string'
          ? parseInt(item.contentSize, 10)
          : (item.contentSize || 0);

        fileMetadata[item['@id']] = {
          '@id': item['@id'],
          '@type': item['@type'] || 'File',
          name: item.name || '',
          alternateName: item.alternateName,
          encodingFormat: item.encodingFormat || '',
          contentSize: contentSize,
          dateModified: item.dateModified || '',
          description: item.description || '',
          sha256: item.sha256 || ''
        };
      }
    }

    return fileMetadata;
  }

  extractCustomFields(variableMeasured: any[], crateData?: ROCrateData | null) {
    const extractor = new CustomFieldExtractor();
    return extractor.extractCustomFields(variableMeasured, crateData);
  }

  /**
   * Cleans up text content by removing LaTeX delimiters and fixing arrows
   * - Removes '$' around LaTeX
   * - Removes '\[ ' and ' \]' around LaTeX
   * - Replaces '-&gt;' with '->'
   */
  private cleanupTextContent(text: string): string {
    if (!text) return '';

    let cleaned = text;

    // Replace LaTeX enclosed in '$' characters
    // Using a regex to find content between $ and $
    // This matches $...$ and replaces it with RSpace equation div
    cleaned = cleaned.replace(/\$([^$]+)\$/g, (_, latex) => {
      return `<div class="rsEquation mceNonEditable" data-equation="${latex}"> <a class="rsEquationClickableWrapper"> click here to insert latex data </a></div>`;
    });

    // Replace LaTeX enclosed in '\[ ' and ' \]' characters
    // Using a regex to find content between \[ and \]
    // We escape [ and ] in the regex
    cleaned = cleaned.replace(/\\\[(.*?)\\\]/g, (_, latex) => {
      return `<div class="rsEquation mceNonEditable" data-equation="${latex}"> <a class="rsEquationClickableWrapper"> click here to insert latex data </a></div>`;
    });

    // Replace '->' with '->'
    cleaned = cleaned.replace(/-&gt;/g, '->');

    return cleaned;
  }
}

// Re-export for backwards compatibility
export { ClassificationEngine } from './ClassificationEngine';
export { ValidationEngine } from './ValidationEngine';
export { CustomFieldExtractor } from './CustomFieldExtractor';

// Helper function to convert datasets to preview items
export function convertDatasetsToPreviewItems(
  datasets: ELabFTWDataset[],
  fileMetadata: Record<string, FileMetadata>,
  crateData?: ROCrateData | null
): PreviewItem[] {
  const parser = new ELabFTWParser();
  const classifier = new ClassificationEngine();
  const validator = new ValidationEngine();

  return datasets.map(dataset => {
    // Extract custom fields
    const customFields = parser.extractCustomFields(dataset.variableMeasured, crateData);
    
    // Classify the dataset
    const classification = classifier.classifyDataset(dataset, customFields);
    
    // Create item-specific eLabFTW metadata blob
    const rawElabFTWMetadata = createItemSpecificMetadata(dataset, crateData);
    
    // Create preview item
    const previewItem: PreviewItem = {
      id: dataset.id,
      name: dataset.name,
      alternateName: dataset.alternateName,
      type: dataset.genre,
      category: dataset.category || 'Uncategorized',
      categoryColor: dataset.categoryColor || '#666666',
      proposedClassification: classification.proposed,
      userClassification: null,
      confidence: classification.confidence,
      justification: classification.justification,
      reasons: classification.reasons,
      metadata: customFields,
      files: dataset.files,
      crossReferences: dataset.mentions,
      validationIssues: [],
      textContent: dataset.textContent,
      steps: dataset.steps || [],
      keywords: dataset.keywords || [],
      dateCreated: dataset.dateCreated || '',
      dateModified: dataset.dateModified || '',
      authorName: dataset.authorName,
      elabftwMetadata: rawElabFTWMetadata,
      chosenQuantityName: 'Items',
      creativeWorkStatus: dataset.creativeWorkStatus
    };
    
    // Validate the item
    previewItem.validationIssues = validator.validateItem(previewItem);

    return previewItem;
  });
}

// Helper function to create item-specific metadata
function createItemSpecificMetadata(dataset: ELabFTWDataset, crateData?: ROCrateData | null): any {
  if (!crateData || !crateData['@graph']) {
    return {
      dataset: {
        id: dataset.id,
        name: dataset.name,
        genre: dataset.genre,
        dateCreated: dataset.dateCreated,
        dateModified: dataset.dateModified
      },
      variableMeasured: dataset.variableMeasured,
      extractedAt: new Date().toISOString(),
      note: 'Limited metadata - no RO-Crate graph available'
    };
  }

  // Find the specific dataset in the graph
  const datasetInGraph = crateData['@graph'].find(item => item['@id'] === dataset.id);
  if (!datasetInGraph) {
    return {
      dataset: {
        id: dataset.id,
        name: dataset.name,
        genre: dataset.genre
      },
      variableMeasured: dataset.variableMeasured,
      extractedAt: new Date().toISOString(),
      note: 'Dataset not found in RO-Crate graph'
    };
  }

  // Create a map for quick lookups
  const graphMap = new Map();
  crateData['@graph'].forEach(item => {
    if (item['@id']) {
      graphMap.set(item['@id'], item);
    }
  });

  // Collect only items that are directly referenced by this dataset
  const referencedItems: any[] = [];
  const processedIds = new Set([dataset.id]);

  // Function to collect referenced items recursively (but only 1 level deep to avoid bloat)
  const collectReferences = (item: any, depth: number = 0) => {
    if (depth > 1) return; // Limit depth to avoid including too much

    Object.values(item).forEach((value: any) => {
      if (value && typeof value === 'object') {
        if (Array.isArray(value)) {
          value.forEach(arrayItem => {
            if (arrayItem && typeof arrayItem === 'object' && arrayItem['@id']) {
              const refId = arrayItem['@id'];
              if (!processedIds.has(refId)) {
                const referencedItem = graphMap.get(refId);
                if (referencedItem) {
                  processedIds.add(refId);
                  referencedItems.push(referencedItem);
                  if (depth === 0) {
                    collectReferences(referencedItem, depth + 1);
                  }
                }
              }
            }
          });
        } else if (value['@id']) {
          const refId = value['@id'];
          if (!processedIds.has(refId)) {
            const referencedItem = graphMap.get(refId);
            if (referencedItem) {
              processedIds.add(refId);
              referencedItems.push(referencedItem);
              if (depth === 0) {
                collectReferences(referencedItem, depth + 1);
              }
            }
          }
        }
      }
    });
  };

  // Start collecting references from the main dataset
  collectReferences(datasetInGraph);

  // Build the item-specific metadata
  const itemMetadata = {
    dataset: datasetInGraph,
    referencedItems: referencedItems,
    variableMeasured: dataset.variableMeasured,
    extractedAt: new Date().toISOString(),
    source: 'ELN',
    note: `Item-specific metadata for ${dataset.name} (${dataset.id})`
  };

  console.log(`Created item-specific metadata for ${dataset.name}:`);
  console.log(`- Dataset properties: ${Object.keys(datasetInGraph).length}`);
  console.log(`- Referenced items: ${referencedItems.length}`);
  console.log(`- Variable measured: ${dataset.variableMeasured.length}`);

  return itemMetadata;
}