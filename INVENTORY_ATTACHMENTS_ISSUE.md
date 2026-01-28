# Inventory Item Attachments Issue

**Status:** 🔴 BUG IDENTIFIED
**Date:** 2026-01-27
**Severity:** MEDIUM - Files are not attached to inventory items

---

## Problem Description

Files/attachments associated with inventory items (samples/containers) are not being uploaded or attached during the import process.

---

## Root Cause

In `rspace-importer.ts` lines 83-87:

```typescript
// Upload files first if this is a document with files
let uploadedFileIds: number[] = [];
if (classification === 'document' && item.files && item.files.length > 0) {
  uploadedFileIds = await this.uploadFilesBeforeDocument(item, session);
}
```

**The condition `classification === 'document'` excludes inventory items from file upload.**

Files are only uploaded for documents, not for:
- Inventory samples (`classification === 'inventory'`)
- Inventory containers (instruments)

---

## Impact

### What Doesn't Work
- SampleDB exports with attachments on samples
- Any ELN export where inventory items have associated files
- Images, data files, protocols attached to samples

### What Still Works
- ✅ Document attachments (working)
- ✅ Inventory item creation (working)
- ✅ Inventory item metadata (working)
- ✅ Cross-references (working)

---

## RSpace API Investigation

### Documents
Documents support file attachments via:
```
POST /api/v1/records/{recordId}/attachments
Body: { "fileId": <uploaded_file_id> }
```

**Status:** ✅ Implemented in `attachFileToDocument()` method

### Inventory Items
Need to verify if RSpace Inventory API supports file attachments:

**Option 1: Direct attachment endpoint**
```
POST /api/inventory/v1/samples/{sampleId}/attachments
POST /api/inventory/v1/containers/{containerId}/attachments
```

**Option 2: Include files during creation**
```json
{
  "name": "Sample Name",
  "description": "...",
  "attachments": [{ "fileId": 123 }, { "fileId": 456 }]
}
```

**Option 3: Use description field with embedded images**
```json
{
  "description": "<img src='/api/files/123'/> Sample description"
}
```

**Option 4: Not supported**
- Inventory items may not support file attachments in RSpace API
- Files might need to be linked via description or external references

---

## Proposed Solution

### Step 1: Verify RSpace API Support

Test if RSpace Inventory API supports attachments:

```bash
# Test sample attachment endpoint
curl -X POST "https://rspace.example.com/api/inventory/v1/samples/{sampleId}/attachments" \
  -H "apiKey: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"fileId": 123}'

# Check API documentation
curl "https://rspace.example.com/api/inventory/v1/samples/{sampleId}" \
  -H "apiKey: YOUR_API_KEY"
```

### Step 2A: If Attachments Supported

**Update `rspace-importer.ts`:**

```typescript
// Upload files for ALL item types
let uploadedFileIds: number[] = [];
if (item.files && item.files.length > 0) {
  progress.status = 'uploading_files';
  onProgress(progress);
  uploadedFileIds = await this.uploadFilesBeforeItem(item, session);
}

if (classification === 'document') {
  const result = await this.createRSpaceDocument(item, uploadedFileIds);
  // ... existing code
} else {
  const result = await this.createRSpaceInventoryItem(item);
  // NEW: Attach files to inventory item
  for (const fileId of uploadedFileIds) {
    await this.attachFileToInventoryItem(result.id, fileId);
  }
  // ... existing code
}
```

**Add method to `rspace-api.ts`:**

```typescript
async attachFileToInventoryItem(itemId: string, fileId: number): Promise<void> {
  try {
    // Determine if it's a sample or container
    const itemType = itemId.startsWith('SA') ? 'samples' : 'containers';

    console.log(`Attaching file ${fileId} to inventory ${itemType} ${itemId}`);

    const response = await this.makeRequest(
      `/api/inventory/v1/${itemType}/${itemId}/attachments`,
      {
        method: 'POST',
        body: JSON.stringify({ fileId: fileId })
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to attach file: ${response.status} - ${errorText}`);
    }

    console.log(`Successfully attached file ${fileId} to ${itemType} ${itemId}`);
  } catch (error) {
    console.error(`Failed to attach file to inventory item:`, error);
    throw error;
  }
}
```

### Step 2B: If Attachments NOT Supported

**Workaround: Embed file references in description**

```typescript
private async createRSpaceInventoryItem(
  item: PreviewItem,
  uploadedFileIds: number[] = []
) {
  const isInstrument = isInstrumentResource(item);
  const customFields = prepareInventoryCustomFields(item);
  const tags = prepareTags(item);

  let description = item.textContent || `Imported from ELN: ${item.category}`;

  // Add file references to description if files were uploaded
  if (uploadedFileIds.length > 0) {
    description += '\n\n**Attachments:**\n';
    description += uploadedFileIds
      .map(fileId => `- [File ${fileId}](/gallery/${fileId})`)
      .join('\n');
  }

  const commonData = {
    name: item.name,
    description,
    tags,
    customFields
  };

  // ... rest of method
}
```

---

## Testing Plan

### Test Case 1: Sample with Single File
1. Create SampleDB export with sample + 1 image attachment
2. Import into RSpace
3. Verify file is attached/referenced

### Test Case 2: Sample with Multiple Files
1. Create SampleDB export with sample + 3 files (image, PDF, data)
2. Import into RSpace
3. Verify all files are attached/referenced

### Test Case 3: Container with Files
1. Create export with instrument/container + protocol PDF
2. Import into RSpace
3. Verify file is attached/referenced

---

## Next Steps

1. **[IMMEDIATE]** Test RSpace Inventory API endpoints for attachment support
2. **[HIGH]** Implement appropriate solution (2A or 2B) based on API capabilities
3. **[MEDIUM]** Update progress indicator to show file upload status for inventory
4. **[LOW]** Add file count to preview card for inventory items

---

## Questions for User/Documentation

1. Does RSpace Inventory API support file attachments for samples/containers?
2. What is the expected behavior when inventory items have attachments?
3. Should files be uploaded but not attached (for future reference)?
4. Is embedding file links in description an acceptable workaround?

---

## Related Files

- `src/services/rspace-importer.ts` - Import orchestration (lines 83-109)
- `src/services/rspace-api.ts` - API methods (lines 203-259, 261-301)
- `src/utils/eln-parser.ts` - File extraction (extractFiles method)

---

**Investigation Status:** 🟡 AWAITING API VERIFICATION
