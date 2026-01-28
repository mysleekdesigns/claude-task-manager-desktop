/**
 * InviteMemberModal Component
 *
 * Modal dialog for inviting new members to a project.
 * Supports searching for existing users by email, generating shareable invite links,
 * and sending email invitations to new users.
 */

import { useState, useCallback } from 'react';
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
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Search,
  UserPlus,
  AlertCircle,
  Link2,
  Mail,
  Copy,
  Check,
  Clock,
} from 'lucide-react';
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
  projectName?: string;
  onSuccess?: () => void;
}

interface InviteLink {
  url: string;
  token: string;
  expiresAt: Date;
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

/**
 * Generate a mock invite link (to be replaced with actual IPC call)
 */
function generateMockInviteLink(projectId: string): InviteLink {
  const token = `inv_${projectId.slice(0, 8)}_${Date.now().toString(36)}`;
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7); // 7 days from now

  return {
    url: `claude-tasks://invite/${token}`,
    token,
    expiresAt,
  };
}

/**
 * Format remaining time until expiration
 */
function formatExpirationTime(expiresAt: Date): string {
  const now = new Date();
  const diffMs = expiresAt.getTime() - now.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

  if (diffDays > 0) {
    return `${diffDays} day${diffDays > 1 ? 's' : ''}`;
  }
  if (diffHours > 0) {
    return `${diffHours} hour${diffHours > 1 ? 's' : ''}`;
  }
  return 'Less than an hour';
}

// ============================================================================
// Component
// ============================================================================

