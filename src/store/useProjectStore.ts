/**
 * Project Store - Zustand State Management
 *
 * Manages project data and operations for the current user.
 * Uses IPC to communicate with the main process for database operations.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
// import { invoke } from '@/lib/ipc'; // TODO: Uncomment when IPC handlers are ready

// ============================================================================
// Types
// ============================================================================

/**
 * Project role enum matching Prisma schema
 */
export type ProjectRole = 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';

/**
 * User information for project members
 */
export interface ProjectMemberUser {
  id: string;
  name: string | null;
  email: string;
  avatar: string | null;
}

/**
 * Project member with user details
 */
export interface ProjectMember {
  id: string;
  role: ProjectRole;
  userId: string;
  projectId: string;
  createdAt: string;
  user?: ProjectMemberUser;
}

/**
 * Project entity matching Prisma schema
 */
export interface Project {
  id: string;
  name: string;
  description: string | null;
  targetPath: string | null;
  githubRepo: string | null;
  createdAt: string;
  updatedAt: string;
  members?: ProjectMember[];
}

/**
 * Create project data (fields required for creation)
 */
export interface CreateProjectData {
  name: string;
  description?: string;
  targetPath?: string;
  githubRepo?: string;
}

/**
 * Update project data (partial update)
 */
export interface UpdateProjectData {
  name?: string;
  description?: string;
  targetPath?: string;
  githubRepo?: string;
}

// ============================================================================
// Store State Interface
// ============================================================================

interface ProjectState {
  // State
  projects: Project[];
  currentProject: Project | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  fetchProjects: (userId: string) => Promise<void>;
  setCurrentProject: (projectId: string | null) => void;
  createProject: (data: CreateProjectData, userId: string) => Promise<Project>;
  updateProject: (id: string, data: UpdateProjectData) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  addMember: (projectId: string, userId: string, role: ProjectRole) => Promise<void>;
  removeMember: (projectId: string, userId: string) => Promise<void>;
  updateMemberRole: (projectId: string, userId: string, role: ProjectRole) => Promise<void>;
  clearError: () => void;
  reset: () => void;
}

// ============================================================================
// Initial State
// ============================================================================

const initialState = {
  projects: [],
  currentProject: null,
  isLoading: false,
  error: null,
};

// ============================================================================
// Store Implementation
// ============================================================================

