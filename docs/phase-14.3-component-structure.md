# Phase 14.3: Settings UI Component Structure

## Component Tree

```
SettingsPage (/src/routes/settings.tsx)
│
├── Tabs (shadcn/ui)
│   │
│   ├── TabsList
│   │   ├── TabsTrigger: "Profile"
│   │   ├── TabsTrigger: "API Keys"
│   │   ├── TabsTrigger: "Preferences"
│   │   └── TabsTrigger: "Shortcuts"
│   │
│   ├── TabsContent: "profile"
│   │   └── ProfileSection
│   │       ├── Card: Profile Information
│   │       │   ├── Avatar upload (with native file dialog)
│   │       │   ├── Name input
│   │       │   ├── Email display (read-only)
│   │       │   └── Save Profile button
│   │       └── Card: Change Password
│   │           ├── Current password input (with show/hide)
│   │           ├── New password input (with show/hide)
│   │           ├── Confirm password input (with show/hide)
│   │           └── Change Password button
│   │
│   ├── TabsContent: "api-keys"
│   │   └── ApiKeysSection
│   │       ├── Card: Claude API Key
│   │       │   ├── API key input (masked, with show/hide)
│   │       │   ├── Status badge (Valid/Invalid/Not Configured)
│   │       │   ├── Save Key button
│   │       │   ├── Test Connection button
│   │       │   ├── Delete Key button
│   │       │   ├── Validation result alert
│   │       │   └── API info section
│   │       └── GitHubTokenSettings (existing component)
│   │           ├── GitHub token input
│   │           ├── Save/Validate/Delete buttons
│   │           └── Token validation feedback
│   │
│   ├── TabsContent: "preferences"
│   │   └── PreferencesSection
│   │       └── Card: Application Preferences
│   │           ├── Theme selector (Light/Dark/System)
│   │           ├── Default terminal count (1-12)
│   │           ├── Auto-launch Claude toggle
│   │           ├── Minimize to tray toggle
│   │           └── Save Preferences button
│   │
│   └── TabsContent: "shortcuts"
│       └── KeyboardShortcutsSection
│           └── Card: Keyboard Shortcuts
│               ├── Info banner (display only)
│               ├── Navigation shortcuts table
│               ├── Tasks shortcuts table
│               ├── Terminals shortcuts table
│               ├── General shortcuts table
│               └── Platform notice (⌘ vs Ctrl)
```

## Component Files & Stats

| File | Lines of Code | Size | Purpose |
|------|---------------|------|---------|
| `settings.tsx` | 43 | 1.3 KB | Main settings page with tabs |
| `ProfileSection.tsx` | 384 | 13 KB | User profile & password management |
| `ApiKeysSection.tsx` | 316 | 11 KB | Claude & GitHub API key management |
| `PreferencesSection.tsx` | 238 | 7.9 KB | Application preferences |
| `KeyboardShortcutsSection.tsx` | 236 | 6.9 KB | Keyboard shortcuts display |
| `index.ts` | 9 | 332 B | Barrel export |
| **Total** | **1,226** | **~39 KB** | **Complete settings UI** |

## Key Features by Component

### ProfileSection

**Avatar Management**
- Click "Upload Avatar" → Opens native file dialog
- Supports: JPG, PNG, GIF, WebP
- Max size: 5MB (enforced by backend)
- Preview shows immediately after selection
- Base64 encoding for storage

**Profile Editing**
- Name: Text input, real-time updates
- Email: Read-only, locked (shown as disabled)
- Changes tracked: Save button only enabled when changed

**Password Change**
- Current password: Required, masked by default
- New password: Minimum 8 characters, masked by default
- Confirm password: Must match new password
- All fields have show/hide toggle buttons
- Validates before submission
- Clears fields after successful change

### ApiKeysSection

**Claude API Key**
- Input validation: Must start with "sk-ant-"
- Masked by default (shows bullets)
- Show/hide toggle for visibility
- Save button: Encrypts using Electron safeStorage
- Test Connection: Makes real API call to Anthropic
- Status badge: Visual indicator (✓ Valid, ✗ Invalid, ○ Not Configured)
- Delete button: Removes stored key
- Link to Anthropic console for key generation

**GitHub Token**
- Reuses existing `GitHubTokenSettings` component
- Same UX patterns: masked input, show/hide, validate, delete
- Link to GitHub settings for token generation

### PreferencesSection

**Theme Selection**
- Select dropdown: Light / Dark / System
- Applies immediately on change (no save required for preview)
- Persisted to electron-store on save

**Terminal Configuration**
- Number input: 1-12 terminals
- Default value: 4
- Used when creating new tasks

**Behavioral Toggles**
- Auto-launch Claude: Switch component
- Minimize to tray: Switch component
- Clear visual states (on/off)

**Change Detection**
- Save button only enabled when preferences differ from stored values
- Shows loading spinner during save operation

### KeyboardShortcutsSection

**Organized by Category**
- Navigation (8 shortcuts): Page navigation, sidebar toggle
- Tasks (2 shortcuts): New task, search
- Terminals (3 shortcuts): New, close, clear
- General (2 shortcuts): Refresh, quit

