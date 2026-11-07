import { useState, useEffect, useCallback } from 'react';
import { authClient, getErrorMessage, isPasskeyCancelled, unwrap } from '@/lib/auth-client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
  Loader2,
  LockKeyhole,
  Trash2,
  PlusCircle,
  Smartphone,
  Key,
  Pencil,
  CloudOff,
  CloudyIcon,
} from 'lucide-react';
import { Badge } from '../ui/badge';

const PasskeyManager = () => {
  const [passkeys, setPasskeys] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isPasskeyLoading, setIsPasskeyLoading] = useState(false);
  const [deletePasskeyId, setDeletePasskeyId] = useState(null);
  const [isNicknameDialogOpen, setIsNicknameDialogOpen] = useState(false);
  const [nickname, setNickname] = useState('');
  const [editingPasskey, setEditingPasskey] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  const fetchPasskeys = useCallback(async () => {
    try {
      setIsLoading(true);
      setPasskeys(await unwrap(authClient.passkey.listUserPasskeys()));
    } catch {
      toast.error('Failed to fetch passkeys');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPasskeys();
  }, [fetchPasskeys]);

  const handlePasskeyRegister = async () => {
    const name = nickname.trim();
    if (!name) {
      toast.error('Please enter a nickname for your passkey');
      return;
    }

    setIsPasskeyLoading(true);
    const { error } = await authClient.passkey.addPasskey({ name });
    setIsPasskeyLoading(false);

    if (error) {
      if (!isPasskeyCancelled(error)) toast.error(getErrorMessage(error, 'Failed to add passkey'));
      return;
    }

    toast.success('Passkey registered successfully!');
    fetchPasskeys();
    setIsNicknameDialogOpen(false);
    setNickname('');
  };

  const handleAddPasskeyClick = () => {
    setNickname('');
    setIsNicknameDialogOpen(true);
  };

  const handleEditPasskey = (passkey) => {
    setEditingPasskey(passkey);
    setNickname(passkey.name || '');
  };

  const handleUpdatePasskey = async () => {
    if (!editingPasskey || !nickname.trim()) return;

    try {
      setIsUpdating(true);
      await unwrap(
        authClient.passkey.updatePasskey({ id: editingPasskey.id, name: nickname.trim() })
      );
      toast.success('Passkey updated successfully');
      fetchPasskeys();
      setEditingPasskey(null);
      setNickname('');
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to update passkey'));
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDeletePasskey = async () => {
    if (!deletePasskeyId) return;

    try {
      setIsDeleting(true);
      await unwrap(authClient.passkey.deletePasskey({ id: deletePasskeyId }));
      toast.success('Passkey deleted successfully');
      fetchPasskeys();
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to delete passkey'));
    } finally {
      setIsDeleting(false);
      setDeletePasskeyId(null);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  // Get icon based on device type
  const getDeviceIcon = (deviceType) => {
    // singleDevice = platform authenticator (TouchID, FaceID, Windows Hello)
    // multiDevice = cross-platform/roaming authenticator (security keys, synced passkeys)
    if (deviceType === 'singleDevice') {
      return <Smartphone className='h-5 w-5 text-foreground' />;
    }
    return <Key className='h-5 w-5 text-foreground' />;
  };

  return (
    <Card className='border-border/80 bg-card/60 backdrop-blur-xl shadow-sm rounded-2xl overflow-hidden'>
      <CardHeader className='pb-4'>
        <div className='flex items-center justify-between gap-4'>
          <div>
            <CardTitle className='text-base font-semibold'>Passkeys</CardTitle>
            <CardDescription className='text-xs text-muted-foreground mt-0.5'>
              Sign in securely with Touch ID, Face ID, Windows Hello, or hardware security keys
            </CardDescription>
          </div>
          <Button
            onClick={handleAddPasskeyClick}
            disabled={isPasskeyLoading}
            size='sm'
            className='rounded-xl h-8.5 px-3.5 text-xs font-medium shrink-0 gap-1.5 cursor-pointer'
          >
            {isPasskeyLoading ? (
              <Loader2 className='h-3.5 w-3.5 animate-spin' />
            ) : (
              <PlusCircle className='h-3.5 w-3.5' />
            )}
            Add passkey
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className='flex justify-center py-8'>
            <Loader2 className='h-8 w-8 animate-spin text-muted-foreground' />
          </div>
        ) : passkeys.length === 0 ? (
          <div className='text-center py-8 text-muted-foreground'>
            <LockKeyhole className='h-12 w-12 mx-auto mb-4 opacity-50' />
            <p className='font-medium'>No passkeys registered</p>
            <p className='text-sm mt-1'>Add a passkey to enable fast, secure passwordless login</p>
          </div>
        ) : (
          <div className='space-y-3'>
            {passkeys.map((passkey) => (
              <div
                key={passkey.id}
                className='flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors'
              >
                <div className='flex items-center gap-3'>
                  {getDeviceIcon(passkey.deviceType)}
                  <div className='space-y-1'>
                    <div className='flex items-center gap-2'>
                      <span className='font-medium'>{passkey.name || 'Unnamed Passkey'}</span>
                      <Badge
                        variant='outline'
                        className={`text-xs ${passkey.backedUp ? 'text-foreground border-foreground' : 'text-foreground border-foreground'}`}
                      >
                        {passkey.backedUp ? (
                          <>
                            <CloudyIcon className='h-3 w-3 mr-1' /> Synced
                          </>
                        ) : (
                          <>
                            <CloudOff className='h-3 w-3 mr-1' /> Device-only
                          </>
                        )}
                      </Badge>
                    </div>
                    <div className='text-sm text-muted-foreground'>
                      Created {formatDate(passkey.createdAt)}
                    </div>
                  </div>
                </div>
                <div className='flex items-center gap-1'>
                  <Button
                    variant='ghost'
                    size='icon'
                    className='h-8 w-8 text-muted-foreground hover:text-foreground'
                    onClick={() => handleEditPasskey(passkey)}
                  >
                    <Pencil className='h-4 w-4' />
                  </Button>
                  <Button
                    variant='ghost'
                    size='icon'
                    className='h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10 dark:hover:bg-destructive/20'
                    onClick={() => setDeletePasskeyId(passkey.id)}
                  >
                    <Trash2 className='h-4 w-4' />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Add Passkey Dialog */}
        <Dialog open={isNicknameDialogOpen} onOpenChange={setIsNicknameDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Passkey</DialogTitle>
              <DialogDescription>
                Give your passkey a nickname to help you identify it later (e.g., "MacBook Pro",
                "iPhone 15").
              </DialogDescription>
            </DialogHeader>
            <div className='grid gap-4 py-4'>
              <div className='grid gap-2'>
                <Label htmlFor='nickname'>Passkey Nickname</Label>
                <Input
                  id='nickname'
                  placeholder='e.g., Work Laptop, iPhone 15'
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handlePasskeyRegister()}
                  autoFocus
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant='outline'
                onClick={() => {
                  setIsNicknameDialogOpen(false);
                  setNickname('');
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handlePasskeyRegister}
                disabled={isPasskeyLoading || !nickname.trim()}
              >
                {isPasskeyLoading && <Loader2 className='h-4 w-4 animate-spin mr-2' />}
                Continue
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Passkey Dialog */}
        <Dialog open={!!editingPasskey} onOpenChange={() => setEditingPasskey(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Rename Passkey</DialogTitle>
              <DialogDescription>Update the nickname for this passkey.</DialogDescription>
            </DialogHeader>
            <div className='grid gap-4 py-4'>
              <div className='grid gap-2'>
                <Label htmlFor='edit-nickname'>Passkey Nickname</Label>
                <Input
                  id='edit-nickname'
                  placeholder='e.g., Work Laptop, iPhone 15'
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleUpdatePasskey()}
                  autoFocus
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant='outline' onClick={() => setEditingPasskey(null)}>
                Cancel
              </Button>
              <Button onClick={handleUpdatePasskey} disabled={isUpdating || !nickname.trim()}>
                {isUpdating && <Loader2 className='h-4 w-4 animate-spin mr-2' />}
                Save
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={!!deletePasskeyId} onOpenChange={() => setDeletePasskeyId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Passkey</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete this passkey? This action cannot be undone.
                {passkeys.length === 1 && (
                  <p className='mt-2 text-destructive font-medium'>
                    ⚠️ This is your last passkey. Deleting it will disable passkey authentication.
                  </p>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className='bg-destructive hover:bg-destructive/90'
                onClick={handleDeletePasskey}
                disabled={isDeleting}
              >
                {isDeleting && <Loader2 className='h-4 w-4 animate-spin mr-2' />}
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
};

export default PasskeyManager;
