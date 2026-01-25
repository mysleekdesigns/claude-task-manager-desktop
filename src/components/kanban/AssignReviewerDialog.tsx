/**
 * AssignReviewerDialog Component
 *
 * Modal dialog for assigning a human reviewer when a task is moved to HUMAN_REVIEW status.
 * Displays project collaborators with search/filter functionality.
 */

import { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, UserCircle2, Check } from 'lucide-react';
import type { ProjectMember, ProjectRole } from '@/store/useProjectStore';

// ============================================================================
// Types
// ============================================================================

interface AssignReviewerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  members: ProjectMember[];
  taskTitle: string;
  currentReviewerId?: string | null;
  onAssign: (userId: string | null) => void | Promise<void>;
  isLoading?: boolean;
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
      return `${parts[0]?.[0] ?? ''}${parts[parts.length - 1]?.[0] ?? ''}`.toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  }
  return email.slice(0, 2).toUpperCase();
}

/**
 * Get badge variant and class for role
 */
function getRoleBadgeProps(role: ProjectRole): { variant: 'default' | 'secondary' | 'outline'; className: string } {
  switch (role) {
    case 'OWNER':
      return { variant: 'default', className: 'bg-purple-600 text-white hover:bg-purple-700' };
    case 'ADMIN':
      return { variant: 'secondary', className: 'bg-blue-600 text-white hover:bg-blue-700' };
    case 'MEMBER':
      return { variant: 'outline', className: 'bg-green-600 text-white hover:bg-green-700' };
    case 'VIEWER':
      return { variant: 'outline', className: 'bg-gray-500 text-white hover:bg-gray-600' };
    default:
      return { variant: 'outline', className: '' };
  }
}

// ============================================================================
// Component
// ============================================================================

export function AssignReviewerDialog({
  open,
  onOpenChange,
  members,
  taskTitle,
  currentReviewerId,
  onAssign,
  isLoading = false,
}: AssignReviewerDialogProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(currentReviewerId ?? null);

  /**
   * Filter members based on search query
   */
  const filteredMembers = useMemo(() => {
    if (!searchQuery.trim()) {
      return members;
    }

    const query = searchQuery.toLowerCase();
    return members.filter((member) => {
      const user = member.user;
      if (!user) return false;

      const name = user.name?.toLowerCase() ?? '';
      const email = user.email.toLowerCase();
      const role = member.role.toLowerCase();

      return name.includes(query) || email.includes(query) || role.includes(query);
    });
  }, [members, searchQuery]);

  /**
   * Reset state when dialog opens/closes
   */
  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      // Reset search when closing
      setSearchQuery('');
      // Reset selection to current value
      setSelectedUserId(currentReviewerId ?? null);
    }
    onOpenChange(isOpen);
  };

  /**
   * Handle selecting the unassigned option
   */
  const handleSelectUnassigned = () => {
    setSelectedUserId(null);
  };

  /**
   * Handle selecting a user
   */
  const handleSelectUser = (userId: string) => {
    setSelectedUserId(userId);
  };

  /**
   * Handle confirm button click
   */
  const handleConfirm = () => {
    void onAssign(selectedUserId);
  };

  /**
   * Handle cancel button click
   */
  const handleCancel = () => {
    handleOpenChange(false);
  };

  /**
   * Check if selection has changed from current
   */
  const hasSelectionChanged = selectedUserId !== (currentReviewerId ?? null);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Assign Reviewer</DialogTitle>
          <DialogDescription>
            Select a team member to review &quot;{taskTitle}&quot;
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by name, email, or role..."
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); }}
              className="pl-10"
              disabled={isLoading}
            />
          </div>

          {/* Member List */}
          <ScrollArea className="h-[300px] rounded-md border">
            <div className="p-2 space-y-1">
              {/* Unassigned Option */}
              <button
                type="button"
                onClick={handleSelectUnassigned}
                disabled={isLoading}
                className={`
                  w-full flex items-center gap-3 p-3 rounded-md transition-colors text-left
                  ${selectedUserId === null
                    ? 'bg-primary/10 border border-primary'
                    : 'hover:bg-muted border border-transparent'
                  }
                  ${isLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                `}
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                  <UserCircle2 className="h-6 w-6 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">Unassigned</p>
                  <p className="text-xs text-muted-foreground">
                    No reviewer assigned
                  </p>
                </div>
                {selectedUserId === null && (
                  <Check className="h-5 w-5 text-primary flex-shrink-0" />
                )}
              </button>

              {/* Member Options */}
              {filteredMembers.map((member) => {
                const user = member.user;
                if (!user) return null;

                const isSelected = selectedUserId === user.id;
                const roleProps = getRoleBadgeProps(member.role);

                return (
                  <button
                    key={member.id}
                    type="button"
                    onClick={() => { handleSelectUser(user.id); }}
                    disabled={isLoading}
                    className={`
                      w-full flex items-center gap-3 p-3 rounded-md transition-colors text-left
                      ${isSelected
                        ? 'bg-primary/10 border border-primary'
                        : 'hover:bg-muted border border-transparent'
                      }
                      ${isLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                    `}
                  >
                    {/* Avatar */}
                    <Avatar className="h-10 w-10">
                      {user.avatar && (
                        <AvatarImage src={user.avatar} alt={user.name ?? user.email} />
                      )}
                      <AvatarFallback className="text-sm">
                        {getInitials(user.name, user.email)}
                      </AvatarFallback>
                    </Avatar>

                    {/* User Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm truncate">
                          {user.name ?? user.email}
                        </p>
                        <Badge
                          variant={roleProps.variant}
                          className={`${roleProps.className} text-[10px] px-1.5 py-0`}
                        >
                          {member.role}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {user.email}
                      </p>
                    </div>

                    {/* Selected Indicator */}
                    {isSelected && (
                      <Check className="h-5 w-5 text-primary flex-shrink-0" />
                    )}
                  </button>
                );
              })}

              {/* Empty State */}
              {filteredMembers.length === 0 && searchQuery && (
                <div className="py-8 text-center text-muted-foreground">
                  <p className="text-sm">No members found matching &quot;{searchQuery}&quot;</p>
                </div>
              )}

              {/* No Members State */}
              {members.length === 0 && (
                <div className="py-8 text-center text-muted-foreground">
                  <p className="text-sm">No team members in this project</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={handleCancel}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={isLoading || !hasSelectionChanged}
          >
            {isLoading ? 'Assigning...' : 'Confirm'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
