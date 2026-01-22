---
name: electron-security
description: Electron application security patterns, vulnerability detection, and secure coding practices. Use when auditing security, implementing secure features, or reviewing code for vulnerabilities.
allowed-tools: Read, Bash, Glob, Grep
---

# Electron Security Patterns

## Overview

Security is critical in Electron applications because they combine web technologies with Node.js capabilities. A compromised renderer process with improper configuration could lead to full system access.

## Security Checklist

### Required BrowserWindow Settings

```typescript
// electron/main.ts
const mainWindow = new BrowserWindow({
  webPreferences: {
    // REQUIRED: Prevents renderer from accessing Node.js APIs
    nodeIntegration: false,

    // REQUIRED: Isolates preload script from renderer context
    contextIsolation: true,

    // REQUIRED: Enforces same-origin policy (default true)
    webSecurity: true,

    // RECOMMENDED: Enables Chromium OS-level sandbox
    sandbox: true,

    // Path to preload script
    preload: path.join(__dirname, 'preload.js'),
  },
});
```

### Dangerous Settings to NEVER Use

```typescript
// NEVER DO THIS
new BrowserWindow({
  webPreferences: {
    nodeIntegration: true,           // DANGEROUS: Full Node.js access
    contextIsolation: false,         // DANGEROUS: No script isolation
    webSecurity: false,              // DANGEROUS: Disables same-origin
    allowRunningInsecureContent: true, // DANGEROUS: Mixed content
    enableRemoteModule: true,        // DEPRECATED and DANGEROUS
  },
});
```

## Secure IPC Patterns

### Safe: ipcMain.handle (Request-Response)

```typescript
// electron/ipc/files.ts
import { ipcMain, dialog } from 'electron';
import path from 'path';
import fs from 'fs/promises';

// Allowed base directories
const ALLOWED_BASES = [
  app.getPath('userData'),
  app.getPath('documents'),
];

function isPathAllowed(filePath: string): boolean {
  const normalized = path.normalize(filePath);
  return ALLOWED_BASES.some(base =>
    normalized.startsWith(base) && !normalized.includes('..')
  );
}

ipcMain.handle('files:read', async (_, filePath: string) => {
  // ALWAYS validate paths
  if (!isPathAllowed(filePath)) {
    throw new Error('Access denied: path not allowed');
  }

  return fs.readFile(filePath, 'utf-8');
});
```

### Dangerous: Unvalidated Shell Commands

```typescript
// DANGEROUS - Never do this
ipcMain.handle('shell:execute', async (_, command: string) => {
  // User-controlled command execution = Remote Code Execution
  return execSync(command);
});

// SAFE Alternative - Predefined commands only
const ALLOWED_COMMANDS = {
  'git-status': ['git', 'status'],
  'git-log': ['git', 'log', '--oneline', '-10'],
} as const;

ipcMain.handle('shell:execute', async (_, commandId: keyof typeof ALLOWED_COMMANDS, cwd: string) => {
  if (!isPathAllowed(cwd)) {
    throw new Error('Access denied');
  }

  const [cmd, ...args] = ALLOWED_COMMANDS[commandId];
  return execFileSync(cmd, args, { cwd, encoding: 'utf-8' });
});
```

## Preload Script Security

### Minimal API Surface

```typescript
// electron/preload.ts
import { contextBridge, ipcRenderer } from 'electron';

// Whitelist of allowed channels
const ALLOWED_INVOKE_CHANNELS = [
  'auth:login',
  'auth:logout',
  'projects:list',
  'tasks:list',
  'dialog:openDirectory',
] as const;

const ALLOWED_ON_CHANNELS = [
  'terminal:output',
  'task:updated',
] as const;

type InvokeChannel = typeof ALLOWED_INVOKE_CHANNELS[number];
type OnChannel = typeof ALLOWED_ON_CHANNELS[number];

contextBridge.exposeInMainWorld('electron', {
  invoke: (channel: InvokeChannel, ...args: unknown[]) => {
    // Validate channel
    if (!ALLOWED_INVOKE_CHANNELS.includes(channel)) {
      throw new Error(`Invalid channel: ${channel}`);
    }
    return ipcRenderer.invoke(channel, ...args);
  },

  on: (channel: OnChannel, callback: (...args: unknown[]) => void) => {
    if (!ALLOWED_ON_CHANNELS.includes(channel)) {
      throw new Error(`Invalid channel: ${channel}`);
    }

    const subscription = (_: Electron.IpcRendererEvent, ...args: unknown[]) =>
      callback(...args);
    ipcRenderer.on(channel, subscription);

    // Return unsubscribe function
    return () => ipcRenderer.removeListener(channel, subscription);
  },
});
```

### Never Expose These

```typescript
// NEVER DO THIS
contextBridge.exposeInMainWorld('dangerous', {
  // Direct Node.js access
  require: require,
  fs: require('fs'),
  childProcess: require('child_process'),

  // Raw IPC access
  ipcRenderer: ipcRenderer,

  // Process info
  process: process,
});
```

## Content Security Policy

### Recommended CSP

```typescript
// electron/main.ts
import { session } from 'electron';

app.whenReady().then(() => {
  // Set CSP for all responses
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          [
            "default-src 'self'",
            "script-src 'self'",
            "style-src 'self' 'unsafe-inline'", // Needed for some UI libraries
            "img-src 'self' data: https:",
            "font-src 'self'",
            "connect-src 'self'",
            "frame-ancestors 'none'",
          ].join('; '),
        ],
      },
    });
  });
});
```

## shell.openExternal Security

### Safe URL Opening

