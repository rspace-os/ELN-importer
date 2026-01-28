# Attachment Field Solution - IMPLEMENTED

**Date:** 2026-01-28
**Status:** ✅ COMPLETE - Ready for testing

---

## Key Insight

The API documentation says:
> "Attach existing Gallery item to the inventory item **or sample field** of 'attachment' type"

**This means:** Attachments go on **fields** (not items directly). We need to:
1. Create a field with `type: 'attachment'` on the sample/container
2. Get the field's globalId from the response
3. Attach files to the **field's** globalId (not the item's globalId)

---

## Implementation Changes

### 1. Updated `prepareExtraFields()` Method

**File:** `src/services/rspace-api.ts`

```typescript
private prepareExtraFields(
  customFields: Record<string, any>,
  hasAttachments: boolean = false
): any[] {
  const extraFields = Object.entries(customFields).map(([name, value]) => ({
    name: name.substring(0, 50),
    type: typeof value === 'number' ? 'number' : 'text',
    content: String(value)
  }));

  // BUG FIX: Add attachment field if there are files to attach
  if (hasAttachments) {
    extraFields.push({
      name: 'Attachments',
      type: 'attachment',  // ← Special type!
      content: ''
    });
  }

  return extraFields;
}
```

### 2. Added Helper to Extract Attachment Field ID

**File:** `src/services/rspace-api.ts`

```typescript
getAttachmentFieldId(item: any): string | null {
  if (!item.extraFields || !Array.isArray(item.extraFields)) {
    return null;
  }

  const attachmentField = item.extraFields.find((field: any) =>
    field.type === 'attachment' && field.name === 'Attachments'
  );

  return attachmentField?.globalId || null;
}
```

### 3. Updated `createInventorySample()`

**File:** `src/services/rspace-api.ts`

Added `hasAttachments` parameter:

```typescript
async createInventorySample(data: {
  name: string;
  description?: string;
  tags?: string[];
  quantity?: { value: number; unit: string };
  customFields?: Record<string, any>;
  hasAttachments?: boolean;  // ← New!
}): Promise<RSpaceInventoryItem> {
  // ...

  if (data.customFields && Object.keys(data.customFields).length > 0) {
    sampleData.extraFields = this.prepareExtraFields(
      data.customFields,
      data.hasAttachments || false
    );
  } else if (data.hasAttachments) {
    // No custom fields but has attachments - create attachment field only
    sampleData.extraFields = [{
      name: 'Attachments',
      type: 'attachment',
      content: ''
    }];
  }

  // ...
}
```

### 4. Updated `createInventoryContainer()`

**File:** `src/services/rspace-api.ts`

Same changes as sample creation - added `hasAttachments` parameter.

### 5. Updated Import Flow

**File:** `src/services/rspace-importer.ts`

```typescript
// Create inventory item WITH attachment field if there are files
const result = await this.createRSpaceInventoryItem(
  item,
  uploadedFiles.length > 0  // ← Tells it to create attachment field
);

// Get attachment FIELD's globalId from response
const attachmentFieldId = this.rspaceService.getAttachmentFieldId(result);

if (uploadedFiles.length > 0 && attachmentFieldId) {
  console.log(`Attaching ${uploadedFiles.length} files to attachment field ${attachmentFieldId}`);

  for (const file of uploadedFiles) {
    try {
      // Use FIELD globalId, not sample globalId!
      await this.rspaceService.attachFileToInventoryItem(
        attachmentFieldId,  // ← Field ID like "SF12345"
        file.globalId       // ← File ID like "GL123"
      );
    } catch (error) {
      console.error(`Failed to attach file:`, error);
    }
  }
} else if (uploadedFiles.length > 0 && !attachmentFieldId) {
  console.error('Cannot attach files: attachment field not found in response');
}
```

---

## How It Works Now

### Step 1: Create Sample with Attachment Field

```json
POST /api/inventory/v1/samples
{
  "name": "Test Sample",
  "extraFields": [
    {
      "name": "Attachments",
      "type": "attachment",  // ← Creates attachment field
      "content": ""
    }
  ]
}
```

**Response:**
```json
{
  "id": "12345",
  "globalId": "SA12345",
  "extraFields": [
    {
      "id": "67890",
      "globalId": "SF67890",  // ← Field has its own globalId!
      "name": "Attachments",
      "type": "attachment",
      "content": ""
    }
  ]
}
```

### Step 2: Attach File to Field

```json
POST /api/inventory/v1/attachments
{
  "parentGlobalId": "SF67890",  // ← Field globalId (not sample!)
  "mediaFileGlobalId": "GL123"   // ← Gallery file globalId
}
```

---

## Expected Console Output

```
Creating inventory sample: Test Sample
Sample data: {
  "name": "Test Sample",
  "subsample_count": 1,
  "extraFields": [
    {
      "name": "Attachments",
      "type": "attachment",
      "content": ""
    }
  ]
}

Sample created: {...}
DEBUG - Sample result.extraFields: [
  {
    "id": "67890",
    "globalId": "SF67890",
    "name": "Attachments",
    "type": "attachment"
  }
]

Attaching 1 files to attachment field SF67890
=== ATTACHMENT DEBUG ===
Attaching Gallery file GL123 to inventory item SF67890
Request body: {
  "parentGlobalId": "SF67890",
  "mediaFileGlobalId": "GL123"
}
Response status: 200
Successfully attached file GL123 to inventory item SF67890
```

---

## Files Modified

1. **`src/services/rspace-api.ts`**
   - Updated `prepareExtraFields()` to accept `hasAttachments` parameter
   - Added `getAttachmentFieldId()` helper method
   - Updated `createInventorySample()` to include attachment field
   - Updated `createInventoryContainer()` to include attachment field

2. **`src/services/rspace-importer.ts`**
   - Updated `createRSpaceInventoryItem()` to accept `hasAttachments` parameter
   - Updated import flow to pass `hasAttachments` flag
   - Updated attachment logic to use field globalId instead of item globalId

---

## Key Differences from Previous Approach

| Aspect | Before (Wrong) | After (Correct) |
|--------|---------------|-----------------|
| **Attachment Target** | Sample globalId (SA123) | Field globalId (SF456) |
| **Field Creation** | No attachment field | Creates type='attachment' field |
| **API Call** | `parentGlobalId: "SA123"` | `parentGlobalId: "SF456"` |
| **Field Detection** | N/A | Extracts from extraFields response |

---

## Testing Checklist

- [ ] Import sample with files
- [ ] Check console for "Creating inventory sample" with attachment field
- [ ] Verify response contains extraFields with type='attachment'
- [ ] Check "Attaching X files to attachment field SF..."
- [ ] Verify attachment API success (200 response)
- [ ] **Most important:** Check RSpace UI - do files appear in sample's Attachments field?

---

## Expected Behavior in RSpace UI

After successful import, the sample should have:
- An "Attachments" field in the custom fields section
- Files visible when you open that field
- Ability to click files to view/download them

---

**Status:** ✅ READY FOR TESTING - Please try importing a sample with attachments!
