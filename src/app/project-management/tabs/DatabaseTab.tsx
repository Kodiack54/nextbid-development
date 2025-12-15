'use client';

import { useState, useEffect } from 'react';
import { Database, Table, ChevronRight, Copy, Check, RefreshCw } from 'lucide-react';

interface TableInfo {
  table_name: string;
  row_count?: number;
  columns?: Array<{
    column_name: string;
    data_type: string;
    is_nullable: boolean;
    column_default?: string;
  }>;
}

interface DatabaseTabProps {
  projectPath: string;
  tablePrefix?: string;
}

export default function DatabaseTab({ projectPath, tablePrefix }: DatabaseTabProps) {
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedTable, setExpandedTable] = useState<string | null>(null);
  const [copiedTable, setCopiedTable] = useState<string | null>(null);

  useEffect(() => {
    fetchTables();
  }, [projectPath, tablePrefix]);

  const fetchTables = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (tablePrefix) params.set('prefix', tablePrefix);

      const response = await fetch(`/api/susan/tables?${params.toString()}`);
      const data = await response.json();
      if (data.success) {
        setTables(data.tables || []);
      }
    } catch (error) {
      console.error('Error fetching tables:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchTableColumns = async (tableName: string) => {
    try {
      const response = await fetch(`/api/susan/table/${tableName}/columns`);
      const data = await response.json();
      if (data.success) {
        setTables(prev => prev.map(t =>
          t.table_name === tableName ? { ...t, columns: data.columns } : t
        ));
      }
    } catch (error) {
      console.error('Error fetching columns:', error);
    }
  };

  const handleToggleTable = (tableName: string) => {
    if (expandedTable === tableName) {
      setExpandedTable(null);
    } else {
      setExpandedTable(tableName);
      const table = tables.find(t => t.table_name === tableName);
      if (!table?.columns) {
        fetchTableColumns(tableName);
      }
    }
  };

  const generateCreateStatement = (table: TableInfo): string => {
    if (!table.columns || table.columns.length === 0) {
      return `-- No column info available for ${table.table_name}`;
    }

    const columns = table.columns.map(col => {
      let line = `  ${col.column_name} ${col.data_type.toUpperCase()}`;
      if (!col.is_nullable) line += ' NOT NULL';
      if (col.column_default) line += ` DEFAULT ${col.column_default}`;
      return line;
    });

    return `CREATE TABLE ${table.table_name} (\n${columns.join(',\n')}\n);`;
  };

  const copyToClipboard = async (table: TableInfo) => {
    const sql = generateCreateStatement(table);
    await navigator.clipboard.writeText(sql);
    setCopiedTable(table.table_name);
    setTimeout(() => setCopiedTable(null), 2000);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin text-2xl">⏳</div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-white">Database Tables</h2>
          {tablePrefix && (
            <p className="text-gray-500 text-sm">Filtered by prefix: {tablePrefix}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-gray-400 text-sm">{tables.length} tables</span>
          <button
            onClick={fetchTables}
            className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Tables List */}
      {tables.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <Database className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>No tables found{tablePrefix ? ` with prefix "${tablePrefix}"` : ''}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {tables.map(table => (
            <div
              key={table.table_name}
              className="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden"
            >
              {/* Table Header */}
              <div className="flex items-center justify-between p-3 hover:bg-gray-750 transition-colors">
                <button
                  onClick={() => handleToggleTable(table.table_name)}
                  className="flex items-center gap-3 flex-1"
                >
                  <ChevronRight
                    className={`w-4 h-4 text-gray-500 transition-transform ${
                      expandedTable === table.table_name ? 'rotate-90' : ''
                    }`}
                  />
                  <Table className="w-4 h-4 text-blue-400" />
                  <span className="text-white font-mono text-sm">{table.table_name}</span>
                  {table.row_count !== undefined && (
                    <span className="text-gray-500 text-xs">({table.row_count} rows)</span>
                  )}
                </button>

                {/* Copy SQL button */}
                {table.columns && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      copyToClipboard(table);
                    }}
                    className="flex items-center gap-1 px-2 py-1 text-gray-400 hover:text-white hover:bg-gray-700 rounded text-xs"
                  >
                    {copiedTable === table.table_name ? (
                      <>
                        <Check className="w-3 h-3 text-green-400" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        SQL
                      </>
                    )}
                  </button>
                )}
              </div>

              {/* Expanded Columns */}
              {expandedTable === table.table_name && (
                <div className="border-t border-gray-700 p-3 bg-gray-850">
                  {table.columns ? (
                    <div className="space-y-1">
                      {table.columns.map(col => (
                        <div
                          key={col.column_name}
                          className="flex items-center justify-between py-1.5 px-2 hover:bg-gray-800 rounded"
                        >
                          <span className="text-gray-300 font-mono text-sm">{col.column_name}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-blue-400 text-xs font-mono">{col.data_type}</span>
                            {!col.is_nullable && (
                              <span className="text-red-400 text-xs">NOT NULL</span>
                            )}
                            {col.column_default && (
                              <span className="text-gray-500 text-xs">= {col.column_default}</span>
                            )}
                          </div>
                        </div>
                      ))}

                      {/* SQL Preview */}
                      <div className="mt-3 pt-3 border-t border-gray-700">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-gray-500 text-xs">CREATE TABLE Statement</span>
                          <button
                            onClick={() => copyToClipboard(table)}
                            className="flex items-center gap-1 text-gray-400 hover:text-white text-xs"
                          >
                            {copiedTable === table.table_name ? (
                              <>
                                <Check className="w-3 h-3 text-green-400" />
                                Copied
                              </>
                            ) : (
                              <>
                                <Copy className="w-3 h-3" />
                                Copy
                              </>
                            )}
                          </button>
                        </div>
                        <pre className="text-gray-400 font-mono text-xs bg-gray-900 p-2 rounded overflow-x-auto">
                          {generateCreateStatement(table)}
                        </pre>
                      </div>
                    </div>
                  ) : (
                    <div className="text-gray-500 text-sm text-center py-2">
                      Loading columns...
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
