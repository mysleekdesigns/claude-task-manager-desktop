# Phase 14.2: Settings IPC Handlers Implementation

## Summary

Successfully implemented Phase 14.2 Settings IPC Handlers for the Claude Tasks Desktop Electron application. All required IPC handlers have been created following the existing patterns and best practices.

## Files Created

### 1. `/electron/ipc/settings.ts`
Created new IPC handlers file with the following handlers:

#### `settings:get`
- **Purpose:** Get user settings by userId
- **Parameters:** `userId: string`
- **Returns:** `UserSettingsResponse` (includes theme, terminal count, flags, etc.)
- **Features:**
  - Auto-creates default settings if they don't exist (upsert pattern)
  - Parses JSON fields (keyboardShortcuts)
  - Returns boolean flags for API key existence (not the actual keys)
  - Retrieves encrypted API keys from electron-store

#### `settings:update`
- **Purpose:** Update general settings (theme, defaultTerminalCount, autoLaunchClaude, minimizeToTray)
- **Parameters:** `userId: string`, `data: UpdateSettingsInput`
- **Returns:** `UserSettingsResponse`
- **Features:**
  - Validates theme values (light, dark, system)
  - Validates terminal count (1-10)
  - Uses upsert to ensure settings exist
  - Handles keyboard shortcuts JSON serialization

#### `settings:updateApiKey`
- **Purpose:** Update API keys (claudeApiKey, githubToken) with secure encryption
- **Parameters:** `userId: string`, `data: UpdateApiKeyInput`
- **Returns:** `{ success: boolean }`
- **Features:**
  - Stores API keys in encrypted electron-store (not in database)
  - Uses separate encryption key for API keys
  - Validates user exists before updating
  - Updates UserSettings timestamp when keys change
  - Supports partial updates (can update just one key)

#### `settings:updateProfile`
- **Purpose:** Update user profile (name, avatar, password change)
- **Parameters:** `data: UpdateProfileInput`
- **Returns:** User profile data
- **Features:**
  - Retrieves current user from session (no userId needed)
  - Password change requires current password verification
  - Validates new password strength with existing auth service
  - Hashes password with bcrypt
  - Supports updating name and avatar independently
  - Proper error handling for authentication failures

## Files Modified

### 1. `/electron/ipc/index.ts`
- Added import for `registerSettingsHandlers` and `unregisterSettingsHandlers`
- Registered settings handlers in `registerIPCHandlers()` function
- Added settings handlers to `unregisterIPCHandlers()` function

### 2. `/electron/preload.ts`
- Added new IPC channels to `VALID_INVOKE_CHANNELS` whitelist:
  - `settings:get`
  - `settings:update`
  - `settings:updateApiKey`
  - `settings:updateProfile`

## Security Features

### 1. Encrypted API Key Storage
- Uses electron-store with encryption for API keys
- Separate encryption key: `claude-tasks-api-keys-encryption-key`
- API keys stored outside database for enhanced security
- Keys stored per user: `user_${userId}` keys in store

### 2. Password Handling
- Current password verification required for password changes
- Password validation using existing auth service
- bcrypt hashing with 12 salt rounds
- Passwords redacted in logs

### 3. Session Validation
- Profile updates require valid session
- Session expiry checking
- Automatic session cleanup on expiry
- Authentication errors properly handled

### 4. Logging Security
- Sensitive data redacted in logs:
  - API keys shown as `[REDACTED]`
  - Passwords shown as `[REDACTED]`
  - Current/new passwords sanitized in request logs
- Full logging integration using existing IPC logger

## Data Flow

### Settings Retrieval
```
Renderer → settings:get(userId)
  ↓
Main Process:
  1. Fetch/create UserSettings from database
  2. Parse JSON fields (keyboardShortcuts)
  3. Check encrypted store for API keys (boolean flags only)
  4. Return UserSettingsResponse
  ↓
Renderer receives settings
```

### API Key Update
```
Renderer → settings:updateApiKey(userId, { claudeApiKey, githubToken })
  ↓
Main Process:
  1. Verify user exists in database
  2. Get existing keys from encrypted store
  3. Merge with new keys
  4. Save to encrypted electron-store
  5. Update UserSettings timestamp
  ↓
Renderer receives success confirmation
```

### Profile Update with Password
```
Renderer → settings:updateProfile({ name, avatar, currentPassword, newPassword })
  ↓
Main Process:
  1. Get current user from session
  2. Verify current password
  3. Validate new password strength
  4. Hash new password
  5. Update user in database
  ↓
Renderer receives updated profile
```

## Type Definitions

