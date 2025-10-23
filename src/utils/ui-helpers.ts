import { AlertTriangle, Info, CheckCircle } from 'lucide-react';

export function getConfidenceColor(confidence: string): string {
  switch (confidence) {
    case 'high': return 'text-green-600 bg-green-100';
    case 'medium': return 'text-yellow-600 bg-yellow-100';
    case 'low': return 'text-red-600 bg-red-100';
    default: return 'text-gray-600 bg-gray-100';
  }
}

export function getValidationIcon(type: string) {
  switch (type) {
    case 'error': return AlertTriangle;
    case 'warning': return AlertTriangle;
    case 'info': return Info;
    default: return CheckCircle;
  }
}

export function getValidationIconColor(type: string): string {
  switch (type) {
    case 'error': return 'text-red-500';
    case 'warning': return 'text-yellow-500';
    case 'info': return 'text-blue-500';
    default: return 'text-green-500';
  }
}
