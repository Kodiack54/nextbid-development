'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';

interface Project {
  id: string;
  name: string;
  table_prefix?: string;
  database_schema?: Record<string, { columns: string[]; types: Record<string, string> }>;
}

interface SchemaPanelProps {
  project: Project | null;
  isOpen: boolean;
}

export function SchemaPanel({ project, isOpen }: SchemaPanelProps) {
  const [allProjects, setAllProjects] = useState<Project[]>([]);
  const [selectedPrefix, setSelectedPrefix] = useState<string | null>(null);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  // Separate open state for popups (they stay open independently)
  const [tablesPopupOpen, setTablesPopupOpen] = useState(false);
  const [columnsPopupOpen, setColumnsPopupOpen] = useState(false);
  const [tablesPopupData, setTablesPopupData] = useState<{ prefix: string; schema: Record<string, { columns: string[]; types: Record<string, string> }> } | null>(null);
  const [columnsPopupData, setColumnsPopupData] = useState<{ tableName: string; schema: { columns: string[]; types: Record<string, string> } } | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isRescanning, setIsRescanning] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [refreshMessage, setRefreshMessage] = useState<string | null>(null);

  // Fetch all projects to get all prefixes (uses cached schema)
  const fetchProjects = async () => {
    setIsRefreshing(true);
    try {
      const res = await fetch('/api/projects');
      const data = await res.json();
      if (data.success) {
        setAllProjects(data.projects);
        setLastRefresh(new Date());
      }
    } finally {
      setIsRefreshing(false);
    }
  };

  // Rescan database and refresh schema (calls Supabase to get fresh data)
  const rescanSchema = async () => {
    setIsRescanning(true);
    setRefreshMessage(null);
    try {
      const res = await fetch('/api/refresh-schema', { method: 'POST' });
      const data = await res.json();
      console.log('Rescan response:', data); // Debug log
      if (data.success) {
        setRefreshMessage(`Found ${data.dev_tables_found || 0} tables`);
        // Now fetch the updated projects
        await fetchProjects();
      } else {
        // Show more detailed error
        const debugInfo = data.debug ? ` (${data.debug.projects_found} projects, RPC: ${data.debug.rpc_error || 'ok'})` : '';
        setRefreshMessage(`${data.error || 'Refresh failed'}${debugInfo}`);
        console.error('Rescan failed:', data);
      }
    } catch (error) {
      console.error('Rescan error:', error);
      setRefreshMessage('Error refreshing schema');
    } finally {
      setIsRescanning(false);
    }
  };

  // Auto-refresh when panel opens
  useEffect(() => {
    if (isOpen) {
      fetchProjects();
    }
  }, [isOpen]);

  // Get unique prefixes from all projects (deduplicated)
  const prefixMap = new Map<string, { prefix: string; name: string; tableCount: number; schema: Record<string, { columns: string[]; types: Record<string, string> }> }>();

  allProjects
    .filter(p => p.table_prefix && p.database_schema)
    .forEach(p => {
      // Only add if we haven't seen this prefix yet (first project wins)
      if (!prefixMap.has(p.table_prefix!)) {
        prefixMap.set(p.table_prefix!, {
          prefix: p.table_prefix!,
          name: p.name,
          tableCount: Object.keys(p.database_schema || {}).length,
          schema: p.database_schema!
        });
      }
    });

  const prefixes = Array.from(prefixMap.values());

  // Handler for opening tables popup
  const handlePrefixClick = (prefix: string) => {
    const prefixData = prefixes.find(p => p.prefix === prefix);
    if (prefixData) {
      setSelectedPrefix(prefix);
      setTablesPopupData({ prefix, schema: prefixData.schema });
      setTablesPopupOpen(true);
    }
  };

  // Handler for opening columns popup
  const handleTableClick = (tableName: string) => {
    if (tablesPopupData) {
      const tableSchema = tablesPopupData.schema[tableName];
      if (tableSchema) {
        setSelectedTable(tableName);
        setColumnsPopupData({ tableName, schema: tableSchema });
        setColumnsPopupOpen(true);
      }
    }
  };

  // Get tables for the open popup
  const tables = tablesPopupData ? Object.entries(tablesPopupData.schema) : [];

  // Find the slot to render panel content into
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      const slot = document.getElementById('schema-panel-slot');
      setPortalTarget(slot);
    } else {
      setPortalTarget(null);
    }
  }, [isOpen]);

  // Panel content (only shown when panel is open)
  const panelContent = (
    <div className="text-sm">
      <div className="flex items-center justify-between mb-2">
        <div className="text-gray-400">Database Prefixes</div>
        <span className="text-xs text-gray-500">{prefixes.length} schemas</span>
      </div>

      {prefixes.length === 0 ? (
        <div className="text-gray-500 text-xs space-y-2">
          <p>No schemas loaded yet.</p>
          <p>Click <span className="text-blue-400">Rescan DB</span> below to scan for tables.</p>
        </div>
      ) : (
        <div className="space-y-1">
          {prefixes.map(({ prefix, name, tableCount }) => (
            <button
              key={prefix}
              onClick={() => handlePrefixClick(prefix)}
              className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-left ${
                selectedPrefix === prefix ? 'bg-blue-600' : 'bg-gray-800 hover:bg-gray-700'
              }`}
            >
              <span className="text-yellow-400">📁</span>
              <div className="flex-1 min-w-0">
                <div className="text-yellow-400 font-mono text-xs">{prefix}_</div>
                <div className="text-gray-500 text-[10px] truncate">{name}</div>
              </div>
              <span className="text-gray-500 text-xs">{tableCount}</span>
            </button>
          ))}
        </div>
      )}

      <div className="mt-3 pt-2 border-t border-gray-700 space-y-2">
        <div className="flex gap-1">
          <button
            onClick={fetchProjects}
            disabled={isRefreshing || isRescanning}
            className="flex-1 px-2 py-1 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 text-gray-300 text-xs rounded flex items-center justify-center gap-1"
            title="Refresh from cache"
          >
            <span className={isRefreshing ? 'animate-spin' : ''}>🔄</span>
            {isRefreshing ? '...' : 'Refresh'}
          </button>
          <button
            onClick={rescanSchema}
            disabled={isRefreshing || isRescanning}
            className="flex-1 px-2 py-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-800 text-white text-xs rounded flex items-center justify-center gap-1"
            title="Rescan database for new tables"
          >
            <span className={isRescanning ? 'animate-spin' : ''}>🗄️</span>
            {isRescanning ? 'Scanning...' : 'Rescan DB'}
          </button>
        </div>
        {refreshMessage && (
          <div className="text-center text-[10px] text-green-400">
            {refreshMessage}
          </div>
        )}
        {lastRefresh && (
          <div className="text-center text-[10px] text-gray-600">
            Last: {lastRefresh.toLocaleTimeString()}
          </div>
        )}
      </div>

    </div>
  );

  // Popups are rendered separately and always persist
  const popups = (
    <>
      {/* Tables Popup (Level 2) - stays open independently */}
      {tablesPopupOpen && tablesPopupData && (
        <TablesPopup
          prefix={tablesPopupData.prefix}
          tables={tables}
          onSelectTable={handleTableClick}
          selectedTable={selectedTable}
          onClose={() => {
            setTablesPopupOpen(false);
            setSelectedPrefix(null);
          }}
        />
      )}

      {/* Columns Popup (Level 3) - stays open independently */}
      {columnsPopupOpen && columnsPopupData && (
        <TableColumnsPopup
          tableName={columnsPopupData.tableName}
          schema={columnsPopupData.schema}
          onClose={() => {
            setColumnsPopupOpen(false);
            setSelectedTable(null);
          }}
        />
      )}
    </>
  );

  return (
    <>
      {/* Panel content renders into slot via portal when open */}
      {portalTarget && createPortal(panelContent, portalTarget)}

      {/* Popups always render directly (they use fixed positioning) */}
      {popups}
    </>
  );
}

// Custom hook for draggable functionality
function useDraggable(initialPosition: { x: number; y: number }) {
  const [position, setPosition] = useState(initialPosition);
  const [isDragging, setIsDragging] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    // Only drag from the header
    if ((e.target as HTMLElement).closest('.drag-handle')) {
      setIsDragging(true);
      dragOffset.current = {
        x: e.clientX - position.x,
        y: e.clientY - position.y
      };
      e.preventDefault();
    }
  }, [position]);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      setPosition({
        x: e.clientX - dragOffset.current.x,
        y: e.clientY - dragOffset.current.y
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  return { position, isDragging, handleMouseDown };
}

// Level 2: Tables popup for a selected prefix
function TablesPopup({ prefix, tables, onSelectTable, selectedTable, onClose }: {
  prefix: string;
  tables: [string, { columns: string[]; types: Record<string, string> }][];
  onSelectTable: (name: string) => void;
  selectedTable: string | null;
  onClose: () => void;
}) {
  const { position, isDragging, handleMouseDown } = useDraggable({ x: 360, y: 80 });

  return (
    <div
      className="fixed w-80 bg-gray-800 border border-gray-600 rounded-lg shadow-2xl z-50"
      style={{
        left: position.x,
        top: position.y,
        cursor: isDragging ? 'grabbing' : 'default'
      }}
      onMouseDown={handleMouseDown}
    >
      <div className="drag-handle flex items-center justify-between px-3 py-2 border-b border-gray-700 bg-gray-750 cursor-grab active:cursor-grabbing rounded-t-lg">
        <div className="flex items-center gap-2">
          <span className="text-gray-500 text-xs">⋮⋮</span>
          <span className="text-yellow-400">📁</span>
          <span className="text-yellow-400 font-mono text-sm">{prefix}_</span>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onClose(); }}
          className="text-gray-400 hover:text-white text-lg hover:bg-gray-600 rounded px-1"
        >
          ✕
        </button>
      </div>

      <div className="p-2 max-h-[70vh] overflow-auto space-y-1">
        {tables.map(([tableName, schema]) => (
          <button
            key={tableName}
            onClick={() => onSelectTable(tableName)}
            className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-left ${
              selectedTable === tableName ? 'bg-blue-600' : 'hover:bg-gray-700'
            }`}
          >
            <span className="text-green-400">⊞</span>
            <span className="text-green-400 font-mono text-xs truncate flex-1">
              {tableName.replace(prefix + '_', '')}
            </span>
            <span className="text-gray-500 text-xs">{schema.columns?.length || 0}</span>
          </button>
        ))}
      </div>

      <div className="px-3 py-2 border-t border-gray-700 bg-gray-750 text-xs text-gray-500 rounded-b-lg">
        {tables.length} tables · Drag header to move
      </div>
    </div>
  );
}

