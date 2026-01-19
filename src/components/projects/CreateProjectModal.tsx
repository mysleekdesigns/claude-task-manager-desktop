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
import { Textarea } from '@/components/ui/textarea';
import { useIPCMutation } from '@/hooks/useIPC';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { Folder, X } from 'lucide-react';
import type { Project, CreateProjectInput, OpenDirectoryResult } from '@/types/ipc';

interface CreateProjectModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (project: Project) => void;
}

export function CreateProjectModal({
  open,
  onOpenChange,
  onSuccess,
}: CreateProjectModalProps) {
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [targetPath, setTargetPath] = useState('');
  const [githubRepo, setGithubRepo] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { mutate: openDirectory, loading: directoryLoading } = useIPCMutation('dialog:openDirectory');
  const { mutate: createProject, loading: createLoading } = useIPCMutation('projects:create');

  const handleBrowseDirectory = async () => {
    try {
      const result: OpenDirectoryResult = await openDirectory({
        title: 'Select Project Directory',
        buttonLabel: 'Select',
      });

      if (!result.canceled && result.filePaths.length > 0) {
        setTargetPath(result.filePaths[0] || '');
      }
    } catch (error) {
      console.error('Failed to open directory picker:', error);
      toast.error('Failed to open directory picker');
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    // Validate name
    if (!name.trim()) {
      newErrors['name'] = 'Project name is required';
    } else if (name.trim().length < 2) {
      newErrors['name'] = 'Project name must be at least 2 characters';
    }

    // Validate GitHub URL if provided
    if (githubRepo.trim()) {
      const githubUrlPattern = /^https?:\/\/(www\.)?github\.com\/[\w-]+\/[\w.-]+/i;
      if (!githubUrlPattern.test(githubRepo.trim())) {
        newErrors['githubRepo'] = 'Please enter a valid GitHub repository URL';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    if (!user) {
      toast.error('You must be logged in to create a project');
      return;
    }

    try {
      const projectData: CreateProjectInput = {
        name: name.trim(),
        ownerId: user.id,
      };

      if (description.trim()) {
        projectData.description = description.trim();
      }

      if (targetPath.trim()) {
        projectData.targetPath = targetPath.trim();
      }

      if (githubRepo.trim()) {
        projectData.githubRepo = githubRepo.trim();
      }

      const newProject = await createProject(projectData);

      toast.success('Project created successfully');

      // Reset form
      setName('');
      setDescription('');
      setTargetPath('');
      setGithubRepo('');
      setErrors({});

      // Call success callback
      if (onSuccess) {
        onSuccess(newProject);
      }

      // Close modal
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to create project:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to create project');
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    // Reset form when closing
    if (!newOpen) {
      setName('');
      setDescription('');
      setTargetPath('');
      setGithubRepo('');
      setErrors({});
    }
    onOpenChange(newOpen);
  };

  const isLoading = createLoading || directoryLoading;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create New Project</DialogTitle>
          <DialogDescription>
            Add a new project to organize your tasks and workflows.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            {/* Project Name */}
            <div className="space-y-2">
              <Label htmlFor="name">
                Project Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="name"
                placeholder="My Awesome Project"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (errors['name']) {
                    setErrors((prev) => ({ ...prev, name: '' }));
                  }
                }}
                className={errors['name'] ? 'border-destructive' : ''}
                disabled={isLoading}
                autoFocus
              />
              {errors['name'] && (
                <p className="text-sm text-destructive">{errors['name']}</p>
              )}
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Describe your project..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={isLoading}
                rows={3}
              />
            </div>

            {/* Project Directory */}
            <div className="space-y-2">
              <Label htmlFor="targetPath">Project Directory</Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    id="targetPath"
                    placeholder="No directory selected"
                    value={targetPath}
                    onChange={(e) => setTargetPath(e.target.value)}
                    disabled={isLoading}
                    className="pr-8"
                  />
                  {targetPath && (
                    <button
                      type="button"
                      onClick={() => setTargetPath('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      disabled={isLoading}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleBrowseDirectory}
                  disabled={isLoading}
                >
                  <Folder className="h-4 w-4 mr-2" />
                  Browse
                </Button>
              </div>
            </div>

            {/* GitHub Repository */}
            <div className="space-y-2">
              <Label htmlFor="githubRepo">GitHub Repository</Label>
              <Input
                id="githubRepo"
                placeholder="https://github.com/owner/repo"
                value={githubRepo}
                onChange={(e) => {
                  setGithubRepo(e.target.value);
                  if (errors['githubRepo']) {
                    setErrors((prev) => ({ ...prev, githubRepo: '' }));
                  }
                }}
                className={errors['githubRepo'] ? 'border-destructive' : ''}
                disabled={isLoading}
              />
              {errors['githubRepo'] && (
                <p className="text-sm text-destructive">{errors['githubRepo']}</p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {createLoading ? 'Creating...' : 'Create Project'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
