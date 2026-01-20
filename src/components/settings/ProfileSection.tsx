/**
 * Profile Section Component (Phase 14.3)
 *
 * Settings section for user profile management including:
 * - Avatar upload
 * - Name editing
 * - Email display (read-only)
 * - Password change
 */

import { useState, useCallback, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/hooks/useAuth';
import { useIPCMutation, useIPC } from '@/hooks/useIPC';
import { Loader2, Upload, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';

// ============================================================================
// Component
// ============================================================================

export function ProfileSection() {
  const { user, updateProfile } = useAuth();
  const invoke = useIPC();

  // Local state
  const [name, setName] = useState(user?.name || '');
  const [avatar, setAvatar] = useState<string | null>(user?.avatar || null);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // IPC mutations
  const updateProfileMutation = useIPCMutation('auth:updateProfile');
  const changePasswordMutation = useIPCMutation('auth:changePassword');

  // Ref for file input
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ============================================================================
  // Handlers
  // ============================================================================

  /**
   * Handle avatar upload via native file dialog
   */
  const handleAvatarUpload = useCallback(async () => {
    try {
      const result = await invoke('dialog:openFile', {
        title: 'Select Avatar Image',
        filters: [
          {
            name: 'Images',
            extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
          },
        ],
        properties: ['openFile'],
      });

      if (!result.canceled && result.filePaths.length > 0) {
        const filePath = result.filePaths[0];
        if (filePath) {
          // Convert file to base64 for storage
          const base64 = await invoke('file:readAsBase64', filePath);
          setAvatar(base64);

          toast.success('Avatar selected', {
            description: 'Click Save Profile to apply changes',
          });
        }
      }
    } catch (error) {
      console.error('Failed to upload avatar:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to upload avatar');
    }
  }, [invoke]);

  /**
   * Save profile changes (name and avatar)
   */
  const handleSaveProfile = useCallback(async () => {
    if (!user) return;

    try {
      const updates: { name?: string; avatar?: string } = {};
      if (name.trim()) updates.name = name.trim();
      if (avatar) updates.avatar = avatar;

      await updateProfileMutation.mutate(updates);

      await updateProfile(updates);

      toast.success('Profile updated successfully');
    } catch (error) {
      console.error('Failed to update profile:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to update profile');
    }
  }, [user, name, avatar, updateProfileMutation, updateProfile]);

  /**
   * Change password
   */
  const handleChangePassword = useCallback(async () => {
    if (!user) return;

    // Validation
    if (!currentPassword) {
      toast.error('Please enter your current password');
      return;
    }

    if (!newPassword) {
      toast.error('Please enter a new password');
      return;
    }

    if (newPassword.length < 8) {
      toast.error('New password must be at least 8 characters');
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    try {
      await changePasswordMutation.mutate({
        currentPassword,
        newPassword,
      });

      // Clear password fields
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');

      toast.success('Password changed successfully');
    } catch (error) {
      console.error('Failed to change password:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to change password');
    }
  }, [user, currentPassword, newPassword, confirmPassword, changePasswordMutation]);

  // ============================================================================
  // Helpers
  // ============================================================================

  const getInitials = (name: string | null | undefined, email: string): string => {
    if (name) {
      const parts = name.split(' ');
      if (parts.length >= 2 && parts[0] && parts[1]) {
        return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
      }
      return name.slice(0, 2).toUpperCase();
    }
    return email.slice(0, 2).toUpperCase();
  };

  const hasProfileChanges = name !== (user?.name || '') || avatar !== user?.avatar;

  // ============================================================================
  // Render
  // ============================================================================

  if (!user) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>Loading user information...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile</CardTitle>
        <CardDescription>Manage your profile information and avatar</CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Avatar Section */}
        <div className="flex items-center gap-4">
          <Avatar className="h-20 w-20">
            <AvatarImage src={avatar || user.avatar || undefined} />
            <AvatarFallback className="text-lg">
              {getInitials(user.name, user.email)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarUpload}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={handleAvatarUpload}
              disabled={updateProfileMutation.loading}
            >
              <Upload className="mr-2 h-4 w-4" />
              Upload Avatar
            </Button>
            <p className="text-xs text-muted-foreground mt-2">
              JPG, PNG, GIF or WebP. Max 5MB.
            </p>
          </div>
        </div>

        {/* Name Field */}
        <div className="space-y-2">
          <Label htmlFor="name">Name</Label>
          <Input
            id="name"
            type="text"
            placeholder="Your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={updateProfileMutation.loading}
          />
        </div>

        {/* Email Field (Read-only) */}
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={user.email}
            disabled
            className="bg-muted cursor-not-allowed"
          />
          <p className="text-xs text-muted-foreground">
            Email cannot be changed
          </p>
        </div>

        {/* Save Button */}
        <div className="flex justify-end">
          <Button
            onClick={handleSaveProfile}
            disabled={!hasProfileChanges || updateProfileMutation.loading}
          >
            {updateProfileMutation.loading && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            Save Profile
          </Button>
        </div>

        {/* Password Change Section */}
        <div className="pt-6 border-t space-y-4">
          <div>
            <h3 className="text-lg font-medium">Change Password</h3>
            <p className="text-sm text-muted-foreground">
              Update your password to keep your account secure
            </p>
          </div>

          <div className="space-y-4">
            {/* Current Password */}
            <div className="space-y-2">
              <Label htmlFor="current-password">Current Password</Label>
              <div className="relative">
                <Input
                  id="current-password"
                  type={showCurrentPassword ? 'text' : 'password'}
                  placeholder="Enter current password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  disabled={changePasswordMutation.loading}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  tabIndex={-1}
                >
                  {showCurrentPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            {/* New Password */}
            <div className="space-y-2">
              <Label htmlFor="new-password">New Password</Label>
              <div className="relative">
                <Input
                  id="new-password"
                  type={showNewPassword ? 'text' : 'password'}
                  placeholder="Enter new password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  disabled={changePasswordMutation.loading}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  tabIndex={-1}
                >
                  {showNewPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                Must be at least 8 characters
              </p>
            </div>

            {/* Confirm Password */}
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm New Password</Label>
              <div className="relative">
                <Input
                  id="confirm-password"
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder="Confirm new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={changePasswordMutation.loading}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  tabIndex={-1}
                >
                  {showConfirmPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Change Password Button */}
            <div className="flex justify-end">
              <Button
                onClick={handleChangePassword}
                disabled={
                  !currentPassword ||
                  !newPassword ||
                  !confirmPassword ||
                  changePasswordMutation.loading
                }
              >
                {changePasswordMutation.loading && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Change Password
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
