/**
 * Project Store - Zustand State Management
 *
 * Manages project data and operations for the current user.
 * Uses IPC to communicate with the main process for database operations.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { invoke } from '@/lib/ipc';

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
      fetchProjects: async (userId: string) => {
        console.log('[ProjectStore] fetchProjects called with userId:', userId);
        set({ isLoading: true, error: null });
        try {
          const projects = await invoke('projects:list', userId);
          console.log('[ProjectStore] fetchProjects received projects:', projects.length);

          // If we have a currentProjectId stored, restore it from the fetched projects
          const state = get();
          let currentProject = state.currentProject;

          if (currentProject?.id) {
            const restoredProject = projects.find(p => p.id === currentProject?.id);
            if (restoredProject) {
              console.log('[ProjectStore] Restored previously selected project:', restoredProject.name);
              currentProject = restoredProject;
            } else {
              // Project no longer exists, clear it
              console.log('[ProjectStore] Previously selected project no longer exists');
              currentProject = null;
            }
          }

          // Auto-select first project if none is selected and projects exist
          if (!currentProject && projects.length > 0) {
            const firstProject = projects[0];
            if (firstProject) {
              console.log('[ProjectStore] Auto-selecting first project:', firstProject.name);
              currentProject = firstProject;
            }
          }

          set({ projects, currentProject, isLoading: false });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to fetch projects';
          set({ error: errorMessage, isLoading: false });
          console.error('[ProjectStore] Failed to fetch projects:', error);
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
      createProject: async (data: CreateProjectData, userId: string) => {
        set({ isLoading: true, error: null });
        try {
          const createData: {
            name: string;
            ownerId: string;
            description?: string;
            targetPath?: string;
            githubRepo?: string;
          } = {
            name: data.name,
            ownerId: userId,
          };

          if (data.description !== undefined) {
            createData.description = data.description;
          }
          if (data.targetPath !== undefined) {
            createData.targetPath = data.targetPath;
          }
          if (data.githubRepo !== undefined) {
            createData.githubRepo = data.githubRepo;
          }

          const newProject = await invoke('projects:create', createData);

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
          const updateData: {
            name?: string;
            description?: string;
            targetPath?: string;
            githubRepo?: string;
          } = {};

          if (data.name !== undefined) {
            updateData.name = data.name;
          }
          if (data.description !== undefined) {
            updateData.description = data.description;
          }
          if (data.targetPath !== undefined) {
            updateData.targetPath = data.targetPath;
          }
          if (data.githubRepo !== undefined) {
            updateData.githubRepo = data.githubRepo;
          }

          const updatedProject = await invoke('projects:update', id, updateData);

          set(state => ({
            projects: state.projects.map(p => p.id === id ? updatedProject : p),
            currentProject: state.currentProject?.id === id ? updatedProject : state.currentProject,
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
          await invoke('projects:delete', id);

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
      addMember: async (projectId: string, userId: string, role: ProjectRole) => {
        set({ isLoading: true, error: null });
        try {
          await invoke('projects:addMember', projectId, userId, role);

          // Refetch the project to get updated members
          const updatedProject = await invoke('projects:get', projectId);
          if (updatedProject) {
            set(state => ({
              projects: state.projects.map(p => p.id === projectId ? updatedProject : p),
              currentProject: state.currentProject?.id === projectId ? updatedProject : state.currentProject,
              isLoading: false,
            }));
          } else {
            set({ isLoading: false });
          }
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
      removeMember: async (projectId: string, userId: string) => {
        set({ isLoading: true, error: null });
        try {
          await invoke('projects:removeMember', projectId, userId);

          // Refetch the project to get updated members
          const updatedProject = await invoke('projects:get', projectId);
          if (updatedProject) {
            set(state => ({
              projects: state.projects.map(p => p.id === projectId ? updatedProject : p),
              currentProject: state.currentProject?.id === projectId ? updatedProject : state.currentProject,
              isLoading: false,
            }));
          } else {
            set({ isLoading: false });
          }
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
      updateMemberRole: async (projectId: string, userId: string, role: ProjectRole) => {
        set({ isLoading: true, error: null });
        try {
          await invoke('projects:updateMemberRole', projectId, userId, role);

          // Refetch the project to get updated members
          const updatedProject = await invoke('projects:get', projectId);
          if (updatedProject) {
            set(state => ({
              projects: state.projects.map(p => p.id === projectId ? updatedProject : p),
              currentProject: state.currentProject?.id === projectId ? updatedProject : state.currentProject,
              isLoading: false,
            }));
          } else {
            set({ isLoading: false });
          }
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