export function InviteMemberModal({
  open,
  onOpenChange,
  projectId,
  projectName,
  onSuccess,
}: InviteMemberModalProps) {
  // Search existing user state
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<ProjectRole>('MEMBER');
  const [foundUser, setFoundUser] = useState<User | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  // Invite link state
  const [inviteLink, setInviteLink] = useState<InviteLink | null>(null);
  const [isGeneratingLink, setIsGeneratingLink] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  // Email invitation state
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteMessage, setInviteMessage] = useState('');
  const [inviteRole, setInviteRole] = useState<ProjectRole>('MEMBER');
  const [isSendingInvite, setIsSendingInvite] = useState(false);

  // Active tab
  const [activeTab, setActiveTab] = useState<'search' | 'link' | 'email'>('search');

  const findUserMutation = useIPCMutation('users:findByEmail');
  const addMemberMutation = useIPCMutation('projects:addMember');

  /**
   * Reset form state
   */
  const resetForm = useCallback(() => {
    setEmail('');
    setRole('MEMBER');
    setFoundUser(null);
    setSearchError(null);
    setIsSearching(false);
    setInviteLink(null);
    setIsGeneratingLink(false);
    setLinkCopied(false);
    setInviteEmail('');
    setInviteMessage('');
    setInviteRole('MEMBER');
    setIsSendingInvite(false);
    setActiveTab('search');
  }, []);

  /**
   * Handle dialog close
   */
  const handleClose = useCallback(
    (open: boolean) => {
      if (!open) {
        resetForm();
      }
      onOpenChange(open);
    },
    [onOpenChange, resetForm]
  );

  /**
   * Search for user by email
   */
  const handleSearchUser = useCallback(async () => {
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
        setSearchError(
          'User not found. You can send an email invitation instead.'
        );
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
  }, [email, findUserMutation]);

  /**
   * Handle adding member to project
   */
  const handleAddMember = useCallback(async () => {
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
  }, [foundUser, projectId, role, addMemberMutation, handleClose, onSuccess]);

  /**
   * Handle form submission for search tab
   */
  const handleSearchSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      if (!foundUser) {
        await handleSearchUser();
      } else {
        await handleAddMember();
      }
    },
    [foundUser, handleSearchUser, handleAddMember]
  );

  /**
   * Generate invite link
   */
  const handleGenerateLink = useCallback(() => {
    setIsGeneratingLink(true);

    // Simulate API call - replace with actual IPC call
    setTimeout(() => {
      const link = generateMockInviteLink(projectId);
      setInviteLink(link);
      setIsGeneratingLink(false);
      toast.success('Invite link generated');
    }, 500);
  }, [projectId]);

  /**
   * Copy invite link to clipboard
   */
  const handleCopyLink = useCallback(async () => {
    if (!inviteLink) return;

    try {
      await navigator.clipboard.writeText(inviteLink.url);
      setLinkCopied(true);
      toast.success('Link copied to clipboard');

      // Reset copy state after 3 seconds
      setTimeout(() => {
        setLinkCopied(false);
      }, 3000);
    } catch (error) {
      toast.error('Failed to copy link');
    }
  }, [inviteLink]);

  /**
   * Send email invitation
   */
  const handleSendEmailInvite = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      if (!isValidEmail(inviteEmail)) {
        toast.error('Please enter a valid email address');
        return;
      }

      setIsSendingInvite(true);

      // Simulate API call - replace with actual IPC call
      setTimeout(() => {
        setIsSendingInvite(false);
        toast.success(`Invitation sent to ${inviteEmail}`);
        setInviteEmail('');
        setInviteMessage('');
        onSuccess?.();
      }, 1000);
    },
    [inviteEmail, onSuccess]
  );

  const isLoading = isSearching || addMemberMutation.loading;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle>Invite Team Member</DialogTitle>
          <DialogDescription>
            Add a team member to{' '}
            {projectName ? (
              <span className="font-medium">{projectName}</span>
            ) : (
              'your project'
            )}
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'search' | 'link' | 'email')}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="search" className="flex items-center gap-2">
              <Search className="h-4 w-4" />
              <span className="hidden sm:inline">Find User</span>
            </TabsTrigger>
            <TabsTrigger value="link" className="flex items-center gap-2">
              <Link2 className="h-4 w-4" />
              <span className="hidden sm:inline">Invite Link</span>
            </TabsTrigger>
            <TabsTrigger value="email" className="flex items-center gap-2">
              <Mail className="h-4 w-4" />
              <span className="hidden sm:inline">Send Email</span>
            </TabsTrigger>
          </TabsList>

          {/* Search Existing User Tab */}
          <TabsContent value="search">
            <form onSubmit={handleSearchSubmit} className="space-y-4 pt-4">
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

                {searchError && (
                  <div className="flex items-start gap-2 text-sm text-destructive">
                    <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <span>{searchError}</span>
                  </div>
                )}
              </div>

              {foundUser && (
                <Card className="bg-muted/50">
                  <CardContent className="flex items-center gap-3 p-4">
                    <Avatar className="h-10 w-10">
                      {foundUser.avatar && (
                        <AvatarImage
                          src={foundUser.avatar}
                          alt={foundUser.name || foundUser.email}
                        />
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
          </TabsContent>

          {/* Invite Link Tab */}
          <TabsContent value="link">
            <div className="space-y-4 pt-4">
              <p className="text-sm text-muted-foreground">
                Generate a shareable link that anyone can use to join this project.
              </p>

              {!inviteLink ? (
                <Button
                  onClick={handleGenerateLink}
                  disabled={isGeneratingLink}
                  className="w-full"
                >
                  <Link2 className="h-4 w-4 mr-2" />
                  {isGeneratingLink ? 'Generating...' : 'Generate Invite Link'}
                </Button>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Invite Link</Label>
                    <div className="flex gap-2">
                      <Input
                        value={inviteLink.url}
                        readOnly
                        className="flex-1 font-mono text-sm"
                      />
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={handleCopyLink}
                        className="shrink-0"
                      >
                        {linkCopied ? (
                          <Check className="h-4 w-4 text-green-600" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>

                  <Alert>
                    <Clock className="h-4 w-4" />
                    <AlertDescription>
                      This link expires in{' '}
                      <span className="font-medium">
                        {formatExpirationTime(inviteLink.expiresAt)}
                      </span>
                    </AlertDescription>
                  </Alert>

                  <Separator />

                  <Button
                    variant="outline"
                    onClick={() => {
                      setInviteLink(null);
                      setLinkCopied(false);
                    }}
                    className="w-full"
                  >
                    Generate New Link
                  </Button>
                </div>
              )}

              <DialogFooter className="pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleClose(false)}
                >
                  Close
                </Button>
              </DialogFooter>
            </div>
          </TabsContent>

          {/* Send Email Tab */}
          <TabsContent value="email">
            <form onSubmit={handleSendEmailInvite} className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="inviteEmail">
                  Email Address <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="inviteEmail"
                  type="email"
                  placeholder="colleague@example.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  disabled={isSendingInvite}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="inviteRole">Role</Label>
                <Select
                  value={inviteRole}
                  onValueChange={(value) => setInviteRole(value as ProjectRole)}
                  disabled={isSendingInvite}
                >
                  <SelectTrigger id="inviteRole">
                    <SelectValue placeholder="Select a role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ADMIN">Admin</SelectItem>
                    <SelectItem value="MEMBER">Member</SelectItem>
                    <SelectItem value="VIEWER">Viewer</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="inviteMessage">
                  Personal Message (Optional)
                </Label>
                <Textarea
                  id="inviteMessage"
                  placeholder="Add a personal note to your invitation..."
                  value={inviteMessage}
                  onChange={(e) => setInviteMessage(e.target.value)}
                  disabled={isSendingInvite}
                  rows={3}
                />
              </div>

              <Alert>
                <Mail className="h-4 w-4" />
                <AlertDescription>
                  An email will be sent with instructions to join this project.
                  The invitation expires in 7 days.
                </AlertDescription>
              </Alert>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleClose(false)}
                  disabled={isSendingInvite}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSendingInvite || !inviteEmail.trim()}
                >
                  <Mail className="h-4 w-4 mr-2" />
                  {isSendingInvite ? 'Sending...' : 'Send Invitation'}
                </Button>
              </DialogFooter>
            </form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
