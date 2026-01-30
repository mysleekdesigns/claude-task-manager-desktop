/**
 * Tech Stack Auto-Detection Service
 *
 * Automatically detects the technology stack from a project directory
 * by checking for common configuration files and package dependencies.
 */

import fs from 'fs';
import path from 'path';
import { createIPCLogger } from '../utils/ipc-logger.js';

const logger = createIPCLogger('TechDetection');

/**
 * Known package.json dependencies and their corresponding technologies
 */
const PACKAGE_DEPENDENCY_MAP: Record<string, string> = {
  // Frontend frameworks
  react: 'react',
  'react-dom': 'react',
  vue: 'vue',
  '@vue/cli': 'vue',
  angular: 'angular',
  '@angular/core': 'angular',
  svelte: 'svelte',
  next: 'next.js',
  nuxt: 'nuxt',
  gatsby: 'gatsby',
  remix: 'remix',

  // Backend frameworks
  express: 'express',
  fastify: 'fastify',
  koa: 'koa',
  hapi: 'hapi',
  nestjs: 'nestjs',
  '@nestjs/core': 'nestjs',

  // Desktop/Mobile
  electron: 'electron',
  'react-native': 'react native',
  '@capacitor/core': 'capacitor',
  cordova: 'cordova',
  tauri: 'tauri',

  // Build tools
  webpack: 'webpack',
  vite: 'vite',
  rollup: 'rollup',
  parcel: 'parcel',
  esbuild: 'esbuild',
  turbo: 'turborepo',

  // Testing
  jest: 'jest',
  vitest: 'vitest',
  mocha: 'mocha',
  cypress: 'cypress',
  playwright: 'playwright',
  '@playwright/test': 'playwright',

  // Database
  prisma: 'prisma',
  '@prisma/client': 'prisma',
  mongoose: 'mongodb',
  sequelize: 'sequelize',
  typeorm: 'typeorm',
  drizzle: 'drizzle',
  'drizzle-orm': 'drizzle',
  knex: 'knex',
  'better-sqlite3': 'sqlite',
  sqlite3: 'sqlite',
  pg: 'postgresql',
  mysql2: 'mysql',
  redis: 'redis',
  ioredis: 'redis',

  // Styling
  tailwindcss: 'tailwind css',
  'styled-components': 'styled-components',
  '@emotion/react': 'emotion',
  sass: 'sass',
  less: 'less',

  // State management
  redux: 'redux',
  '@reduxjs/toolkit': 'redux',
  zustand: 'zustand',
  mobx: 'mobx',
  recoil: 'recoil',
  jotai: 'jotai',

  // API/GraphQL
  graphql: 'graphql',
  '@apollo/client': 'apollo',
  '@apollo/server': 'apollo',
  '@trpc/server': 'trpc',
  '@trpc/client': 'trpc',

  // Utilities
  typescript: 'typescript',
  lodash: 'lodash',
  axios: 'axios',
  zod: 'zod',
  'date-fns': 'date-fns',
  dayjs: 'dayjs',
  moment: 'moment',
};

/**
 * Detect the technology stack from a project directory.
 *
 * @param projectPath - Path to the project directory
 * @returns Array of lowercase technology names
 */
export async function detectTechStack(projectPath: string): Promise<string[]> {
  logger.info(`Detecting tech stack for: ${projectPath}`);

  const technologies = new Set<string>();

  // Validate path exists
  if (!fs.existsSync(projectPath)) {
    logger.warn(`Project path does not exist: ${projectPath}`);
    return [];
  }

  try {
    // Check package.json for dependencies
    await detectFromPackageJson(projectPath, technologies);

    // Check for configuration files
    detectFromConfigFiles(projectPath, technologies);

    const result = Array.from(technologies).sort();
    logger.info(`Detected ${result.length} technologies: ${result.join(', ')}`);

    return result;
  } catch (error) {
    logger.error('Error detecting tech stack:', error);
    return Array.from(technologies).sort();
  }
}

/**
 * Parse package.json and detect technologies from dependencies.
 */
async function detectFromPackageJson(
  projectPath: string,
  technologies: Set<string>
): Promise<void> {
  const packageJsonPath = path.join(projectPath, 'package.json');

  if (!fs.existsSync(packageJsonPath)) {
    logger.debug('No package.json found');
    return;
  }

  try {
    const content = fs.readFileSync(packageJsonPath, 'utf-8');
    const packageJson = JSON.parse(content) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
      peerDependencies?: Record<string, string>;
    };

    // Combine all dependencies
    const allDependencies = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies,
      ...packageJson.peerDependencies,
    };

    // Check each dependency against our map
    for (const dep of Object.keys(allDependencies)) {
      const tech = PACKAGE_DEPENDENCY_MAP[dep];
      if (tech) {
        technologies.add(tech);
      }
    }

    // Node.js project indicator
    if (Object.keys(allDependencies).length > 0) {
      technologies.add('node.js');
    }
  } catch (error) {
    logger.debug('Failed to parse package.json:', error);
  }
}

