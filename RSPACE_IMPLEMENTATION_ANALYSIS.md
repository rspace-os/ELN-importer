# RSpace API Implementation Analysis

## Comparison: Python Script vs Our TypeScript Implementation

### ✅ Already Implemented Correctly

1. **Connection Testing** (`testConnection()`)
   - Tests `/api/v1/status` endpoint
   - Returns boolean for connection status

2. **Form Creation** (`createForm()`)
   - Creates forms with fields
   - Publishes forms automatically
   - Handles field types (String, Number, Date, Radio, Choice)

3. **Document Creation** (`createDocument()`)
   - Creates documents from forms
   - Passes field values correctly
   - Uses proper tag format (comma-separated string)

4. **Inventory Sample Creation** (`createInventorySample()`)
   - Creates samples with quantity
   - Adds custom fields
   - Uses correct tag format (array of objects with 'value' field)

5. **Inventory Container Creation** (`createInventoryContainer()`)
   - Creates containers for instruments
   - Adds custom fields
   - Uses correct tag format

6. **Custom Fields** (`addCustomFieldsToInventoryItem()`)
   - Adds extra fields to inventory items
   - Uses `/api/inventory/v1/items/{id}/extraFields` endpoint

7. **File Upload** (`uploadFile()`)
   - Uploads files to gallery
   - Returns file ID for linking

### ❌ Missing Functions We Need to Add

1. **Document Update** (`updateDocumentById()`)
   ```typescript
   async updateDocument(
     documentId: number,
     updates: {
       name?: string;
       tags?: string[];
       fieldUpdates?: Record<string, string>;
     }
   ): Promise<boolean>
   ```
   - GET current document
   - Merge updates with existing fields
   - PUT updated document

2. **Document Retrieval** (`getDocument()`)
   ```typescript
   async getDocument(documentId: number): Promise<RSpaceDocument>
   ```
   - GET `/api/v1/documents/{id}`
   - Returns full document with fields

3. **Link Files to Documents**
   - Currently we upload files but don't link them to documents
   - Need to embed file IDs in document content using `<fileId={id}>` format

### ⚠️ Potential Issues in Current Implementation

1. **makeRequest() timeout**
   - Python uses 30s timeout
   - Our fetch doesn't have timeout set properly (fetch API doesn't support timeout directly)
   - Need to implement AbortController with timeout

2. **Error Handling**
   - Python has detailed error messages
   - We should improve error details (include response body)

3. **File Upload Size Limits**
   - Python checks file size (100MB limit)
   - We don't validate file size

4. **Form Field Options**
   - Python auto-generates default options for Choice/Radio fields if missing
   - We should add this logic

### 🔧 Implementation Priorities

**High Priority (Required for Import)**:
1. ✅ All create operations work
2. ✅ Custom fields work
3. ✅ File uploads work
4. ❌ Document updates (needed for cross-references)
5. ❌ Better error handling

**Medium Priority (Improvements)**:
1. Timeout handling
2. File size validation
3. Default options for Choice fields
4. Retry logic for failed requests

**Low Priority (Nice to have)**:
1. Form caching to avoid duplicates
2. Batch operations
3. Progress callbacks for large files

## Key Differences in API Usage

### Tags Format

**Documents:**
```typescript
tags: "tag1,tag2,tag3"  // Comma-separated string
```

**Inventory Items:**
```typescript
tags: [{ value: "tag1" }, { value: "tag2" }]  // Array of objects
```

### Custom Fields

Both inventory items use the same format:
```typescript
POST /api/inventory/v1/items/{id}/extraFields
[
  { name: "Field 1", type: "text", content: "value" },
  { name: "Field 2", type: "number", content: "123" }
]
```

### File References in Documents

When embedding files in document content:
```html
<!-- Link format -->
<fileId={file_id}>filename.pdf</fileId>

<!-- Image format -->
<img src="/files/{file_id}/preview" />
```

## Implementation Status Summary

| Feature | Python | TypeScript | Status |
|---------|--------|------------|--------|
| Connection Test | ✅ | ✅ | Complete |
| Form Creation | ✅ | ✅ | Complete |
| Document Creation | ✅ (3 approaches) | ✅ (1 approach) | Working |
| Document Update | ✅ | ❌ | **Need to add** |
| Sample Creation | ✅ | ✅ | Complete |
| Container Creation | ✅ | ✅ | Complete |
| Custom Fields | ✅ | ✅ | Complete |
| File Upload | ✅ | ✅ | Complete |
| Error Handling | ✅ Detailed | ⚠️ Basic | Needs improvement |
| Timeout | ✅ 30s | ❌ None | Needs fix |

## Next Steps

1. Add `updateDocument()` method
2. Add `getDocument()` method
3. Improve error handling (include response bodies)
4. Add request timeout with AbortController
5. Add file size validation
6. Test full import workflow
