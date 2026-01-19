# Native Modules Architecture

## Overview

This document explains how native Node.js modules are handled in the Claude Tasks Desktop application, particularly focusing on node-pty (terminal emulation) and better-sqlite3 (database).

## What Are Native Modules?

Native modules are Node.js packages that contain compiled C/C++ code (.node files). Unlike pure JavaScript modules, they cannot be easily bundled or transpiled. Examples include:

- **node-pty**: Creates pseudo-terminal sessions (used for terminal emulation)
- **better-sqlite3**: High-performance SQLite binding
- **bcryptjs**: Cryptographic functions (pure JS, but treated as external)

## The Challenge

When building Electron applications with bundlers like Vite/Webpack, there's a conflict:

1. **Bundlers want to include everything** - They want to create a single bundle file
2. **Native modules need to stay external** - They contain platform-specific binaries that can't be bundled
3. **ASAR compresses files** - electron-builder's ASAR format makes binaries inaccessible at runtime

## Solution Architecture

Our solution uses three complementary mechanisms:

### 1. Vite Externalization

**Configuration**: `vite.config.ts`

```typescript
rollupOptions: {
  external: [
    'electron',
    '@prisma/client',
    '.prisma/client',
    'node-pty',
    'better-sqlite3',
  ],
}
```

**What it does**:
- Tells Vite/Rollup to NOT bundle these modules
- Leaves `require()` calls intact in the bundled code
- The bundled code references the module by name, not its implementation

**Result in bundled code**:
```javascript
// Instead of including the entire node-pty implementation
// The bundled code contains:
const pty = require('node-pty');
```

### 2. File Inclusion in electron-builder

**Configuration**: `electron-builder.yml`

```yaml
files:
  - dist/**/*
  - dist-electron/**/*
  - node_modules/node-pty/**/*
  - node_modules/better-sqlite3/**/*
```

**What it does**:
- Tells electron-builder to include node_modules folders in the package
- By default, electron-builder excludes node_modules to reduce package size
- We explicitly include only the native modules needed

### 3. ASAR Unpacking

**Configuration**: `electron-builder.yml`

```yaml
asar: true
asarUnpack:
  - "**/node_modules/node-pty/**"
  - "**/node_modules/better-sqlite3/**"
```

**What it does**:
- `asar: true` compresses most files into a single archive (reduces size, speeds loading)
- `asarUnpack` extracts specific directories from the archive after installation
- Native binaries need to be unpacked because:
  1. They contain platform-specific code that must be executable
  2. The ASAR archive format is read-only, preventing execution
  3. Node.js's module loader needs direct file system access

**Result in packaged app**:
```
Claude Tasks.app/Contents/Resources/
├── app.asar (most app files)
├── app.asar.unpacked/
│   ├── node_modules/node-pty/
│   │   ├── prebuilds/
│   │   │   ├── darwin-arm64/
│   │   │   │   └── pty.node
│   │   │   └── darwin-x64/
│   │   │       └── pty.node
│   │   └── ... other files
│   └── node_modules/better-sqlite3/
│       ├── build/
│       │   └── Release/
│       │       └── better_sqlite3.node
│       └── ... other files
```

### 4. Native Module Rebuilding

**Configuration**: `package.json`

```json
{
  "scripts": {
    "postinstall": "npm run build:natives",
    "build:natives": "electron-builder install-app-deps"
  }
}
```

**What it does**:
- `npm install` automatically runs postinstall hooks
- `electron-builder install-app-deps` rebuilds native modules for Electron's Node.js version
- Electron bundles its own Node.js runtime that may differ from system Node.js
- Native modules must be compiled for the exact Node.js version being used

**Why it's needed**:

```
System Node.js (v20.x) -> compiles for v20
Electron Node.js (v20.x) -> may have different ABI
Result: "Module version mismatch" error

Solution: Rebuild for Electron's exact version
```

## Runtime Flow

### Development Mode

```
npm run dev
    ↓
Vite starts dev server
    ↓
electron/main.ts imported
    ↓
require('node-pty') called
    ↓
Node.js searches for 'node-pty'
    ↓
Finds node_modules/node-pty
    ↓
Loads prebuilt binary for current platform
    ↓
TerminalManager can spawn terminals
```

### Production Mode (Packaged App)