### UserSettingsResponse
```typescript
interface UserSettingsResponse {
  id: string;
  userId: string;
  theme: string;
  defaultTerminalCount: number;
  autoLaunchClaude: boolean;
  minimizeToTray: boolean;
  keyboardShortcuts: Record<string, string> | null;
  hasClaudeApiKey: boolean;      // Security: boolean flag, not actual key
  hasGithubToken: boolean;        // Security: boolean flag, not actual key
  createdAt: Date;
  updatedAt: Date;
}
```

### UpdateSettingsInput
```typescript
interface UpdateSettingsInput {
  theme?: string;                 // 'light' | 'dark' | 'system'
  defaultTerminalCount?: number;  // 1-10
  autoLaunchClaude?: boolean;
  minimizeToTray?: boolean;
  keyboardShortcuts?: Record<string, string>;
}
```

### UpdateApiKeyInput
```typescript
interface UpdateApiKeyInput {
  claudeApiKey?: string;
  githubToken?: string;
}
```

### UpdateProfileInput
```typescript
interface UpdateProfileInput {
  name?: string;
  avatar?: string;
  currentPassword?: string;       // Required if newPassword is provided
  newPassword?: string;
}
```

## Database Schema

Uses existing `UserSettings` model from Prisma schema:

```prisma
model UserSettings {
  id                   String   @id @default(cuid())
  userId               String   @unique
  claudeApiKey         String?  // Deprecated - now in electron-store
  githubToken          String?  // Deprecated - now in electron-store
  defaultTerminalCount Int      @default(2)
  theme                String   @default("system")
  keyboardShortcuts    String?  // JSON string
  autoLaunchClaude     Boolean  @default(true)
  minimizeToTray       Boolean  @default(true)
  createdAt            DateTime @default(now())
  updatedAt            DateTime @updatedAt

  user                 User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

**Note:** The `claudeApiKey` and `githubToken` fields in the database are now deprecated in favor of electron-store encryption. The implementation uses the encrypted store but maintains the schema fields for backward compatibility.

## Error Handling

### Validation Errors
- Invalid theme values
- Terminal count out of range (1-10)
- Missing required fields
- Invalid email format
- Weak passwords

### Authentication Errors
- Invalid session
- Expired session
- Incorrect current password
- Missing current password for password change

### Database Errors
- User not found (P2025)
- Settings not found (auto-creates)
- Unique constraint violations

## Testing Checklist

- [ ] Get settings for existing user
- [ ] Get settings for new user (auto-create)
- [ ] Update theme setting
- [ ] Update terminal count (valid range)
- [ ] Update terminal count (invalid range - should fail)
- [ ] Update autoLaunchClaude flag
- [ ] Update minimizeToTray flag
- [ ] Update keyboard shortcuts JSON
- [ ] Store Claude API key (encrypted)
- [ ] Store GitHub token (encrypted)
- [ ] Update profile name
- [ ] Update profile avatar
- [ ] Change password with valid current password
- [ ] Change password with invalid current password (should fail)
- [ ] Change password with weak new password (should fail)
- [ ] Update profile without password change
- [ ] Verify API keys are encrypted in electron-store
- [ ] Verify sensitive data is redacted in logs

## Next Steps

To complete Phase 14, the following tasks remain:

1. **Phase 14.3 - Settings UI:**
   - Create `/settings` page
   - Build Profile section (avatar upload, name, password change)
   - Build API Keys section (masked inputs, test connections)
   - Build Preferences section (theme, terminal count, toggles)
   - Build Keyboard Shortcuts section

2. **Phase 14.4 - Theme System:**
   - Implement theme persistence
   - Support system theme detection
   - Apply theme to all components
   - Support theme switching without restart

3. **IPC Type Definitions:**
   - Add settings handlers to `src/types/ipc.ts`
   - Update renderer-side hooks to support settings operations

## Code Quality

- Follows existing IPC handler patterns from auth.ts and projects.ts
- Uses consistent error handling with IPCErrors utility
- Implements comprehensive logging with sanitization
- Type-safe with full TypeScript support
- Secure API key storage with encryption
- Proper session management
- Input validation on all handlers
- Prisma best practices (upsert, transactions)

## Files Summary

```
electron/ipc/settings.ts          - NEW (485 lines)
electron/ipc/index.ts             - MODIFIED (added settings handlers)
electron/preload.ts               - MODIFIED (whitelisted 4 new channels)
docs/PHASE_14_2_SETTINGS_IPC_HANDLERS.md - NEW (this file)
```

## Verification

TypeScript compilation: ✅ PASSED (settings handlers compiled successfully)
IPC handler registration: ✅ IMPLEMENTED
Preload whitelist: ✅ UPDATED
Security measures: ✅ IMPLEMENTED
Error handling: ✅ COMPREHENSIVE
Logging: ✅ INTEGRATED

Phase 14.2 Settings IPC Handlers implementation is **COMPLETE**.
