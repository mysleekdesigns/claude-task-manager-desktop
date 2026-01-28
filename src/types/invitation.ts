/**
 * Invitation Types for Phase 19.5
 *
 * Types for project invitation flow including email invitations,
 * invite links, and pending invitation management.
 */

/**
 * Status of a project invitation
 */
export type InvitationStatus = 'pending' | 'accepted' | 'expired' | 'revoked';

/**
 * Project invitation entity
 */
export interface Invitation {
  id: string;
  projectId: string;
  projectName: string;
  invitedEmail: string;
  invitedBy: string;
  inviterName: string;
  message?: string;
  token: string;
  status: InvitationStatus;
  role: 'ADMIN' | 'MEMBER' | 'VIEWER';
  createdAt: Date;
  expiresAt: Date;
}

/**
 * Input for creating a new invitation
 */
export interface CreateInvitationInput {
  projectId: string;
  email: string;
  role?: 'ADMIN' | 'MEMBER' | 'VIEWER';
  message?: string;
}

/**
 * Input for accepting an invitation
 */
export interface AcceptInvitationInput {
  token: string;
}

/**
 * Response when generating an invite link
 */
export interface InviteLinkResponse {
  url: string;
  token: string;
  expiresAt: Date;
}
