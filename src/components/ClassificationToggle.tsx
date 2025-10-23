import React from 'react';
import clsx from 'clsx';

interface ClassificationToggleProps {
  currentClassification: 'document' | 'inventory';
  onClassificationChange: (classification: 'document' | 'inventory') => void;
  size?: 'small' | 'medium' | 'large';
}

export function ClassificationToggle({
  currentClassification,
  onClassificationChange,
  size = 'medium'
}: ClassificationToggleProps) {
  const sizeClasses = {
    small: 'px-2 py-1 text-xs',
    medium: 'px-3 py-1 text-sm',
    large: 'px-4 py-2 text-sm'
  };

  const buttonClass = sizeClasses[size];

  return (
    <div className="flex bg-gray-100 rounded-lg p-1">
      <button
        onClick={() => onClassificationChange('document')}
        className={clsx(
          buttonClass,
          'rounded font-medium transition-colors',
          currentClassification === 'document'
            ? 'bg-blue-600 text-white shadow-sm'
            : 'text-gray-600 hover:text-gray-800'
        )}
      >
        Document
      </button>
      <button
        onClick={() => onClassificationChange('inventory')}
        className={clsx(
          buttonClass,
          'rounded font-medium transition-colors',
          currentClassification === 'inventory'
            ? 'bg-purple-600 text-white shadow-sm'
            : 'text-gray-600 hover:text-gray-800'
        )}
      >
        Inventory
      </button>
    </div>
  );
}
