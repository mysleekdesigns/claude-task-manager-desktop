# Testing Native Modules Fix

## Quick Start

After applying the native modules fix, follow these steps to verify everything works:

### 1. Clean Install (Recommended)

```bash
# Remove old dependencies and compiled modules
rm -rf node_modules package-lock.json

# Clean build artifacts
rm -rf dist dist-electron release

# Fresh install with postinstall script
npm install
```

The postinstall script will automatically run `npm run build:natives` to compile native modules for your environment.

### 2. Test Development Mode

```bash
npm run dev
```

**Expected behavior:**
- Vite dev server starts without errors
- Browser opens to http://localhost:5173
- DevTools console shows no native module errors
- Application loads and renders UI

**If you see errors:**
- Check that `node-pty` appears in vite.config.ts external array
- Run `npm run build:natives` manually
- Check node_modules/node-pty exists and has platform-specific binaries

### 3. Test Terminal Functionality

Once the app is running:
1. Navigate to a project (create one if needed)
2. Open a terminal in the UI
3. Try typing commands (e.g., `ls`, `pwd`, `echo "test"`)

**Expected behavior:**
- Terminal spawns successfully
- Commands execute and show output
- No "pty.node" or "Failed to load native module" errors

**If terminal doesn't work:**
- Check browser console for errors
- Check Electron main process logs (DevTools -> "Main" tab)
- Verify `node-pty` is in the external modules list

### 4. Test Build Process

```bash
npm run build
```

**Expected behavior:**
- TypeScript compilation succeeds
- Vite bundling completes without errors
- dist-electron/main.js contains `require('node-pty')` calls (not bundled code)
- No warnings about native module handling

**If build fails:**
- Check tsconfig.electron.json is correct
- Ensure external modules are listed in rollupOptions
- Run `npm run build:natives` to rebuild for your Node version

### 5. Test Packaging

```bash
npm run package:mac  # macOS
# or
npm run package:win  # Windows
# or
npm run package:linux  # Linux
```

**Expected behavior:**
- Build succeeds
- electron-builder packages without errors
- Release files are created (DMG, EXE, or AppImage)

**If packaging fails:**
- Check electron-builder.yml has asarUnpack configuration
- Verify native modules are listed in files section
- Check that native modules were properly built for the target platform

### 6. Test Packaged Application

```bash
# macOS
open release/Claude\ Tasks\ Desktop-*.dmg

# or install and run the packaged app
# Windows: Run the .exe installer
# Linux: Install the .deb or .AppImage
```

Then:
1. Launch the installed application
2. Create or open a project
3. Test terminal functionality

**Expected behavior:**
- App launches without errors
- Terminal functionality works
- Database operations work (tasks load)
- No native module errors in logs

## Diagnostic Commands

### Check if node-pty is properly installed

```bash
ls -la node_modules/node-pty/
```

Should show:
- `build/` directory
- `prebuilds/` directory with platform-specific binaries (e.g., `darwin-arm64`, `win32-x64`)
- `lib/` directory with TypeScript definitions

### Verify native module rebuilds

```bash
npm run build:natives
```

Should output:
```
gyp info ok
```

And may show compilation messages for native modules.

### Check Vite config externals

```bash
grep -A 10 "external:" vite.config.ts
```

Should show:
```
external: [
  'electron',
  '@prisma/client',
  '.prisma/client',
  'node-pty',
  'better-sqlite3',
],
```

### Check electron-builder config

```bash
grep -A 2 "asarUnpack:" electron-builder.yml
```

Should show:
```
asarUnpack:
  - "**/node_modules/node-pty/**"
  - "**/node_modules/better-sqlite3/**"
```

### Inspect bundled main process

After building, check the bundled main process doesn't contain node-pty code:

```bash
grep -c "spawn(shell, \[\]" dist-electron/main.js
# Should be 0 - the node-pty spawn logic should NOT be bundled
```

Check that it contains require calls instead:

```bash
grep "require.*node-pty" dist-electron/main.js
# Should find the require statement
```

## Common Issues and Solutions

### Issue: "Error: Failed to load native module: pty.node"

**Cause**: Native binaries not accessible at runtime

**Solutions**:
1. Ensure `asarUnpack` is configured in electron-builder.yml
2. Verify native modules are in the `files` list
3. Check that node_modules/node-pty contains platform-specific binaries

### Issue: "Could not dynamically require './prebuilds/darwin-arm64//pty.node'"

**Cause**: Vite is attempting to bundle the native module

**Solutions**:
1. Add `node-pty` and `better-sqlite3` to external array in vite.config.ts
2. Ensure the external array is in the main process configuration, not renderer
3. Rebuild: `npm run build`

### Issue: Native module works in dev but fails in packaged app

**Cause**: Native binaries not included or unpacked from ASAR

**Solutions**:
1. Verify `asarUnpack` configuration exists
2. Verify native modules are in `files` array
3. Check that the packaged app contains node_modules/node-pty
4. Try running with `asar: false` temporarily to debug

### Issue: Different architecture errors (e.g., "Expected darwin-arm64, got darwin-x64")

**Cause**: Native modules compiled for wrong architecture

**Solutions**:
1. Clean install: `rm -rf node_modules && npm install`
2. Explicitly rebuild: `npm run build:natives`
3. Ensure your build machine matches the target architecture
4. For CI/CD: Ensure each platform runs on its native architecture

## Platform-Specific Considerations

### macOS (Intel and Apple Silicon)

- Universal builds may require special configuration
- Verify prebuilds for both `darwin-x64` and `darwin-arm64` exist
- May need to sign notarize the packaged app

### Windows

- Requires Visual Studio Build Tools or Python for native compilation
- Verify `win32-x64` prebuilds exist
- May need code signing certificate

### Linux

- Requires build-essential package
- Verify `linux-x64` and/or `linux-arm64` prebuilds exist
- Test on the target Linux distribution

## Next Steps

If all tests pass:
1. Commit the changes
2. Update CI/CD workflows if necessary
3. Create a release build
4. Test on target platforms

If issues persist:
1. Review the NATIVE_MODULES_FIX.md documentation
2. Check GitHub issues for electron-builder and node-pty
3. Enable verbose logging during build: `DEBUG=* npm run build`