/**
 * Detect technologies from configuration files in the project root.
 */
function detectFromConfigFiles(
  projectPath: string,
  technologies: Set<string>
): void {
  // TypeScript
  if (
    fileExists(projectPath, 'tsconfig.json') ||
    fileExists(projectPath, 'tsconfig.base.json')
  ) {
    technologies.add('typescript');
  }

  // Tailwind CSS
  if (
    fileExists(projectPath, 'tailwind.config.js') ||
    fileExists(projectPath, 'tailwind.config.ts') ||
    fileExists(projectPath, 'tailwind.config.cjs') ||
    fileExists(projectPath, 'tailwind.config.mjs')
  ) {
    technologies.add('tailwind css');
  }

  // Prisma
  if (fileExists(projectPath, 'prisma/schema.prisma')) {
    technologies.add('prisma');
  }

  // Vite
  if (
    fileExists(projectPath, 'vite.config.js') ||
    fileExists(projectPath, 'vite.config.ts') ||
    fileExists(projectPath, 'vite.config.mjs')
  ) {
    technologies.add('vite');
  }

  // ESLint
  if (
    fileExists(projectPath, '.eslintrc') ||
    fileExists(projectPath, '.eslintrc.js') ||
    fileExists(projectPath, '.eslintrc.cjs') ||
    fileExists(projectPath, '.eslintrc.json') ||
    fileExists(projectPath, '.eslintrc.yml') ||
    fileExists(projectPath, '.eslintrc.yaml') ||
    fileExists(projectPath, 'eslint.config.js') ||
    fileExists(projectPath, 'eslint.config.mjs') ||
    fileExists(projectPath, 'eslint.config.cjs')
  ) {
    technologies.add('eslint');
  }

  // Prettier
  if (
    fileExists(projectPath, '.prettierrc') ||
    fileExists(projectPath, '.prettierrc.js') ||
    fileExists(projectPath, '.prettierrc.json') ||
    fileExists(projectPath, '.prettierrc.yml') ||
    fileExists(projectPath, '.prettierrc.yaml') ||
    fileExists(projectPath, 'prettier.config.js') ||
    fileExists(projectPath, 'prettier.config.cjs')
  ) {
    technologies.add('prettier');
  }

  // Rust
  if (fileExists(projectPath, 'Cargo.toml')) {
    technologies.add('rust');
  }

  // Go
  if (fileExists(projectPath, 'go.mod')) {
    technologies.add('go');
  }

  // Python
  if (
    fileExists(projectPath, 'requirements.txt') ||
    fileExists(projectPath, 'pyproject.toml') ||
    fileExists(projectPath, 'setup.py') ||
    fileExists(projectPath, 'Pipfile')
  ) {
    technologies.add('python');
  }

  // Docker
  if (
    fileExists(projectPath, 'Dockerfile') ||
    fileExists(projectPath, 'docker-compose.yml') ||
    fileExists(projectPath, 'docker-compose.yaml') ||
    fileExists(projectPath, 'compose.yml') ||
    fileExists(projectPath, 'compose.yaml')
  ) {
    technologies.add('docker');
  }

  // Git
  if (fileExists(projectPath, '.git')) {
    technologies.add('git');
  }

  // Webpack
  if (
    fileExists(projectPath, 'webpack.config.js') ||
    fileExists(projectPath, 'webpack.config.ts')
  ) {
    technologies.add('webpack');
  }

  // Jest
  if (
    fileExists(projectPath, 'jest.config.js') ||
    fileExists(projectPath, 'jest.config.ts') ||
    fileExists(projectPath, 'jest.config.json')
  ) {
    technologies.add('jest');
  }

  // Vitest
  if (
    fileExists(projectPath, 'vitest.config.js') ||
    fileExists(projectPath, 'vitest.config.ts')
  ) {
    technologies.add('vitest');
  }

  // Next.js
  if (
    fileExists(projectPath, 'next.config.js') ||
    fileExists(projectPath, 'next.config.mjs') ||
    fileExists(projectPath, 'next.config.ts')
  ) {
    technologies.add('next.js');
  }

  // Nx monorepo
  if (fileExists(projectPath, 'nx.json')) {
    technologies.add('nx');
  }

  // Turbo monorepo
  if (fileExists(projectPath, 'turbo.json')) {
    technologies.add('turborepo');
  }

  // Yarn
  if (fileExists(projectPath, 'yarn.lock')) {
    technologies.add('yarn');
  }

  // pnpm
  if (fileExists(projectPath, 'pnpm-lock.yaml')) {
    technologies.add('pnpm');
  }

  // npm
  if (fileExists(projectPath, 'package-lock.json')) {
    technologies.add('npm');
  }

  // Bun
  if (fileExists(projectPath, 'bun.lockb')) {
    technologies.add('bun');
  }
}

/**
 * Check if a file exists at the given path.
 */
function fileExists(basePath: string, relativePath: string): boolean {
  return fs.existsSync(path.join(basePath, relativePath));
}
