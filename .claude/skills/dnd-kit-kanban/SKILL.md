---
name: dnd-kit-kanban
description: Kanban board implementation with @dnd-kit for drag-and-drop. Use when building drag-and-drop interfaces, sortable lists, or multi-column boards with React.
allowed-tools: Read, Write, Edit, Glob, Grep
---

# @dnd-kit Kanban Implementation

## Overview

@dnd-kit is a lightweight, performant drag-and-drop library for React. It's used in Claude Tasks Desktop for the Kanban board task management.

## Installation

```bash
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

## Kanban Board Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    DndContext                                │
│  ┌─────────────────────────────────────────────────────────┐│
│  │              SortableContext (per column)               ││
│  │  ┌───────────┐ ┌───────────┐ ┌───────────┐             ││
│  │  │  Column   │ │  Column   │ │  Column   │             ││
│  │  │ Planning  │ │In Progress│ │ Completed │             ││
│  │  │ ┌───────┐ │ │ ┌───────┐ │ │ ┌───────┐ │             ││
│  │  │ │ Task  │ │ │ │ Task  │ │ │ │ Task  │ │             ││
│  │  │ └───────┘ │ │ └───────┘ │ │ └───────┘ │             ││
│  │  │ ┌───────┐ │ │           │ │           │             ││
│  │  │ │ Task  │ │ │           │ │           │             ││
│  │  │ └───────┘ │ │           │ │           │             ││
│  │  └───────────┘ └───────────┘ └───────────┘             ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

## Kanban Board Component

```tsx
// src/components/kanban/KanbanBoard.tsx
import { useState, useCallback, useMemo } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
  DragOverEvent,
} from '@dnd-kit/core';
import { arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { KanbanColumn } from './KanbanColumn';
import { TaskCard } from './TaskCard';
import type { Task, TaskStatus } from '@/types';

const COLUMNS: { id: TaskStatus; title: string }[] = [
  { id: 'PLANNING', title: 'Planning' },
  { id: 'IN_PROGRESS', title: 'In Progress' },
  { id: 'AI_REVIEW', title: 'AI Review' },
  { id: 'HUMAN_REVIEW', title: 'Human Review' },
  { id: 'COMPLETED', title: 'Completed' },
];

interface KanbanBoardProps {
  tasks: Task[];
  onTaskStatusChange: (taskId: string, newStatus: TaskStatus) => Promise<void>;
  onTaskClick: (task: Task) => void;
}

export function KanbanBoard({ tasks, onTaskStatusChange, onTaskClick }: KanbanBoardProps) {
  const [activeTask, setActiveTask] = useState<Task | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Require 8px movement before starting drag
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Group tasks by status
  const tasksByStatus = useMemo(() => {
    return tasks.reduce((acc, task) => {
      const status = task.status as TaskStatus;
      if (!acc[status]) acc[status] = [];
      acc[status].push(task);
      return acc;
    }, {} as Record<TaskStatus, Task[]>);
  }, [tasks]);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const task = tasks.find(t => t.id === event.active.id);
    setActiveTask(task || null);
  }, [tasks]);

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTask(null);

    if (!over) return;

    const taskId = active.id as string;
    const overId = over.id as string;

    // Determine if dropped on a column or another task
    const overColumn = COLUMNS.find(col => col.id === overId);
    const newStatus = overColumn
      ? overColumn.id
      : tasks.find(t => t.id === overId)?.status;

    if (newStatus && newStatus !== tasks.find(t => t.id === taskId)?.status) {
      await onTaskStatusChange(taskId, newStatus);
    }
  }, [tasks, onTaskStatusChange]);

  const handleDragOver = useCallback((event: DragOverEvent) => {
    // Optional: Handle reordering within columns
  }, []);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragOver={handleDragOver}
    >
      <div className="flex gap-4 h-full overflow-x-auto p-4">
        {COLUMNS.map(column => (
          <KanbanColumn
            key={column.id}
            id={column.id}
            title={column.title}
            tasks={tasksByStatus[column.id] || []}
            onTaskClick={onTaskClick}
          />
        ))}
      </div>

      {/* Drag overlay - shows the dragged item */}
      <DragOverlay>
        {activeTask ? (
          <TaskCard task={activeTask} isDragging />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
```

## Kanban Column

```tsx
// src/components/kanban/KanbanColumn.tsx
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { TaskCard } from './TaskCard';
import type { Task, TaskStatus } from '@/types';

interface KanbanColumnProps {
  id: TaskStatus;
  title: string;
  tasks: Task[];
  onTaskClick: (task: Task) => void;
}

export function KanbanColumn({ id, title, tasks, onTaskClick }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id });

  const taskIds = tasks.map(t => t.id);

  return (
    <div
      className={`flex flex-col w-72 flex-shrink-0 bg-muted/50 rounded-lg ${
        isOver ? 'ring-2 ring-primary' : ''
      }`}
    >
      {/* Column Header */}
      <div className="flex items-center justify-between p-3 border-b">
        <h3 className="font-semibold text-sm">{title}</h3>
        <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
          {tasks.length}
        </span>
      </div>

      {/* Column Content */}
      <div
        ref={setNodeRef}
        className="flex-1 p-2 space-y-2 overflow-y-auto min-h-[200px]"
      >
        <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
          {tasks.map(task => (
            <TaskCard
              key={task.id}
              task={task}
              onClick={() => onTaskClick(task)}
            />
          ))}
        </SortableContext>
      </div>
    </div>
  );
}
```

## Sortable Task Card

```tsx
// src/components/kanban/TaskCard.tsx
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { GripVertical } from 'lucide-react';
import type { Task } from '@/types';

interface TaskCardProps {
  task: Task;
  onClick?: () => void;
  isDragging?: boolean;
}

export function TaskCard({ task, onClick, isDragging }: TaskCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const isCurrentlyDragging = isDragging || isSortableDragging;

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={`cursor-pointer transition-shadow ${
        isCurrentlyDragging ? 'opacity-50 shadow-lg' : 'hover:shadow-md'
      }`}
      onClick={onClick}
    >
      <CardHeader className="p-3 pb-2 flex flex-row items-start gap-2">
        {/* Drag handle */}
        <button
          {...attributes}
          {...listeners}
          className="mt-0.5 text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing"
          onClick={e => e.stopPropagation()}
        >
          <GripVertical className="h-4 w-4" />
        </button>

        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-sm truncate">{task.title}</h4>
          {task.description && (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
              {task.description}
            </p>
          )}
        </div>
      </CardHeader>

      <CardContent className="p-3 pt-0">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge
            variant={
              task.priority === 'URGENT' ? 'destructive' :
              task.priority === 'HIGH' ? 'warning' :
              'secondary'
            }
            className="text-xs"
          >
            {task.priority}
          </Badge>

          {task.tags?.slice(0, 2).map(tag => (
            <Badge key={tag} variant="outline" className="text-xs">
              {tag}
            </Badge>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
```

## Key Concepts

### Sensors
- **PointerSensor**: Mouse/touch dragging
- **KeyboardSensor**: Keyboard navigation (Tab, Arrow keys, Space/Enter)

### Collision Detection
- **closestCorners**: Best for grid layouts
- **closestCenter**: Best for single-axis lists
- **rectIntersection**: Based on overlap area

### Drag Overlay
Renders the dragged item outside the normal flow, preventing layout shift.

```tsx
<DragOverlay dropAnimation={null}> {/* dropAnimation controls the "snap back" */}
  {activeItem && <ItemComponent item={activeItem} />}
</DragOverlay>
```
