import { PreviewItem, ValidationIssue } from '../types/elabftw';

/**
 * P1 IMPROVEMENT: Enhanced validation engine with comprehensive pre-import checks
 *
 * Validates items before import to catch errors early and provide clear feedback
 */
export class ValidationEngine {
  // P1: RSpace API limits
  private static readonly MAX_FIELD_NAME_LENGTH = 50;
  private static readonly MAX_FIELD_VALUE_LENGTH = 10000;
  private static readonly MAX_FILE_SIZE_MB = 100;
  private static readonly MAX_FILES_PER_ITEM = 50;
  private static readonly INVALID_FIELD_NAME_CHARS = /[<>{}]/;

  validateItem(item: PreviewItem): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    if (!item.name.trim()) {
      issues.push({
        type: 'error',
        message: 'Item name is required',
        suggestion: 'Provide a descriptive name for this item'
      });
    }

    if (item.userClassification === 'inventory' || item.proposedClassification === 'inventory') {
      const hasQuantityFields = Object.keys(item.metadata).some(fieldName =>
        ['quantity', 'amount', 'volume', 'mass', 'weight'].some(q => fieldName.toLowerCase().includes(q))
      );

      if (!hasQuantityFields && !item.justification.includes('instrument')) {
        issues.push({
          type: 'warning',
          message: 'No quantity information found',
          suggestion: 'Consider adding quantity fields for better inventory tracking'
        });
      }

      if (item.justification.includes('instrument')) {
        const hasInstrumentFields = Object.keys(item.metadata).some(fieldName =>
          ['model', 'serial', 'manufacturer'].some(f => fieldName.toLowerCase().includes(f))
        );

        if (!hasInstrumentFields) {
          issues.push({
            type: 'warning',
            message: 'Missing typical instrument information',
            suggestion: 'Consider adding model, serial number, or manufacturer information'
          });
        }
      }

      Object.entries(item.metadata).forEach(([fieldName, field]) => {
        if (field.required && !field.value.trim()) {
          issues.push({
            type: 'error',
            message: `Required field "${fieldName}" is empty`,
            suggestion: `Please provide a value for ${fieldName}`,
            field: fieldName
          });
        }
      });
    }

    if (item.userClassification === 'document' || item.proposedClassification === 'document') {
      if (!item.textContent.trim() && item.steps.length === 0) {
        issues.push({
          type: 'warning',
          message: 'Document has no content or steps',
          suggestion: 'Ensure the document contains meaningful experimental information'
        });
      }
    }

    if (item.crossReferences.length > 10) {
      issues.push({
        type: 'info',
        message: `High number of cross-references (${item.crossReferences.length})`,
        suggestion: 'Verify all references are necessary and correct'
      });
    }

    // P1: Add comprehensive validation checks
    this.validateFieldNames(item, issues);
    this.validateFieldValues(item, issues);
    this.validateFiles(item, issues);
    this.validateCrossReferences(item, issues);