```
User installs app (DMG, EXE, etc.)
    ↓
electron-builder extracts app.asar
    ↓
electron-builder unpacks asarUnpack entries
    ↓
app.asar.unpacked/node_modules/node-pty created
    ↓
App launches
    ↓
dist-electron/main.js imported
    ↓
require('node-pty') called
    ↓
Node.js (Electron's version) searches for 'node-pty'
    ↓
Finds app.asar.unpacked/node_modules/node-pty
    ↓
Loads prebuilt binary for app's platform
    ↓
TerminalManager can spawn terminals
```

## Prebuilt Binaries

Node-pty includes prebuilt binaries for multiple platforms:

```
node_modules/node-pty/prebuilds/
├── darwin-arm64/
│   └── pty.node (Apple Silicon)
├── darwin-x64/
│   └── pty.node (Intel Mac)
├── linux-arm64/
│   └── pty.node (ARM Linux)
├── linux-x64/
│   └── pty.node (x64 Linux)
└── win32-x64/
    └── pty.node (Windows)
```

Better-sqlite3 stores its binary in:

```
node_modules/better-sqlite3/
├── build/
│   └── Release/
│       └── better_sqlite3.node
```

## Configuration Interaction

The three mechanisms work together:

| Phase | Mechanism | Action | Result |
|-------|-----------|--------|--------|
| Install | Native rebuild | `electron-builder install-app-deps` | Compiles for Electron's Node.js |
| Dev | Vite external | Leaves require() calls | Loads from node_modules |
| Dev | Direct load | Node.js module loader | Uses system-compiled binaries |
| Build | Vite external | Doesn't bundle code | Preserves require() calls |
| Build | electron-builder | Includes modules in `files` | Copies to build directory |
| Package | ASAR unpacking | Extracts unpacked entries | Makes binaries accessible |
| Runtime | Module loading | Node.js searches unpacked dir | Loads prebuilt binaries |

## Adding New Native Modules

If you need to add another native module (e.g., `sqlite3`, `node-gyp-build`):

### 1. Add to Vite External List

```typescript
// vite.config.ts
external: [
  'electron',
  '@prisma/client',
  '.prisma/client',
  'node-pty',
  'better-sqlite3',
  'new-native-module', // <- Add here
],
```

### 2. Add to electron-builder Files

```yaml
# electron-builder.yml
files:
  - node_modules/node-pty/**/*
  - node_modules/better-sqlite3/**/*
  - node_modules/new-native-module/**/* # <- Add here
```

### 3. Add to electron-builder asarUnpack

```yaml
# electron-builder.yml
asarUnpack:
  - "**/node_modules/node-pty/**"
  - "**/node_modules/better-sqlite3/**"
  - "**/node_modules/new-native-module/**" # <- Add here
```

### 4. Install and Build

```bash
npm install new-native-module
npm run build:natives
```

## Troubleshooting

### Module loads in dev but fails in packaged app

**Cause**: Module not in asarUnpack configuration
**Solution**: Add to asarUnpack in electron-builder.yml

### "Module version mismatch" errors

**Cause**: Native module compiled for wrong Node.js version
**Solution**: Run `npm run build:natives`

### macOS: "Cannot open ... because the developer cannot be verified"

**Cause**: Packaged .node binaries not signed
**Solution**: May need to sign entire app or disable SIP for testing (development only)

### Platform-specific binary not found

**Cause**: Prebuilds don't exist for your platform
**Solution**: Check node_modules/[module]/prebuilds/ contains your platform directory

## Performance Implications

- **ASAR**: Speeds up file access for bundled files (uses memory-mapped I/O)
- **asarUnpack**: Unpacked files load slower but necessary for native modules
- **Prebuilds**: Faster than building from source during install
- **Size**: Native modules add ~5-10MB to packaged app, but necessary for functionality

## Security Considerations

- **Sandboxing**: Preload scripts run in sandbox; native modules run in main process
- **Signing**: On macOS, packaged .node files must be signed
- **Permissions**: Terminal access requires user permissions
- **Database**: SQLite runs in main process with full file system access

## References

- [Electron: Using Native Node Modules](https://www.electronjs.org/docs/tutorial/using-native-node-modules)
- [electron-builder: ASAR](https://www.electron.build/configuration/asar)
- [node-pty: Prebuilds](https://github.com/microsoft/node-pty#prebuilt-binaries)
- [better-sqlite3: Building](https://github.com/WiseLibs/better-sqlite3/blob/master/docs/getting-started.md)
