/**
 * Native Notification Service
 *
 * Provides notification functionality using Electron's native Notification API.
 * Handles task completion, terminal errors, and assignment notifications.
 */

import { Notification } from 'electron';
import { trayService } from './tray.js';
import { createIPCLogger } from '../utils/ipc-logger.js';

const logger = createIPCLogger('Notifications');

export interface NotificationOptions {
  title: string;
  body: string;
  silent?: boolean;
  urgency?: 'normal' | 'critical' | 'low';
  icon?: string;
}

export class NotificationService {
  private isSupported: boolean = false;

  constructor() {
    // Check if notifications are supported
    this.isSupported = Notification.isSupported();
    if (!this.isSupported) {
      logger.warn('Native notifications are not supported on this platform');
    }
  }

  /**
   * Check if notifications are supported and available
   */
  isAvailable(): boolean {
    return this.isSupported;
  }

  /**
   * Show a native notification
   */
  private show(options: NotificationOptions): void {
    if (!this.isSupported) {
      logger.warn('Cannot show notification - not supported');
      return;
    }

    try {
      const notification = new Notification({
        title: options.title,
        body: options.body,
        silent: options.silent ?? false,
        urgency: options.urgency ?? 'normal',
        ...(options.icon !== undefined && { icon: options.icon }),
      });

      // Handle notification click - show window
      notification.on('click', () => {
        trayService.showWindow();
      });

      notification.show();
      logger.info(`Notification shown: ${options.title}`);
    } catch (error) {
      logger.error('Failed to show notification:', error);
    }
  }

  /**
   * Show task completion notification
   */
  showTaskCompleted(task: {
    id: string;
    title: string;
    projectName?: string;
  }): void {
    const projectInfo = task.projectName ? ` in ${task.projectName}` : '';
    this.show({
      title: 'Task Completed ✓',
      body: `"${task.title}"${projectInfo}`,
      urgency: 'normal',
    });
  }

  /**
   * Show terminal error notification
   */
  showTerminalError(terminalName: string, error: string): void {
    // Truncate long error messages
    const errorMessage = error.length > 100 ? error.substring(0, 97) + '...' : error;

    this.show({
      title: `Terminal Error: ${terminalName}`,
      body: errorMessage,
      urgency: 'critical',
    });
  }

  /**
   * Show task assignment notification
   */
  showAssignment(task: {
    id: string;
    title: string;
    projectName?: string;
  }, assignerName: string): void {
    const projectInfo = task.projectName ? ` in ${task.projectName}` : '';
    this.show({
      title: `New Task Assigned by ${assignerName}`,
      body: `"${task.title}"${projectInfo}`,
      urgency: 'normal',
    });
  }

  /**
   * Show mention notification (for comments/discussions)
   */
  showMention(context: {
    title: string;
    body: string;
    urgency?: 'normal' | 'critical' | 'low';
  }): void {
    this.show({
      title: context.title,
      body: context.body,
      urgency: context.urgency ?? 'normal',
    });
  }

  /**
   * Show generic notification
   */
  showNotification(title: string, body: string, options?: {
    silent?: boolean;
    urgency?: 'normal' | 'critical' | 'low';
  }): void {
    this.show({
      title,
      body,
      ...(options?.silent !== undefined && { silent: options.silent }),
      ...(options?.urgency !== undefined && { urgency: options.urgency }),
    });
  }

  /**
   * Request notification permission (mainly for Linux)
   * Windows and macOS grant permission by default
   */
  async requestPermission(): Promise<boolean> {
    if (!this.isSupported) {
      return false;
    }

    // On Linux, we might need to request permission
    // On Windows and macOS, permission is granted by default
    if (process.platform === 'linux') {
      // Linux notification permission is handled by the desktop environment
      // We can't explicitly request it, but we can check if notifications work
      try {
        const test = new Notification({
          title: 'Claude Tasks',
          body: 'Notifications are enabled',
          silent: true,
        });
        test.close();
        return true;
      } catch (error) {
        logger.error('Notification permission check failed:', error);
        return false;
      }
    }

    // Windows and macOS - always return true
    return true;
  }
}

// Export singleton instance
export const notificationService = new NotificationService();
