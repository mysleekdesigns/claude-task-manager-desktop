# Phase 14.3: Settings UI Implementation

## Status: Components Created ✅ | Backend Required ⚠️

## Completed Work

### 1. Frontend Components Created

All four settings section components have been created in `/src/components/settings/`:

1. **ProfileSection.tsx** - User profile management
   - Avatar upload (uses native file dialog)
   - Name input field
   - Email display (read-only)
   - Change password form with show/hide toggle

2. **ApiKeysSection.tsx** - API key management
   - Claude API key input with validation
   - GitHub token management (reuses existing GitHubTokenSettings component)
   - Masked inputs with show/hide toggle
   - Test connection buttons

3. **PreferencesSection.tsx** - Application preferences
   - Theme selector (Light/Dark/System)
   - Default terminal count (1-12)
   - Auto-launch Claude toggle
   - Minimize to tray toggle

4. **KeyboardShortcutsSection.tsx** - Keyboard shortcuts display
   - Categorized shortcuts table (Navigation, Tasks, Terminals, General)
   - Display-only (customization marked as future enhancement)
   - Platform-specific key display (⌘ for macOS, Ctrl for Windows/Linux)

### 2. Settings Page Updated

The `/src/routes/settings.tsx` file has been updated to:
- Use shadcn/ui Tabs component for navigation
- Display all four sections in separate tabs
- Provide clean, organized UX

## Required Backend Implementation

The following IPC handlers and channels need to be implemented in the Electron main process:

### 1. Authentication Handlers (electron/ipc/auth.ts)

Add to existing auth handlers:

```typescript
/**
 * Change user password
 */
async function handleChangePassword(
  _event: IpcMainInvokeEvent,
  data: { currentPassword: string; newPassword: string }
): Promise<void> {
  // 1. Get current user from session
  // 2. Verify current password with bcrypt
  // 3. Hash new password with bcrypt
  // 4. Update user password in database
  // 5. Invalidate all other sessions (optional security)
}
```

### 2. Claude API Handlers (electron/ipc/claude.ts - NEW FILE)

Create new file for Claude API key management:

```typescript
/**
 * Save Claude API key to electron-store (encrypted)
 */
async function handleSaveApiKey(
  _event: IpcMainInvokeEvent,
  key: string
): Promise<void> {
  // Use safeStorage to encrypt the API key
  const encrypted = safeStorage.encryptString(key);
  store.set('claude.apiKey', encrypted);
}

/**
 * Validate Claude API key by making test request
 */
async function handleValidateApiKey(
  _event: IpcMainInvokeEvent
): Promise<{ valid: boolean; model?: string; error?: string }> {
  // 1. Get encrypted key from store
  // 2. Decrypt with safeStorage
  // 3. Make test API request to Anthropic
  // 4. Return validation result
}

/**
 * Delete Claude API key
 */
async function handleDeleteApiKey(
  _event: IpcMainInvokeEvent
): Promise<void> {
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
```

### 3. Settings/Preferences Handlers (electron/ipc/settings.ts - NEW FILE)

Create new file for app preferences:

```typescript
interface Preferences {
  theme: 'light' | 'dark' | 'system';
  defaultTerminalCount: number;
  autoLaunchClaude: boolean;
  minimizeToTray: boolean;
}

/**
 * Get user preferences from electron-store
 */
async function handleGetPreferences(
  _event: IpcMainInvokeEvent
): Promise<Preferences> {
  return {
    theme: store.get('preferences.theme', 'system'),
    defaultTerminalCount: store.get('preferences.defaultTerminalCount', 4),
    autoLaunchClaude: store.get('preferences.autoLaunchClaude', false),
    minimizeToTray: store.get('preferences.minimizeToTray', true),
  };
}

/**
 * Save user preferences to electron-store
 */
async function handleSavePreferences(
  _event: IpcMainInvokeEvent,
  prefs: Preferences
): Promise<void> {
  store.set('preferences.theme', prefs.theme);
  store.set('preferences.defaultTerminalCount', prefs.defaultTerminalCount);
  store.set('preferences.autoLaunchClaude', prefs.autoLaunchClaude);
  store.set('preferences.minimizeToTray', prefs.minimizeToTray);

  // Apply theme change immediately if needed
  // Update tray behavior if minimizeToTray changed
}
```

### 4. Dialog Handlers (electron/ipc/dialog.ts)

Add to existing dialog handlers:

```typescript
/**
 * Open file dialog (for avatar upload)
 */
async function handleOpenFile(
  _event: IpcMainInvokeEvent,
  options: {
    title?: string;
    filters?: { name: string; extensions: string[] }[];
    properties?: Array<'openFile' | 'multiSelections'>;
  }
): Promise<{ canceled: boolean; filePaths: string[] }> {
  const result = await dialog.showOpenDialog({
    title: options.title,
    filters: options.filters,
    properties: options.properties || ['openFile'],
  });

  return result;
}
```

