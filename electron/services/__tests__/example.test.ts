/**
 * Example Main Process Service Tests
 *
 * Demonstrates how to test Electron main process code including:
 * - Services that use Electron APIs
 * - IPC handlers
 * - Database operations
 * - File system operations
 *
 * Uses Node.js environment with mocked Electron modules.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  mockApp,
  mockDialog,
  mockShell,
  MockNotification,
  createMockIPCEvent,
  createMockPrismaClient,
} from '../../../tests/setup/main';

describe('Main Process Service Examples', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Electron App API', () => {
    it('should get user data path', () => {
      const userDataPath = mockApp.getPath('userData');

      expect(userDataPath).toBe('/mock/userData');
      expect(mockApp.getPath).toHaveBeenCalledWith('userData');
    });

    it('should get app name', () => {
      const appName = mockApp.getName();

      expect(appName).toBe('claude-tasks-desktop');
    });

    it('should get app version', () => {
      const version = mockApp.getVersion();

      expect(version).toBe('0.1.0');
    });

    it('should handle platform-specific paths', () => {
      const homePath = mockApp.getPath('home');
      const documentsPath = mockApp.getPath('documents');

      expect(homePath).toBe('/mock/home');
      expect(documentsPath).toBe('/mock/home/Documents');
    });
  });

  describe('Electron Dialog API', () => {
    it('should show open dialog for directory selection', async () => {
      mockDialog.showOpenDialog.mockResolvedValueOnce({
        canceled: false,
        filePaths: ['/selected/project/path'],
      });

      const result = await mockDialog.showOpenDialog({
        properties: ['openDirectory'],
        title: 'Select Project Directory',
      });

      expect(result.canceled).toBe(false);
      expect(result.filePaths).toEqual(['/selected/project/path']);
      expect(mockDialog.showOpenDialog).toHaveBeenCalledWith({
        properties: ['openDirectory'],
        title: 'Select Project Directory',
      });
    });

    it('should handle dialog cancellation', async () => {
      mockDialog.showOpenDialog.mockResolvedValueOnce({
        canceled: true,
        filePaths: [],
      });

      const result = await mockDialog.showOpenDialog({
        properties: ['openFile'],
      });

      expect(result.canceled).toBe(true);
      expect(result.filePaths).toEqual([]);
    });

    it('should show save dialog', async () => {
      mockDialog.showSaveDialog.mockResolvedValueOnce({
        canceled: false,
        filePath: '/save/location/file.json',
      });

      const result = await mockDialog.showSaveDialog({
        defaultPath: 'export.json',
        filters: [{ name: 'JSON', extensions: ['json'] }],
      });

      expect(result.canceled).toBe(false);
      expect(result.filePath).toBe('/save/location/file.json');
    });

    it('should show message box', async () => {
      mockDialog.showMessageBox.mockResolvedValueOnce({
        response: 1, // User clicked second button
        checkboxChecked: false,
      });

      const result = await mockDialog.showMessageBox({
        type: 'question',
        buttons: ['Cancel', 'OK'],
        message: 'Are you sure?',
      });

      expect(result.response).toBe(1);
    });
  });

  describe('Electron Shell API', () => {
    it('should open external URL', async () => {
      await mockShell.openExternal('https://github.com');

      expect(mockShell.openExternal).toHaveBeenCalledWith('https://github.com');
    });

    it('should show item in folder', () => {
      mockShell.showItemInFolder('/path/to/file.txt');

      expect(mockShell.showItemInFolder).toHaveBeenCalledWith('/path/to/file.txt');
    });

    it('should trash item', async () => {
      await mockShell.trashItem('/path/to/delete.txt');

      expect(mockShell.trashItem).toHaveBeenCalledWith('/path/to/delete.txt');
    });
  });

  describe('Electron Notification API', () => {
    it('should create and show notification', () => {
      const notification = new MockNotification({
        title: 'Task Complete',
        body: 'Your task has finished successfully.',
      });

      notification.show();

      expect(notification.title).toBe('Task Complete');
      expect(notification.body).toBe('Your task has finished successfully.');
      expect(notification.show).toHaveBeenCalled();
    });

    it('should check if notifications are supported', () => {
      expect(MockNotification.isSupported()).toBe(true);
    });
  });

  describe('IPC Handler Testing', () => {
    it('should create mock IPC event', () => {
      const event = createMockIPCEvent(123);

      expect(event.sender.id).toBe(123);
      expect(event.sender.send).toBeDefined();
      expect(event.reply).toBeDefined();
    });

    it('should test IPC handler with mock event', async () => {
      // Example IPC handler function
      const listProjectsHandler = async (
        _event: unknown,
        userId: string
      ) => {
        // Simulate database query
        return [
          { id: '1', name: 'Project A', userId },
          { id: '2', name: 'Project B', userId },
        ];
      };

      const event = createMockIPCEvent();
      const result = await listProjectsHandler(event, 'user-123');

      expect(result).toHaveLength(2);
      expect(result[0]?.name).toBe('Project A');
    });

    it('should handle IPC errors gracefully', async () => {
      const errorHandler = async () => {
        throw new Error('Database connection failed');
      };

      await expect(errorHandler()).rejects.toThrow('Database connection failed');
    });
  });

  describe('Prisma Client Mocking', () => {
    it('should create mock Prisma client', () => {
      const prisma = createMockPrismaClient();

      expect(prisma.user.findMany).toBeDefined();
      expect(prisma.project.create).toBeDefined();
      expect(prisma.task.update).toBeDefined();
    });

    it('should mock database queries', async () => {
      const prisma = createMockPrismaClient();

      prisma.project.findMany.mockResolvedValue([
        {
          id: 'proj-1',
          name: 'Test Project',
          path: '/test/path',
          description: 'A test project',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      const projects = await prisma.project.findMany({
        where: { name: { contains: 'Test' } },
      });

      expect(projects).toHaveLength(1);
      expect(projects[0]?.name).toBe('Test Project');
    });

    it('should mock database create operations', async () => {
      const prisma = createMockPrismaClient();
      const newTask = {
        id: 'task-1',
        title: 'New Task',
        status: 'PENDING',
        priority: 'MEDIUM',
        projectId: 'proj-1',
        tags: '[]',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      prisma.task.create.mockResolvedValue(newTask);

      const result = await prisma.task.create({
        data: {
          title: 'New Task',
          status: 'PENDING',
          priority: 'MEDIUM',
          projectId: 'proj-1',
        },
      });

      expect(result.id).toBe('task-1');
      expect(result.title).toBe('New Task');
    });

    it('should mock database transactions', async () => {
      const prisma = createMockPrismaClient();

      prisma.$transaction.mockImplementation(async (fn) => {
        return fn(prisma);
      });

      const result = await prisma.$transaction(async (tx) => {
        // Simulate transaction operations
        return { success: true, tx };
      }) as { success: boolean; tx: unknown };

      expect(result.success).toBe(true);
    });
  });

  describe('Service Pattern Examples', () => {
    it('should test service that combines multiple operations', async () => {
      const prisma = createMockPrismaClient();

      // Mock the specific query
      prisma.task.findMany.mockResolvedValue([
        {
          id: '1',
          title: 'Task 1',
          status: 'PENDING',
          tags: '["frontend", "bug"]',
        },
        {
          id: '2',
          title: 'Task 2',
          status: 'IN_PROGRESS',
          tags: '["backend"]',
        },
      ]);

      // Example service function
      const getTasksForProject = async (projectId: string) => {
        const tasks = await prisma.task.findMany({
          where: { projectId },
          orderBy: { createdAt: 'desc' },
        });

        // Transform tags from JSON string to array
        return tasks.map((task: { id: string; title: string; status: string; tags: string }) => ({
          ...task,
          tags: JSON.parse(task.tags),
        }));
      };

      const tasks = await getTasksForProject('proj-1');

      expect(tasks).toHaveLength(2);
      expect(tasks[0]?.tags).toEqual(['frontend', 'bug']);
      expect(tasks[1]?.tags).toEqual(['backend']);
    });

    it('should test error handling in services', async () => {
      const prisma = createMockPrismaClient();

      prisma.task.create.mockRejectedValue(
        new Error('Unique constraint violation')
      );

      const createTask = async () => {
        try {
          await prisma.task.create({
            data: { title: 'Duplicate', projectId: 'proj-1' },
          });
        } catch (error) {
          throw new Error(
            `Failed to create task: ${error instanceof Error ? error.message : 'Unknown error'}`
          );
        }
      };

      await expect(createTask()).rejects.toThrow(
        'Failed to create task: Unique constraint violation'
      );
    });
  });
});

describe('MCP Config Service (Example Pattern)', () => {
  /**
   * This demonstrates how to structure tests for the actual mcp-config service.
   * The actual service test file exists at electron/services/__tests__/mcp-config.test.ts
   */

  describe('validateConfig', () => {
    // Example of testing a pure validation function
    const validateConfig = (config: unknown): boolean => {
      if (!config || typeof config !== 'object') return false;
      const cfg = config as { mcpServers?: unknown };
      if (!cfg.mcpServers || typeof cfg.mcpServers !== 'object') return false;
      return true;
    };

    it('should validate correct config structure', () => {
      const config = {
        mcpServers: {
          github: { command: 'npx', args: ['-y', '@modelcontextprotocol/server-github'] },
        },
      };

      expect(validateConfig(config)).toBe(true);
    });

    it('should reject config without mcpServers', () => {
      const config = { other: 'field' };

      expect(validateConfig(config)).toBe(false);
    });

    it('should reject null config', () => {
      expect(validateConfig(null)).toBe(false);
    });

    it('should reject non-object config', () => {
      expect(validateConfig('string')).toBe(false);
      expect(validateConfig(123)).toBe(false);
      expect(validateConfig(undefined)).toBe(false);
    });
  });
});