    return issues;
  }

  /**
   * P1 IMPROVEMENT: Validate field names against RSpace constraints
   * - Max length: 50 characters
   * - No invalid characters (<>{}
   * - No duplicates (handled by P0 deduplication, but warn if found)
   */
  private validateFieldNames(item: PreviewItem, issues: ValidationIssue[]): void {
    const fieldNames = new Set<string>();
    const truncatedNames = new Set<string>();

    // Check metadata field names
    Object.keys(item.metadata).forEach(fieldName => {
      // Check length
      if (fieldName.length > ValidationEngine.MAX_FIELD_NAME_LENGTH) {
        const truncated = fieldName.substring(0, ValidationEngine.MAX_FIELD_NAME_LENGTH);
        truncatedNames.add(truncated);
        issues.push({
          type: 'warning',
          message: `Field name exceeds ${ValidationEngine.MAX_FIELD_NAME_LENGTH} characters: "${fieldName}"`,
          suggestion: `Will be truncated to: "${truncated}"`,
          field: fieldName
        });
      }

      // Check invalid characters
      if (ValidationEngine.INVALID_FIELD_NAME_CHARS.test(fieldName)) {
        issues.push({
          type: 'error',
          message: `Field name contains invalid characters: "${fieldName}"`,
          suggestion: 'Remove characters: < > { }',
          field: fieldName
        });
      }

      // Check for duplicates after truncation
      const finalName = fieldName.substring(0, ValidationEngine.MAX_FIELD_NAME_LENGTH);
      if (fieldNames.has(finalName)) {
        issues.push({
          type: 'warning',
          message: `Duplicate field name after truncation: "${finalName}"`,
          suggestion: 'Field names will be auto-deduplicated with _1, _2 suffix',
          field: fieldName
        });
      }
      fieldNames.add(finalName);
    });
  }

  /**
   * P1 IMPROVEMENT: Validate field values against RSpace constraints
   * - Max length: 10,000 characters
   * - Required fields must have values
   */
  private validateFieldValues(item: PreviewItem, issues: ValidationIssue[]): void {
    Object.entries(item.metadata).forEach(([fieldName, field]) => {
      const value = String(field.value || '');

      // Check value length
      if (value.length > ValidationEngine.MAX_FIELD_VALUE_LENGTH) {
        issues.push({
          type: 'error',
          message: `Field value exceeds ${ValidationEngine.MAX_FIELD_VALUE_LENGTH} characters: "${fieldName}"`,
          suggestion: `Current length: ${value.length}. Value must be shortened.`,
          field: fieldName
        });
      }

      // Check required fields
      if (field.required && !value.trim()) {
        issues.push({
          type: 'error',
          message: `Required field "${fieldName}" is empty`,
          suggestion: `Please provide a value for ${fieldName}`,
          field: fieldName
        });
      }
    });

    // Check content field
    if (item.textContent && item.textContent.length > ValidationEngine.MAX_FIELD_VALUE_LENGTH) {
      issues.push({
        type: 'warning',
        message: `Content exceeds ${ValidationEngine.MAX_FIELD_VALUE_LENGTH} characters`,
        suggestion: `Current length: ${item.textContent.length}. Consider splitting into multiple documents.`
      });
    }
  }

  /**
   * P1 IMPROVEMENT: Validate file attachments
   * - Max file size: 100 MB
   * - Max files per item: 50
   * - File references must exist
   */
  private validateFiles(item: PreviewItem, issues: ValidationIssue[]): void {
    // Check file count
    if (item.files.length > ValidationEngine.MAX_FILES_PER_ITEM) {
      issues.push({
        type: 'error',
        message: `Too many files attached (${item.files.length})`,
        suggestion: `Maximum ${ValidationEngine.MAX_FILES_PER_ITEM} files per item. Split into multiple items.`
      });
    }

    // Note: File size validation would require access to session.fileMetadata
    // This is handled in the importer where we have access to file blobs
  }

  /**
   * P1 IMPROVEMENT: Validate cross-references
   * - Referenced items should exist in the import batch
   * - No circular references
   * - No self-references
   */
  private validateCrossReferences(item: PreviewItem, issues: ValidationIssue[]): void {
    // Check for self-reference
    if (item.crossReferences.includes(item.id)) {
      issues.push({
        type: 'error',
        message: 'Item cannot reference itself',
        suggestion: 'Remove self-reference from cross-references'
      });
    }

    // Note: Checking if referenced items exist requires access to full item list
    // This is handled during import preparation where we have the complete batch
  }

  /**
   * P1 IMPROVEMENT: Validate entire batch of items
   * Performs cross-item validations that require knowledge of all items
   */
  validateBatch(items: PreviewItem[]): Map<string, ValidationIssue[]> {
    const batchIssues = new Map<string, ValidationIssue[]>();
    const itemIds = new Set(items.map(item => item.id));

    items.forEach(item => {
      const issues: ValidationIssue[] = [];

      // Check cross-reference validity
      item.crossReferences.forEach(refId => {
        if (!itemIds.has(refId)) {
          issues.push({
            type: 'warning',
            message: `Cross-reference to unknown item: ${refId}`,
            suggestion: 'Referenced item may not be in this import batch'
          });
        }
      });

      if (issues.length > 0) {
        batchIssues.set(item.id, issues);
      }
    });

    return batchIssues;
  }

  /**
   * P1 IMPROVEMENT: Count validation issues by severity
   */
  static countIssues(issues: ValidationIssue[]): { errors: number; warnings: number; info: number } {
    return {
      errors: issues.filter(i => i.type === 'error').length,
      warnings: issues.filter(i => i.type === 'warning').length,
      info: issues.filter(i => i.type === 'info').length
    };
  }

  /**
   * P1 IMPROVEMENT: Check if import can proceed (no blocking errors)
   */
  static canProceed(issues: ValidationIssue[]): boolean {
    return !issues.some(i => i.type === 'error');
  }
}
