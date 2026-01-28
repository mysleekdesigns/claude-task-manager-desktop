/**
 * PendingInvitations Component
 *
 * Displays a list of pending project invitations for project owners/admins.
 * Allows resending or revoking invitations.
 */

import { useState, useMemo } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Mail,
  MoreHorizontal,
  RefreshCw,
  Trash2,
  Clock,
  AlertCircle,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import type { Invitation, InvitationStatus } from '@/types/invitation';

// ============================================================================
// Types
// ============================================================================

interface PendingInvitationsProps {
  projectId: string;
  invitations?: Invitation[];
  canManage?: boolean;
  onResend?: (invitationId: string) => Promise<void>;
  onRevoke?: (invitationId: string) => Promise<void>;
  onRefresh?: () => void;
}

// ============================================================================
// Mock Data (for UI development)
// ============================================================================

const MOCK_INVITATIONS: Invitation[] = [
  {
    id: '1',
    projectId: 'proj-1',
    projectName: 'Claude Tasks Desktop',
    invitedEmail: 'alice@example.com',
    invitedBy: 'user-1',
    inviterName: 'John Doe',
    role: 'MEMBER',
    token: 'inv_abc123',
    status: 'pending',
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
    expiresAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), // 5 days from now
  },
  {
    id: '2',
    projectId: 'proj-1',
    projectName: 'Claude Tasks Desktop',
    invitedEmail: 'bob@example.com',
    invitedBy: 'user-1',
    inviterName: 'John Doe',
    message: 'Would love to have you on the team!',
    role: 'ADMIN',
    token: 'inv_def456',
    status: 'pending',
    createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
    expiresAt: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000), // 6 days from now
  },
  {
    id: '3',
    projectId: 'proj-1',
    projectName: 'Claude Tasks Desktop',
    invitedEmail: 'charlie@example.com',
    invitedBy: 'user-1',
    inviterName: 'John Doe',
    role: 'VIEWER',
    token: 'inv_ghi789',
    status: 'expired',
    createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), // 10 days ago
    expiresAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
  },
];

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Format date to relative time or date string
 */
function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffDays = Math.floor(Math.abs(diffMs) / (1000 * 60 * 60 * 24));
  const diffHours = Math.floor(
    (Math.abs(diffMs) % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)
  );

  if (diffMs < 0) {
    // Past
    if (diffDays === 0) {
      if (diffHours === 0) return 'Just now';
      return `${diffHours}h ago`;
    }
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  } else {
    // Future
    if (diffDays === 0) {
      if (diffHours === 0) return 'Less than an hour';
      return `${diffHours}h remaining`;
    }
    if (diffDays === 1) return 'Tomorrow';
    return `${diffDays} days remaining`;
  }
}

/**
 * Get status badge variant and icon
 */
function getStatusBadgeProps(status: InvitationStatus): {
  variant: 'default' | 'secondary' | 'destructive' | 'outline';
  className?: string;
  icon: React.ReactNode;
} {
  switch (status) {
    case 'pending':
      return {
        variant: 'secondary',
        icon: <Clock className="h-3 w-3 mr-1" />,
      };
    case 'accepted':
      return {
        variant: 'default',
        className: 'bg-green-600 hover:bg-green-700',
        icon: <CheckCircle className="h-3 w-3 mr-1" />,
      };
    case 'expired':
      return {
        variant: 'destructive',
        icon: <AlertCircle className="h-3 w-3 mr-1" />,
      };
    case 'revoked':
      return {
        variant: 'outline',
        icon: <XCircle className="h-3 w-3 mr-1" />,
      };
    default:
      return {
        variant: 'outline',
        icon: null,
      };
  }
}

/**
 * Get role badge variant
 */
