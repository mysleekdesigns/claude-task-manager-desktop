/**
 * Database type definitions
 * Used for type safety across the application
 */

/**
 * ProjectRole enum values
 * Used for ProjectMember.role field
 */
export enum ProjectRole {
  OWNER = 'OWNER',
  ADMIN = 'ADMIN',
  MEMBER = 'MEMBER',
  VIEWER = 'VIEWER',
}

/**
 * Type guard for ProjectRole
 */
export function isProjectRole(value: unknown): value is ProjectRole {
  return Object.values(ProjectRole).includes(value as ProjectRole);
}

/**
 * Get default ProjectRole
 */
export function getDefaultProjectRole(): ProjectRole {
  return ProjectRole.MEMBER;
}
