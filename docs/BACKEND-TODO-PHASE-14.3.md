# Backend Implementation TODO - Phase 14.3 Settings UI

## Quick Start

The Settings UI frontend is **100% complete**. To make it functional, you need to:

1. Create 3 new IPC handler files
2. Update 3 existing IPC handler files
3. Add type definitions to `src/types/ipc.ts`
4. Register handlers in `electron/ipc/index.ts`

**Estimated time**: 5-7 hours

---

## File Creation Checklist

### ☐ NEW: `/electron/ipc/claude.ts`

Claude API key management with encryption.

```typescript
/**
 * Claude API IPC Handlers
 *
 * Manages Claude API keys with safeStorage encryption.
 */

import { ipcMain, safeStorage, type IpcMainInvokeEvent } from 'electron';
import Store from 'electron-store';
import { wrapHandler } from '../utils/ipc-error.js';

const store = new Store();

/**
 * Save Claude API key (encrypted)
 */
async function handleSaveApiKey(
  _event: IpcMainInvokeEvent,
  key: string
): Promise<void> {
  if (!key || !key.startsWith('sk-ant-')) {
    throw new Error('Invalid API key format');
  }

  const encrypted = safeStorage.encryptString(key);
  store.set('claude.apiKey', encrypted.toString('base64'));
}

/**
 * Validate Claude API key by making test request
 */
async function handleValidateApiKey(
  _event: IpcMainInvokeEvent
): Promise<{ valid: boolean; model?: string; error?: string }> {
  const encryptedBase64 = store.get('claude.apiKey') as string | undefined;

  if (!encryptedBase64) {
    return { valid: false, error: 'No API key configured' };
  }

  try {
    const encrypted = Buffer.from(encryptedBase64, 'base64');
    const apiKey = safeStorage.decryptString(encrypted);

    // Make test API request to Anthropic
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1,
        messages: [{ role: 'user', content: 'test' }],
      }),
    });

    if (response.ok) {
      return { valid: true, model: 'claude-3-5-sonnet-20241022' };
    } else {
      const error = await response.text();
      return { valid: false, error: `API error: ${error}` };
    }
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Validation failed',
    };
  }
}

/**
 * Delete Claude API key
 */
async function handleDeleteApiKey(_event: IpcMainInvokeEvent): Promise<void> {
  store.delete('claude.apiKey');
}

/**
 * Check if Claude API key exists
 */
async function handleGetApiKey(
  _event: IpcMainInvokeEvent
): Promise<{ hasKey: boolean }> {
  return { hasKey: store.has('claude.apiKey') };
}

/**
 * Register Claude API handlers
 */
export function registerClaudeHandlers(): void {
  ipcMain.handle('claude:saveApiKey', wrapHandler(handleSaveApiKey));
  ipcMain.handle('claude:validateApiKey', wrapHandler(handleValidateApiKey));
  ipcMain.handle('claude:deleteApiKey', wrapHandler(handleDeleteApiKey));
  ipcMain.handle('claude:getApiKey', wrapHandler(handleGetApiKey));
}

/**
 * Unregister Claude API handlers
 */
export function unregisterClaudeHandlers(): void {
  ipcMain.removeHandler('claude:saveApiKey');
  ipcMain.removeHandler('claude:validateApiKey');
  ipcMain.removeHandler('claude:deleteApiKey');
  ipcMain.removeHandler('claude:getApiKey');
}
```

---

### ☐ NEW: `/electron/ipc/settings.ts`

Application preferences management.

