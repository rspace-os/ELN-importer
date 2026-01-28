# P1 Improvements Implementation Plan

**Date:** January 26, 2026
**Status:** In Progress

---

## Overview

P1 improvements focus on making the ELN importer more generic, robust, and user-friendly. These are important improvements that enhance usability and reliability without being critical blocking bugs.

---

## P1-1: Generic RO-Crate Extraction ⏳ IN PROGRESS

### Current Issues
1. **eLabFTW-specific field extraction** in `CustomFieldExtractor.ts`:
   - Lines 28-32: Hardcoded `elabftw_metadata` property handling
   - Lines 48-70: `extractFromElabFTWMetadata()` method specific to eLabFTW format
   - Line 77: `mapELabFTWFieldType()` method name suggests eLabFTW-specific

2. **eLabFTW-specific references** in `rspace-mapper.ts`:
   - Line 3: Parameter named `elabftwType` instead of generic `fieldType`
   - Lines 66, 116, 137: Hardcoded skip of 'elabftw_metadata' field
   - Line 142: Hardcoded 'eLabFTW ID' custom field
   - Line 175: Hardcoded 'elabftw-import' tag

3. **Type definitions** in `eln.ts`:
   - Still has `ELabFTWDataset` type alias (backward compatibility)
   - May have eLabFTW-specific interfaces

### Implementation Strategy

**Phase 1: Make CustomFieldExtractor generic**
- Rename `extractFromElabFTWMetadata()` → `extractFromSourceMetadata()`
- Rename `mapELabFTWFieldType()` → `mapFieldType()`
- Support multiple metadata property names:
  - `elabftw_metadata` (eLabFTW)
  - `source_metadata` (generic)
  - `extra_fields` (generic)
  - `custom_fields` (generic)
- Add metadata format detection and normalization

**Phase 2: Make RSpace mapper generic**
- Rename parameter `elabftwType` → `fieldType` in `mapFieldTypeForRSpace()`
- Replace hardcoded 'elabftw_metadata' skip with configurable list
- Replace 'eLabFTW ID' with 'Source ELN ID'
- Replace 'elabftw-import' tag with 'eln-import'
- Add source detection and optional source-specific tagging

**Phase 3: Add source detection**
- Detect ELN source from RO-Crate metadata
- Support: eLabFTW, Chemotion, openBIS, Kadi4Mat, Dataverse, generic
- Add optional source-specific handling via strategy pattern
- Log detected source for debugging

**Phase 4: Documentation**
- Update code comments to be generic
- Add examples of non-eLabFTW ELN formats
- Document supported RO-Crate patterns

### Files to Modify
- `src/utils/CustomFieldExtractor.ts`
- `src/services/rspace-mapper.ts`
- `src/types/eln.ts` (documentation only)

---

## P1-2: Classification Override UI ⏸️ PENDING

### Current Issues
- Users have no way to override automatic document vs inventory classification
- Ambiguous items (e.g., "Sample preparation protocol") could go either way
- No UI to review and adjust classification before import

### Implementation Strategy

**Phase 1: Add classification confidence scores**
- Modify `ClassificationEngine` to return confidence score (0-100)
- Items with confidence < 70 marked as "ambiguous"
- Expose confidence in PreviewItem interface

**Phase 2: Add classification override UI**
- New column in preview table: "Type" with dropdown
- Dropdown options: "Document (auto)", "Inventory (auto)", "Document (manual)", "Inventory (manual)"
- Highlight ambiguous items with warning icon
- Allow bulk classification changes

**Phase 3: Store user preferences**
- Track user classification decisions
- Learn from corrections to improve future classifications
- Export/import classification rules

### Files to Create/Modify
- `src/utils/ClassificationEngine.ts` (add confidence)
- `src/components/PreviewTable.tsx` (add override column)
- `src/services/preview-session.ts` (track manual overrides)
- `src/types/eln.ts` (add confidence to PreviewItem)

---

## P1-3: File Upload Retry Logic ⏸️ PENDING

### Current Issues
- Single network failure aborts entire import
- Large files can timeout without retry
- No exponential backoff or rate limiting
- Transient errors not distinguished from permanent failures

### Implementation Strategy

**Phase 1: Add RetryManager utility**
- Exponential backoff: 1s, 2s, 4s, 8s, 16s (max 5 attempts)
- Configurable retry predicate (which errors to retry)
- Jitter to prevent thundering herd
- Max retry time cap (e.g., 60s total)

**Phase 2: Integrate with file upload**
- Wrap `uploadFileToRSpace()` in RetryManager
- Detect retryable errors: network, timeout, 429, 502, 503, 504
- Non-retryable errors: 400, 401, 403, 404 (fail immediately)
- Show retry status in progress bar

**Phase 3: Add resume capability**
- Track partially uploaded files
- Support chunked upload for large files (>10MB)
- Resume from last successful chunk

### Files to Create/Modify
- `src/utils/RetryManager.ts` (NEW)
- `src/services/rspace-api.ts` (wrap upload methods)
- `src/services/rspace-importer.ts` (update progress reporting)