**Visual Display**
- Table format with 3 columns: Action | Description | Shortcut
- Keyboard keys shown as styled kbd elements
- Platform-aware: ⌘ for macOS, Ctrl for Windows/Linux
- Display-only badge: Indicates customization coming in future

**Shortcuts List**
```
Navigation:
- ⌘⇧D → Dashboard
- ⌘⇧P → Projects
- ⌘⇧T → Tasks
- ⌘⇧R → Roadmap
- ⌘⇧M → Memory
- ⌘⇧I → Insights
- ⌘, → Settings
- ⌘B → Toggle Sidebar

Tasks:
- ⌘N → New Task
- ⌘K → Search Tasks

Terminals:
- ⌘T → New Terminal
- ⌘W → Close Terminal
- ⌘L → Clear Terminal

General:
- ⌘R → Refresh
- ⌘Q → Quit Application
```

## State Management

### Local State (useState)
Each component manages its own form state:
- `ProfileSection`: name, avatar, passwords, show/hide toggles
- `ApiKeysSection`: claudeApiKey, showKey, validationResult
- `PreferencesSection`: theme, terminalCount, toggles

### Server State (useIPCQuery/Mutation)
Data fetched from/sent to main process:
- `ProfileSection`: user data (via useAuth), password mutations
- `ApiKeysSection`: key validation, save/delete operations
- `PreferencesSection`: load/save preferences

### Optimistic Updates
- Theme changes apply immediately (before save)
- Other changes require explicit save button

## IPC Communications

### Profile Tab
```typescript
// Get current user (via AuthContext)
useAuth() → { user, updateProfile }

// Upload avatar
invoke('dialog:openFile') → { filePaths: string[] }
invoke('file:readAsBase64', filePath) → base64String
invoke('auth:updateProfile', { avatar }) → User

// Change password
invoke('auth:changePassword', {
  currentPassword,
  newPassword
}) → void
```

### API Keys Tab
```typescript
// Claude API key
invoke('claude:getApiKey') → { hasKey: boolean }
invoke('claude:saveApiKey', key) → void
invoke('claude:validateApiKey') → {
  valid: boolean,
  model?: string,
  error?: string
}
invoke('claude:deleteApiKey') → void

// GitHub token (existing handlers)
invoke('github:getToken') → { hasToken: boolean }
invoke('github:saveToken', token) → void
invoke('github:validateToken') → GitHubTokenValidation
invoke('github:deleteToken') → void
```

### Preferences Tab
```typescript
invoke('settings:getPreferences') → {
  theme: 'light' | 'dark' | 'system',
  defaultTerminalCount: number,
  autoLaunchClaude: boolean,
  minimizeToTray: boolean
}

invoke('settings:savePreferences', preferences) → void
```

### Shortcuts Tab
No IPC calls (display only)

## Error Handling

### Loading States
- Skeleton loaders during data fetch
- Spinner in buttons during mutations
- Disabled inputs during operations

### Error Display
- Toast notifications for all errors
- Inline validation messages
- Alert components for critical feedback

### Validation
- Client-side validation before IPC calls
- Format checks (API keys, passwords)
- Range validation (terminal count)
- Confirmation matching (password change)

## Accessibility

- All inputs have associated labels
- Keyboard navigation supported
- Tab order follows logical flow
- ARIA attributes on custom components
- Focus management in dialogs
- Error messages announced to screen readers

## Responsive Design

- Tabs stack on mobile (grid-cols-4 → single column)
- Form layouts adapt to screen width
- Tables scrollable on small screens
- Consistent spacing using Tailwind utilities

## Design System

### Components Used
- `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`
- `Input`, `Label`, `Button`
- `Select`, `SelectTrigger`, `SelectValue`, `SelectContent`, `SelectItem`
- `Switch`
- `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent`
- `Table`, `TableHeader`, `TableBody`, `TableRow`, `TableHead`, `TableCell`
- `Badge`, `Alert`, `AlertDescription`
- `Avatar`, `AvatarImage`, `AvatarFallback`

### Icons Used (lucide-react)
- `Upload`, `Eye`, `EyeOff`, `Loader2`
- `Check`, `X`, `Trash2`, `ExternalLink`
- `GripVertical`

### Color Tokens
- `text-muted-foreground` - Secondary text
- `bg-muted` - Subtle backgrounds
- `border-border` - Component borders
- `text-destructive` - Delete actions
- `text-primary` - Links and accents

## Future Enhancements

1. **Keyboard Shortcuts Customization**
   - Allow users to edit shortcuts
   - Conflict detection
   - Reset to defaults button

2. **Advanced Preferences**
   - Font size settings
   - Terminal shell selection
   - Auto-save intervals

3. **Profile Enhancements**
   - Social links
   - Bio field
   - 2FA settings

4. **API Key Management**
   - Multiple API keys per service
   - Key rotation scheduling
   - Usage statistics

5. **Import/Export**
   - Export settings as JSON
   - Import settings from file
   - Sync settings across devices