```typescript
/**
 * Settings IPC Handlers
 *
 * Manages application preferences in electron-store.
 */

import { ipcMain, nativeTheme, type IpcMainInvokeEvent } from 'electron';
import Store from 'electron-store';
import { wrapHandler } from '../utils/ipc-error.js';

const store = new Store();

interface Preferences {
  theme: 'light' | 'dark' | 'system';
  defaultTerminalCount: number;
  autoLaunchClaude: boolean;
  minimizeToTray: boolean;
}

/**
 * Get user preferences
 */
async function handleGetPreferences(
  _event: IpcMainInvokeEvent
): Promise<Preferences> {
  return {
    theme: (store.get('preferences.theme', 'system') as 'light' | 'dark' | 'system'),
    defaultTerminalCount: store.get('preferences.defaultTerminalCount', 4) as number,
    autoLaunchClaude: store.get('preferences.autoLaunchClaude', false) as boolean,
    minimizeToTray: store.get('preferences.minimizeToTray', true) as boolean,
  };
}

/**
 * Save user preferences
 */
async function handleSavePreferences(
  _event: IpcMainInvokeEvent,
  prefs: Preferences
): Promise<void> {
  // Validate terminal count
  if (prefs.defaultTerminalCount < 1 || prefs.defaultTerminalCount > 12) {
    throw new Error('Terminal count must be between 1 and 12');
  }

  // Save to store
  store.set('preferences.theme', prefs.theme);
  store.set('preferences.defaultTerminalCount', prefs.defaultTerminalCount);
  store.set('preferences.autoLaunchClaude', prefs.autoLaunchClaude);
  store.set('preferences.minimizeToTray', prefs.minimizeToTray);

  // Apply theme immediately
  if (prefs.theme === 'system') {
    nativeTheme.themeSource = 'system';
  } else {
    nativeTheme.themeSource = prefs.theme;
  }

  // Note: minimizeToTray behavior should be handled in main window setup
}

/**
 * Register settings handlers
 */
export function registerSettingsHandlers(): void {
  ipcMain.handle('settings:getPreferences', wrapHandler(handleGetPreferences));
  ipcMain.handle('settings:savePreferences', wrapHandler(handleSavePreferences));
}

/**
 * Unregister settings handlers
 */
export function unregisterSettingsHandlers(): void {
  ipcMain.removeHandler('settings:getPreferences');
  ipcMain.removeHandler('settings:savePreferences');
}
```

---

### ☐ NEW: `/electron/ipc/files.ts`

File operations for avatar upload.

```typescript
/**
 * File IPC Handlers
 *
 * File system operations for the renderer process.
 */

import { ipcMain, type IpcMainInvokeEvent } from 'electron';
import { promises as fs } from 'fs';
import path from 'path';
import { wrapHandler, IPCErrors } from '../utils/ipc-error.js';

/**
 * Read file as base64 (for avatar images)
 */
async function handleReadAsBase64(
  _event: IpcMainInvokeEvent,
  filePath: string
): Promise<string> {
  if (!filePath) {
    throw IPCErrors.invalidArguments('File path is required');
  }

  try {
    // Security: Validate file exists and is readable
    const stats = await fs.stat(filePath);

    if (!stats.isFile()) {
      throw new Error('Path is not a file');
    }

    // Check file size (max 5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (stats.size > maxSize) {
      throw new Error('File size exceeds 5MB limit');
    }

    // Read file and convert to base64
    const buffer = await fs.readFile(filePath);
    const ext = path.extname(filePath).slice(1).toLowerCase();

    // Validate image extension
    const validExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
    if (!validExtensions.includes(ext)) {
      throw new Error('Invalid image format. Supported: JPG, PNG, GIF, WebP');
    }

    // Return as data URL
    const mimeType = ext === 'jpg' ? 'jpeg' : ext;
    return `data:image/${mimeType};base64,${buffer.toString('base64')}`;
  } catch (error) {
    throw new Error(
      `Failed to read file: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Register file handlers
 */
export function registerFileHandlers(): void {
  ipcMain.handle('file:readAsBase64', wrapHandler(handleReadAsBase64));
}

/**
 * Unregister file handlers
 */
export function unregisterFileHandlers(): void {
  ipcMain.removeHandler('file:readAsBase64');
}
```

---

## File Update Checklist

### ☐ UPDATE: `/electron/ipc/auth.ts`

Add password change handler.

```typescript
// Add this interface at the top with other types
interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
}

// Add this handler function
/**
 * Change user password
 */
async function handleChangePassword(
  _event: IpcMainInvokeEvent,
  data: ChangePasswordInput
): Promise<void> {
  if (!data.currentPassword || !data.newPassword) {
    throw IPCErrors.invalidArguments('Current and new password are required');
  }

  if (data.newPassword.length < 8) {
    throw IPCErrors.invalidArguments('New password must be at least 8 characters');
  }

  // Get current user from session
  const sessionData = getCurrentSession();
  if (!sessionData) {
    throw IPCErrors.unauthorized('Not authenticated');
  }

  const prisma = databaseService.getClient();

  // Get user with password
  const user = await prisma.user.findUnique({
    where: { id: sessionData.userId },
  });

  if (!user) {
    throw new Error('User not found');
  }

  // Verify current password
  const isValidPassword = await bcrypt.compare(
    data.currentPassword,
    user.passwordHash
  );

  if (!isValidPassword) {
    throw new Error('Current password is incorrect');
  }

  // Hash new password
  const newPasswordHash = await bcrypt.hash(data.newPassword, 10);

  // Update password
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: newPasswordHash },
  });

  // Optional: Invalidate all other sessions for security
  // This depends on your session management implementation
}

