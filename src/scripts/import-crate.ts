import fs from 'fs';
import path from 'path';
import { ELabFTWParser, convertDatasetsToPreviewItems } from '../utils/elabftw-parser';
import { RSpaceService } from '../services/rspace-api';
import { RSpaceImporter } from '../services/rspace-importer';
import { PreviewSession } from '../types/eln';

async function runImport() {
  // const filePath = '/Users/neilhanlon/Library/Application Support/JetBrains/IntelliJIdea2025.3/scratches/elab_ftw_ro_crate_differenttypes.json';
  // const filePath = '/Users/neilhanlon/Library/Application Support/JetBrains/IntelliJIdea2025.3/scratches/elab_ftw_ro_crate_bores_size_metadata.json';
  // const filePath = '/Users/neilhanlon/Library/Application Support/JetBrains/IntelliJIdea2025.3/scratches/elab_ftw_ro_crate_chemical_equation_h2o.json';
  const filePath = '/Users/neilhanlon/Library/Application Support/JetBrains/IntelliJIdea2025.3/scratches/elab_ftw_ro_crate_number_and_units.json';
  // const filePath = '/Users/neilhanlon/Library/Application Support/JetBrains/IntelliJIdea2025.3/scratches/elab_ftw_ro_crate.default_values.json';
  const apiKey = 'py3n5pPPwvrjq2kRQ2QmEXnc1uSOaIN0';
  const baseUrl = 'http://localhost:8080';

  console.log('--- Starting Import Script ---');
  console.log('Reading file:', filePath);

  if (!fs.existsSync(filePath)) {
    console.error('File not found:', filePath);
    process.exit(1);
  }

  const rawData = fs.readFileSync(filePath, 'utf8');
  const crateData = JSON.parse(rawData);

  const parser = new (ELabFTWParser as any)();
  // @ts-ignore - access private method for script
  const datasets = parser.extractDatasets(crateData);
  // @ts-ignore - access private method for script
  const fileMetadata = parser.extractFileMetadata(crateData);

  const previewItems = convertDatasetsToPreviewItems(datasets, fileMetadata, crateData);

  const session: PreviewSession = {
    id: 'script-session-' + Date.now(),
    createdAt: new Date().toISOString(),
    elnFileName: path.basename(filePath),
    totalItems: previewItems.length,
    items: previewItems,
    fileMetadata: fileMetadata as any,
    fileBlobs: new Map() // No actual blobs in this scratch file
  };

  console.log(`Parsed ${previewItems.length} items from RO-Crate`);

  const rspaceService = new RSpaceService({ baseUrl, apiKey });
  const importer = new RSpaceImporter(rspaceService);

  console.log('Connecting to RSpace at', baseUrl);

  try {
    const result = await importer.importSession(session, (progress) => {
      console.log(`Progress: ${progress.status} - ${progress.current}/${progress.total} ${progress.currentItem || ''}`);
    });

    console.log('\n--- Import Results ---');
    result.results.forEach(res => {
      console.log(`${res.success ? '✅' : '❌'} ${res.item}: ${res.success ? 'Success (ID: ' + res.rspaceId + ')' : 'Error: ' + res.error}`);
    });
  } catch (error) {
    console.error('\n💥 Import failed with fatal error:');
    console.error(error);
  }
}

runImport();
