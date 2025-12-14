'use client';

import { useState, useEffect, useCallback } from 'react';
import { SidebarIcon } from './SidebarIcon';

export interface SidebarItem {
  id: string;
  icon: string | React.ReactNode;
  label: string;
}

interface DraggableSidebarProps {
  items: SidebarItem[];
  activePanel: string | null;
  onPanelChange: (panel: string | null) => void;
  storageKey?: string;
}

const STORAGE_KEY = 'sidebar-order';

export function DraggableSidebar({
  items,
  activePanel,
  onPanelChange,
  storageKey = STORAGE_KEY,
}: DraggableSidebarProps) {
  const [orderedItems, setOrderedItems] = useState<SidebarItem[]>(items);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Load saved order from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const savedOrder: string[] = JSON.parse(saved);
        // Reorder items based on saved order
        const reordered = savedOrder
          .map(id => items.find(item => item.id === id))
          .filter((item): item is SidebarItem => item !== undefined);

        // Add any new items that weren't in saved order
        const newItems = items.filter(item => !savedOrder.includes(item.id));
        setOrderedItems([...reordered, ...newItems]);
      } else {
        setOrderedItems(items);
      }
    } catch {
      setOrderedItems(items);
    }
  }, [items, storageKey]);

  // Save order to localStorage
  const saveOrder = useCallback((newOrder: SidebarItem[]) => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(newOrder.map(i => i.id)));
    } catch {
      // Ignore storage errors
    }
  }, [storageKey]);

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', index.toString());

    // Make the drag image slightly transparent
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '0.5';
    }
  };

  const handleDragEnd = (e: React.DragEvent) => {
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '1';
    }
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverIndex(index);
  };

  const handleDragLeave = () => {
    setDragOverIndex(null);
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();

    if (draggedIndex === null || draggedIndex === dropIndex) {
      setDragOverIndex(null);
      return;
    }

    const newOrder = [...orderedItems];
    const [draggedItem] = newOrder.splice(draggedIndex, 1);
    newOrder.splice(dropIndex, 0, draggedItem);

    setOrderedItems(newOrder);
    saveOrder(newOrder);
    setDragOverIndex(null);
  };

  return (
    <div className="flex flex-col gap-2">
      {orderedItems.map((item, index) => (
        <div
          key={item.id}
          draggable
          onDragStart={(e) => handleDragStart(e, index)}
          onDragEnd={handleDragEnd}
          onDragOver={(e) => handleDragOver(e, index)}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, index)}
          className={`relative cursor-grab active:cursor-grabbing transition-transform ${
            dragOverIndex === index && draggedIndex !== index
              ? 'transform translate-y-1'
              : ''
          }`}
        >
          {/* Drop indicator line */}
          {dragOverIndex === index && draggedIndex !== null && draggedIndex !== index && (
            <div className="absolute -top-1 left-0 right-0 h-0.5 bg-blue-500 rounded" />
          )}

          <SidebarIcon
            icon={item.icon}
            label={item.label}
            active={activePanel === item.id}
            onClick={() => onPanelChange(activePanel === item.id ? null : item.id)}
          />
        </div>
      ))}
    </div>
  );
}
