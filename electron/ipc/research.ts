/**
 * Research IPC Handlers
 *
 * Handlers for researching solutions for code review findings.
 * Uses shell.openExternal() to open search queries in the user's browser.
 */

import { ipcMain, shell, type IpcMainInvokeEvent } from 'electron';
import { wrapHandler, IPCErrors } from '../utils/ipc-error.js';
import {
  logIPCRequest,
  logIPCResponse,
  logIPCError,
} from '../utils/ipc-logger.js';

/**
 * Input for researching a solution
 */
export interface ResearchRequest {
  title: string;
  description: string;
  severity: string;
  file?: string;
  line?: number;
  category: 'security' | 'quality' | 'performance';
}

/**
 * Result from a research request
 */
export interface ResearchResponse {
  success: boolean;
  searchUrl?: string;
  error?: string;
}

/**
 * Search engine options
 */
type SearchEngine = 'google' | 'stackoverflow' | 'github';

/**
 * Build a search query from a research request
 */
function buildSearchQuery(request: ResearchRequest): string {
  const parts: string[] = [];

  // Add the title as the main search term
  parts.push(request.title);

  // Add context based on category
  switch (request.category) {
    case 'security':
      parts.push('security fix');
      break;
    case 'performance':
      parts.push('performance optimization');
      break;
    case 'quality':
      parts.push('best practice');
      break;
  }

  // Add file extension context if available
  if (request.file) {
    const ext = request.file.split('.').pop()?.toLowerCase();
    if (ext) {
      const languageMap: Record<string, string> = {
        ts: 'TypeScript',
        tsx: 'TypeScript React',
        js: 'JavaScript',
        jsx: 'JavaScript React',
        py: 'Python',
        rs: 'Rust',
        go: 'Go',
        java: 'Java',
        rb: 'Ruby',
        php: 'PHP',
        cs: 'C#',
        cpp: 'C++',
        c: 'C',
      };
      const language = languageMap[ext];
      if (language) {
        parts.push(language);
      }
    }
  }

  return parts.join(' ');
}

/**
 * Build a search URL for the given engine and query
 */
function buildSearchUrl(engine: SearchEngine, query: string): string {
  const encodedQuery = encodeURIComponent(query);

  switch (engine) {
    case 'google':
      return `https://www.google.com/search?q=${encodedQuery}`;
    case 'stackoverflow':
      return `https://stackoverflow.com/search?q=${encodedQuery}`;
    case 'github':
      return `https://github.com/search?q=${encodedQuery}&type=code`;
    default:
      return `https://www.google.com/search?q=${encodedQuery}`;
  }
}

/**
 * Handle research:searchSolution - Open a search for a finding in the browser
 */
async function handleSearchSolution(
  _event: IpcMainInvokeEvent,
  data: ResearchRequest
): Promise<ResearchResponse> {
  // Validate required fields
  if (!data.title) {
    throw IPCErrors.invalidArguments('Title is required');
  }
  if (!data.description) {
    throw IPCErrors.invalidArguments('Description is required');
  }
  if (!data.category) {
    throw IPCErrors.invalidArguments('Category is required');
  }

  try {
    const query = buildSearchQuery(data);
    const searchUrl = buildSearchUrl('google', query);

    // Open the search URL in the user's default browser
    await shell.openExternal(searchUrl);

    return {
      success: true,
      searchUrl,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Handle research:searchStackOverflow - Open a Stack Overflow search
 */
async function handleSearchStackOverflow(
  _event: IpcMainInvokeEvent,
  data: ResearchRequest
): Promise<ResearchResponse> {
  // Validate required fields
  if (!data.title) {
    throw IPCErrors.invalidArguments('Title is required');
  }
  if (!data.category) {
    throw IPCErrors.invalidArguments('Category is required');
  }

  try {
    const query = buildSearchQuery(data);
    const searchUrl = buildSearchUrl('stackoverflow', query);

    await shell.openExternal(searchUrl);

    return {
      success: true,
      searchUrl,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Handle research:searchGitHub - Open a GitHub code search
 */
async function handleSearchGitHub(
  _event: IpcMainInvokeEvent,
  data: ResearchRequest
): Promise<ResearchResponse> {
  // Validate required fields
  if (!data.title) {
    throw IPCErrors.invalidArguments('Title is required');
  }
  if (!data.category) {
    throw IPCErrors.invalidArguments('Category is required');
  }

  try {
    const query = buildSearchQuery(data);
    const searchUrl = buildSearchUrl('github', query);

    await shell.openExternal(searchUrl);

    return {
      success: true,
      searchUrl,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Handle research:openUrl - Open a specific URL in the browser
 */
async function handleOpenUrl(
  _event: IpcMainInvokeEvent,
  url: string
): Promise<ResearchResponse> {
  if (!url) {
    throw IPCErrors.invalidArguments('URL is required');
  }

  // Basic URL validation
  try {
    new URL(url);
  } catch {
    throw IPCErrors.invalidArguments('Invalid URL format');
  }

  try {
    await shell.openExternal(url);

    return {
      success: true,
      searchUrl: url,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Wrap a handler with logging
 */
function wrapWithLogging<TArgs extends unknown[], TReturn>(
  channel: string,
  handler: (event: IpcMainInvokeEvent, ...args: TArgs) => Promise<TReturn>
): (event: IpcMainInvokeEvent, ...args: TArgs) => Promise<TReturn> {
  return async (
    event: IpcMainInvokeEvent,
    ...args: TArgs
  ): Promise<TReturn> => {
    const startTime = performance.now();
    logIPCRequest(channel, args);

    try {
      const result = await handler(event, ...args);
      const duration = performance.now() - startTime;
      logIPCResponse(channel, result, duration, true);
      return result;
    } catch (error) {
      const duration = performance.now() - startTime;
      logIPCError(channel, error, duration);
      throw error;
    }
  };
}

/**
 * Register all research-related IPC handlers
 */
export function registerResearchHandlers(): void {
  // research:searchSolution - Open a Google search for a finding
  ipcMain.handle(
    'research:searchSolution',
    wrapWithLogging('research:searchSolution', wrapHandler(handleSearchSolution))
  );

  // research:searchStackOverflow - Open a Stack Overflow search
  ipcMain.handle(
    'research:searchStackOverflow',
    wrapWithLogging(
      'research:searchStackOverflow',
      wrapHandler(handleSearchStackOverflow)
    )
  );

  // research:searchGitHub - Open a GitHub code search
  ipcMain.handle(
    'research:searchGitHub',
    wrapWithLogging('research:searchGitHub', wrapHandler(handleSearchGitHub))
  );

  // research:openUrl - Open a specific URL in the browser
  ipcMain.handle(
    'research:openUrl',
    wrapWithLogging('research:openUrl', wrapHandler(handleOpenUrl))
  );
}

/**
 * Unregister all research-related IPC handlers
 */
export function unregisterResearchHandlers(): void {
  ipcMain.removeHandler('research:searchSolution');
  ipcMain.removeHandler('research:searchStackOverflow');
  ipcMain.removeHandler('research:searchGitHub');
  ipcMain.removeHandler('research:openUrl');
}
