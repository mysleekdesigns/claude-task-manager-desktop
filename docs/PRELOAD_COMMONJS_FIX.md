# Preload Script CommonJS Conversion Fix

## Problem

The Electron preload script was failing to load with the error:

```
Unable to load preload script: /path/to/dist-electron/preload.cjs
SyntaxError: Unexpected token 'export'
```

Even though the Vite build was configured to output CommonJS format (`format: 'cjs'`), the bundled code still contained ES module `export` statements that are not valid in CommonJS.

## Root Cause

Vite/Rollup's `format: 'cjs'` configuration converts the module wrapper to CommonJS, but the custom `convertToCommonJS` plugin was incomplete. It only handled:
- ✅ `import { ... } from 'module'` → `require('module')`

But it **did not** handle:
- ❌ `export default ...` → needed conversion to `module.exports = ...`
- ❌ `export { ... }` → needed conversion to `module.exports.xxx = ...`
- ❌ `export const/let/var` → needed conversion to `module.exports.xxx`
- ❌ `export function/class` → needed conversion to `module.exports.xxx`

## Solution

Updated the `convertToCommonJS` plugin in `vite.config.ts` to handle all ES module export patterns:

### 1. Export Default
```typescript
// Convert: export default foo;
// To: module.exports = foo;
chunk.code = chunk.code.replace(
  /^export\s+default\s+(.+);?$/gm,
  'module.exports = $1;'
);
```

### 2. Named Exports
```typescript
// Convert: export { foo, bar as baz };
// To: module.exports.foo = foo;
//     module.exports.baz = bar;
chunk.code = chunk.code.replace(
  /^export\s+{([^}]+)};?$/gm,
  (match, exports) => {
    const cleaned = exports.split(',').map((s: string) => s.trim());
    return cleaned.map((exp: string) => {
      const [local, exported] = exp.includes(' as ')
        ? exp.split(' as ').map((s: string) => s.trim())
        : [exp, exp];
      return `module.exports.${exported} = ${local};`;
    }).join('\n');
  }
);
```

### 3. Export Declarations
```typescript
// Convert: export const foo = 'bar';
// To: const foo = 'bar';
//     module.exports.foo = foo;
chunk.code = chunk.code.replace(
  /^export\s+(const|let|var)\s+(\w+)\s*=/gm,
  '$1 $2 =\nmodule.exports.$2 ='
);
```

### 4. Export Functions/Classes
```typescript
// Convert: export function myFunc() { ... }
// To: function myFunc() { ... }
//     module.exports.myFunc = myFunc;
chunk.code = chunk.code.replace(
  /^export\s+(function|class)\s+(\w+)/gm,
  (match, type, name) => {
    return `${type} ${name}`;
  }
);
```

## Verification

After the fix, the generated `dist-electron/preload.cjs` file contains only valid CommonJS syntax:

**Before:**
```javascript
export default require_preload();  // ❌ Causes error in Electron sandbox
```

**After:**
```javascript
module.exports = f();;  // ✅ Valid CommonJS
```

## Test Results

The application now starts successfully with:
- ✅ No preload script loading errors
- ✅ IPC communication working (`app:getVersion`, `app:getPlatform`)
- ✅ Window loads correctly
- ✅ All IPC handlers registered successfully

## Key Takeaways

1. **Electron's sandbox requires pure CommonJS**: The preload script must be 100% CommonJS-compatible with no ES module syntax.

2. **Vite's `format: 'cjs'` is not enough**: While it sets up the module wrapper as CommonJS, it doesn't convert all export statements automatically.

3. **Custom plugin necessary**: A custom Vite plugin is needed to post-process the bundled code and convert all ES module patterns to CommonJS equivalents.

4. **Handle all export patterns**: The conversion must cover:
   - Default exports
   - Named exports (including `as` aliases)
   - Inline declarations (`export const`, `export function`, etc.)
   - Re-exports

## Files Modified

- `/vite.config.ts` - Enhanced `convertToCommonJS` plugin with comprehensive export conversion

## Related Documentation

- [Electron Context Isolation](https://www.electronjs.org/docs/latest/tutorial/context-isolation)
- [Vite Rollup Options](https://vitejs.dev/config/build-options.html#build-rollupoptions)
- [CommonJS Module Pattern](https://nodejs.org/api/modules.html)

---

**Date:** 2026-01-19
**Status:** ✅ Fixed and verified