// Level 3: Popup showing table columns - positioned next to the tables popup
function TableColumnsPopup({ tableName, schema, onClose }: {
  tableName: string;
  schema: { columns: string[]; types: Record<string, string> };
  onClose: () => void;
}) {
  const { position, isDragging, handleMouseDown } = useDraggable({ x: 660, y: 80 });
  const columns = schema.columns || [];
  const types = schema.types || {};

  return (
    <div
      className="fixed w-96 bg-gray-800 border border-gray-600 rounded-lg shadow-2xl z-50"
      style={{
        left: position.x,
        top: position.y,
        cursor: isDragging ? 'grabbing' : 'default'
      }}
      onMouseDown={handleMouseDown}
    >
      <div className="drag-handle flex items-center justify-between px-3 py-2 border-b border-gray-700 bg-gray-750 cursor-grab active:cursor-grabbing rounded-t-lg">
        <div className="flex items-center gap-2">
          <span className="text-gray-500 text-xs">⋮⋮</span>
          <span className="text-green-400">⊞</span>
          <span className="text-white font-mono text-sm truncate max-w-[250px]">{tableName}</span>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onClose(); }}
          className="text-gray-400 hover:text-white text-lg hover:bg-gray-600 rounded px-1"
        >
          ✕
        </button>
      </div>

      <div className="p-2 max-h-[70vh] overflow-auto">
        <table className="w-full">
          <thead>
            <tr className="text-xs text-gray-500 border-b border-gray-700">
              <th className="text-left py-1 px-2">Column</th>
              <th className="text-left py-1 px-2">Type</th>
            </tr>
          </thead>
          <tbody>
            {columns.map((col: string, i: number) => (
              <tr key={col} className={`text-xs ${i % 2 === 0 ? 'bg-gray-800' : 'bg-gray-750'}`}>
                <td className="py-1.5 px-2">
                  <span className="text-gray-200 font-mono">{col}</span>
                </td>
                <td className="py-1.5 px-2">
                  <span className="text-blue-400 font-mono text-[11px]">
                    {formatType(types[col])}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="px-3 py-2 border-t border-gray-700 bg-gray-750 text-xs text-gray-500 rounded-b-lg">
        {columns.length} columns · Drag header to move
      </div>
    </div>
  );
}

// Format SQL types to be more readable
function formatType(type: string | undefined): string {
  if (!type) return '';
  return type
    .replace('character varying', 'varchar')
    .replace('timestamp with time zone', 'timestamptz')
    .replace('timestamp without time zone', 'timestamp')
    .replace('double precision', 'double')
    .replace('boolean', 'bool');
}
