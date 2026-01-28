# contentSize Type Fix

## Issue Summary

**Specification:** contentSize must be a **string**
**Your Code:** contentSize is typed as **number**
**eLabFTW Reality:** Exports contentSize as **number** (spec violation)

---

## Current Status: ✅ NOT CRITICAL

**Good news:** I checked your entire codebase and found:
- contentSize is only read during parsing
- It's never used in calculations or display
- No immediate bug or risk

**Risk:** If you later add features that use file sizes (totals, sorting, filtering), you could hit type issues.

---

## Recommended Fix

### Option 1: Accept Both Types (Defensive - RECOMMENDED)

**File:** `src/types/elabftw.ts`
```typescript
export interface FileMetadata {
  '@id': string;
  '@type': string;
  name: string;
  alternateName?: string;
  encodingFormat: string;
  contentSize: number | string;  // ✅ Accept both
  sha256: string;
}
```

**File:** `src/utils/elabftw-parser.ts`
```typescript
fileMetadata[item['@id']] = {
  id: item['@id'],
  name: item.name || '',
  encodingFormat: item.encodingFormat || '',
  // Normalize to number
  contentSize: typeof item.contentSize === 'string'
    ? parseInt(item.contentSize, 10)
    : (item.contentSize || 0),
  dateModified: item.dateModified || '',
  description: item.description || ''
};
```

**Benefits:**
- ✅ Works with eLabFTW exports (number)
- ✅ Works with spec-compliant files (string)
- ✅ Normalizes to number for future use
- ✅ No breaking changes

---

### Option 2: Strict Spec Compliance

**File:** `src/types/elabftw.ts`
```typescript
export interface FileMetadata {
  '@id': string;
  '@type': string;
  name: string;
  alternateName?: string;
  encodingFormat: string;
  contentSize: string;  // Spec-compliant
  sha256: string;
}
```

**File:** `src/utils/elabftw-parser.ts`
```typescript
fileMetadata[item['@id']] = {
  id: item['@id'],
  name: item.name || '',
  encodingFormat: item.encodingFormat || '',
  // Force to string (spec-compliant)
  contentSize: String(item.contentSize || 0),
  dateModified: item.dateModified || '',
  description: item.description || ''
};
```

**Benefits:**
- ✅ Follows specification exactly
- ✅ Works with eLabFTW (converts numbers to strings)

**Drawbacks:**
- ⚠️ Any future code using contentSize must parse it first
- ⚠️ More verbose when doing calculations

---

## Testing

After implementing the fix, test with:

1. **eLabFTW export** (contentSize: 85530)
2. **Spec-compliant file** (contentSize: "85530")
3. **Edge cases:**
   - Missing contentSize
   - Zero contentSize
   - Very large files (>2GB)
   - Invalid string ("abc")

---

## My Recommendation

**Go with Option 1** because:
1. It's defensive - handles both formats
2. Internally normalizes to number (easier to work with)
3. No breaking changes
4. Future-proof for any file size operations

**Priority:** LOW (since contentSize isn't currently used)
**Effort:** 5 minutes
**Risk:** None

---

## Additional Finding

While checking this, I also noticed the type definition has a mismatch:

**In `elabftw-parser.ts` line 278:**
```typescript
fileMetadata[item['@id']] = {
  id: item['@id'],           // ❌ Type has 'id' field
  name: item.name || '',
  // ...
```

**But `FileMetadata` interface has:**
```typescript
export interface FileMetadata {
  '@id': string;              // ✅ Should be '@id', not 'id'
  '@type': string;
  // ...
}
```

This is a **separate bug** - the parser creates `id` but the type expects `@id`. This might cause issues when accessing file metadata.

Would you like me to create a comprehensive fix for both issues?