---

## P1-4: Comprehensive Pre-Import Validation ⏸️ PENDING

### Current Issues
- Validation happens during import (too late)
- Errors discovered mid-import trigger rollback
- No validation summary shown to user
- Missing validations:
  - File size limits
  - Field value length limits
  - Invalid characters in field names
  - Required fields missing
  - Invalid cross-references

### Implementation Strategy

**Phase 1: Enhance ValidationEngine**
- Add comprehensive validation rules:
  - RSpace field name rules (length, characters, duplicates) ✅ DONE IN P0
  - File size limits (RSpace API limit)
  - Field value length limits
  - Cross-reference validity
  - Required metadata presence
- Return structured validation results (errors, warnings)

**Phase 2: Add validation step to UI**
- New "Validation" step after preview, before import
- Show validation results:
  - ✅ Passed validations (green)
  - ⚠️ Warnings (yellow, can proceed)
  - ❌ Errors (red, must fix)
- "Fix Issues" button to return to preview with highlights
- "Proceed Anyway" for warnings only

**Phase 3: Validation caching**
- Validate during preview generation
- Cache validation results
- Re-validate only if user makes changes
- Show validation status in preview table

### Files to Modify
- `src/utils/ValidationEngine.ts` (enhance rules)
- `src/components/ImportWizard.tsx` (add validation step)
- `src/components/ValidationResults.tsx` (NEW)
- `src/services/preview-session.ts` (cache validation)

---

## P1-5: Partial Rollback with Retry ⏸️ PENDING

### Current Issues
- Current rollback is all-or-nothing (P0 implementation)
- Single item failure rolls back entire import
- No retry for individual failed items
- User loses all progress on transient errors

### Implementation Strategy

**Phase 1: Implement checkpoint system**
- Create checkpoints after each successful item
- Track item dependencies (what depends on what)
- Rollback only failed item and dependents
- Keep successfully imported items

**Phase 2: Add retry for failed items**
- Retry failed items up to 3 times
- Exponential backoff between retries
- Show retry status in progress
- Final report: succeeded, failed, rolled back

**Phase 3: Partial import success handling**
- Allow import to complete with some failures
- Generate detailed report:
  - ✅ Successfully imported items
  - ❌ Failed items with reasons
  - 🔄 Rolled back items (due to dependencies)
- Option to retry failed items later
- Export failed items list for debugging

**Phase 4: Dependency-aware rollback**
- If item A references item B, and B fails:
  - Roll back both A and B
  - Report as "dependency failure"
- If A fails but B succeeded:
  - Roll back only A
  - Keep B (no dependency issue)

### Files to Modify
- `src/services/rspace-importer.ts` (checkpoint system)
- `src/types/eln.ts` (add ImportResult interface)
- `src/components/ImportProgress.tsx` (show partial results)
- `src/components/ImportReport.tsx` (NEW - detailed results)

---

## Implementation Order

1. **P1-1: Generic RO-Crate** (2-3 hours)
   - Critical for supporting non-eLabFTW ELNs
   - Improves code maintainability
   - No UI changes needed

2. **P1-4: Pre-Import Validation** (3-4 hours)
   - Prevents wasted imports that will fail
   - Better user experience
   - Leverages existing ValidationEngine

3. **P1-3: File Upload Retry** (2-3 hours)
   - Improves reliability significantly
   - No UI changes needed (just progress updates)
   - Quick win for robustness

4. **P1-2: Classification Override UI** (4-5 hours)
   - Requires UI work
   - Nice-to-have but not critical
   - Can be added later

5. **P1-5: Partial Rollback** (5-6 hours)
   - Most complex implementation
   - Significant architecture changes
   - Should be done last after other improvements tested

---

## Testing Strategy

For each P1 improvement:

1. **Unit tests**
   - Test each new utility/method
   - Test edge cases
   - Test error conditions

2. **Integration tests**
   - Test with sample .eln files
   - Test with non-eLabFTW ELN files (P1-1)
   - Test with large files (P1-3)
   - Test with invalid data (P1-4)
   - Test with network errors (P1-3, P1-5)

3. **User acceptance tests**
   - Test full import workflow
   - Test UI improvements (P1-2, P1-4)
   - Test error scenarios
   - Test partial success scenarios (P1-5)

---

## Success Metrics

- **P1-1**: Successfully imports ELN files from at least 2 non-eLabFTW sources
- **P1-2**: Users can override classification for 100% of items
- **P1-3**: File upload success rate improves by 20-30% in flaky networks
- **P1-4**: 90%+ of validation errors caught before import attempt
- **P1-5**: Partial import success allows recovery of 70%+ of data on single item failures

---

## Next Steps

1. Start with P1-1 (Generic RO-Crate extraction)
2. Implement Phase 1: Make CustomFieldExtractor generic
3. Run tests with sample eLabFTW and non-eLabFTW files
4. Move to next phase
