# Code Fixes to Apply

## Summary of Changes

1. ✅ Created new `src/types/eln.ts` with:
   - Generic naming (ELNDataset instead of ELabFTWDataset)
   - Fixed `contentSize: number | string` (accepts both)
   - Renamed `elabftwMetadata` to `elnMetadata`
   - Added legacy type alias for backward compatibility

2. 🔧 Need to apply to `src/utils/elabftw-parser.ts`:
   - Fix FileMetadata property mismatch
   - Normalize contentSize to number
   - Update imports

3. 🔧 Need to rename:
   - `src/utils/elabftw-parser.ts` → `src/utils/eln-parser.ts`
   - Class `ELabFTWParser` → `ELNParser`

4. 🔧 Update all imports across codebase

---

## Fix 1: FileMetadata Property Names (Line 278-285)

**File:** `src/utils/elabftw-parser.ts`

**Current (WRONG):**
```typescript
fileMetadata[item['@id']] = {
  id: item['@id'],              // ❌ Wrong property name
  name: item.name || '',
  encodingFormat: item.encodingFormat || '',
  contentSize: item.contentSize || 0,  // ❌ No type normalization
  dateModified: item.dateModified || '',
  description: item.description || ''
};
```

**Fixed (CORRECT):**
```typescript
// Normalize contentSize to number (handles both string and number per spec)
const contentSize = typeof item.contentSize === 'string'
  ? parseInt(item.contentSize, 10)
  : (item.contentSize || 0);

fileMetadata[item['@id']] = {
  '@id': item['@id'],           // ✅ Matches interface
  '@type': item['@type'] || 'File',  // ✅ Matches interface
  name: item.name || '',
  alternateName: item.alternateName,
  encodingFormat: item.encodingFormat || '',
  contentSize: contentSize,     // ✅ Normalized to number
  sha256: item.sha256 || ''
};
```

---

## Fix 2: Update Import Statement (Line 1-8)

**File:** `src/utils/elabftw-parser.ts` → Rename to `src/utils/eln-parser.ts`

**Current:**
```typescript
import {
  ELabFTWDataset,
  PropertyValue,
  HowToStep,
  FileMetadata,
  PreviewItem,
  ROCrateData
} from '../types/elabftw';
```

**Fixed:**
```typescript
import {
  ELNDataset,
  PropertyValue,
  HowToStep,
  FileMetadata,
  PreviewItem,
  ROCrateData
} from '../types/eln';
```

---

## Fix 3: Rename Class (Line 13)

**Current:**
```typescript
export class ELabFTWParser {
```

**Fixed:**
```typescript
export class ELNParser {
```

---

## Fix 4: Update Return Type (Line 21-25)

**Current:**
```typescript
async parseELNFile(file: File): Promise<{
  datasets: ELabFTWDataset[];
  fileMetadata: Record<string, FileMetadata>;
  fileIndex: Map<string, Blob>;
}> {
```

**Fixed:**
```typescript
async parseELNFile(file: File): Promise<{
  datasets: ELNDataset[];
  fileMetadata: Record<string, FileMetadata>;
  fileIndex: Map<string, Blob>;
}> {
```

---

## Fix 5: Update extractDatasets Method

Find all occurrences of `ELabFTWDataset` and replace with `ELNDataset`

**Search:** `ELabFTWDataset`
**Replace:** `ELNDataset`

---

## Fix 6: Update All Import Statements Across Codebase

Files to update (13 files):

```bash
src/App.tsx
src/utils/ValidationEngine.ts
src/utils/item-filters.ts
src/utils/ClassificationEngine.ts
src/utils/CustomFieldExtractor.ts
src/components/PreviewSummary.tsx
src/components/PreviewCard.tsx
src/components/PreviewInterface.tsx
src/components/ItemDetailModal.tsx
src/services/rspace-importer.ts
src/services/preview-session.ts
src/services/rspace-mapper.ts
```

**Find:**
```typescript
from './types/elabftw'
from '../types/elabftw'
```

**Replace with:**
```typescript
from './types/eln'
from '../types/eln'
```

**Also find:**
```typescript
import { ELabFTWParser
ELabFTWParser
new ELabFTWParser()
```

**Replace with:**
```typescript
import { ELNParser
ELNParser
new ELNParser()
```

---

## Quick Fix Commands (for manual execution)

### Rename files
```bash
cd src/utils
mv elabftw-parser.ts eln-parser.ts
```

### Update imports (macOS/Linux)
```bash
# Update type imports
find src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i '' 's/from.*elabftw/from '\''..\/types\/eln'\''/g' {} +

# Update parser imports
find src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i '' 's/elabftw-parser/eln-parser/g' {} +

# Update class name
find src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i '' 's/ELabFTWParser/ELNParser/g' {} +

# Update dataset type
find src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i '' 's/ELabFTWDataset/ELNDataset/g' {} +
```

---

## Verification Checklist

After applying fixes:

- [ ] File `src/types/eln.ts` exists with fixed types
- [ ] File `src/utils/eln-parser.ts` exists (renamed from elabftw-parser.ts)
- [ ] No files still import from `'../types/elabftw'`
- [ ] No files still reference `ELabFTWParser`
- [ ] No files still reference `ELabFTWDataset`
- [ ] FileMetadata uses `@id` and `@type` properties
- [ ] contentSize normalized to number in parser
- [ ] All TypeScript compilation errors resolved
- [ ] `npm run build` succeeds

---

## Testing

After fixes, test with:

1. Upload an eLabFTW .eln file (contentSize as number)
2. Upload a spec-compliant .eln file (contentSize as string) if available
3. Verify file metadata displays correctly
4. Verify no console errors about missing properties

---

## Status

✅ Part 1: Created `src/types/eln.ts` with fixes
⏳ Part 2: Awaiting application of parser fixes
⏳ Part 3: Awaiting file rename
⏳ Part 4: Awaiting import updates
