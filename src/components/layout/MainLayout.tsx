import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { ProjectSelector } from './ProjectSelector';
import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

/**
 * MainLayout component that wraps the application with a sidebar
 * and renders child routes in the main content area.
 */
export function MainLayout() {
  const [newTaskDialogOpen, setNewTaskDialogOpen] = useState(false);
  const [taskTitle, setTaskTitle] = useState('');

  const handleNewTask = () => {
    setNewTaskDialogOpen(true);
  };

  const handleCreateTask = () => {
    // TODO: Implement task creation
    console.log('Creating task:', taskTitle);
    setTaskTitle('');
    setNewTaskDialogOpen(false);
  };

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar onNewTask={handleNewTask} />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header with Project Selector */}
        <header className="h-14 border-b border-border bg-background flex items-center justify-end px-4 titlebar-drag-region">
          <ProjectSelector />
        </header>

        {/* Main Content - pt-6 accounts for macOS titlebar spacing */}
        <main className="flex-1 overflow-y-auto bg-background pt-6">
          <Outlet />
        </main>
      </div>

      {/* New Task Dialog */}
      <Dialog open={newTaskDialogOpen} onOpenChange={setNewTaskDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Create New Task</DialogTitle>
            <DialogDescription>
              Add a new task to your project. You can add more details after creation.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="task-title">Title</Label>
              <Input
                id="task-title"
                placeholder="Enter task title..."
                value={taskTitle}
                onChange={(e) => setTaskTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && taskTitle.trim()) {
                    handleCreateTask();
                  }
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setNewTaskDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateTask}
              disabled={!taskTitle.trim()}
            >
              Create Task
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
