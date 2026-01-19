# Native Modules Fix - Quick Checklist

## What Was Fixed

The application was failing to load node-pty (terminal emulation) and better-sqlite3 (database) native modules. This has been fixed with configuration changes.

## Files Modified

- [x] `vite.config.ts` - Added native modules to external array
- [x] `electron-builder.yml` - Added native modules to files and asarUnpack
- [x] `package.json` - Added postinstall and build:natives scripts

## Next Steps

### 1. Rebuild Dependencies (Run Once)

```bash
# Clean install to ensure native modules are rebuilt for your system
rm -rf node_modules package-lock.json
npm install
```

The postinstall script will automatically run `npm run build:natives`.

### 2. Test Development Mode

```bash
npm run dev
```

**Check**:
- App launches without errors
- No "pty.node" errors in console
- Terminal functionality works (try spawning a terminal)

### 3. Test Build

```bash
npm run build
```

**Check**:
- Build completes successfully
- No warnings about native modules

### 4. Test Packaging

```bash
npm run package
```

**Check**:
- Packaging completes successfully
- DMG (macOS), EXE (Windows), or AppImage (Linux) is created

### 5. Test Packaged App (Optional)

```bash
# macOS
open release/*.dmg

# Windows/Linux - Install and run the executable
```

**Check**:
- App launches without errors
- Terminal feature works

## Documentation

Read these for more details:

1. **docs/NATIVE_MODULES_FIX.md** - Problem and solution explanation
2. **docs/TESTING_NATIVE_MODULES.md** - Detailed testing procedures
3. **docs/NATIVE_MODULES_ARCHITECTURE.md** - Technical deep-dive

## Troubleshooting

### Problem: "Failed to load native module: pty.node"

**Solution**:
```bash
npm run build:natives
npm run build
npm run dev
```

### Problem: App works in dev but fails in packaged version

**Cause**: ASAR unpacking might need verification

**Solution**: Check that `asarUnpack` is in `electron-builder.yml`

### Problem: Different platform errors

**Cause**: Prebuilt binaries for your platform may not exist

**Solution**:
```bash
rm -rf node_modules
npm install
```

## Quick Commands Reference

```bash
# Rebuild natives
npm run build:natives

# Full rebuild and test
rm -rf node_modules package-lock.json
npm install
npm run dev

# Build and package for current platform
npm run build && npm run package

# Build for specific platform
npm run package:mac
npm run package:win
npm run package:linux
```

## Configuration Summary

### vite.config.ts
Prevents Vite from bundling node-pty and better-sqlite3

### electron-builder.yml
- Includes native modules in the package
- Extracts them from ASAR archive at runtime

### package.json
- Automatically rebuilds natives during `npm install`

## What Changed (Technical)

```diff
# vite.config.ts
+ 'node-pty',
+ 'better-sqlite3',

# electron-builder.yml
+ - node_modules/node-pty/**/*
+ - node_modules/better-sqlite3/**/*
+ asarUnpack:
+   - "**/node_modules/node-pty/**"
+   - "**/node_modules/better-sqlite3/**"

# package.json
+ "postinstall": "npm run build:natives",
+ "build:natives": "electron-builder install-app-deps",
```

## Status

- [x] Configuration complete
- [x] Documentation created
- [ ] Testing in progress (run verification steps above)
- [ ] Ready for deployment

## Need Help?

1. Check **docs/TESTING_NATIVE_MODULES.md** for detailed troubleshooting
2. Review **docs/NATIVE_MODULES_ARCHITECTURE.md** for technical details
3. See **docs/FIX_SUMMARY_NODE_PTY.md** for complete change documentation

---

**Summary**: Three small configuration changes to fix native module loading. Run `npm install` to rebuild natives, then `npm run dev` to test.
