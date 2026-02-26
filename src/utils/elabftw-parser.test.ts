import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ELabFTWParser } from './elabftw-parser';
import { convertDatasetsToPreviewItems } from './elabftw-parser';

// Mock jszip dynamic import used by ELabFTWParser
vi.mock('jszip', () => {
  class MockZipEntry {
    dir = false;
    constructor(public name: string, private content: string | null = null) {}
    async async(type: 'text') {
      if (type === 'text' && this.content != null) return this.content;
      throw new Error('Unsupported type or missing content');
    }
  }

  class MockZip {
    files: Record<string, MockZipEntry> = {};
    static async loadAsync(_file: File) {
      // Create a minimal ELN export structure
      const zip = new MockZip();
      const base = '2025-01-01-export/';
      const cratePath = `${base}ro-crate-metadata.json`;
      const crateGraph = {
        '@graph': [
          { '@id': './', '@type': 'Dataset' }, // Should be skipped
          { '@id': './dataset1', '@type': 'Dataset', name: 'Exp 1', genre: 'experiment', hasPart: ['./step1'], variableMeasured: [], keywords: ['k1','k2'], step: [{ '@id': './step1' }] },
          { '@id': './step1', '@type': 'HowToStep', position: 1, creativeWorkStatus: 'unfinished', expires: '2026-02-25T17:42:10+01:00', itemListElement: { '@id': './dir1' } },
          { '@id': './dir1', '@type': 'HowToDirection', text: 'Mix A and B' },
        ],
      };
      zip.files[cratePath] = new MockZipEntry(cratePath, JSON.stringify(crateGraph));
      zip.files[`${base}file1.txt`] = new MockZipEntry(`${base}file1.txt`, 'content');
      return zip as any;
    }

    forEach(cb: (relativePath: string, zipEntry: MockZipEntry) => void) {
      Object.entries(this.files).forEach(([path, entry]) => cb(path, entry));
    }
  }

  return { default: MockZip };
});

function makeFile(name = 'export.eln', size = 10) {
  return new File([new ArrayBuffer(size)], name, { type: 'application/zip' });
}

describe('ELabFTWParser', () => {
  let parser: ELabFTWParser;
  beforeEach(() => {
    parser = new ELabFTWParser();
  });

  it('parses a minimal ELN ZIP and extracts datasets', async () => {
    const file = makeFile();
    const { datasets, fileMetadata, fileIndex } = await parser.parseELNFile(file);

    expect(Array.isArray(datasets)).toBe(true);
    // Root dataset with id './' should be filtered out, leaving only dataset1
    expect(datasets.length).toBe(1);
    expect(datasets[0].id).toBe('./dataset1');
    expect(datasets[0].steps.length).toBe(1);
    expect(datasets[0].steps[0].expires).toBe('2026-02-25T17:42:10+01:00');
    expect(datasets[0].steps[0].itemListElement.text).toBe('Mix A and B');
    expect(typeof fileMetadata).toBe('object');
    expect(fileIndex instanceof Map).toBe(true);
  });
});

describe('RO-Crate converters', () => {
  it('converts datasets to preview items', () => {
    const datasets = [
      {
        id: './dataset1',
        name: 'Exp 1',
        genre: 'experiment',
        dateCreated: '',
        dateModified: '',
        textContent: 'Do X',
        steps: [],
        mentions: [],
        files: [],
        variableMeasured: [],
        keywords: ['k1'],
        category: 'Experiments',
      }
    ] as any;
    const crateData = { '@graph': [
      { '@id': './', '@type': 'Dataset' }
    ] } as any;

    const items = convertDatasetsToPreviewItems(datasets as any, {}, crateData);
    expect(items.length).toBe(1);
    expect(items[0].name).toBe('Exp 1');
    expect(items[0].textContent).toContain('Do X');
  });

});

describe('ELabFTWParser Internal Extractors', () => {
  let parser: ELabFTWParser;
  beforeEach(() => {
    parser = new ELabFTWParser();
  });

  it('extracts keywords from verschiedene Formate', () => {
    // @ts-ignore - accessing private for unit testing
    expect(parser.extractKeywords(['k1', 'k2'])).toEqual(['k1', 'k2']);
    // @ts-ignore
    expect(parser.extractKeywords('k1, k2')).toEqual(['k1', 'k2']);
    // @ts-ignore
    expect(parser.extractKeywords(undefined)).toEqual([]);
  });

  it('extracts mentions correctly', () => {
    const mentions = [
      { '@id': './ref1', name: 'Reference 1' },
      { '@id': './ref2', name: 'Reference 2' }
    ];
    // @ts-ignore
    const result = parser.extractMentions(mentions);
    expect(result.length).toBe(2);
    // extractMentions prefers @id over name
    expect(result[0]).toBe('./ref1');
  });

  it('maps ELabFTW field types correctly', () => {
    // @ts-ignore private method mapping returns null for unknowns and non-mapped types
    expect(parser.mapELabFTWFieldType('text')).toBeNull();
    // @ts-ignore
    expect(parser.mapELabFTWFieldType('date')).toBe('date');
    // @ts-ignore
    expect(parser.mapELabFTWFieldType('unknown')).toBeNull();
  });
});
