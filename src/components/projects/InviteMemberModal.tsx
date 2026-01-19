/**
 * InviteMemberModal Component
 *
 * Modal dialog for inviting new members to a project.
 * Searches for users by email and adds them with a selected role.
 */

import { useState } from 'react';
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
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent } from '@/components/ui/card';
import { Search, UserPlus, AlertCircle } from 'lucide-react';
import { useIPCMutation } from '@/hooks/useIPC';
import { toast } from 'sonner';
import type { ProjectRole } from './TeamMembersList';

// ============================================================================
// Types
// ============================================================================

interface User {
  id: string;
  name: string | null;
  email: string;
  avatar: string | null;
}

interface InviteMemberModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  onSuccess?: () => void;
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
 * Validate email format
 */
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// ============================================================================
// Component
// ============================================================================

export function InviteMemberModal({
  open,
  onOpenChange,
  projectId,
  onSuccess,
}: InviteMemberModalProps) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<ProjectRole>('MEMBER');
  const [foundUser, setFoundUser] = useState<User | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  const findUserMutation = useIPCMutation('users:findByEmail');
  const addMemberMutation = useIPCMutation('projects:addMember');

  /**
   * Reset form state
   */
  const resetForm = () => {
    setEmail('');
    setRole('MEMBER');
    setFoundUser(null);
    setSearchError(null);
    setIsSearching(false);
  };

  /**
   * Handle dialog close
   */
  const handleClose = (open: boolean) => {
    if (!open) {
      resetForm();
    }
    onOpenChange(open);
  };

  /**
   * Search for user by email
   */
  const handleSearchUser = async () => {
    // Validate email
    if (!email.trim()) {
      setSearchError('Please enter an email address');
      return;
    }

    if (!isValidEmail(email)) {
      setSearchError('Please enter a valid email address');
      return;
    }

    setIsSearching(true);
    setSearchError(null);
    setFoundUser(null);

    try {
      const user = await findUserMutation.mutate(email.trim().toLowerCase());

      if (!user) {
        setSearchError('User not found with this email address');
      } else {
        setFoundUser(user);
      }
    } catch (error) {
      setSearchError(
        error instanceof Error ? error.message : 'Failed to search for user'
      );
    } finally {
      setIsSearching(false);
    }
  };

  /**
   * Handle email input blur
   */
  const handleEmailBlur = () => {
    if (email.trim() && !foundUser) {
      handleSearchUser();
    }
  };

  /**
   * Handle adding member to project
   */
  const handleAddMember = async () => {
    if (!foundUser) {
      toast.error('Please search for a user first');
      return;
    }

    try {
      await addMemberMutation.mutate(projectId, foundUser.id, role);
      toast.success(`${foundUser.name || foundUser.email} added to project`);
      handleClose(false);
      onSuccess?.();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to add member to project'
      );
    }
  };

  /**
   * Handle form submission
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!foundUser) {
      await handleSearchUser();
    } else {
      await handleAddMember();
    }
  };

  const isLoading = isSearching || addMemberMutation.loading;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Invite Team Member</DialogTitle>
          <DialogDescription>
            Search for a user by email and add them to your project.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Email Input */}
          <div className="space-y-2">
            <Label htmlFor="email">Email Address</Label>
            <div className="flex gap-2">
              <Input
                id="email"
                type="email"
                placeholder="user@example.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setSearchError(null);
                  setFoundUser(null);
                }}
                onBlur={handleEmailBlur}
                disabled={isLoading}
                className="flex-1"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={handleSearchUser}
                disabled={isLoading || !email.trim()}
              >
                <Search className="h-4 w-4" />
              </Button>
            </div>

            {/* Search Error */}
            {searchError && (
              <div className="flex items-start gap-2 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <span>{searchError}</span>
              </div>
            )}
          </div>

          {/* User Preview */}
          {foundUser && (
            <Card className="bg-muted/50">
              <CardContent className="flex items-center gap-3 p-4">
                <Avatar className="h-10 w-10">
                  {foundUser.avatar && (
                    <AvatarImage src={foundUser.avatar} alt={foundUser.name || foundUser.email} />
                  )}
                  <AvatarFallback className="text-sm">
                    {getInitials(foundUser.name, foundUser.email)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">
                    {foundUser.name || foundUser.email}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {foundUser.email}
                  </p>
                </div>
                <div className="flex items-center text-green-600">
                  <UserPlus className="h-4 w-4" />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Role Selector */}
          <div className="space-y-2">
            <Label htmlFor="role">Role</Label>
            <Select
              value={role}
              onValueChange={(value) => setRole(value as ProjectRole)}
              disabled={isLoading}
            >
              <SelectTrigger id="role">
                <SelectValue placeholder="Select a role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ADMIN">
                  <div className="flex flex-col items-start">
                    <span className="font-medium">Admin</span>
                    <span className="text-xs text-muted-foreground">
                      Can manage team members and project settings
                    </span>
                  </div>
                </SelectItem>
                <SelectItem value="MEMBER">
                  <div className="flex flex-col items-start">
                    <span className="font-medium">Member</span>
                    <span className="text-xs text-muted-foreground">
                      Can create and manage tasks
                    </span>
                  </div>
                </SelectItem>
                <SelectItem value="VIEWER">
                  <div className="flex flex-col items-start">
                    <span className="font-medium">Viewer</span>
                    <span className="text-xs text-muted-foreground">
                      Can view tasks but not edit
                    </span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleClose(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading || !foundUser}>
              {isLoading ? 'Adding...' : 'Add Member'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
