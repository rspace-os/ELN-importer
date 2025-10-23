import React, { useState, useMemo } from 'react';
import {
  Filter,
  Search,
  Upload,
  FileText,
  Settings,
  Info
} from 'lucide-react';
import { PreviewSession, PreviewItem } from '../types/elabftw';
import { PreviewCard } from './PreviewCard';
import { PreviewSummary } from './PreviewSummary';
import { ItemDetailModal } from './ItemDetailModal';
import { ImportProgressModal } from './ImportProgressModal';
import { useRSpaceConfig } from '../contexts/RSpaceConfigContext';
import { RSpaceService } from '../services/rspace-api';
import { RSpaceImporter, ImportProgress } from '../services/rspace-importer';
import { filterItems, sortItems, getFilterCounts, FilterType, SortType } from '../utils/item-filters';
import clsx from 'clsx';
import toast from 'react-hot-toast';

interface PreviewInterfaceProps {
  session: PreviewSession;
  onImport: (session: PreviewSession) => void;
  onBack: () => void;
  onClassificationChange: (itemId: string, classification: 'document' | 'inventory') => void;
  onConfigureRSpace: () => void;
}

export function PreviewInterface({ session, onImport, onBack, onClassificationChange, onConfigureRSpace }: PreviewInterfaceProps) {
  const { config, isConfigured } = useRSpaceConfig();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [sortBy, setSortBy] = useState<SortType>('name');
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [detailItem, setDetailItem] = useState<PreviewItem | null>(null);
  const [showBulkActions, setShowBulkActions] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<ImportProgress | null>(null);

  const filteredAndSortedItems = useMemo(() => {
    const filtered = filterItems(session.items, activeFilter, searchQuery);
    return sortItems(filtered, sortBy);
  }, [session.items, searchQuery, activeFilter, sortBy]);

  const handleBulkClassification = (classification: 'document' | 'inventory') => {
    selectedItems.forEach(itemId => {
      onClassificationChange(itemId, classification);
    });
    setSelectedItems(new Set());
    setShowBulkActions(false);
    toast.success(`Updated ${selectedItems.size} items to ${classification}`);
  };

  const handleSelectAll = () => {
    if (selectedItems.size === filteredAndSortedItems.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(filteredAndSortedItems.map(item => item.id)));
    }
  };

  const filterCounts = getFilterCounts(session.items);
  const filters = [
    { id: 'all' as FilterType, label: 'All Items', count: filterCounts.all },
    { id: 'experiments' as FilterType, label: 'Experiments', count: filterCounts.experiments },
    { id: 'resources' as FilterType, label: 'Resources', count: filterCounts.resources },
    { id: 'high' as FilterType, label: 'High Confidence', count: filterCounts.high },
    { id: 'medium' as FilterType, label: 'Medium Confidence', count: filterCounts.medium },
    { id: 'low' as FilterType, label: 'Low Confidence', count: filterCounts.low },
    { id: 'modified' as FilterType, label: 'User Modified', count: filterCounts.modified },
    { id: 'issues' as FilterType, label: 'Has Issues', count: filterCounts.issues }
  ];

  const totalIssues = session.items.reduce((sum, item) => sum + item.validationIssues.length, 0);
  const hasErrors = session.items.some(item =>
    item.validationIssues.some(issue => issue.type === 'error')
  );

  const handleImport = async () => {
    if (!config) {
      toast.error('Please configure RSpace credentials first. Click the settings button in the top right.');
      return;
    }

    if (selectedItems.size === 0) {
      toast.error('Please select at least one item to import');
      return;
    }

    setIsImporting(true);
    const rspaceService = new RSpaceService(config);
    const importer = new RSpaceImporter(rspaceService);

    try {
      const finalProgress = await importer.importSession(session, (progress) => {
        console.log('Progress update:', progress.current, '/', progress.total, '-', progress.status);
        setImportProgress({ ...progress });
      }, selectedItems);

      const successCount = finalProgress.results.filter(r => r.success).length;
      const failureCount = finalProgress.results.filter(r => !r.success).length;

      if (failureCount === 0) {
        toast.success(`Successfully imported ${successCount} item${successCount !== 1 ? 's' : ''} to RSpace!`);
      } else {
        toast.error(`Import completed with ${failureCount} failure${failureCount !== 1 ? 's' : ''}. ${successCount} items imported successfully.`);
      }

      setSelectedItems(new Set());
    } catch (error) {
      console.error('Import failed:', error);
      toast.error(`Import failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };


  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <button
                onClick={onBack}
                className="text-gray-600 hover:text-gray-900 transition-colors"
              >
                ← Back
              </button>
              <h1 className="text-xl font-semibold text-gray-900">
                Import Preview
              </h1>
              <span className="text-sm text-gray-500">
                {session.elnFileName}
              </span>
            </div>
            
            <div className="flex items-center space-x-3">
              {selectedItems.size > 0 && (
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-600">
                    {selectedItems.size} selected
                  </span>
                  <button
                    onClick={() => setShowBulkActions(!showBulkActions)}
                    className="px-3 py-1 bg-blue-100 text-blue-700 rounded text-sm hover:bg-blue-200 transition-colors"
                  >
                    Bulk Actions
                  </button>
                </div>
              )}

              <button
                onClick={onConfigureRSpace}
                className="px-3 py-2 text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors flex items-center space-x-2"
                title="Configure RSpace Connection"
              >
                <Settings className="h-4 w-4" />
                <span className="text-sm">Configure</span>
              </button>

              <button
                onClick={handleImport}
                disabled={selectedItems.size === 0}
                className={clsx(
                  'px-4 py-2 rounded-lg font-medium transition-colors',
                  selectedItems.size === 0
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-green-600 text-white hover:bg-green-700'
                )}
              >
                <span className="flex items-center space-x-2">
                  <Upload className="h-4 w-4" />
                  <span>
                    {selectedItems.size === 0
                      ? 'Select Items to Import'
                      : `Import ${selectedItems.size} Item${selectedItems.size !== 1 ? 's' : ''}`
                    }
                  </span>
                  {totalIssues > 0 && selectedItems.size > 0 && (
                    <span className="text-xs bg-yellow-200 text-yellow-800 px-2 py-1 rounded-full ml-2">
                      {hasErrors ? `${totalIssues} issues` : `${totalIssues} warnings`}
                    </span>
                  )}
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Bulk Actions Bar */}
      {showBulkActions && selectedItems.size > 0 && (
        <div className="bg-blue-50 border-b border-blue-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-blue-700">
                {selectedItems.size} items selected
              </span>
              <div className="flex items-center space-x-3">
                <button
                  onClick={() => handleBulkClassification('document')}
                  className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 transition-colors"
                >
                  Set as Documents
                </button>
                <button
                  onClick={() => handleBulkClassification('inventory')}
                  className="px-3 py-1 bg-purple-600 text-white rounded text-sm hover:bg-purple-700 transition-colors"
                >
                  Set as Inventory
                </button>
                <button
                  onClick={() => {
                    setSelectedItems(new Set());
                    setShowBulkActions(false);
                  }}
                  className="px-3 py-1 bg-gray-600 text-white rounded text-sm hover:bg-gray-700 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar */}
          <div className="lg:col-span-1">
            <div className="space-y-6">
              {/* Search */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search items..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Filters */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                <h3 className="text-sm font-medium text-gray-900 mb-3 flex items-center">
                  <Filter className="h-4 w-4 mr-2" />
                  Filters
                </h3>
                <div className="space-y-2">
                  {filters.map((filter) => (
                    <button
                      key={filter.id}
                      onClick={() => setActiveFilter(filter.id)}
                      className={clsx(
                        'w-full flex items-center justify-between px-3 py-2 text-sm rounded-lg transition-colors',
                        activeFilter === filter.id
                          ? 'bg-blue-100 text-blue-700'
                          : 'text-gray-600 hover:bg-gray-100'
                      )}
                    >
                      <span>{filter.label}</span>
                      <span className={clsx(
                        'text-xs px-2 py-1 rounded-full',
                        activeFilter === filter.id
                          ? 'bg-blue-200 text-blue-800'
                          : 'bg-gray-200 text-gray-600'
                      )}>
                        {filter.count}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Sort */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                <h3 className="text-sm font-medium text-gray-900 mb-3">Sort By</h3>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortType)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="name">Name</option>
                  <option value="type">Type</option>
                  <option value="confidence">Confidence</option>
                  <option value="created">Date Created</option>
                  <option value="modified">Date Modified</option>
                </select>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3">
            <div className="space-y-6">
              {/* Summary */}
              <PreviewSummary session={session} />

              {/* Selection Notice */}
              {selectedItems.size === 0 && (
                <div className="bg-blue-50 border-l-4 border-blue-400 p-4 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <Info className="h-5 w-5 text-blue-400 mr-3" />
                      <p className="text-sm text-blue-700">
                        Please select items to import by checking the boxes on each card
                      </p>
                    </div>
                    <button
                      onClick={handleSelectAll}
                      className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
                    >
                      Select All
                    </button>
                  </div>
                </div>
              )}

              {/* Controls */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <span className="text-sm text-gray-600">
                      Showing {filteredAndSortedItems.length} of {session.totalItems} items
                    </span>
                    {selectedItems.size > 0 && (
                      <span className="text-sm font-medium text-blue-600">
                        {selectedItems.size} selected
                      </span>
                    )}
                  </div>

                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={selectedItems.size === filteredAndSortedItems.length && filteredAndSortedItems.length > 0}
                      onChange={handleSelectAll}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-600">Select all visible</span>
                  </div>
                </div>
              </div>

              {/* Items Grid */}
              <div className="space-y-4">
                {filteredAndSortedItems.length === 0 ? (
                  <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
                    <div className="text-gray-400 mb-4">
                      {searchQuery || activeFilter !== 'all' ? (
                        <Search className="h-12 w-12 mx-auto" />
                      ) : (
                        <FileText className="h-12 w-12 mx-auto" />
                      )}
                    </div>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                      {searchQuery || activeFilter !== 'all' ? 'No items match your filters' : 'No items found'}
                    </h3>
                    <p className="text-gray-600">
                      {searchQuery || activeFilter !== 'all' 
                        ? 'Try adjusting your search or filter criteria'
                        : 'There are no items to preview in this session'
                      }
                    </p>
                  </div>
                ) : (
                  filteredAndSortedItems.map((item) => (
                    <div key={item.id} className="relative">
                      <div className="absolute left-4 top-4 z-10">
                        <input
                          type="checkbox"
                          checked={selectedItems.has(item.id)}
                          onChange={(e) => {
                            const newSelected = new Set(selectedItems);
                            if (e.target.checked) {
                              newSelected.add(item.id);
                            } else {
                              newSelected.delete(item.id);
                            }
                            setSelectedItems(newSelected);
                          }}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                      </div>
                      <PreviewCard
                        item={item}
                        onClassificationChange={onClassificationChange}
                        onItemClick={setDetailItem}
                      />
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Detail Modal */}
      <ItemDetailModal
        item={detailItem}
        isOpen={detailItem !== null}
        onClose={() => setDetailItem(null)}
        onClassificationChange={onClassificationChange}
      />

      {/* Import Progress Modal */}
      <ImportProgressModal
        isOpen={isImporting}
        progress={importProgress}
        onClose={() => {
          setIsImporting(false);
          setImportProgress(null);
        }}
      />
    </div>
  );
}