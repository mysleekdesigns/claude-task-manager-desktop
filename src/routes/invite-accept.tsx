/**
 * Invite Accept Page
 *
 * Displays project invitation details and allows users to accept or decline.
 * Handles expired invitations gracefully.
 */

import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import {
  FolderGit2,
  UserPlus,
  Clock,
  AlertCircle,
  CheckCircle,
  XCircle,
  ArrowLeft,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import type { Invitation } from '@/types/invitation';

// ============================================================================
// Types
// ============================================================================

interface InviteAcceptPageState {
  isLoading: boolean;
  invitation: Invitation | null;
  error: string | null;
  isExpired: boolean;
  isAccepting: boolean;
  isDeclining: boolean;
  isComplete: boolean;
}

// ============================================================================
// Mock Data (for UI development)
// ============================================================================

const MOCK_INVITATION: Invitation = {
  id: '1',
  projectId: 'proj-123',
  projectName: 'Claude Tasks Desktop',
  invitedEmail: 'you@example.com',
  invitedBy: 'user-1',
  inviterName: 'John Doe',
  message: 'Hey! I would love to have you join our team. We are building something amazing!',
  role: 'MEMBER',
  token: 'inv_abc123',
  status: 'pending',
  createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
  expiresAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
};

const MOCK_EXPIRED_INVITATION: Invitation = {
  ...MOCK_INVITATION,
  id: '2',
  status: 'expired',
  expiresAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get initials from name
 */
function getInitials(name: string): string {
  const parts = name.trim().split(' ');
  if (parts.length >= 2) {
    return `${parts[0]?.[0] || ''}${parts[parts.length - 1]?.[0] || ''}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

/**
 * Format date to readable string
 */
function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
  }).format(date);
}

/**
 * Get role description
 */
function getRoleDescription(role: string): string {
  switch (role) {
    case 'ADMIN':
      return 'Full access to manage team and settings';
    case 'MEMBER':
      return 'Can create and manage tasks';
    case 'VIEWER':
      return 'Read-only access to view tasks';
    default:
      return '';
  }
}

/**
 * Get role badge class
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

export function InviteAcceptPage() {
  const { token } = useParams<{ token: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  const [state, setState] = useState<InviteAcceptPageState>({
    isLoading: true,
    invitation: null,
    error: null,
    isExpired: false,
    isAccepting: false,
    isDeclining: false,
    isComplete: false,
  });

  // Check for demo/test mode
  const isDemo = searchParams.get('demo') === 'true';
  const isExpiredDemo = searchParams.get('expired') === 'true';

  // Fetch invitation details on mount
  useEffect(() => {
    const fetchInvitation = async () => {
      setState((prev) => ({ ...prev, isLoading: true, error: null }));

      try {
        // Simulate API call
        await new Promise((resolve) => setTimeout(resolve, 800));

        // Use mock data for demo
        const mockInvite = isExpiredDemo ? MOCK_EXPIRED_INVITATION : MOCK_INVITATION;

        // Check if expired
        const isExpired =
          mockInvite.expiresAt.getTime() < Date.now() ||
          mockInvite.status === 'expired';

        setState({
          isLoading: false,
          invitation: mockInvite,
          error: null,
          isExpired,
          isAccepting: false,
          isDeclining: false,
          isComplete: false,
        });
      } catch (error) {
        setState({
          isLoading: false,
          invitation: null,
          error:
            error instanceof Error
              ? error.message
              : 'Failed to load invitation',
          isExpired: false,
          isAccepting: false,
          isDeclining: false,
          isComplete: false,
        });
      }
    };

    if (token || isDemo) {
      fetchInvitation();
    } else {
      setState({
        isLoading: false,
        invitation: null,
        error: 'Invalid invitation link',
        isExpired: false,
        isAccepting: false,
        isDeclining: false,
        isComplete: false,
      });
    }
  }, [token, isDemo, isExpiredDemo]);

  /**
   * Handle accept invitation
   */
  const handleAccept = async () => {
    if (!state.invitation) return;

    if (!isAuthenticated) {
      // Redirect to login with return URL
      const returnUrl = window.location.pathname + window.location.search;
      navigate(`/login?returnTo=${encodeURIComponent(returnUrl)}`);
      return;
    }

    setState((prev) => ({ ...prev, isAccepting: true }));

    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1500));

      setState((prev) => ({
        ...prev,
        isAccepting: false,
        isComplete: true,
      }));

      toast.success('You have joined the project!');

      // Redirect to project after short delay
      setTimeout(() => {
        navigate(`/projects/${state.invitation?.projectId || ''}`);
      }, 1500);
    } catch (error) {
      setState((prev) => ({ ...prev, isAccepting: false }));
      toast.error(
        error instanceof Error
          ? error.message
          : 'Failed to accept invitation'
      );
    }
  };

  /**
   * Handle decline invitation
   */
  const handleDecline = async () => {
    if (!state.invitation) return;

    setState((prev) => ({ ...prev, isDeclining: true }));

    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 800));

      toast.success('Invitation declined');
      navigate('/');
    } catch (error) {
      setState((prev) => ({ ...prev, isDeclining: false }));
      toast.error(
        error instanceof Error
          ? error.message
          : 'Failed to decline invitation'
      );
    }
  };

  // Loading state
  if (state.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-lg mx-4">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-muted-foreground">Loading invitation...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Error state
  if (state.error || !state.invitation) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-lg mx-4">
          <CardHeader>
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              <CardTitle>Invalid Invitation</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              {state.error ||
                'This invitation link is invalid or has been revoked.'}
            </p>
          </CardContent>
          <CardFooter>
            <Button variant="outline" onClick={() => navigate('/')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Go to Dashboard
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  // Expired state
  if (state.isExpired) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-lg mx-4">
          <CardHeader>
            <div className="flex items-center gap-2 text-destructive">
              <Clock className="h-5 w-5" />
              <CardTitle>Invitation Expired</CardTitle>
            </div>
            <CardDescription>
              This invitation is no longer valid
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Expired on {formatDate(state.invitation.expiresAt)}</AlertTitle>
              <AlertDescription>
                Contact{' '}
                <span className="font-medium">
                  {state.invitation.inviterName}
                </span>{' '}
                to request a new invitation to{' '}
                <span className="font-medium">
                  {state.invitation.projectName}
                </span>
                .
              </AlertDescription>
            </Alert>
          </CardContent>
          <CardFooter>
            <Button variant="outline" onClick={() => navigate('/')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Go to Dashboard
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  // Success state
  if (state.isComplete) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-lg mx-4">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="h-16 w-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
              <div>
                <h2 className="text-xl font-semibold">
                  Welcome to {state.invitation.projectName}!
                </h2>
                <p className="text-muted-foreground mt-1">
                  You have successfully joined the project
                </p>
              </div>
              <p className="text-sm text-muted-foreground">
                Redirecting to project...
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { invitation } = state;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
              <FolderGit2 className="h-8 w-8 text-primary" />
            </div>
          </div>
          <CardTitle className="text-2xl">Project Invitation</CardTitle>
          <CardDescription>
            You have been invited to join a project
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Project Info */}
          <div className="text-center">
            <h3 className="text-xl font-semibold">{invitation.projectName}</h3>
            <div className="flex items-center justify-center gap-2 mt-2">
              <Badge
                variant="secondary"
                className={getRoleBadgeClass(invitation.role)}
              >
                {invitation.role}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {getRoleDescription(invitation.role)}
            </p>
          </div>

          <Separator />

          {/* Inviter Info */}
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10">
              <AvatarFallback>
                {getInitials(invitation.inviterName)}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="font-medium">{invitation.inviterName}</p>
              <p className="text-sm text-muted-foreground">Invited you</p>
            </div>
          </div>

          {/* Personal Message */}
          {invitation.message && (
            <div className="bg-muted/50 rounded-lg p-4">
              <p className="text-sm italic">"{invitation.message}"</p>
            </div>
          )}

          {/* Expiration Warning */}
          <Alert>
            <Clock className="h-4 w-4" />
            <AlertDescription>
              This invitation expires on{' '}
              <span className="font-medium">
                {formatDate(invitation.expiresAt)}
              </span>
            </AlertDescription>
          </Alert>

          {/* Login Notice */}
          {!isAuthenticated && (
            <Alert variant="default" className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-900">
              <UserPlus className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-blue-800 dark:text-blue-200">
                You will need to sign in or create an account to accept this
                invitation.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>

        <CardFooter className="flex gap-3">
          <Button
            variant="outline"
            className="flex-1"
            onClick={handleDecline}
            disabled={state.isAccepting || state.isDeclining}
          >
            {state.isDeclining ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <XCircle className="h-4 w-4 mr-2" />
            )}
            Decline
          </Button>
          <Button
            className="flex-1"
            onClick={handleAccept}
            disabled={state.isAccepting || state.isDeclining}
          >
            {state.isAccepting ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <CheckCircle className="h-4 w-4 mr-2" />
            )}
            Accept & Join
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

export default InviteAcceptPage;