// Add to registerAuthHandlers()
export function registerAuthHandlers(): void {
  // ... existing handlers ...

  ipcMain.handle(
    'auth:changePassword',
    wrapWithLogging('auth:changePassword', wrapHandler(handleChangePassword))
  );
}

// Add to unregisterAuthHandlers()
export function unregisterAuthHandlers(): void {
  // ... existing handlers ...

  ipcMain.removeHandler('auth:changePassword');
}
```

---

### ☐ UPDATE: `/electron/ipc/dialog.ts`

Add file dialog handler.

```typescript
/**
 * Open file dialog
 */
async function handleOpenFile(
  _event: IpcMainInvokeEvent,
  options?: {
    title?: string;
    filters?: { name: string; extensions: string[] }[];
    properties?: Array<'openFile' | 'multiSelections'>;
  }
): Promise<{ canceled: boolean; filePaths: string[] }> {
  const result = await dialog.showOpenDialog({
    title: options?.title,
    filters: options?.filters,
    properties: options?.properties || ['openFile'],
  });

  return result;
}

// Add to registerDialogHandlers()
export function registerDialogHandlers(): void {
  // ... existing handler ...

  ipcMain.handle(
    'dialog:openFile',
    wrapWithLogging('dialog:openFile', wrapHandler(handleOpenFile))
  );
}

// Add to unregisterDialogHandlers()
export function unregisterDialogHandlers(): void {
  // ... existing handler ...

  ipcMain.removeHandler('dialog:openFile');
}
```

---

### ☐ UPDATE: `/electron/ipc/index.ts`

Register new handlers.

```typescript
// Add imports at top
import { registerClaudeHandlers, unregisterClaudeHandlers } from './claude.js';
import { registerSettingsHandlers, unregisterSettingsHandlers } from './settings.js';
import { registerFileHandlers, unregisterFileHandlers } from './files.js';

// Update registerIPCHandlers()
export function registerIPCHandlers(mainWindow: BrowserWindow): void {
  // ... existing handlers ...

  registerClaudeHandlers();
  registerSettingsHandlers();
  registerFileHandlers();

  // ... rest of function ...
}

// Update unregisterIPCHandlers()
export function unregisterIPCHandlers(): void {
  // ... existing handlers ...

  unregisterClaudeHandlers();
  unregisterSettingsHandlers();
  unregisterFileHandlers();

  // ... rest of function ...
}
```

---

## Type Definitions Checklist

### ☐ UPDATE: `/src/types/ipc.ts`

Add new channel type definitions.

#### 1. Add to `IpcChannels` interface (around line 1010-1195)

```typescript
// Add after auth:updateProfile channel
'auth:changePassword': (data: {
  currentPassword: string;
  newPassword: string;
}) => Promise<void>;

// Add after github channels (around line 1186)
// Claude API channels
'claude:saveApiKey': (key: string) => Promise<void>;
'claude:validateApiKey': () => Promise<{
  valid: boolean;
  model?: string;
  error?: string;
}>;
'claude:deleteApiKey': () => Promise<void>;
'claude:getApiKey': () => Promise<{ hasKey: boolean }>;

// Settings channels
'settings:getPreferences': () => Promise<{
  theme: 'light' | 'dark' | 'system';
  defaultTerminalCount: number;
  autoLaunchClaude: boolean;
  minimizeToTray: boolean;
}>;
'settings:savePreferences': (prefs: {
  theme: 'light' | 'dark' | 'system';
  defaultTerminalCount: number;
  autoLaunchClaude: boolean;
  minimizeToTray: boolean;
}) => Promise<void>;

// Add to dialog channels (after dialog:openDirectory)
'dialog:openFile': (options?: {
  title?: string;
  filters?: { name: string; extensions: string[] }[];
  properties?: Array<'openFile' | 'multiSelections'>;
}) => Promise<{ canceled: boolean; filePaths: string[] }>;

