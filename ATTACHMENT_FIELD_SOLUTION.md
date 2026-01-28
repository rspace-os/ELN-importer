# Attachment Field Solution for Inventory Items

**Date:** 2026-01-28
**Key Insight:** Attachments go on **fields**, not items directly

---

## The Problem Clarified

API Documentation says:
> "Attach existing Gallery item to the inventory item **or sample field** of 'attachment' type"

**This means:**
- Option A: Attach to the inventory item itself (not what we need)
- Option B: Attach to a **sample field** with type='attachment' ✅ **THIS IS IT**

---

## Solution Architecture

### Step 1: Create Sample with Attachment Field

When creating a sample, add an extraField with type='attachment':

```javascript
POST /api/inventory/v1/samples
Body: {
  "name": "My Sample",
  "description": "Sample description",
  "extraFields": [
    {
      "name": "Attachments",
      "type": "attachment",  // ← Special type for file attachments
      "content": ""          // Empty initially
    },
    {
      "name": "Other Field",
      "type": "text",
      "content": "Some value"
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

### Step 2: Attach Files to the Field

Use the **field's globalId** (not the sample's globalId):

```javascript
POST /api/inventory/v1/attachments
Body: {
  "parentGlobalId": "SF67890",  // ← Field globalId, not sample globalId!
  "mediaFileGlobalId": "GL123"   // Gallery file globalId
}
```

---

## Implementation Changes Needed

### 1. Update `prepareExtraFields()` to Support Attachments

**File:** `src/services/rspace-api.ts`

```typescript
private prepareExtraFields(
  customFields: Record<string, any>,
  attachmentFieldName?: string  // New parameter
): any[] {
  const extraFields = Object.entries(customFields).map(([name, value]) => ({
    name: name.substring(0, 50),
    type: typeof value === 'number' ? 'number' : 'text',
    content: String(value)
  }));

  // Add attachment field if there are files to attach
  if (attachmentFieldName) {
    extraFields.push({
      name: attachmentFieldName,
      type: 'attachment',
      content: ''
    });
  }

  return extraFields;
}
```

### 2. Update `createInventorySample()` to Include Attachment Field

```typescript
async createInventorySample(data: {
  name: string;
  description?: string;
  tags?: string[];
  quantity?: { value: number; unit: string };
  customFields?: Record<string, any>;
  hasAttachments?: boolean;  // New parameter
}): Promise<RSpaceInventoryItem> {
  const sampleData: any = {
    name: data.name,
    subsample_count: 1
  };

  // ... existing description, tags, quantity code ...

  // Add custom fields as extraFields
  if (data.customFields && Object.keys(data.customFields).length > 0) {
    const attachmentFieldName = data.hasAttachments ? 'Attachments' : undefined;
    sampleData.extraFields = this.prepareExtraFields(data.customFields, attachmentFieldName);
  } else if (data.hasAttachments) {
    // No custom fields but has attachments - create attachment field only
    sampleData.extraFields = [{
      name: 'Attachments',
      type: 'attachment',
      content: ''
    }];
  }

  const response = await this.makeRequest('/api/inventory/v1/samples', {
    method: 'POST',
    body: JSON.stringify(sampleData)
  });

  const result = await response.json();
  console.log('Sample created:', result);

  return { ...result, type: 'sample' as const };
}
```

### 3. Extract Attachment Field GlobalId from Response

After creating the sample, find the attachment field's globalId:

```typescript
function findAttachmentFieldId(sample: any): string | null {
  if (!sample.extraFields) return null;

  const attachmentField = sample.extraFields.find((f: any) =>
    f.type === 'attachment' && f.name === 'Attachments'
  );

  return attachmentField?.globalId || null;
}
```

### 4. Update Import Flow

**File:** `src/services/rspace-importer.ts`

```typescript
// Create inventory item with attachment field if there are files
const result = await this.rspaceService.createInventorySample({
  ...commonData,
  quantity,
  hasAttachments: uploadedFiles.length > 0  // Signal that we need attachment field
});

// Find attachment field ID from response
const attachmentFieldId = this.findAttachmentFieldId(result);

if (uploadedFiles.length > 0 && attachmentFieldId) {
  console.log(`Attaching ${uploadedFiles.length} files to field ${attachmentFieldId}`);

  for (const file of uploadedFiles) {
    try {
      // Use FIELD globalId, not sample globalId
      await this.rspaceService.attachFileToInventoryItem(
        attachmentFieldId,  // ← Field ID, not sample ID!
        file.globalId
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

## Expected Behavior

### Sample Creation Response:
```json
{
  "id": "12345",
  "globalId": "SA12345",
  "name": "Test Sample",
  "extraFields": [
    {
      "id": "67890",
      "globalId": "SF67890",
      "name": "Attachments",
      "type": "attachment",
      "content": "",
      "attachments": []  // Empty initially
    },
    {
      "id": "67891",
      "globalId": "SF67891",
      "name": "Other Field",
      "type": "text",
      "content": "Value"
    }
  ]
}
```

### After Attaching Files:
```json
{
  "id": "67890",
  "globalId": "SF67890",
  "name": "Attachments",
  "type": "attachment",
  "attachments": [
    {
      "id": "98765",
      "globalId": "AT98765",
      "name": "image.png",
      "mediaFileGlobalId": "GL123"
    }
  ]
}
```

---

## Containers (Instruments)

Same approach for containers:

```typescript
async createInventoryContainer(data: {
  name: string;
  description?: string;
  tags?: string[];
  customFields?: Record<string, any>;
  hasAttachments?: boolean;  // New parameter
}): Promise<RSpaceInventoryItem> {
  const containerData: any = {
    name: data.name,
    cType: 'LIST',
    can_store_containers: true,
    can_store_samples: true
  };

  // ... existing code ...

  if (data.customFields && Object.keys(data.customFields).length > 0) {
    const attachmentFieldName = data.hasAttachments ? 'Attachments' : undefined;
    containerData.extraFields = this.prepareExtraFields(data.customFields, attachmentFieldName);
  } else if (data.hasAttachments) {
    containerData.extraFields = [{
      name: 'Attachments',
      type: 'attachment',
      content: ''
    }];
  }

  // ... rest of method ...
}
```

---

## Summary of Changes

1. ✅ Add `type: 'attachment'` field when creating samples/containers with files
2. ✅ Extract attachment field's globalId from creation response
3. ✅ Use field globalId (not sample globalId) in attachment API call
4. ✅ Handle both samples and containers

---

## Why This Will Work

**Current approach (wrong):**
```
parentGlobalId: "SA12345"  ← Sample's globalId
```

**Correct approach:**
```
parentGlobalId: "SF67890"  ← Attachment FIELD's globalId
```

The API is designed to attach files to **fields**, not directly to items. This allows:
- Multiple attachment fields per item
- Organizing attachments by category
- Granular control over file placement

---

**Next Step:** Implement these changes in the code
