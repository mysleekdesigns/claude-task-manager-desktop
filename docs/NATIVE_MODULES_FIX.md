# Native Module Loading Fix for Electron + Vite

## Problem

The application was failing with the error:
```
Error: Failed to load native module: pty.node
Could not dynamically require "./prebuilds/darwin-arm64//pty.node".
Please configure the dynamicRequireTargets or/and ignoreDynamicRequires option of @rollup/plugin-commonjs appropriately for this require call to work.
```

This occurs because node-pty (and better-sqlite3) are native Node.js modules that contain compiled `.node` binaries. When using Vite to bundle the Electron main process, these native modules must not be bundled but instead loaded at runtime.

## Root Causes

1. **Vite bundling native modules** - Vite/Rollup was attempting to bundle native modules, which doesn't work for compiled binaries
2. **ASAR compression** - electron-builder's ASAR (A Simple Archive) format compresses files, making native binaries inaccessible at runtime
3. **Missing native rebuilds** - Native modules need to be compiled for Electron's specific Node.js version

## Solution

The fix involves three key changes:

### 1. Externalize Native Modules in Vite Configuration

**File: `vite.config.ts`**

Add native modules to the `external` array in the main process Rollup configuration:

```typescript
{
  // Main process entry file
  entry: 'electron/main.ts',
  vite: {
    build: {
      rollupOptions: {
        external: [
          'electron',
          '@prisma/client',
          '.prisma/client',
          'node-pty',      // <- Add this
          'better-sqlite3', // <- Add this
        ],
      },
    },
  },
},
```

This tells Vite/Rollup to NOT bundle these modules, leaving `require()` calls intact at runtime.

### 2. Include Native Modules in Build and Configure ASAR Unpacking

**File: `electron-builder.yml`**

Update the `files` array to explicitly include native modules, and add an `asarUnpack` configuration:

```yaml
files:
  - dist/**/*
  - dist-electron/**/*
  - node_modules/node-pty/**/*      # <- Add this
  - node_modules/better-sqlite3/**/* # <- Add this
  - # ... rest of files

asarUnpack:
  - "**/node_modules/node-pty/**"      # <- Add this
  - "**/node_modules/better-sqlite3/**" # <- Add this
```

The `asarUnpack` configuration tells electron-builder to extract these modules from the ASAR archive after installation, making the native binaries accessible at runtime.

### 3. Rebuild Native Modules for Electron

**File: `package.json`**

Add a postinstall script that rebuilds native modules for Electron's Node.js version:

```json
{
  "scripts": {
    "postinstall": "npm run build:natives",
    "build:natives": "electron-builder install-app-deps",
    // ... other scripts
  }
}
```

The `electron-builder install-app-deps` command automatically:
- Rebuilds native modules for Electron's specific Node.js version
- Installs native dependencies for the current platform
- Handles all platform-specific compilation

## How It Works

1. **Development Mode** (`npm run dev`)
   - Vite leaves `require('node-pty')` calls intact in the bundled code
   - Node.js loads the module from `node_modules/node-pty` directly
   - Postinstall script ensures native binaries are compiled for your local Node.js version

2. **Production/Packaged Mode** (`npm run package`)
   - Vite externalizes node-pty and better-sqlite3
   - electron-builder includes the node_modules folders in the package
   - ASAR unpacking extracts native binaries to a directory accessible at runtime
   - Electron's main process loads the native modules from the unpacked directory

## Verification

To verify the fix is working:

```bash
# Rebuild native modules
npm run build:natives

# Start development mode (should not error)
npm run dev

# Build and package (should not error)
npm run package

# For macOS: Check the built app
open release/Claude\ Tasks\ Desktop-*.dmg
```

Look for these indicators of success:
- No errors during `npm run dev`
- No errors during `npm run build`
- Terminal functionality works (terminals spawn and accept input)
- Database operations work (tasks load without errors)

## File Changes Summary

| File | Change | Purpose |
|------|--------|---------|
| `vite.config.ts` | Added `node-pty` and `better-sqlite3` to external modules | Prevent Vite from bundling native modules |
| `electron-builder.yml` | Added `files` entries and `asarUnpack` config | Include native modules and extract from ASAR |
| `package.json` | Added postinstall script with `build:natives` | Rebuild native modules for Electron's Node.js |

## Related Issues

- **Issue**: "Module not found: node-pty"
  - **Cause**: `external` array missing from Vite config
  - **Fix**: Add to external array

- **Issue**: "pty.node: ENOENT: no such file or directory"
  - **Cause**: ASAR compression prevents binary access
  - **Fix**: Configure `asarUnpack`

- **Issue**: "Error loading native module: binding module not found"
  - **Cause**: Native modules not compiled for Electron's Node.js version
  - **Fix**: Run `npm run build:natives`

## References

- [Electron Building Native Modules](https://www.electronjs.org/docs/tutorial/using-native-node-modules)
- [electron-builder ASAR Configuration](https://www.electron.build/configuration/asar)
- [node-pty Documentation](https://github.com/microsoft/node-pty)
