import * as fs from 'fs';
import * as path from 'path';
import { ELabFTWParser, convertDatasetsToPreviewItems } from '../utils/elabftw-parser';
import { RSpaceImporter } from '../services/rspace-importer';
import { RSpaceService } from '../services/rspace-api';
import { PreviewSession } from '../types/elabftw';
import {extractQuantityFromMetadata} from "../services/rspace-mapper.ts";

async function generateExpectedOutput() {
  const dataDir = path.join(process.cwd(), 'src/integration-test/data');
  const outputDir = path.join(process.cwd(), 'src/integration-test/expected-output');

  if (!fs.existsSync(dataDir)) {
    console.error(`Data directory not found: ${dataDir}`);
    process.exit(1);
  }

  const files = fs.readdirSync(dataDir).filter(f => f.endsWith('.json'));
  console.log(`Found ${files.length} files to process.`);

  for (const file of files) {
    console.log(`Processing ${file}...`);
    const filePath = path.join(dataDir, file);
    const crateContent = fs.readFileSync(filePath, 'utf8');
    const crateData = JSON.parse(crateContent);

    // Mock file index and metadata
    const fileIndex = new Map<string, Blob>();
    const fileMetadata = {};

    const parser = new ELabFTWParser();
    // Use private method via cast to bypass access for this script
    const datasets = (parser as any).extractDatasets(crateData);
    
    const previewItems = convertDatasetsToPreviewItems(datasets, fileMetadata, crateData);
    //if we dont do this, everything defaults to 'Items' as its quantity type
    previewItems.forEach(item => {
      Object.entries(item.metadata).forEach(([fieldName, _]) => {
        if (extractQuantityFromMetadata(item.metadata, fieldName).length > 0) {
          item.chosenQuantityName = fieldName;
        }
      })
    })
    const session: PreviewSession = {
      id: `session-${Date.now()}`,
      createdAt: new Date().toISOString(),
      elnFileName: file,
      totalItems: previewItems.length,
      items: previewItems,
      fileMetadata: fileMetadata,
      fileBlobs: fileIndex
    };

    const rspaceService = new RSpaceService({
      baseUrl: 'http://localhost:8080',
      apiKey: 'lwTjhgDKzfHvqou8mLUTfwZUL3ez1EY5'
    });

    // Clear previous output file if exists
    const outputPath = path.join(outputDir, `${file}-output.json`);
    if (fs.existsSync(outputPath)) {
      fs.unlinkSync(outputPath);
    }

    rspaceService.setIntegrationTestMode(outputDir, filePath);

    const importer = new RSpaceImporter(rspaceService);
    
    try {
      await importer.importSession(session, (progress) => {
        // console.log(`  Progress: ${progress.status} - ${progress.currentItem}`);
      });
      console.log(`  Successfully generated output for ${file}`);
    } catch (error) {
      console.error(`  Failed to process ${file}:`, error);
    }
  }
}

generateExpectedOutput().catch(console.error);