function getRoleBadgeClass(role: string): string {
  switch (role) {
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

// ============================================================================
// Component
// ============================================================================

export function PendingInvitations({
  projectId,
  invitations: propInvitations,
  canManage = true,
  onResend,
  onRevoke,
  onRefresh,
}: PendingInvitationsProps) {
  // Use mock data if no invitations provided
  const invitations = useMemo(() => {
    return (
      propInvitations ||
      MOCK_INVITATIONS.filter((inv) => inv.projectId === projectId)
    );
  }, [propInvitations, projectId]);

  const [resendingId, setResendingId] = useState<string | null>(null);
  const [revokeDialogOpen, setRevokeDialogOpen] = useState(false);
  const [selectedInvitation, setSelectedInvitation] =
    useState<Invitation | null>(null);
  const [isRevoking, setIsRevoking] = useState(false);

  // Filter to show only actionable invitations (pending)
  const pendingInvitations = useMemo(() => {
    return invitations.filter((inv) => inv.status === 'pending');
  }, [invitations]);

  // All invitations for history
  const allInvitations = invitations;

  /**
   * Handle resend invitation
   */
  const handleResend = async (invitation: Invitation) => {
    setResendingId(invitation.id);

    try {
      if (onResend) {
        await onResend(invitation.id);
      } else {
        // Mock resend
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
      toast.success(`Invitation resent to ${invitation.invitedEmail}`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to resend invitation'
      );
    } finally {
      setResendingId(null);
    }
  };

  /**
   * Handle revoke invitation
   */
  const handleRevoke = async () => {
    if (!selectedInvitation) return;

    setIsRevoking(true);

    try {
      if (onRevoke) {
        await onRevoke(selectedInvitation.id);
      } else {
        // Mock revoke
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
      toast.success('Invitation revoked');
      onRefresh?.();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to revoke invitation'
      );
    } finally {
      setIsRevoking(false);
      setRevokeDialogOpen(false);
      setSelectedInvitation(null);
    }
  };

  /**
   * Open revoke confirmation dialog
   */
  const openRevokeDialog = (invitation: Invitation) => {
    setSelectedInvitation(invitation);
    setRevokeDialogOpen(true);
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-muted-foreground" />
              <div>
                <CardTitle>Pending Invitations</CardTitle>
                <CardDescription>
                  {pendingInvitations.length > 0
                    ? `${pendingInvitations.length} pending invitation${pendingInvitations.length > 1 ? 's' : ''}`
                    : 'No pending invitations'}
                </CardDescription>
              </div>
            </div>
            {onRefresh && (
              <Button variant="ghost" size="icon" onClick={onRefresh}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            )}
          </div>
        </CardHeader>

        <CardContent>
          {allInvitations.length === 0 ? (
            <div className="text-center py-8">
              <Mail className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
              <p className="text-muted-foreground">No invitations yet</p>
              <p className="text-sm text-muted-foreground mt-1">
                Use the "Invite Member" button to invite people to this project
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Sent</TableHead>
                  <TableHead>Expires</TableHead>
                  {canManage && <TableHead className="w-[80px]">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {allInvitations.map((invitation) => {
                  const statusProps = getStatusBadgeProps(invitation.status);
                  const isResending = resendingId === invitation.id;
                  const isPending = invitation.status === 'pending';

                  return (
                    <TableRow key={invitation.id}>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">
                            {invitation.invitedEmail}
                          </span>
                          {invitation.message && (
                            <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                              "{invitation.message}"
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className={getRoleBadgeClass(invitation.role)}
                        >
                          {invitation.role}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={statusProps.variant}
                          className={statusProps.className}
                        >
                          <span className="flex items-center">
                            {statusProps.icon}
                            {invitation.status.charAt(0).toUpperCase() +
                              invitation.status.slice(1)}
                          </span>
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatRelativeTime(invitation.createdAt)}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatRelativeTime(invitation.expiresAt)}
                      </TableCell>
                      {canManage && (
                        <TableCell>
                          {isPending && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  disabled={isResending}
                                >
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  onClick={() => handleResend(invitation)}
                                  disabled={isResending}
                                >
                                  <RefreshCw className="h-4 w-4 mr-2" />
                                  {isResending ? 'Sending...' : 'Resend'}
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => openRevokeDialog(invitation)}
                                  className="text-destructive focus:text-destructive"
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Revoke
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Revoke Confirmation Dialog */}
      <AlertDialog open={revokeDialogOpen} onOpenChange={setRevokeDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke Invitation</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to revoke the invitation to{' '}
              <span className="font-medium">
                {selectedInvitation?.invitedEmail}
              </span>
              ? They will no longer be able to join the project using this
              invitation.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRevoking}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRevoke}
              disabled={isRevoking}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isRevoking ? 'Revoking...' : 'Revoke Invitation'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export default PendingInvitations;
