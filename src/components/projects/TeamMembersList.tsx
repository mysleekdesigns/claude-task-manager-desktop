/**
 * TeamMembersList Component
 *
 * Displays a list of project team members with role management.
 * Owners and Admins can update member roles and remove members.
 */

import { useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Trash2 } from 'lucide-react';
import { useIPCMutation } from '@/hooks/useIPC';
import { toast } from 'sonner';

// ============================================================================
// Types
// ============================================================================

export type ProjectRole = 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';

export interface ProjectMember {
  id: string;
  role: ProjectRole;
  userId: string;
  projectId: string;
  createdAt: string;
  user?: {
    id: string;
    name: string | null;
    email: string;
    avatar: string | null;
  };
}

interface TeamMembersListProps {
  projectId: string;
  members: ProjectMember[];
  currentUserId: string;
  currentUserRole: ProjectRole;
  onMemberChange?: () => void;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get initials from user name or email
 */
function getInitials(name: string | null | undefined, email: string): string {
  if (name) {
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return `${parts[0]?.[0] || ''}${parts[parts.length - 1]?.[0] || ''}`.toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  }
  return email.slice(0, 2).toUpperCase();
}

/**
 * Get badge variant for role
 */
function getRoleBadgeVariant(role: ProjectRole): 'default' | 'secondary' | 'outline' {
  switch (role) {
    case 'OWNER':
      return 'default'; // Purple-ish
    case 'ADMIN':
      return 'secondary'; // Blue-ish
    case 'MEMBER':
      return 'outline'; // Green-ish
    case 'VIEWER':
      return 'outline'; // Gray
    default:
      return 'outline';
  }
}

/**
 * Get custom badge class for role colors
 */
function getRoleBadgeClass(role: ProjectRole): string {
  switch (role) {
    case 'OWNER':
      return 'bg-purple-600 text-white hover:bg-purple-700';
    case 'ADMIN':
      return 'bg-blue-600 text-white hover:bg-blue-700';
    case 'MEMBER':
      return 'bg-green-600 text-white hover:bg-green-700';
    case 'VIEWER':
      return 'bg-gray-500 text-white hover:bg-gray-600';
    default:
      return '';
  }
}

/**
 * Check if current user can manage members
 */
function canManageMembers(role: ProjectRole): boolean {
  return role === 'OWNER' || role === 'ADMIN';
}

// ============================================================================
// Component
// ============================================================================

export function TeamMembersList({
  projectId,
  members,
  currentUserId,
  currentUserRole,
  onMemberChange,
}: TeamMembersListProps) {
  const [updatingMemberId, setUpdatingMemberId] = useState<string | null>(null);
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null);

  const updateRoleMutation = useIPCMutation('projects:updateMemberRole');
  const removeMemberMutation = useIPCMutation('projects:removeMember');

  const canManage = canManageMembers(currentUserRole);

  /**
   * Handle role change for a member
   */
  const handleRoleChange = async (memberId: string, newRole: ProjectRole) => {
    setUpdatingMemberId(memberId);

    try {
      await updateRoleMutation.mutate(projectId, memberId, newRole);
      toast.success('Member role updated successfully');
      onMemberChange?.();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to update member role'
      );
    } finally {
      setUpdatingMemberId(null);
    }
  };

  /**
   * Handle member removal
   */
  const handleRemoveMember = async (memberId: string, userName: string) => {
    setRemovingMemberId(memberId);

    try {
      await removeMemberMutation.mutate(projectId, memberId);
      toast.success(`${userName} removed from project`);
      onMemberChange?.();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to remove member'
      );
    } finally {
      setRemovingMemberId(null);
    }
  };

  /**
   * Check if a member can be edited
   */
  const canEditMember = (member: ProjectMember): boolean => {
    // Can't edit if current user doesn't have permissions
    if (!canManage) return false;
    // Can't edit self
    if (member.userId === currentUserId) return false;
    // Can't edit owner
    if (member.role === 'OWNER') return false;
    return true;
  };

  /**
   * Check if a member can be removed
   */
  const canRemoveMember = (member: ProjectMember): boolean => {
    // Can't remove if current user doesn't have permissions
    if (!canManage) return false;
    // Can't remove self
    if (member.userId === currentUserId) return false;
    // Can't remove owner
    if (member.role === 'OWNER') return false;
    return true;
  };

  return (
    <div className="space-y-3">
      {members.map((member) => {
        const user = member.user || {
          name: null,
          email: 'Unknown',
          avatar: null,
        };

        const isCurrentUser = member.userId === currentUserId;
        const isUpdating = updatingMemberId === member.id;
        const isRemoving = removingMemberId === member.id;
        const editable = canEditMember(member);
        const removable = canRemoveMember(member);

        return (
          <Card key={member.id}>
            <CardContent className="flex items-center gap-4 p-4">
              {/* Avatar */}
              <Avatar className="h-10 w-10">
                {user.avatar && <AvatarImage src={user.avatar} alt={user.name || user.email} />}
                <AvatarFallback className="text-sm">
                  {getInitials(user.name, user.email)}
                </AvatarFallback>
              </Avatar>

              {/* User Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-sm truncate">
                    {user.name || user.email}
                    {isCurrentUser && (
                      <span className="text-muted-foreground ml-1">(You)</span>
                    )}
                  </p>
                </div>
                <p className="text-xs text-muted-foreground truncate">{user.email}</p>
              </div>

              {/* Role Badge/Selector */}
              <div className="flex items-center gap-2">
                {editable && member.role !== 'OWNER' ? (
                  <Select
                    value={member.role}
                    onValueChange={(value) => handleRoleChange(member.id, value as ProjectRole)}
                    disabled={isUpdating || isRemoving}
                  >
                    <SelectTrigger className="w-[120px] h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ADMIN">Admin</SelectItem>
                      <SelectItem value="MEMBER">Member</SelectItem>
                      <SelectItem value="VIEWER">Viewer</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <Badge
                    variant={getRoleBadgeVariant(member.role)}
                    className={getRoleBadgeClass(member.role)}
                  >
                    {member.role}
                  </Badge>
                )}

                {/* Remove Button */}
                {removable && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => handleRemoveMember(member.id, user.name || user.email)}
                    disabled={isUpdating || isRemoving}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}

      {members.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          No team members yet
        </div>
      )}
    </div>
  );
}