### 5. File Handlers (electron/ipc/files.ts - NEW FILE)

Create new file for file operations:

```typescript
/**
 * Read file as base64 (for avatar images)
 */
async function handleReadAsBase64(
  _event: IpcMainInvokeEvent,
  filePath: string
): Promise<string> {
  const buffer = await fs.promises.readFile(filePath);
  return `data:image/${path.extname(filePath).slice(1)};base64,${buffer.toString('base64')}`;
}
```

## Required Type Definitions

Add to `/src/types/ipc.ts`:

```typescript
// Add to IpcChannels interface:

// Auth
'auth:changePassword': (data: {
  currentPassword: string;
  newPassword: string;
}) => Promise<void>;

// Claude API
'claude:saveApiKey': (key: string) => Promise<void>;
'claude:validateApiKey': () => Promise<{
  valid: boolean;
  model?: string;
  error?: string;
}>;
'claude:deleteApiKey': () => Promise<void>;
'claude:getApiKey': () => Promise<{ hasKey: boolean }>;

// Settings
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

// Dialog
'dialog:openFile': (options: {
  title?: string;
  filters?: { name: string; extensions: string[] }[];
  properties?: Array<'openFile' | 'multiSelections'>;
}) => Promise<{ canceled: boolean; filePaths: string[] }>;

// Files
'file:readAsBase64': (filePath: string) => Promise<string>;
```

Add to VALID_INVOKE_CHANNELS array:

```typescript
'auth:changePassword',
'claude:saveApiKey',
'claude:validateApiKey',
'claude:deleteApiKey',
'claude:getApiKey',
'settings:getPreferences',
'settings:savePreferences',
'dialog:openFile',
'file:readAsBase64',
```

## Register IPC Handlers

Update `/electron/ipc/index.ts`:

```typescript
import { registerClaudeHandlers, unregisterClaudeHandlers } from './claude.js';
import { registerSettingsHandlers, unregisterSettingsHandlers } from './settings.js';
import { registerFileHandlers, unregisterFileHandlers } from './files.js';

export function registerIPCHandlers(mainWindow: BrowserWindow): void {
  // ... existing handlers ...
  registerClaudeHandlers();
  registerSettingsHandlers();
  registerFileHandlers();
}

export function unregisterIPCHandlers(): void {
  // ... existing handlers ...
  unregisterClaudeHandlers();
  unregisterSettingsHandlers();
  unregisterFileHandlers();
}
```

## Security Considerations

1. **API Keys**: Use Electron's `safeStorage` API to encrypt sensitive data (Claude API key, GitHub token)
2. **Password Changes**: Always verify current password before allowing changes
3. **File Upload**: Validate file types and sizes for avatar uploads (max 5MB)
4. **Path Validation**: Sanitize and validate all file paths from dialogs

## Testing Checklist

Once backend is implemented:

- [ ] Profile avatar upload works with native file dialog
- [ ] Profile name can be updated
- [ ] Password change validates current password
- [ ] Password change requires minimum 8 characters
- [ ] Password change confirms matching passwords
- [ ] Claude API key can be saved with encryption
- [ ] Claude API key validation makes real API call
- [ ] GitHub token management still works (existing functionality)
- [ ] Theme changes apply immediately
- [ ] Terminal count validation (1-12)
- [ ] Preferences are persisted across app restarts
- [ ] Keyboard shortcuts display correctly
- [ ] Tabs navigation works smoothly
- [ ] All loading states display properly
- [ ] All error messages are user-friendly

## Files Created

- `/src/components/settings/ProfileSection.tsx`
- `/src/components/settings/ApiKeysSection.tsx`
- `/src/components/settings/PreferencesSection.tsx`
- `/src/components/settings/KeyboardShortcutsSection.tsx`
- `/src/routes/settings.tsx` (updated)
- `/docs/phase-14.3-settings-ui-implementation.md` (this file)

## Files to Create

- `/electron/ipc/claude.ts`
- `/electron/ipc/settings.ts`
- `/electron/ipc/files.ts`
- Update `/electron/ipc/auth.ts`
- Update `/electron/ipc/dialog.ts`
- Update `/electron/ipc/index.ts`
- Update `/src/types/ipc.ts`

## Next Steps

1. Create the backend IPC handlers listed above
2. Update type definitions in `src/types/ipc.ts`
3. Register new handlers in `electron/ipc/index.ts`
4. Test all settings functionality end-to-end
5. Add E2E tests for settings page interactions
