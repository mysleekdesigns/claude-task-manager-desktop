/**
 * TechStackBadges Component
 *
 * Displays a list of technology badges for the detected tech stack.
 */

import { Badge } from '@/components/ui/badge';

interface TechStackBadgesProps {
  techStack: string[];
  className?: string;
}

/**
 * Map of technology names to their display colors/variants
 */
const TECH_COLORS: Record<string, 'default' | 'secondary' | 'outline'> = {
  react: 'default',
  typescript: 'default',
  javascript: 'secondary',
  nodejs: 'secondary',
  python: 'default',
  rust: 'default',
  go: 'default',
  electron: 'secondary',
  tailwind: 'secondary',
  prisma: 'outline',
  vite: 'outline',
  webpack: 'outline',
  docker: 'outline',
  postgresql: 'outline',
  mongodb: 'outline',
  sqlite: 'outline',
  redis: 'outline',
};

/**
 * Format technology name for display
 */
function formatTechName(tech: string): string {
  const displayNames: Record<string, string> = {
    react: 'React',
    typescript: 'TypeScript',
    javascript: 'JavaScript',
    nodejs: 'Node.js',
    python: 'Python',
    rust: 'Rust',
    go: 'Go',
    electron: 'Electron',
    tailwind: 'Tailwind CSS',
    prisma: 'Prisma',
    vite: 'Vite',
    webpack: 'Webpack',
    docker: 'Docker',
    postgresql: 'PostgreSQL',
    mongodb: 'MongoDB',
    sqlite: 'SQLite',
    redis: 'Redis',
    nextjs: 'Next.js',
    vue: 'Vue',
    angular: 'Angular',
    svelte: 'Svelte',
    express: 'Express',
    fastapi: 'FastAPI',
    django: 'Django',
    flask: 'Flask',
  };

  return displayNames[tech.toLowerCase()] || tech.charAt(0).toUpperCase() + tech.slice(1);
}

export function TechStackBadges({ techStack, className }: TechStackBadgesProps) {
  if (!techStack || techStack.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No technologies detected. Make sure the project has a valid target path.
      </p>
    );
  }

  return (
    <div className={className}>
      <div className="flex flex-wrap gap-2">
        {techStack.map((tech) => (
          <Badge
            key={tech}
            variant={TECH_COLORS[tech.toLowerCase()] || 'outline'}
            className="text-xs"
          >
            {formatTechName(tech)}
          </Badge>
        ))}
      </div>
    </div>
  );
}
