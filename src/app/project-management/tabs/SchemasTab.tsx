'use client';

import { useState, useEffect } from 'react';
import { Database, Copy, Check } from 'lucide-react';
import { Schema } from '../types';

interface SchemasTabProps {
  projectPath: string;
}

export default function SchemasTab({ projectPath }: SchemasTabProps) {
  const [schemas, setSchemas] = useState<Schema[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    fetchSchemas();
  }, [projectPath]);

  const fetchSchemas = async () => {
    try {
      const response = await fetch(`/api/susan/schemas?project=${encodeURIComponent(projectPath)}`);
      const data = await response.json();
      if (data.success) {
        setSchemas(data.schemas || []);
      }
    } catch (error) {
      console.error('Error fetching schemas:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Group schemas by table
  const groupedSchemas = schemas.reduce((acc, schema) => {
    const key = `${schema.database_name}.${schema.table_name}`;
    if (!acc[key]) {
      acc[key] = {
        database_name: schema.database_name,
        table_name: schema.table_name,
        columns: [],
      };
    }
    acc[key].columns.push(schema);
    return acc;
  }, {} as Record<string, { database_name: string; table_name: string; columns: Schema[] }>);

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
        <h2 className="text-lg font-semibold text-white">Schema Definitions</h2>
        <span className="text-gray-400 text-sm">
          {Object.keys(groupedSchemas).length} tables
        </span>
      </div>

      {/* Schemas List */}
      {Object.keys(groupedSchemas).length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <Database className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>No schema definitions cataloged yet</p>
          <p className="text-sm mt-1">Susan will catalog schemas as she encounters them</p>
        </div>
      ) : (
        <div className="space-y-4">
          {Object.values(groupedSchemas).map(group => {
            const tableKey = `${group.database_name}.${group.table_name}`;
            const createStatement = generateCreateStatement(group);

            return (
              <div
                key={tableKey}
                className="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden"
              >
                <div className="flex items-center justify-between p-3 border-b border-gray-700">
                  <div className="flex items-center gap-2">
                    <Database className="w-4 h-4 text-blue-400" />
                    <span className="text-white font-mono text-sm">{tableKey}</span>
                  </div>
                  <button
                    onClick={() => copyToClipboard(createStatement, tableKey)}
                    className="flex items-center gap-1 px-2 py-1 text-gray-400 hover:text-white hover:bg-gray-700 rounded text-sm"
                  >
                    {copiedId === tableKey ? (
                      <>
                        <Check className="w-3 h-3 text-green-400" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        Copy SQL
                      </>
                    )}
                  </button>
                </div>
                <div className="p-3">
                  <pre className="text-gray-300 font-mono text-xs overflow-x-auto">
                    {createStatement}
                  </pre>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function generateCreateStatement(group: { table_name: string; columns: Schema[] }): string {
  const columns = group.columns.map(col => {
    let line = `  ${col.column_name} ${col.data_type.toUpperCase()}`;
    if (!col.is_nullable) line += ' NOT NULL';
    if (col.column_default) line += ` DEFAULT ${col.column_default}`;
    return line;
  });

  return `CREATE TABLE ${group.table_name} (\n${columns.join(',\n')}\n);`;
}