export const useProjectStore = create<ProjectState>()(
  persist(
    (set, get) => ({
      ...initialState,

      /**
       * Fetch all projects for the current user
       */
      fetchProjects: async (_userId: string) => {
        set({ isLoading: true, error: null });
        try {
          // TODO: Replace with actual IPC call when handler is ready
          // const projects = await invoke('projects:list', _userId);

          // For now, use mock data or empty array
          const projects: Project[] = [];

          set({ projects, isLoading: false });

          // If we have a currentProjectId stored, restore it from the fetched projects
          const state = get();
          if (state.currentProject?.id) {
            const restoredProject = projects.find(p => p.id === state.currentProject?.id);
            if (restoredProject) {
              set({ currentProject: restoredProject });
            } else {
              // Project no longer exists, clear it
              set({ currentProject: null });
            }
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to fetch projects';
          set({ error: errorMessage, isLoading: false });
          console.error('Failed to fetch projects:', error);
        }
      },

      /**
       * Set the currently active project
       */
      setCurrentProject: (projectId: string | null) => {
        const state = get();
        if (projectId === null) {
          set({ currentProject: null });
          return;
        }

        const project = state.projects.find(p => p.id === projectId);
        if (project) {
          set({ currentProject: project });
        } else {
          console.warn(`Project with id ${projectId} not found`);
        }
      },

      /**
       * Create a new project
       */
      createProject: async (data: CreateProjectData, _userId: string) => {
        set({ isLoading: true, error: null });
        try {
          // TODO: Replace with actual IPC call when handler is ready
          // const newProject = await invoke('projects:create', { ...data, userId: _userId });

          // Mock implementation for now
          const projectId = `project-${Date.now()}`;
          const newProject: Project = {
            id: projectId,
            name: data.name,
            description: data.description || null,
            targetPath: data.targetPath || null,
            githubRepo: data.githubRepo || null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            members: [{
              id: `member-${Date.now()}`,
              role: 'OWNER',
              userId: _userId,
              projectId,
              createdAt: new Date().toISOString(),
            }],
          };

          set(state => ({
            projects: [...state.projects, newProject],
            currentProject: newProject,
            isLoading: false,
          }));

          return newProject;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to create project';
          set({ error: errorMessage, isLoading: false });
          console.error('Failed to create project:', error);
          throw error;
        }
      },

      /**
       * Update an existing project
       */
      updateProject: async (id: string, data: UpdateProjectData) => {
        set({ isLoading: true, error: null });
        try {
          // TODO: Replace with actual IPC call when handler is ready
          // const updatedProject = await invoke('projects:update', id, data);

          // Mock implementation
          set(state => ({
            projects: state.projects.map(p =>
              p.id === id
                ? { ...p, ...data, updatedAt: new Date().toISOString() }
                : p
            ),
            currentProject: state.currentProject?.id === id
              ? { ...state.currentProject, ...data, updatedAt: new Date().toISOString() }
              : state.currentProject,
            isLoading: false,
          }));
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to update project';
          set({ error: errorMessage, isLoading: false });
          console.error('Failed to update project:', error);
          throw error;
        }
      },

      /**
       * Delete a project
       */
      deleteProject: async (id: string) => {
        set({ isLoading: true, error: null });
        try {
          // TODO: Replace with actual IPC call when handler is ready
          // await invoke('projects:delete', id);

          set(state => ({
            projects: state.projects.filter(p => p.id !== id),
            currentProject: state.currentProject?.id === id ? null : state.currentProject,
            isLoading: false,
          }));
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to delete project';
          set({ error: errorMessage, isLoading: false });
          console.error('Failed to delete project:', error);
          throw error;
        }
      },

      /**
       * Add a member to a project
       */
      addMember: async (_projectId: string, _userId: string, _role: ProjectRole) => {
        set({ isLoading: true, error: null });
        try {
          // TODO: Replace with actual IPC call when handler is ready
          // await invoke('projects:addMember', _projectId, _userId, _role);

          // Mock implementation - would need to refetch project to get updated members
          // For now, just clear loading state
          set({ isLoading: false });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to add member';
          set({ error: errorMessage, isLoading: false });
          console.error('Failed to add member:', error);
          throw error;
        }
      },

      /**
       * Remove a member from a project
       */
      removeMember: async (_projectId: string, _userId: string) => {
        set({ isLoading: true, error: null });
        try {
          // TODO: Replace with actual IPC call when handler is ready
          // await invoke('projects:removeMember', _projectId, _userId);

          set({ isLoading: false });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to remove member';
          set({ error: errorMessage, isLoading: false });
          console.error('Failed to remove member:', error);
          throw error;
        }
      },

      /**
       * Update a member's role
       */
      updateMemberRole: async (_projectId: string, _userId: string, _role: ProjectRole) => {
        set({ isLoading: true, error: null });
        try {
          // TODO: Replace with actual IPC call when handler is ready
          // await invoke('projects:updateMemberRole', _projectId, _userId, _role);

          set({ isLoading: false });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to update member role';
          set({ error: errorMessage, isLoading: false });
          console.error('Failed to update member role:', error);
          throw error;
        }
      },

      /**
       * Clear the current error
       */
      clearError: () => {
        set({ error: null });
      },

      /**
       * Reset the store to initial state
       */
      reset: () => {
        set(initialState);
      },
    }),
    {
      name: 'project-storage', // localStorage key
      // Only persist the current project ID, not the entire project list
      partialize: (state) => ({
        currentProject: state.currentProject ? { id: state.currentProject.id } : null,
      }),
      // Restore current project from persisted ID after rehydration
      onRehydrateStorage: () => () => {
        // After hydration, the currentProject will only have the ID
        // We need to refetch projects to restore the full project object
        // This will be handled in fetchProjects
      },
    }
  )
);
