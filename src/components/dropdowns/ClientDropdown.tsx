'use client';

import { useState, useEffect, useRef } from 'react';
import { Building2, ChevronDown } from 'lucide-react';

interface Client {
  id: string;
  slug: string;
  name: string;
  description: string;
  primary_color: string;
  is_active: boolean;
}

interface ClientDropdownProps {
  selectedClientId: string | null;
  onClientChange: (clientId: string | null) => void;
}

export function ClientDropdown({ selectedClientId, onClientChange }: ClientDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchClients();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchClients = async () => {
    try {
      const res = await fetch('/api/clients');
      const data = await res.json();
      if (data.success) {
        setClients(data.clients);
        // Auto-select first client if none selected
        if (!selectedClientId && data.clients.length > 0) {
          onClientChange(data.clients[0].id);
        }
      }
    } catch (error) {
      console.error('Failed to fetch clients:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const selectedClient = clients.find(c => c.id === selectedClientId);

  if (isLoading) {
    return (
      <div className="px-3 py-1.5 bg-gray-700 rounded-lg text-gray-400 text-sm">
        Loading...
      </div>
    );
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 border border-gray-600 rounded-lg text-white text-sm transition-colors"
        style={{ borderLeftColor: selectedClient?.primary_color || '#3B82F6', borderLeftWidth: '3px' }}
      >
        <Building2 size={16} className="text-gray-400" />
        <span>{selectedClient?.name || 'Select Client'}</span>
        <ChevronDown size={14} className={`text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-64 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-50 overflow-hidden">
          {clients.map(client => (
            <button
              key={client.id}
              onClick={() => {
                onClientChange(client.id);
                setIsOpen(false);
              }}
              className={`w-full px-3 py-2 text-left hover:bg-gray-700 transition-colors flex items-center gap-3 ${
                client.id === selectedClientId ? 'bg-gray-700' : ''
              }`}
            >
              <div
                className="w-2 h-8 rounded-full"
                style={{ backgroundColor: client.primary_color }}
              />
              <div>
                <div className="text-white text-sm font-medium">{client.name}</div>
                <div className="text-gray-500 text-xs">{client.description}</div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
