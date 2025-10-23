import { PreviewItem, ValidationIssue } from '../types/elabftw';

export class ValidationEngine {
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

    return issues;
  }
}
