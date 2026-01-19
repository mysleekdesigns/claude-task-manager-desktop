# Native Modules Loading Flow Diagrams

## Development Mode Flow

```
┌─────────────────────────────────────────────────────────────────┐
│ npm run dev                                                     │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│ Vite Dev Server Starts                                          │
│ - Loads vite.config.ts                                          │
│ - external: ['node-pty', 'better-sqlite3', ...]               │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│ Electron Main Process (electron/main.ts)                        │
│ - Not bundled by Vite (separate config)                         │
│ - Contains require('node-pty') statement                        │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│ Runtime: require('node-pty') Executed                           │
│ - Node.js module loader searches for 'node-pty'               │
│ - Finds: node_modules/node-pty/                               │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│ Load Prebuilt Binary                                            │
│ - node_modules/node-pty/prebuilds/[PLATFORM]/pty.node         │
│ - Platform determined at runtime:                              │
│   - darwin-arm64 (Apple Silicon)                              │
│   - darwin-x64 (Intel Mac)                                    │
│   - linux-x64 (Linux)                                         │
│   - win32-x64 (Windows)                                       │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│ TerminalManager Ready                                           │
│ - Can spawn terminal processes                                  │
│ - pty.spawn() works correctly                                   │
└─────────────────────────────────────────────────────────────────┘
```

## Production Build Flow

```
┌─────────────────────────────────────────────────────────────────┐
│ npm run build                                                   │
└──────────────────────┬──────────────────────────────────────────┘
                       │
         ┌─────────────┴──────────────┐
         │                            │
         ▼                            ▼
  ┌─────────────────┐        ┌────────────────────┐
  │ Vite (Renderer) │        │ Vite (Main) +      │
  │                 │        │ TypeScript         │
  │ - Bundles React │        │                    │
  │ - No externals  │        │ - Externalizes    │
  │   needed        │        │   node-pty, etc   │
  └────────┬────────┘        └────────┬───────────┘
           │                          │
           ▼                          ▼
  ┌────────────────────┐    ┌────────────────────┐
  │ dist/             │    │ dist-electron/     │
  │ (React bundle)    │    │ main.js            │
  │                   │    │ (requires intact)  │
  └────────┬──────────┘    └────────┬───────────┘
           │                        │
           └────────────┬───────────┘
                        │
                        ▼
    ┌───────────────────────────────────────┐
    │ npm run package                       │
    │ (electron-builder)                    │
    └───────────────────┬───────────────────┘
                        │
         ┌──────────────┼──────────────┐
         │              │              │
         ▼              ▼              ▼
    ┌────────┐   ┌────────┐   ┌────────┐
    │ dist/  │   │ dist-  │   │ node_  │
    │        │   │ electron
│   │ modules
│   └────────┘   └────────┘   └────────┘
                 │
         ┌───────┴────────┐
         │                │
         ▼                ▼
   ┌──────────┐      ┌───────────────────┐
   │ ASAR     │      │ node_modules/     │
   │ Archive  │      │ node-pty/**       │
   │          │      │ better-sqlite3/** │
   └────┬─────┘      └─────────┬─────────┘
        │                      │
        │         ┌────────────┘
        │         │ (asarUnpack config)
        │         │
        ▼         ▼
   ┌──────────────────────────────────────┐
   │ app.asar.unpacked/                   │
   │ ├── node_modules/node-pty/           │
   │ │   ├── prebuilds/                   │
   │ │   │   ├── darwin-arm64/            │
   │ │   │   │   └── pty.node             │
   │ │   │   └── ...                      │
   │ │   └── lib/                         │
   │ └── node_modules/better-sqlite3/     │
   │     ├── build/Release/               │
   │     │   └── better_sqlite3.node      │
   │     └── lib/                         │
   └──────────────────────────────────────┘
```

## Packaging Output Structure

```
MacOS:
Claude Tasks Desktop.dmg
└── Claude Tasks Desktop.app
    └── Contents
        └── Resources
            ├── app.asar (most files, compressed)
            └── app.asar.unpacked/
                └── node_modules/
                    ├── node-pty/
                    │   ├── prebuilds/
                    │   │   ├── darwin-arm64/pty.node
                    │   │   └── darwin-x64/pty.node
                    │   └── lib/
                    └── better-sqlite3/
                        ├── build/Release/better_sqlite3.node
                        └── lib/

Windows:
Claude Tasks Desktop Setup.exe
└── [Installs to Program Files]
    └── resources
        ├── app.asar
        └── app.asar.unpacked/
            └── node_modules/
                ├── node-pty/
                │   ├── prebuilds/
                │   │   └── win32-x64/pty.node
                │   └── lib/
                └── better-sqlite3/
                    ├── build/Release/better_sqlite3.node
                    └── lib/

Linux:
claude-tasks-desktop-*.AppImage
└── [Extracts to temporary directory]
    └── resources
        ├── app.asar
        └── app.asar.unpacked/
            └── node_modules/
                ├── node-pty/
                │   ├── prebuilds/
                │   │   ├── linux-x64/pty.node
                │   │   └── linux-arm64/pty.node
                │   └── lib/
                └── better-sqlite3/
                    ├── build/Release/better_sqlite3.node
                    └── lib/
```

