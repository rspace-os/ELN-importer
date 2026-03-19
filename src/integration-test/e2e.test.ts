import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { ELabFTWParser, convertDatasetsToPreviewItems } from '../utils/elabftw-parser';
import { RSpaceImporter } from '../services/rspace-importer';
import { RSpaceService } from '../services/rspace-api';
import { PreviewSession } from '../types/eln';

describe('End-to-End Import Integration', () => {
  const dataDir = path.join(process.cwd(), 'src/integration-test/data');
  const expectedOutputDir = path.join(process.cwd(), 'src/integration-test/expected-output');
  const actualOutputDir = path.join(process.cwd(), 'src/integration-test/actual-output');

  if (!fs.existsSync(actualOutputDir)) {
    fs.mkdirSync(actualOutputDir, { recursive: true });
  }

  const files = fs.readdirSync(dataDir).filter(f => f.endsWith('.json'));

  it.each(files)('should correctly process %s', async (file) => {
    const filePath = path.join(dataDir, file);
    console.log(`Processing ${file}...`);
    const crateContent = fs.readFileSync(filePath, 'utf8');
    const crateData = JSON.parse(crateContent);

    // Mock file index and metadata
    const fileIndex = new Map<string, Blob>();
    const fileMetadata = {};

    const parser = new ELabFTWParser();
    // Use private method via cast to bypass access
    const datasets = (parser as any).extractDatasets(crateData);
    
    const previewItems = convertDatasetsToPreviewItems(datasets, fileMetadata, crateData);

    const session: PreviewSession = {
      id: `session-test`,
      createdAt: new Date().toISOString(),
      elnFileName: file,
      totalItems: previewItems.length,
      items: previewItems,
      fileMetadata: fileMetadata,
      fileBlobs: fileIndex
    };

    const rspaceService = new RSpaceService({
      baseUrl: 'http://localhost:8080',
      apiKey: 'test-api-key'
    });

    // Clear previous actual output file if exists
    const outputPath = path.join(actualOutputDir, `${file}-output.json`);
    if (fs.existsSync(outputPath)) {
      fs.unlinkSync(outputPath);
    }

    // Set integration test mode to write to actual-output
    rspaceService.setIntegrationTestMode(actualOutputDir, filePath);

    const importer = new RSpaceImporter(rspaceService);
    
    await importer.importSession(session, () => {});

    // Assertions
    const expectedPath = path.join(expectedOutputDir, `${file}-output.json`);
    
    expect(fs.existsSync(outputPath), `Output file should be generated for ${file}`).toBe(true);
    expect(fs.existsSync(expectedPath), `Expected output file should exist for ${file}`).toBe(true);

    const actualJson = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
    const expectedJson = JSON.parse(fs.readFileSync(expectedPath, 'utf8'));

    // Compare the payloads
    expect(actualJson).toEqual(expectedJson);
  });
});