```typescript
// electron/ipc/shell.ts
import { ipcMain, shell } from 'electron';

const ALLOWED_PROTOCOLS = ['https:', 'mailto:'];
const BLOCKED_DOMAINS = ['malware.com', 'phishing.net'];

ipcMain.handle('shell:openExternal', async (_, url: string) => {
  let parsedUrl: URL;

  try {
    parsedUrl = new URL(url);
  } catch {
    throw new Error('Invalid URL');
  }

  // Protocol whitelist
  if (!ALLOWED_PROTOCOLS.includes(parsedUrl.protocol)) {
    throw new Error(`Protocol not allowed: ${parsedUrl.protocol}`);
  }

  // Domain blacklist
  if (BLOCKED_DOMAINS.some(d => parsedUrl.hostname.includes(d))) {
    throw new Error('Domain blocked');
  }

  // Safe to open
  await shell.openExternal(url);
});
```

## XSS Prevention in React

### Dangerous Patterns

```tsx
// DANGEROUS - XSS vulnerability
function Comment({ html }: { html: string }) {
  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}

// DANGEROUS - Direct innerHTML
function RawContent({ content }: { content: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ref.current) {
      ref.current.innerHTML = content; // XSS!
    }
  }, [content]);
  return <div ref={ref} />;
}
```

### Safe Alternatives

```tsx
// SAFE - Use DOMPurify for HTML sanitization
import DOMPurify from 'dompurify';

function SafeComment({ html }: { html: string }) {
  const sanitized = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['p', 'b', 'i', 'em', 'strong', 'a'],
    ALLOWED_ATTR: ['href'],
  });
  return <div dangerouslySetInnerHTML={{ __html: sanitized }} />;
}

// SAFE - Use markdown parser with sanitization
import { marked } from 'marked';
import DOMPurify from 'dompurify';

function MarkdownContent({ markdown }: { markdown: string }) {
  const html = DOMPurify.sanitize(marked.parse(markdown));
  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}

// SAFEST - Avoid HTML entirely, use React components
function Comment({ text }: { text: string }) {
  return <p>{text}</p>; // React auto-escapes
}
```

## SQL Injection Prevention (Prisma)

### Safe: Prisma Query Builder

```typescript
// SAFE - Prisma automatically parameterizes
const task = await prisma.task.findFirst({
  where: {
    title: userInput, // Safe: parameterized
    projectId: projectId,
  },
});

// SAFE - Prisma parameterized operations
await prisma.task.update({
  where: { id: taskId },
  data: { title: userInput }, // Safe
});
```

### Careful: Raw Queries

```typescript
// DANGEROUS - String concatenation
const result = await prisma.$queryRaw`
  SELECT * FROM Task WHERE title = '${userInput}'
`; // SQL INJECTION!

// SAFE - Use Prisma.sql template
import { Prisma } from '@prisma/client';

const result = await prisma.$queryRaw`
  SELECT * FROM Task WHERE title = ${userInput}
`; // Safe: parameterized by template literal

// SAFE - Explicit parameterization
const result = await prisma.$queryRaw(
  Prisma.sql`SELECT * FROM Task WHERE title = ${userInput}`
);
```

## Credential Storage

### Safe: Electron safeStorage

```typescript
// electron/services/credentials.ts
import { safeStorage } from 'electron';
import Store from 'electron-store';

const store = new Store({ name: 'secure-credentials' });

export function storeCredential(key: string, value: string): void {
  if (safeStorage.isEncryptionAvailable()) {
    const encrypted = safeStorage.encryptString(value);
    store.set(key, encrypted.toString('base64'));
  } else {
    throw new Error('Encryption not available');
  }
}

export function getCredential(key: string): string | null {
  const encrypted = store.get(key) as string | undefined;
  if (!encrypted) return null;

  const buffer = Buffer.from(encrypted, 'base64');
  return safeStorage.decryptString(buffer);
}
```

### Never: Plain Text Storage

```typescript
// NEVER DO THIS
localStorage.setItem('apiKey', secretKey);
store.set('password', password);
fs.writeFileSync('config.json', JSON.stringify({ token }));
```

## Path Traversal Prevention

```typescript
// electron/services/files.ts
import path from 'path';
import { app } from 'electron';

const USER_DATA = app.getPath('userData');
const PROJECTS_DIR = path.join(USER_DATA, 'projects');

export function getSafeProjectPath(projectId: string, filename: string): string {
  // Sanitize inputs
  const safeProjectId = projectId.replace(/[^a-zA-Z0-9-_]/g, '');
  const safeFilename = path.basename(filename); // Remove path components

  const fullPath = path.join(PROJECTS_DIR, safeProjectId, safeFilename);
  const normalized = path.normalize(fullPath);

  // Verify path is within allowed directory
  if (!normalized.startsWith(PROJECTS_DIR)) {
    throw new Error('Path traversal detected');
  }

  return normalized;
}
```

## Vulnerability Search Patterns

```bash
# Find potential XSS
grep -rn "dangerouslySetInnerHTML\|innerHTML" src/

# Find raw SQL
grep -rn "\$queryRaw\|\$executeRaw" electron/

# Find shell execution
grep -rn "exec\|spawn\|execFile\|execSync" electron/

# Find credential handling
grep -rn "password\|apiKey\|secret\|token" --include="*.ts" .

# Find file operations
grep -rn "readFile\|writeFile\|unlink\|rmdir" electron/

# Find URL opening
grep -rn "shell.openExternal" .

# Find nodeIntegration settings
grep -rn "nodeIntegration\|contextIsolation" electron/
```

## Security Audit Commands

```bash
# Dependency vulnerabilities
npm audit
npm audit --json > audit-report.json

# Outdated packages
npm outdated

# License check
npx license-checker --summary

# Find secrets in code
npx secretlint "**/*"

# TypeScript security rules (if eslint configured)
npm run lint -- --rule '@typescript-eslint/no-unsafe-assignment: error'
```
