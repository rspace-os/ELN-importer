import React, { useState } from 'react';
import {
  FileText,
  Package,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Calendar,
  Tag,
  Link,
  File
} from 'lucide-react';
import { PreviewItem } from '../types/eln';
import { ClassificationToggle } from './ClassificationToggle';
import { getConfidenceColor, getValidationIcon, getValidationIconColor } from '../utils/ui-helpers';
import {extractQuantityFromMetadata} from "../services/rspace-mapper.ts";
import clsx from 'clsx';

interface PreviewCardProps {
  item: PreviewItem;
  onClassificationChange: (itemId: string, classification: 'document' | 'inventory') => void;
  onItemClick: (item: PreviewItem) => void;
}

export function PreviewCard({ item, onClassificationChange, onItemClick }: PreviewCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedQuantity, setSelectedQuantity] = useState('auto-detect');
  const currentClassification = item.userClassification || item.proposedClassification;
  const hasUserOverride = item.userClassification !== null;

  return (
    <div className="bg-white rounded-lg shadow-md border border-gray-200 hover:shadow-lg transition-shadow duration-200">
      {/* Header */}
      <div className="p-4 border-b border-gray-100">
        <div className="flex items-start justify-between">
          <div className="flex items-start space-x-3 flex-1">
            {/* Icon and Type */}
            <div className="flex-shrink-0 mt-1">
              {item.type === 'experiment' ? (
                <FileText className="h-6 w-6 text-blue-600" />
              ) : (
                <Package className="h-6 w-6 text-purple-600" />
              )}
            </div>
            
            {/* Main Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-2 mb-1">
                <h3 className="text-lg font-semibold text-gray-900 truncate">
                  {item.name}
                </h3>
                <span 
                  className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium"
                  style={{ 
                    backgroundColor: `${item.categoryColor}20`,
                    color: item.categoryColor 
                  }}
                >
                  {item.category}
                </span>
              </div>
              {/* Quantity selector for Inventory items */}
              {(item.userClassification || item.proposedClassification) === 'inventory' && extractQuantityFromMetadata(item.metadata) && (
                  <div className="mt-2 ml-12 mr-4 p-3 bg-purple-50 border border-purple-200 rounded-md">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium text-purple-900" htmlFor={`qty-${item.id}`}>
                        Quantity field to use (for Inventory template)
                      </label>
                      <select
                          id={`qty-${item.id}`}
                          className="ml-4 px-2 py-1 text-sm border border-purple-300 rounded focus:outline-none focus:ring-2 focus:ring-purple-500"
                          value={selectedQuantity}
                          onChange={(e) => {
                            item.chosenQuantityName = e.target.value;
                            setSelectedQuantity(e.target.value);
                          }}
                      >
                        <option key = "Items" value="Items">(Items)</option>
                        {Object.entries(item.metadata)
                        .filter(([fieldName, _]) => {
                          const indicators = ['quantity','amount','volume','mass','weight','concentration','numeric'];
                          const looksLikeQuantity = indicators.some(q => fieldName.toLowerCase().includes(q));
                          return looksLikeQuantity && extractQuantityFromMetadata(item.metadata, fieldName)?.length>0;
                        })
                        .map(([fieldName]) => (
                            <option key={fieldName} value={fieldName}>{fieldName}</option>
                        ))}
                      </select>
                    </div>
                  </div>
              )}
              <div className="flex items-center space-x-4 text-sm text-gray-500">
                <span className="capitalize">{item.type}</span>
                <span className="flex items-center space-x-1">
                  <Calendar className="h-4 w-4" />
                  <span>{new Date(item.dateCreated).toLocaleDateString()}</span>
                </span>
                {item.keywords && item.keywords.length > 0 && (
                  <span className="flex items-center space-x-1">
                    <Tag className="h-4 w-4" />
                    <span>{item.keywords.slice(0, 2).join(', ')}</span>
                    {item.keywords.length > 2 && <span>+{item.keywords.length - 2}</span>}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Classification Toggle */}
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-600">Classification:</span>
              <ClassificationToggle
                currentClassification={currentClassification}
                onClassificationChange={(classification) => onClassificationChange(item.id, classification)}
                size="small"
              />
            </div>
            
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1 hover:bg-gray-100 rounded"
            >
              {isExpanded ? (
                <ChevronDown className="h-5 w-5 text-gray-400" />
              ) : (
                <ChevronRight className="h-5 w-5 text-gray-400" />
              )}
            </button>
          </div>
        </div>

        {/* Classification Info */}
        <div className="mt-3 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <span className={clsx(
              'inline-flex items-center px-2 py-1 rounded-full text-xs font-medium',
              getConfidenceColor(item.confidence)
            )}>
              {item.confidence} confidence
            </span>
            
            {hasUserOverride && (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                User Modified
              </span>
            )}
            
            {item.validationIssues.length > 0 && (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                {item.validationIssues.length} issue{item.validationIssues.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          
          <button
            onClick={() => onItemClick(item)}
            className="text-sm text-blue-600 hover:text-blue-800 flex items-center space-x-1"
          >
            <span>View Details</span>
            <ExternalLink className="h-4 w-4" />
          </button>
        </div>

        {/* Justification */}
        <div className="mt-2 text-sm text-gray-600 bg-gray-50 rounded p-2">
          <strong>Why {currentClassification}?</strong> {item.justification}
        </div>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="p-4 space-y-4">
          {/* Content Preview */}
          {item.textContent && (
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">Content Preview</h4>
              <div className="text-sm text-gray-600 bg-gray-50 rounded p-3 max-h-32 overflow-y-auto">
                {item.textContent.length > 200 
                  ? `${item.textContent.substring(0, 200)}...`
                  : item.textContent
                }
              </div>
            </div>
          )}

          {/* Steps */}
          {item.steps.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">
                Steps ({item.steps.length})
              </h4>
              <div className="space-y-1">
                {item.steps.slice(0, 3).map((step, index) => (
                  <div key={step['@id']} className="text-sm text-gray-600 flex items-start space-x-2">
                    <span className="bg-blue-100 text-blue-800 rounded-full w-5 h-5 flex items-center justify-center text-xs font-medium flex-shrink-0 mt-0.5">
                      {step.position}
                    </span>
                    <span>{step.itemListElement.text}</span>
                  </div>
                ))}
                {item.steps.length > 3 && (
                  <div className="text-sm text-gray-500 ml-7">
                    +{item.steps.length - 3} more steps
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Custom Fields */}
          {Object.keys(item.metadata).length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">
                Custom Fields ({Object.keys(item.metadata).length})
              </h4>
              <div className="space-y-2">
                {Object.entries(item.metadata).slice(0, 10).map(([fieldName, field]) => (
                  <div key={fieldName} className="text-sm">
                    <span className="font-medium text-gray-700">{fieldName}:</span>
                    <div className="text-gray-600 ml-1 mt-1">
                      <div>
                        <span className="block">{field.value || '(empty)'}</span>
                        {field.required && (
                          <span className="text-xs text-red-600 font-medium">Required</span>
                        )}
                        {field.options && field.options.length > 0 && (
                          <span className="text-xs text-gray-500 block">
                            Options: {field.options.join(', ')}
                          </span>
                        )}
                        {field.units && field.units.length > 0 && (
                          <span className="text-xs text-gray-500 block">
                            Units: {field.units.join(', ')}
                          </span>
                        )}
                        {field.group_id && (
                          <span className="text-xs text-blue-600">
                            Group: {field.group_id}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                {Object.keys(item.metadata).length > 10 && (
                  <div className="text-sm text-gray-500 col-span-full">
                    +{Object.keys(item.metadata).length - 10} more fields
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Files */}
          {item.files.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">
                Files ({item.files.length})
              </h4>
              <div className="flex flex-wrap gap-2">
                {item.files.slice(0, 5).map((file, index) => (
                  <span key={index} className="inline-flex items-center space-x-1 px-2 py-1 bg-gray-100 rounded text-xs">
                    <File className="h-3 w-3" />
                    <span>{file.split('/').pop()}</span>
                  </span>
                ))}
                {item.files.length > 5 && (
                  <span className="text-xs text-gray-500">
                    +{item.files.length - 5} more files
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Cross References */}
          {item.crossReferences.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">
                Cross References ({item.crossReferences.length})
              </h4>
              <div className="flex flex-wrap gap-2">
                {item.crossReferences.slice(0, 3).map((ref, index) => (
                  <span key={index} className="inline-flex items-center space-x-1 px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">
                    <Link className="h-3 w-3" />
                    <span>{ref.split('/').pop()}</span>
                  </span>
                ))}
                {item.crossReferences.length > 3 && (
                  <span className="text-xs text-gray-500">
                    +{item.crossReferences.length - 3} more references
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Validation Issues */}
          {item.validationIssues.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">Validation Issues</h4>
              <div className="space-y-2">
                {item.validationIssues.map((issue, index) => {
                  const IconComponent = getValidationIcon(issue.type);
                  const iconColor = getValidationIconColor(issue.type);
                  return (
                    <div key={index} className="flex items-start space-x-2 text-sm">
                      <IconComponent className={clsx('h-4 w-4', iconColor)} />
                      <div>
                        <div className="text-gray-700">{issue.message}</div>
                        {issue.suggestion && (
                          <div className="text-gray-500 text-xs mt-1">
                            Suggestion: {issue.suggestion}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}