## Configuration Impact Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│ Configuration Changes                                           │
└─────────────────────────────────────────────────────────────────┘

1. vite.config.ts:
   ┌─────────────────────────────────────────┐
   │ rollupOptions: {                        │
   │   external: [                           │
   │     'node-pty',        ──┐              │
   │     'better-sqlite3'   ─┬┘              │
   │   ]                     │               │
   │ }                       │               │
   └─────────────────────────┼───────────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │ Vite Behavior:  │
                    │ - Don't bundle  │
                    │ - Keep require()│
                    │   calls intact  │
                    └─────────────────┘

2. electron-builder.yml:
   ┌──────────────────────────────────────────┐
   │ files:                                   │
   │   - node_modules/node-pty/**/*      ──┐  │
   │   - node_modules/better-sqlite3/**/* ─┤  │
   │                                        │  │
   │ asarUnpack:                            │  │
   │   - "**/node_modules/node-pty/**"   ──┤  │
   │   - "**/node_modules/better-sqlite3"─┬┘  │
   └──────────────────────┬──────────────────┘
                          │
              ┌───────────┴────────────┐
              ▼                        ▼
    ┌─────────────────┐      ┌──────────────────┐
    │ Include modules │      │ Extract after    │
    │ in package      │      │ ASAR install     │
    │                 │      │ (make binaries   │
    │ - Adds size but │      │  accessible)     │
    │   necessary     │      │                  │
    └─────────────────┘      └──────────────────┘

3. package.json:
   ┌────────────────────────────────────────┐
   │ "postinstall":                         │
   │   "npm run build:natives"          ──┐ │
   │                                       │ │
   │ "build:natives":                      │ │
   │   "electron-builder                 ──┤─┤
   │    install-app-deps"                 │ │
   └──────────────────┬────────────────────┘
                      │
                      ▼
           ┌──────────────────────┐
           │ On npm install:      │
           │ - Rebuild natives    │
           │ - For Electron's     │
           │   Node version       │
           │ - Ensures compat     │
           └──────────────────────┘
```

## Module Loading Decision Tree

```
                    ┌─── Require 'node-pty' ───┐
                    │                           │
            ┌───────┴────────┐                 │
            │                │                 │
    Development Mode    Production Mode        │
            │                │                 │
            ▼                ▼                 ▼
    ┌───────────────┐  ┌──────────────┐       │
    │ npm run dev   │  │ Running app  │       │
    │               │  │ from package │       │
    └───────┬───────┘  └──────┬───────┘       │
            │                 │               │
            ▼                 ▼               ▼
   ┌────────────────┐  ┌─────────────────┐  │
   │ Is vite config │  │ Is app packaged?│  │
   │ externalized?  │  └────────┬────────┘  │
   └────────┬───────┘           │           │
            │                Yes│No         │
    Yes ────┤ ◄─────────────────┘           │
            │                               │
            ▼                               ▼
   ┌────────────────────────────┐   ┌─────────────────┐
   │ Load from                  │   │ Error! App not  │
   │ node_modules/node-pty      │   │ properly config │
   │                            │   └─────────────────┘
   │ - Check prebuilds/ dir     │
   │ - Find platform match      │
   │ - Load .node binary        │
   └────────┬───────────────────┘
            │
            ▼
   ┌────────────────────────┐
   │ Available: pty.spawn() │
   │ Terminal manager ready │
   └────────────────────────┘
```

## Success Indicators

```
✓ Development Works:
  npm run dev
  └── No errors in console
      No "pty.node" errors
      Terminal spawning works

✓ Build Works:
  npm run build
  └── dist-electron/main.js contains require('node-pty')
      No "Could not dynamically require" errors

✓ Packaging Works:
  npm run package
  └── Creates DMG/EXE/AppImage
      Includes app.asar.unpacked/node_modules/node-pty

✓ Packaged App Works:
  Launch app from DMG/EXE
  └── Terminal feature functions
      No native module errors
      Database operations work
```

---

This flowchart visualizes how the three configuration changes work together to enable native module loading across all stages of development and deployment.
