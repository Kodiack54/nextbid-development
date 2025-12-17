'use client';

import { useState, useEffect } from 'react';
import { Database, Table, ChevronRight, ChevronDown, ChevronUp, Copy, Check, RefreshCw, FolderOpen, Shield, Key, Layers } from 'lucide-react';

interface ProjectPath {
  id: string;
  project_id: string;
  path: string;
  label: string;
  sort_order: number;
  created_at: string;
}

interface ColumnInfo {
  column_name: string;
  data_type: string;
  is_nullable: boolean;
  column_default?: string;
  is_primary?: boolean;
  is_foreign?: boolean;
  references?: string;
}

interface TableInfo {
  table_name: string;
  schema: string;
  row_count?: number;
  columns?: ColumnInfo[];
  indexes?: Array<{
    name: string;
    columns: string[];
    unique: boolean;
  }>;
}

interface SchemaInfo {
  schema_name: string;
  owner: string;
  table_count: number;
}

interface RLSPolicy {
  policy_name: string;
  table_name: string;
  command: string;
  roles: string[];
  using_expression?: string;
  with_check_expression?: string;
}

interface DatabaseTabProps {
  projectPath: string;
  projectId: string;
}

type ActiveTab = 'tables' | 'schemas' | 'rls';

export default function DatabaseTab({ projectPath, projectId }: DatabaseTabProps) {
  const [projectPaths, setProjectPaths] = useState<ProjectPath[]>([]);
  const [selectedPath, setSelectedPath] = useState<ProjectPath | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>('tables');

  // Tables state
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [expandedTable, setExpandedTable] = useState<string | null>(null);
  const [tableFilter, setTableFilter] = useState('');

  // Schemas state
  const [schemas, setSchemas] = useState<SchemaInfo[]>([]);

  // RLS state
  const [policies, setPolicies] = useState<RLSPolicy[]>([]);
  const [policyFilter, setPolicyFilter] = useState('');

  const [isLoading, setIsLoading] = useState(true);
  const [copiedTable, setCopiedTable] = useState<string | null>(null);

  // Fetch project paths
  useEffect(() => {
    fetchProjectPaths();
  }, [projectId]);

  // Fetch data when path or tab changes
  useEffect(() => {
    if (selectedPath) {
      fetchData();
    }
  }, [selectedPath, activeTab]);

  const fetchProjectPaths = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/project-paths?project_id=${projectId}`);
      const data = await response.json();
      if (data.success) {
        setProjectPaths(data.paths || []);
        const mainPath = data.paths?.find((p: ProjectPath) => p.path === projectPath);
        if (mainPath) {
          setSelectedPath(mainPath);
        } else if (data.paths?.length > 0) {
          setSelectedPath(data.paths[0]);
        }
      }
    } catch (error) {
      console.error('Error fetching project paths:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const moveFolder = async (folderId: string, direction: 'up' | 'down') => {
    const currentIndex = projectPaths.findIndex(p => p.id === folderId);
    if (currentIndex === -1) return;
    const swapIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (swapIndex < 0 || swapIndex >= projectPaths.length) return;
    const currentFolder = projectPaths[currentIndex];
    const swapFolder = projectPaths[swapIndex];
    const newPaths = [...projectPaths];
    newPaths[currentIndex] = { ...swapFolder, sort_order: currentFolder.sort_order };
    newPaths[swapIndex] = { ...currentFolder, sort_order: swapFolder.sort_order };
    newPaths.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
    setProjectPaths(newPaths);
    try {
      await Promise.all([
        fetch('/api/project-paths', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: currentFolder.id, sort_order: swapFolder.sort_order || swapIndex }) }),
        fetch('/api/project-paths', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: swapFolder.id, sort_order: currentFolder.sort_order || currentIndex }) }),
      ]);
    } catch (error) { console.error('Error moving folder:', error); fetchProjectPaths(); }
  };

  const fetchData = async () => {
    if (!selectedPath) return;
    setIsLoading(true);

    try {
      const cleanPath = selectedPath.path.startsWith('/') ? selectedPath.path.slice(1) : selectedPath.path;

      if (activeTab === 'tables') {
        const response = await fetch(`/api/clair/database/${cleanPath}/tables`);
        const data = await response.json();
        if (data.success) {
          setTables(data.tables || []);
        }
      } else if (activeTab === 'schemas') {
        const response = await fetch(`/api/clair/database/${cleanPath}/schemas`);
        const data = await response.json();
        if (data.success) {
          setSchemas(data.schemas || []);
        }
      } else if (activeTab === 'rls') {
        const response = await fetch(`/api/clair/database/${cleanPath}/rls`);
        const data = await response.json();
        if (data.success) {
          setPolicies(data.policies || []);
        }
      }
    } catch (error) {
      console.error('Error fetching database data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchTableColumns = async (tableName: string) => {
    if (!selectedPath) return;
    try {
      const cleanPath = selectedPath.path.startsWith('/') ? selectedPath.path.slice(1) : selectedPath.path;
      const response = await fetch(`/api/clair/database/${cleanPath}/table/${tableName}/columns`);
      const data = await response.json();
      if (data.success) {
        setTables(prev => prev.map(t =>
          t.table_name === tableName ? { ...t, columns: data.columns, indexes: data.indexes } : t
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
      if (col.is_primary) line += ' PRIMARY KEY';
      if (col.references) line += ` REFERENCES ${col.references}`;
      return line;
    });

    return `CREATE TABLE ${table.schema ? `${table.schema}.` : ''}${table.table_name} (\n${columns.join(',\n')}\n);`;
  };

  const copyToClipboard = async (table: TableInfo) => {
    const sql = generateCreateStatement(table);
    await navigator.clipboard.writeText(sql);
    setCopiedTable(table.table_name);
    setTimeout(() => setCopiedTable(null), 2000);
  };

  const filteredTables = tables.filter(t =>
    t.table_name.toLowerCase().includes(tableFilter.toLowerCase())
  );

  const filteredPolicies = policies.filter(p =>
    p.policy_name.toLowerCase().includes(policyFilter.toLowerCase()) ||
    p.table_name.toLowerCase().includes(policyFilter.toLowerCase())
  );

  if (isLoading && !selectedPath) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="w-6 h-6 text-blue-400 animate-spin" />
      </div>
    );
  }

  const tabs = [
    { id: 'tables' as ActiveTab, label: 'Tables', icon: Table, count: tables.length },
    { id: 'schemas' as ActiveTab, label: 'Schemas', icon: Layers, count: schemas.length },
    { id: 'rls' as ActiveTab, label: 'RLS Policies', icon: Shield, count: policies.length },
  ];

  return (
    <div className="flex h-full gap-4">
      {/* Left Panel - Project Folders */}
      <div className="w-64 flex-shrink-0 bg-gray-800 border border-gray-700 rounded-lg overflow-hidden">
        <div className="p-3 border-b border-gray-700">
          <h3 className="text-white font-semibold text-sm">Project Folders</h3>
        </div>

        <div className="overflow-y-auto max-h-[calc(100vh-300px)]">
          {projectPaths.length === 0 ? (
            <div className="p-4 text-center text-gray-500 text-sm">
              <FolderOpen className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>No folders linked</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-700">
              {projectPaths.map((path, index) => (
                <div
                  key={path.id}
                  className={`p-3 cursor-pointer group ${
                    selectedPath?.id === path.id
                      ? 'bg-blue-600/20 border-l-2 border-blue-500'
                      : 'hover:bg-gray-750'
                  }`}
                  onClick={() => setSelectedPath(path)}
                >
                  <div className="flex items-center gap-2">
                    <div className="flex flex-col opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => { e.stopPropagation(); moveFolder(path.id, 'up'); }}
                        disabled={index === 0}
                        className={`p-0.5 rounded ${index === 0 ? 'text-gray-700' : 'text-gray-500 hover:text-white hover:bg-gray-600'}`}
                      ><ChevronUp className="w-3 h-3" /></button>
                      <button
                        onClick={(e) => { e.stopPropagation(); moveFolder(path.id, 'down'); }}
                        disabled={index === projectPaths.length - 1}
                        className={`p-0.5 rounded ${index === projectPaths.length - 1 ? 'text-gray-700' : 'text-gray-500 hover:text-white hover:bg-gray-600'}`}
                      ><ChevronDown className="w-3 h-3" /></button>
                    </div>
                    <FolderOpen className={`w-4 h-4 ${
                      selectedPath?.id === path.id ? 'text-blue-400' : 'text-yellow-400'
                    }`} />
                    <span className="text-white font-medium text-sm flex-1">{path.label}</span>
                  </div>
                  <p className="text-gray-600 text-[10px] font-mono mt-1 pl-12 truncate">
                    {path.path.split('/').pop()}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right Panel - Database Content */}
      <div className="flex-1 bg-gray-800 border border-gray-700 rounded-lg overflow-hidden flex flex-col">
        {selectedPath ? (
          <>
            {/* Header with Tabs */}
            <div className="border-b border-gray-700">
              <div className="p-3 flex items-center justify-between">
                <div>
                  <h3 className="text-white font-semibold text-sm flex items-center gap-2">
                    <Database className="w-4 h-4 text-blue-400" />
                    {selectedPath.label} Database
                  </h3>
                </div>
                <button
                  onClick={fetchData}
                  disabled={isLoading}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded text-sm"
                >
                  <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                  Refresh
                </button>
              </div>

              {/* Tabs */}
              <div className="flex border-t border-gray-700">
                {tabs.map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                      activeTab === tab.id
                        ? 'text-blue-400 border-blue-400 bg-gray-750'
                        : 'text-gray-400 border-transparent hover:text-white hover:bg-gray-750'
                    }`}
                  >
                    <tab.icon className="w-4 h-4" />
                    {tab.label}
                    <span className={`px-1.5 py-0.5 rounded text-xs ${
                      activeTab === tab.id ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-400'
                    }`}>
                      {tab.count}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-3">
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <RefreshCw className="w-6 h-6 text-blue-400 animate-spin" />
                </div>
              ) : (
                <>
                  {/* Tables Tab */}
                  {activeTab === 'tables' && (
                    <div>
                      {/* Search */}
                      <div className="mb-3">
                        <input
                          type="text"
                          value={tableFilter}
                          onChange={(e) => setTableFilter(e.target.value)}
                          placeholder="Filter tables..."
                          className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded text-white text-sm placeholder-gray-500"
                        />
                      </div>

                      {filteredTables.length === 0 ? (
                        <div className="text-center py-12 text-gray-500">
                          <Database className="w-12 h-12 mx-auto mb-3 opacity-50" />
                          <p>No tables found</p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {filteredTables.map(table => (
                            <div
                              key={table.table_name}
                              className="bg-gray-750 border border-gray-700 rounded-lg overflow-hidden"
                            >
                              {/* Table Header */}
                              <div className="flex items-center justify-between p-3 hover:bg-gray-700 transition-colors">
                                <button
                                  onClick={() => handleToggleTable(table.table_name)}
                                  className="flex items-center gap-3 flex-1 text-left"
                                >
                                  {expandedTable === table.table_name ? (
                                    <ChevronDown className="w-4 h-4 text-gray-500" />
                                  ) : (
                                    <ChevronRight className="w-4 h-4 text-gray-500" />
                                  )}
                                  <Table className="w-4 h-4 text-blue-400" />
                                  <span className="text-white font-mono text-sm">{table.table_name}</span>
                                  {table.schema && table.schema !== 'public' && (
                                    <span className="text-gray-500 text-xs">({table.schema})</span>
                                  )}
                                  {table.row_count !== undefined && (
                                    <span className="text-gray-500 text-xs ml-auto">{table.row_count.toLocaleString()} rows</span>
                                  )}
                                </button>

                                {table.columns && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      copyToClipboard(table);
                                    }}
                                    className="flex items-center gap-1 px-2 py-1 text-gray-400 hover:text-white hover:bg-gray-600 rounded text-xs ml-2"
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
                                <div className="border-t border-gray-700 p-3 bg-gray-800">
                                  {table.columns ? (
                                    <div className="space-y-1">
                                      {table.columns.map(col => (
                                        <div
                                          key={col.column_name}
                                          className="flex items-center justify-between py-1.5 px-2 hover:bg-gray-750 rounded"
                                        >
                                          <div className="flex items-center gap-2">
                                            {col.is_primary && <Key className="w-3 h-3 text-yellow-400" />}
                                            <span className="text-gray-300 font-mono text-sm">{col.column_name}</span>
                                          </div>
                                          <div className="flex items-center gap-2">
                                            <span className="text-blue-400 text-xs font-mono">{col.data_type}</span>
                                            {!col.is_nullable && (
                                              <span className="text-red-400 text-xs">NOT NULL</span>
                                            )}
                                            {col.column_default && (
                                              <span className="text-gray-500 text-xs truncate max-w-[150px]" title={col.column_default}>
                                                = {col.column_default}
                                              </span>
                                            )}
                                            {col.references && (
                                              <span className="text-purple-400 text-xs">→ {col.references}</span>
                                            )}
                                          </div>
                                        </div>
                                      ))}

                                      {/* Indexes */}
                                      {table.indexes && table.indexes.length > 0 && (
                                        <div className="mt-3 pt-3 border-t border-gray-700">
                                          <span className="text-gray-500 text-xs font-medium">Indexes</span>
                                          <div className="mt-2 space-y-1">
                                            {table.indexes.map(idx => (
                                              <div key={idx.name} className="flex items-center gap-2 text-xs">
                                                <span className="text-gray-400 font-mono">{idx.name}</span>
                                                <span className="text-gray-600">({idx.columns.join(', ')})</span>
                                                {idx.unique && <span className="text-yellow-400">UNIQUE</span>}
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      )}

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
                                    <div className="flex items-center justify-center py-4">
                                      <RefreshCw className="w-4 h-4 text-blue-400 animate-spin mr-2" />
                                      <span className="text-gray-500 text-sm">Loading columns...</span>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Schemas Tab */}
                  {activeTab === 'schemas' && (
                    <div>
                      {schemas.length === 0 ? (
                        <div className="text-center py-12 text-gray-500">
                          <Layers className="w-12 h-12 mx-auto mb-3 opacity-50" />
                          <p>No schemas found</p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {schemas.map(schema => (
                            <div
                              key={schema.schema_name}
                              className="bg-gray-750 border border-gray-700 rounded-lg p-4"
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <Layers className="w-5 h-5 text-purple-400" />
                                  <span className="text-white font-mono text-sm">{schema.schema_name}</span>
                                </div>
                                <div className="flex items-center gap-4 text-sm">
                                  <span className="text-gray-500">
                                    Owner: <span className="text-gray-300">{schema.owner}</span>
                                  </span>
                                  <span className="text-gray-500">
                                    Tables: <span className="text-blue-400">{schema.table_count}</span>
                                  </span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* RLS Policies Tab */}
                  {activeTab === 'rls' && (
                    <div>
                      {/* Search */}
                      <div className="mb-3">
                        <input
                          type="text"
                          value={policyFilter}
                          onChange={(e) => setPolicyFilter(e.target.value)}
                          placeholder="Filter policies..."
                          className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded text-white text-sm placeholder-gray-500"
                        />
                      </div>

                      {filteredPolicies.length === 0 ? (
                        <div className="text-center py-12 text-gray-500">
                          <Shield className="w-12 h-12 mx-auto mb-3 opacity-50" />
                          <p>No RLS policies found</p>
                          <p className="text-xs mt-1">Row-Level Security policies control access to table rows</p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {filteredPolicies.map(policy => (
                            <div
                              key={`${policy.table_name}-${policy.policy_name}`}
                              className="bg-gray-750 border border-gray-700 rounded-lg p-4"
                            >
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-3">
                                  <Shield className="w-4 h-4 text-green-400" />
                                  <span className="text-white font-medium text-sm">{policy.policy_name}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="px-2 py-0.5 bg-blue-600/20 text-blue-400 rounded text-xs">
                                    {policy.table_name}
                                  </span>
                                  <span className={`px-2 py-0.5 rounded text-xs ${
                                    policy.command === 'ALL' ? 'bg-purple-600/20 text-purple-400' :
                                    policy.command === 'SELECT' ? 'bg-green-600/20 text-green-400' :
                                    policy.command === 'INSERT' ? 'bg-yellow-600/20 text-yellow-400' :
                                    policy.command === 'UPDATE' ? 'bg-orange-600/20 text-orange-400' :
                                    'bg-red-600/20 text-red-400'
                                  }`}>
                                    {policy.command}
                                  </span>
                                </div>
                              </div>

                              <div className="text-xs space-y-2 mt-3">
                                {policy.roles && policy.roles.length > 0 && (
                                  <div>
                                    <span className="text-gray-500">Roles: </span>
                                    <span className="text-gray-300">{policy.roles.join(', ')}</span>
                                  </div>
                                )}
                                {policy.using_expression && (
                                  <div>
                                    <span className="text-gray-500">USING: </span>
                                    <code className="text-green-400 font-mono bg-gray-900 px-1 rounded">
                                      {policy.using_expression}
                                    </code>
                                  </div>
                                )}
                                {policy.with_check_expression && (
                                  <div>
                                    <span className="text-gray-500">WITH CHECK: </span>
                                    <code className="text-yellow-400 font-mono bg-gray-900 px-1 rounded">
                                      {policy.with_check_expression}
                                    </code>
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center h-full text-gray-500">
            <div className="text-center">
              <FolderOpen className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>Select a folder to view database</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