// File channels
'file:readAsBase64': (filePath: string) => Promise<string>;
```

#### 2. Add to `VALID_INVOKE_CHANNELS` array (around line 1308-1412)

```typescript
export const VALID_INVOKE_CHANNELS: readonly IpcChannelName[] = [
  // ... existing channels ...

  // Add after 'auth:updateProfile'
  'auth:changePassword',

  // Add after 'dialog:openDirectory'
  'dialog:openFile',

  // Add after 'github:createPR' (around line 1396)
  'claude:saveApiKey',
  'claude:validateApiKey',
  'claude:deleteApiKey',
  'claude:getApiKey',
  'settings:getPreferences',
  'settings:savePreferences',
  'file:readAsBase64',

  // ... rest of channels ...
] as const;
```

---

## Testing Checklist

After implementing all handlers:

### Unit Tests

- [ ] Claude API key encryption/decryption
- [ ] Claude API validation with mock Anthropic API
- [ ] Settings persistence across app restarts
- [ ] File base64 conversion
- [ ] Password change with bcrypt verification

### Integration Tests

- [ ] Upload avatar via file dialog
- [ ] Save and retrieve preferences
- [ ] Change password flow
- [ ] API key validation
- [ ] Theme switching

### Manual Tests

- [ ] Open Settings page
- [ ] Navigate between all 4 tabs
- [ ] Upload avatar image
- [ ] Change user name
- [ ] Change password with invalid current password (should fail)
- [ ] Change password successfully
- [ ] Save Claude API key
- [ ] Validate Claude API key
- [ ] Delete Claude API key
- [ ] Change theme (should apply immediately)
- [ ] Change terminal count
- [ ] Toggle auto-launch Claude
- [ ] Toggle minimize to tray
- [ ] Save preferences
- [ ] Restart app and verify preferences persisted
- [ ] View keyboard shortcuts

---

## Common Pitfalls

1. **safeStorage Availability**
   - Check `safeStorage.isEncryptionAvailable()` before using
   - Fallback to plain storage if unavailable (dev mode only)

2. **Base64 Data URLs**
   - Include correct MIME type prefix
   - Handle file extensions properly (jpg vs jpeg)

3. **Password Hashing**
   - Use bcrypt with salt rounds >= 10
   - Never store plain text passwords

4. **Preferences Timing**
   - Theme changes should apply immediately
   - Other preferences can wait for save

5. **Error Messages**
   - User-friendly messages in toast
   - Technical details in console/logs

---

## Dependencies Required

Already installed:
- `electron`
- `electron-store`
- `bcrypt`

May need to add:
- None (all dependencies present)

---

## Security Notes

1. **API Keys**: Always use `safeStorage` for encryption
2. **Passwords**: Use bcrypt with >= 10 salt rounds
3. **File Paths**: Validate and sanitize all paths from dialogs
4. **File Sizes**: Enforce 5MB limit for avatar uploads
5. **File Types**: Whitelist allowed image extensions
6. **Session Validation**: Always check auth before password changes

---

## Completion Criteria

Phase 14.3 is complete when:

- [ ] All TypeScript errors resolved
- [ ] All settings can be saved and loaded
- [ ] API keys are encrypted in electron-store
- [ ] Avatar upload works via native dialog
- [ ] Password changes are validated and secured
- [ ] Theme changes apply immediately
- [ ] All error cases handled gracefully
- [ ] Manual testing passed
- [ ] Code reviewed
- [ ] Documentation updated

---

## Estimated Timeline

| Task | Time | Priority |
|------|------|----------|
| Create claude.ts | 2 hours | High |
| Create settings.ts | 1 hour | High |
| Create files.ts | 30 min | High |
| Update auth.ts | 1 hour | High |
| Update dialog.ts | 30 min | Medium |
| Update index.ts | 15 min | Medium |
| Update ipc.ts types | 30 min | High |
| Testing | 2 hours | High |
| **Total** | **~7.5 hours** | |

---

## Getting Help

If you encounter issues:

1. Check `/docs/phase-14.3-settings-ui-implementation.md` for detailed specs
2. Review `/docs/phase-14.3-component-structure.md` for UI architecture
3. Look at existing IPC handlers (github.ts, auth.ts) for patterns
4. Check Electron docs for safeStorage and dialog APIs
5. Review shadcn/ui docs for component usage

---

## After Completion

1. Update main README.md with settings features
2. Create changelog entry for Phase 14.3
3. Tag release (if applicable)
4. Update project documentation
5. Demo to stakeholders
