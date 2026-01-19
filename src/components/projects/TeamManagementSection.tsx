/**
 * TeamManagementSection Component
 *
 * Complete team management section that combines the member list and invite modal.
 * Displays team members with management controls and handles member changes.
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { UserPlus, Users } from 'lucide-react';
import { TeamMembersList } from './TeamMembersList';
import { InviteMemberModal } from './InviteMemberModal';
import type { ProjectMember, ProjectRole } from './TeamMembersList';

// ============================================================================
// Types
// ============================================================================

interface TeamManagementSectionProps {
  projectId: string;
  members: ProjectMember[];
  currentUserId: string;
  onMembersChange?: () => void;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get current user's role from members list
 */
function getCurrentUserRole(members: ProjectMember[], userId: string): ProjectRole | null {
  const currentMember = members.find((m) => m.userId === userId);
  return currentMember?.role || null;
}

/**
 * Check if user can invite members
 */
function canInviteMembers(role: ProjectRole | null): boolean {
  return role === 'OWNER' || role === 'ADMIN';
}

// ============================================================================
// Component
// ============================================================================

export function TeamManagementSection({
  projectId,
  members,
  currentUserId,
  onMembersChange,
}: TeamManagementSectionProps) {
  const [inviteModalOpen, setInviteModalOpen] = useState(false);

  const currentUserRole = getCurrentUserRole(members, currentUserId);
  const canInvite = canInviteMembers(currentUserRole);

  /**
   * Handle member changes (add, remove, role update)
   */
  const handleMemberChange = () => {
    onMembersChange?.();
  };

  /**
   * Handle successful member invitation
   */
  const handleInviteSuccess = () => {
    handleMemberChange();
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-muted-foreground" />
            <div>
              <CardTitle>Team Members</CardTitle>
              <CardDescription>
                Manage who has access to this project
              </CardDescription>
            </div>
          </div>

          {canInvite && (
            <Button
              variant="default"
              size="sm"
              onClick={() => setInviteModalOpen(true)}
            >
              <UserPlus className="h-4 w-4 mr-2" />
              Invite Member
            </Button>
          )}
        </div>

        {/* Member Count */}
        <div className="flex items-center gap-2 pt-2">
          <span className="text-sm text-muted-foreground">
            {members.length} {members.length === 1 ? 'member' : 'members'}
          </span>
        </div>
      </CardHeader>

      <CardContent>
        {currentUserRole ? (
          <TeamMembersList
            projectId={projectId}
            members={members}
            currentUserId={currentUserId}
            currentUserRole={currentUserRole}
            onMemberChange={handleMemberChange}
          />
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            You are not a member of this project
          </div>
        )}
      </CardContent>

      {/* Invite Member Modal */}
      <InviteMemberModal
        open={inviteModalOpen}
        onOpenChange={setInviteModalOpen}
        projectId={projectId}
        onSuccess={handleInviteSuccess}
      />
    </Card>
  );
}
