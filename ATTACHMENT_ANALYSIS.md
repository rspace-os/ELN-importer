# Document vs Inventory Attachment Analysis

**Date:** 2026-01-28
**Purpose:** Understand how file attachments work for documents vs inventory

---

## Document Attachments (WORKING ✅)

### How It Works

1. **Upload files to Gallery**
   ```javascript
   const uploadedFile = await this.rspaceService.uploadFile(file, caption);
   // Returns: { id: "123", globalId: "GL123", name: "file.png" }
   ```

2. **Embed file IDs in Content field**
   ```javascript
   const fileLinks = uploadedFileIds.map(fileId =>
     `<p><fileId=${fileId}></p>`
   ).join('\n');
   fieldValues['Content'] = (fieldValues['Content'] || '') + '\n' + fileLinks;
   ```

3. **Create document with embedded IDs**
   ```javascript
   POST /api/v1/documents
   Body: {
     "name": "My Document",
     "form": { "id": 123 },
     "fields": [
       {
         "name": "Content",
         "content": "<p>Document content</p>\n<p><fileId=456></p>"
       }
     ]
   }
   ```

4. **RSpace auto-renders file links**
   - The `<fileId=456>` syntax is special RSpace markup
   - RSpace automatically converts it to proper file links in the UI
   - No separate "attach" API call needed

### Key Points
- ✅ Uses **numeric IDs** (123, 456)
- ✅ Files embedded in **field content** as HTML
- ✅ No separate attachment API
- ✅ RSpace renders `<fileId>` syntax automatically

---

## Inventory Attachments (NOT WORKING ❌)

### What We're Trying

1. **Upload files to Gallery** ✅ (same as documents, works)
   ```javascript
   const uploadedFile = await uploadFile(file);
   // Returns: { id: "123", globalId: "GL123", name: "file.png" }
   ```

2. **Create inventory item** ✅ (works)
   ```javascript
   POST /api/inventory/v1/samples
   Body: {
     "name": "My Sample",
     "description": "Sample description",
     "extraFields": [...]
   }
   // Returns: { id: "12345", globalId: "SA12345", ... }
   ```

3. **Attach files using attachments endpoint** ❌ (not working)
   ```javascript
   POST /api/inventory/v1/attachments
   Body: {
     "parentGlobalId": "SA12345",
     "mediaFileGlobalId": "GL123"
   }
   ```

### What Happens
- No error returned
- API call seems to succeed (200 OK?)
- BUT files don't appear in RSpace UI
- Attachments section remains empty

---

## Key Questions

### 1. API Documentation Interpretation

The docs say:
> "Attach existing Gallery item to the **inventory item or sample field** of 'attachment' type"

**Question:** What is a "sample field of 'attachment' type"?

**Possibilities:**
- A. Attachments go on the **sample** itself (what we're doing)
- B. Attachments go on a **custom field** with type='attachment' (NOT what we're doing)
- C. Attachments go on **subsamples**, not samples

### 2. Sample vs Subsample

Our code creates samples with:
```javascript
{
  "name": "My Sample",
  "subsample_count": 1,
  "subSamples": [{
    "name": "My Sample",
    "quantity": { ... }
  }]
}
```

**Question:** Do attachments go on:
- The parent **sample** (SA12345)?
- The **subsample** (SS67890)?

### 3. Field Structure

**Question:** Do we need to create an attachment field first?

The API docs mention "sample field of 'attachment' type". Maybe:
```javascript
{
  "name": "My Sample",
  "extraFields": [
    {
      "name": "Attachments",
      "type": "attachment",  // ← Is this needed?
      "content": ???
    }
  ]
}
```

### 4. Global ID Format

**Question:** Is the globalId format correct?

We're using:
- `parentGlobalId: "SA12345"` (from API response)
- `mediaFileGlobalId: "GL123"` (from upload response)

Are these the right format? Should we verify what the API actually returns?

---

## What We Need to Debug

### 1. Check API Response Details

Add detailed logging:
```javascript
const response = await this.makeRequest('/api/inventory/v1/attachments', {...});
const result = await response.json();
console.log('Attachment API response:', JSON.stringify(result, null, 2));
console.log('Response status:', response.status);
console.log('Response headers:', response.headers);
```

### 2. Verify Global IDs

Check what uploadFile actually returns:
```javascript
console.log('Upload response:', JSON.stringify(uploadedFile, null, 2));
// Does it have globalId?
// What format? "GL123" or something else?
```

Check what createInventorySample returns:
```javascript
console.log('Sample creation response:', JSON.stringify(result, null, 2));
// What's in the result?
// Is there a subsample ID we should use instead?
```

### 3. Test with Curl

Manual test to isolate the issue:
```bash
# Upload a file
curl -X POST "https://rspace.example.com/api/v1/files" \
  -H "apiKey: YOUR_KEY" \
  -F "file=@test.png" \
  -F "caption=Test Image"

# Note the globalId from response (e.g., "GL123")

# Create a sample
curl -X POST "https://rspace.example.com/api/inventory/v1/samples" \
  -H "apiKey: YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name": "Test Sample", "subsample_count": 1}'

# Note the globalId from response (e.g., "SA456")

# Try to attach
curl -X POST "https://rspace.example.com/api/inventory/v1/attachments" \
  -H "apiKey: YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"parentGlobalId": "SA456", "mediaFileGlobalId": "GL123"}'

# What does this return?
```

### 4. Check RSpace UI

After creating a sample manually in UI:
- Can you attach files?
- What does the attachment look like in the UI?
- Check the network tab - what API calls does the UI make?
- Is there a different endpoint or structure?

---

## Hypotheses to Test

### Hypothesis 1: Subsamples, not Samples
**Theory:** Attachments go on subsamples, not parent samples

**Test:**
```javascript
// Get subsample ID from sample creation response
const sample = await createInventorySample(...);
const subSampleId = sample.subSamples[0].globalId;  // SS12345?

// Try attaching to subsample instead
await attachFileToInventoryItem(subSampleId, fileGlobalId);
```

### Hypothesis 2: Attachment Field Required
**Theory:** Need to create a custom field with type='attachment'

**Test:**
```javascript
const sampleData = {
  name: "Test Sample",
  extraFields: [
    {
      name: "Files",
      type: "attachment",  // ← Special type?
      // How to reference the file here?
    }
  ]
};
```

### Hypothesis 3: Different Endpoint
**Theory:** The `/attachments` endpoint is wrong

**Test:**
- Check UI network tab for actual endpoint
- Try other endpoints like:
  - `/api/inventory/v1/samples/{id}/files`
  - `/api/inventory/v1/samples/{id}/attachments`
  - `/api/v1/files/{id}/link` or similar

### Hypothesis 4: Wrong ID Format
**Theory:** Global IDs aren't in the format we think

**Test:**
- Log actual API responses
- Verify globalId fields exist and have expected format
- Try numeric IDs instead of global IDs

---

## Next Steps

1. ✅ Add detailed logging to see actual API responses
2. ✅ Verify global ID formats
3. ✅ Check sample creation response for subsample IDs
4. ⬜ Test manually with curl
5. ⬜ Check RSpace UI network tab when attaching files
6. ⬜ Review RSpace inventory API documentation again
7. ⬜ Ask user to share network logs from UI attachment

---

**Status:** Need more diagnostic information before we can fix this
