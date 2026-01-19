import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
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

      <main className="flex-1 overflow-y-auto bg-background">
        <Outlet />
      </main>

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
