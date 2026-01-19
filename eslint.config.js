import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactPlugin from 'eslint-plugin-react';
import reactHooksPlugin from 'eslint-plugin-react-hooks';
import reactRefreshPlugin from 'eslint-plugin-react-refresh';
import eslintConfigPrettier from 'eslint-config-prettier';

export default tseslint.config(
  // Global ignores
  {
    ignores: [
      'dist/**',
      'dist-electron/**',
      'dist-temp/**',
      'node_modules/**',
      'build/**',
      '*.config.js',
      '*.config.ts',
    ],
  },

  // Base JavaScript rules
  js.configs.recommended,

  // TypeScript rules for all TypeScript files
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,

  // Renderer process (src/) - uses tsconfig.json
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    plugins: {
      react: reactPlugin,
      'react-hooks': reactHooksPlugin,
      'react-refresh': reactRefreshPlugin,
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
    rules: {
      // React rules
      ...reactPlugin.configs.recommended.rules,
      ...reactPlugin.configs['jsx-runtime'].rules,

      // React Hooks rules
      ...reactHooksPlugin.configs.recommended.rules,

      // React Refresh rules for hot reload
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
    },
  },

  // Main process (electron/) - uses tsconfig.electron.json
  {
    files: ['electron/**/*.ts'],
    languageOptions: {
      parserOptions: {
        project: './tsconfig.electron.json',
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // Relax some rules for Electron main process
      '@typescript-eslint/no-require-imports': 'off',
    },
  },

  // Shared TypeScript rules
  {
    files: ['**/*.{ts,tsx}'],
    rules: {
      // TypeScript strict mode enhancements
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/await-thenable': 'error',
      '@typescript-eslint/no-unnecessary-condition': 'warn',
      '@typescript-eslint/prefer-nullish-coalescing': 'warn',
      '@typescript-eslint/prefer-optional-chain': 'warn',
    },
  },

  // Prettier compatibility (must be last to override conflicting rules)
  eslintConfigPrettier
);
