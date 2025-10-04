import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { startRegistration } from '@simplewebauthn/browser';
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
import { Loader2, LockKeyhole, Trash2, PlusCircle, Shield } from 'lucide-react';
import { Badge } from '../ui/badge';

const PasskeyManager = ({ getProfile }) => {
  const [passkeys, setPasskeys] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isPasskeyLoading, setIsPasskeyLoading] = useState(false);
  const [deletePasskeyId, setDeletePasskeyId] = useState(null);
  const [isNicknameDialogOpen, setIsNicknameDialogOpen] = useState(false);
  const [nickname, setNickname] = useState('');

  const fetchPasskeys = async () => {
    try {
      setIsLoading(true);
      const response = await axios.get(`${import.meta.env.VITE_API_URL}/api/auth/passkey`, {
        withCredentials: true,
      });
      setPasskeys(response.data);
    } catch (error) {
      toast.error('Failed to fetch passkeys');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPasskeys();
  }, []);

  const handlePasskeyRegister = async () => {
    if (!nickname.trim()) {
      toast.error('Please enter a nickname for your passkey');
      return;
    }

    try {
      setIsPasskeyLoading(true);
      const response = await axios.post(
        `${import.meta.env.VITE_API_URL}/api/auth/passkey/register`,
        {},
        {
          withCredentials: true,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.data) {
        const attResp = await startRegistration({
          optionsJSON: response.data,
          useAutoRegister: true,
        });

        const verificationRes = await axios.post(
          `${import.meta.env.VITE_API_URL}/api/auth/passkey/register/verify`,
          {
            attestationResponse: attResp,
            nickname: nickname.trim(),
          },
          { withCredentials: true }
        );

        if (verificationRes.data.verified) {
          toast.success('Passkey registered successfully');
          getProfile();
          fetchPasskeys();
          setIsNicknameDialogOpen(false);
          setNickname('');
        } else {
          toast.error('Registration failed');
        }
      }
    } catch (error) {
      console.log(error);

      toast.error(error.response?.data?.message || 'Failed to register passkey');
    } finally {
      setIsPasskeyLoading(false);
    }
  };

  const handleAddPasskeyClick = () => {
    setIsNicknameDialogOpen(true);
  };

  const handleDeletePasskey = async () => {
    if (!deletePasskeyId) return;

    try {
      await axios.delete(`${import.meta.env.VITE_API_URL}/api/auth/passkey/${deletePasskeyId}`, {
        withCredentials: true,
      });
      toast.success('Passkey deleted successfully');
      fetchPasskeys();
      getProfile();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to delete passkey');
    } finally {
      setDeletePasskeyId(null);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <Card className='w-full'>
      <CardHeader>
        <CardTitle className='flex items-center justify-between'>
          <div className='flex items-center gap-2'>
            <Shield className='h-5 w-5' />
            Your Passkeys
          </div>
          <Button
            onClick={handleAddPasskeyClick}
            disabled={isPasskeyLoading}
            className='flex items-center gap-2'
          >
            {isPasskeyLoading ? (
              <Loader2 className='h-4 w-4 animate-spin' />
            ) : (
              <PlusCircle className='h-4 w-4' />
            )}
            {isPasskeyLoading ? 'Registering...' : 'Add Passkey'}
          </Button>
        </CardTitle>
        <CardDescription></CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className='flex justify-center py-8'>
            <Loader2 className='h-8 w-8 animate-spin text-gray-400' />
          </div>
        ) : passkeys.length === 0 ? (
          <div className='text-center py-8 text-gray-500'>
            <LockKeyhole className='h-12 w-12 mx-auto mb-4 text-gray-400' />
            <p>No passkeys registered yet</p>
            <p className='text-sm'>Add a passkey to enable passwordless login</p>
          </div>
        ) : (
          <div className='space-y-4'>
            {passkeys.map((passkey) => (
              <div
                key={passkey.authenticatorid}
                className='flex items-center justify-between p-4 rounded-lg border'
              >
                <div className='space-y-1'>
                  <div className='font-medium'>
                    {passkey.nickname || 'Unnamed Device'}
                    <Badge className='ml-2' variant='outline'>
                      synced
                    </Badge>
                  </div>
                  <div className='text-sm text-gray-500'>
                    Created: {formatDate(passkey.createdat)}| Last used on{' '}
                    {formatDate(passkey.lastUsed)}
                  </div>
                  <div className='text-sm text-gray-500'></div>
                </div>
                <Button
                  variant='ghost'
                  size='icon'
                  className='text-red-500 hover:text-red-600 hover:bg-red-50'
                  onClick={() => setDeletePasskeyId(passkey.authenticatorid)}
                >
                  <Trash2 className='h-5 w-5' />
                </Button>
              </div>
            ))}
          </div>
        )}

        <Dialog open={isNicknameDialogOpen} onOpenChange={setIsNicknameDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Passkey</DialogTitle>
              <DialogDescription>
                Enter a nickname for your new passkey to help you identify it later.
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
              <Button onClick={handlePasskeyRegister} disabled={isPasskeyLoading}>
                {isPasskeyLoading ? <Loader2 className='h-4 w-4 animate-spin mr-2' /> : null}
                Continue
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <AlertDialog open={!!deletePasskeyId} onOpenChange={() => setDeletePasskeyId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Passkey</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete this passkey? This action cannot be undone.
                {passkeys.length === 1 && (
                  <p className='mt-2 text-red-500'>
                    Warning: This is your last passkey. Deleting it will disable passkey
                    authentication.
                  </p>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className='bg-red-500 hover:bg-red-600'
                onClick={handleDeletePasskey}
              >
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
