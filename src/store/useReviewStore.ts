/**
 * Review Store - Zustand State Management
 *
 * Manages AI review workflow state for tasks.
 * Tracks active reviews and their progress across the application.
 */

import { create } from 'zustand';
import type { ReviewProgressResponse } from '@/types/ipc';

// ============================================================================
// Types
// ============================================================================

interface ReviewState {
  /**
   * Active reviews being tracked (taskId -> progress)
   */
  activeReviews: Map<string, ReviewProgressResponse>;

  /**
   * Set or update review progress for a task
   */
  setReviewProgress: (taskId: string, progress: ReviewProgressResponse) => void;

  /**
   * Remove a review from tracking
   */
  removeReview: (taskId: string) => void;

  /**
   * Clear all active reviews
   */
  clearAll: () => void;

  /**
   * Get review progress for a specific task
   */
  getReviewProgress: (taskId: string) => ReviewProgressResponse | undefined;

  /**
   * Check if a task has an active review
   */
  hasActiveReview: (taskId: string) => boolean;
}

// ============================================================================
// Store Implementation
// ============================================================================

export const useReviewStore = create<ReviewState>((set, get) => ({
  activeReviews: new Map(),

  setReviewProgress: (taskId, progress) =>
    set((state) => {
      const newMap = new Map(state.activeReviews);
      newMap.set(taskId, progress);
      return { activeReviews: newMap };
    }),

  removeReview: (taskId) =>
    set((state) => {
      const newMap = new Map(state.activeReviews);
      newMap.delete(taskId);
      return { activeReviews: newMap };
    }),

  clearAll: () => set({ activeReviews: new Map() }),

  getReviewProgress: (taskId) => {
    return get().activeReviews.get(taskId);
  },

  hasActiveReview: (taskId) => {
    const progress = get().activeReviews.get(taskId);
    return progress !== undefined && progress.status === 'in_progress';
  },
}));
