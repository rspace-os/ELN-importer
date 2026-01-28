# Diagnostic Logging Added for Inventory Attachments

**Date:** 2026-01-28
**Purpose:** Debug why inventory item attachments aren't appearing in RSpace UI

---

## What We Learned

### Document Attachments (Working Method)

Documents **don't use a separate attachment API**. Instead:

1. Files upload to Gallery → get numeric ID
2. Numeric IDs embedded in Content field as `<fileId=123>`
3. Document created with this content
4. RSpace auto-renders `<fileId>` tags as clickable file links

```javascript
// Documents do this:
fieldValues['Content'] = "<p>Content</p>\n<p><fileId=123></p>";
await createDocument(formId, name, fieldValues, tags);
// No separate attachment API call needed!
```

### Inventory Attachments (What We're Trying)

We're using a different approach:

1. Files upload to Gallery → get ID + globalId
2. Inventory item created
3. **Separate API call** to attach file
4. ❌ Not working - files don't appear

```javascript
// Inventory does this:
await uploadFile(file); // Returns { id, globalId }
await createInventorySample({...});  // Returns { id, globalId }
await attachFileToInventoryItem(sampleGlobalId, fileGlobalId);  // ← Not working
```

---

## Logging Added

### 1. File Upload Response

**File:** `src/services/rspace-api.ts` (lines ~388-394)

```javascript
const uploadResult = await response.json();
console.log('File upload response:', uploadResult);
console.log('DEBUG - Upload result keys:', Object.keys(uploadResult));
console.log('DEBUG - Upload result.id:', uploadResult.id);
console.log('DEBUG - Upload result.globalId:', uploadResult.globalId);
```

**What to check:**
- Does `globalId` actually exist in the response?
- What format is it? "GL123"? Something else?
- Are there other relevant fields we're missing?

### 2. Sample Creation Response

**File:** `src/services/rspace-api.ts` (lines ~248-253)

```javascript
const result = await response.json();
console.log('Sample created:', result);
console.log('DEBUG - Sample result keys:', Object.keys(result));
console.log('DEBUG - Sample result.id:', result.id);
console.log('DEBUG - Sample result.globalId:', result.globalId);
console.log('DEBUG - Sample result.subSamples:', result.subSamples);
```

**What to check:**
- Does the sample have a `globalId`?
- What's in `subSamples`? Do subsamples have their own globalIds?
- Should we attach to subsample instead of parent sample?

### 3. Attachment API Call

**File:** `src/services/rspace-api.ts` (lines ~451-486)

```javascript
console.log(`=== ATTACHMENT DEBUG ===`);
console.log(`Attaching Gallery file ${fileGlobalId} to inventory item ${itemGlobalId}`);
console.log('Request body:', JSON.stringify(requestBody, null, 2));
console.log('Response status:', response.status);
console.log('Response ok:', response.ok);
console.log('Response headers:', Array.from(response.headers.entries()));
console.log('Attachment API response:', JSON.stringify(result, null, 2));
console.log('DEBUG - Attachment result keys:', Object.keys(result));
```

**What to check:**
- What status code? (200, 201, 204?)
- What does the response body contain?
- Does it return an attachment ID or confirmation?
- Are there clues in the response about what went wrong?

---

## How to Test

1. **Run an import with a SampleDB file that has attachments**
2. **Open browser console**
3. **Look for these log patterns:**

```
Uploading 1 files for Sample Name
DEBUG - Upload result keys: [...]
DEBUG - Upload result.id: 123
DEBUG - Upload result.globalId: GL123  ← Does this exist?

Sample created: {...}
DEBUG - Sample result keys: [...]
DEBUG - Sample result.globalId: SA456  ← Does this exist?
DEBUG - Sample result.subSamples: [{...}]  ← What's in here?

=== ATTACHMENT DEBUG ===
Attaching Gallery file GL123 to inventory item SA456
Request body: {
  "parentGlobalId": "SA456",
  "mediaFileGlobalId": "GL123"
}
Response status: 200  ← What is this?
Response ok: true
Attachment API response: {...}  ← What does this contain?
```

---

## Questions to Answer

### From Upload Response
- [ ] Does upload return `globalId`?
- [ ] What format is `globalId`?
- [ ] What other fields are in the response?

### From Sample Creation
- [ ] Does sample have `globalId` field?
- [ ] What's the structure of `subSamples`?
- [ ] Do subsamples have their own `globalId`?
- [ ] Should we use subsample ID instead?

### From Attachment API
- [ ] What HTTP status is returned? (200, 201, 204, 400, 404?)
- [ ] What's in the response body?
- [ ] Does it confirm attachment success?
- [ ] Are there error messages we're not seeing?

---

## Hypotheses to Test Based on Logs

### Hypothesis 1: Missing globalId
**If:** Upload or sample doesn't return `globalId`
**Then:** The API might use a different field name
**Action:** Check what fields ARE present and try alternatives

### Hypothesis 2: Wrong Parent ID
**If:** Sample has subsamples with their own IDs
**Then:** Attachments might go on subsample, not parent
**Action:** Try using subsample globalId instead

### Hypothesis 3: Silent Failure
**If:** API returns 200 but empty/minimal response
**Then:** API might be accepting but not processing
**Action:** Check RSpace server logs or try different endpoint

### Hypothesis 4: Field Type Required
**If:** API returns error about field type
**Then:** Might need attachment custom field first
**Action:** Create sample with attachment field type

---

## Next Steps After Reviewing Logs

1. **Analyze console output** from test import
2. **Identify** which hypothesis matches the data
3. **Adjust code** based on findings
4. **Re-test** with corrections

---

## Files Modified

- `src/services/rspace-api.ts`
  - Added DEBUG logging to `uploadFile()` response
  - Added DEBUG logging to `createInventorySample()` response
  - Added comprehensive logging to `attachFileToInventoryItem()`

---

**Status:** Ready for diagnostic test run - please import a file with attachments and share console output
