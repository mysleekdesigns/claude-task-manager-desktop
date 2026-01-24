/**
 * Review Store - Zustand State Management
 *
 * Manages AI review workflow state for tasks.
 * Tracks active reviews and their progress across the application.
 */

import { create } from 'zustand';
import type { ReviewProgressResponse, ReviewType } from '@/types/ipc';

// ============================================================================
// Types
// ============================================================================

interface ReviewState {
  /**
   * Active reviews being tracked (taskId -> progress)
   */
  activeReviews: Map<string, ReviewProgressResponse>;

  /**
   * Review types currently being re-verified (taskId -> Set of reviewTypes)
   * Used to show blue "verifying" status on review icons during fix verification
   */
  verifyingReviewTypes: Map<string, Set<ReviewType>>;

  /**
   * Set or update review progress for a task
   */
  setReviewProgress: (taskId: string, progress: ReviewProgressResponse) => void;

  /**
   * Reset review progress to 'in_progress' state when starting a new review.
   * This prevents stale 'completed' status from showing during review restart.
   */
  resetReviewProgress: (taskId: string) => void;

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

  /**
   * Mark a review type as currently being re-verified
   */
  setVerifyingReviewType: (taskId: string, reviewType: ReviewType) => void;

  /**
   * Clear a review type from the verifying state
   */
  clearVerifyingReviewType: (taskId: string, reviewType: ReviewType) => void;

  /**
   * Check if a specific review type is currently being re-verified
   */
  isReviewTypeVerifying: (taskId: string, reviewType: ReviewType) => boolean;
}

// ============================================================================
// Store Implementation
// ============================================================================

export const useReviewStore = create<ReviewState>((set, get) => ({
  activeReviews: new Map(),
  verifyingReviewTypes: new Map(),

  setReviewProgress: (taskId, progress) =>
    set((state) => {
      const newMap = new Map(state.activeReviews);
      newMap.set(taskId, progress);
      return { activeReviews: newMap };
    }),

  resetReviewProgress: (taskId) =>
    set((state) => {
      const newMap = new Map(state.activeReviews);
      // Create a fresh in_progress state to prevent stale 'completed' status
      const resetProgress: ReviewProgressResponse = {
        taskId,
        status: 'in_progress',
        reviews: [],
      };
      newMap.set(taskId, resetProgress);
      return { activeReviews: newMap };
    }),

  removeReview: (taskId) =>
    set((state) => {
      const newMap = new Map(state.activeReviews);
      newMap.delete(taskId);
      return { activeReviews: newMap };
    }),

  clearAll: () => set({ activeReviews: new Map(), verifyingReviewTypes: new Map() }),

  getReviewProgress: (taskId) => {
    return get().activeReviews.get(taskId);
  },

  hasActiveReview: (taskId) => {
    const progress = get().activeReviews.get(taskId);
    return progress !== undefined && progress.status === 'in_progress';
  },

  setVerifyingReviewType: (taskId, reviewType) =>
    set((state) => {
      console.log('[useReviewStore] setVerifyingReviewType called:', { taskId, reviewType });
      const newMap = new Map(state.verifyingReviewTypes);
      const existingSet = newMap.get(taskId) ?? new Set();
      const newSet = new Set(existingSet);
      newSet.add(reviewType);
      newMap.set(taskId, newSet);
      return { verifyingReviewTypes: newMap };
    }),

  clearVerifyingReviewType: (taskId, reviewType) =>
    set((state) => {
      console.log('[useReviewStore] clearVerifyingReviewType called:', { taskId, reviewType });
      const newMap = new Map(state.verifyingReviewTypes);
      const existingSet = newMap.get(taskId);
      if (existingSet) {
        const newSet = new Set(existingSet);
        newSet.delete(reviewType);
        console.log('[useReviewStore] After clearing:', { remaining: Array.from(newSet) });
        if (newSet.size === 0) {
          newMap.delete(taskId);
        } else {
          newMap.set(taskId, newSet);
        }
      }
      return { verifyingReviewTypes: newMap };
    }),

  isReviewTypeVerifying: (taskId, reviewType) => {
    const verifyingSet = get().verifyingReviewTypes.get(taskId);
    return verifyingSet?.has(reviewType) ?? false;
  },
}));
