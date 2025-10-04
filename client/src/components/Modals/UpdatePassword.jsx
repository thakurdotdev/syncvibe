import React, { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import axios from 'axios';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
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
import { Loader2 } from 'lucide-react';

const passwordSchema = yup.object().shape({
  oldPassword: yup.string().required('Current password is required'),
  newPassword: yup
    .string()
    .required('New password is required')
    .min(8, 'Password must be at least 8 characters')
    .matches(/[a-z]/, 'Must include a lowercase letter')
    .matches(/[A-Z]/, 'Must include an uppercase letter')
    .matches(/\d/, 'Must include a number')
    .matches(/[^a-zA-Z0-9]/, 'Must include a special character'),
  confirmNewPassword: yup
    .string()
    .required('Please confirm your new password')
    .oneOf([yup.ref('newPassword')], 'Passwords must match'),
});

const UpdatePasswordDialog = ({ isOpen, toggleDialog }) => {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({
    resolver: yupResolver(passwordSchema),
    defaultValues: {
      oldPassword: '',
      newPassword: '',
      confirmNewPassword: '',
    },
  });

  const onSubmit = async (data) => {
    setIsSubmitting(true);
    try {
      const response = await axios.post(
        `${import.meta.env.VITE_API_URL}/api/change-password`,
        {
          oldPassword: data.oldPassword,
          newPassword: data.newPassword,
        },
        {
          withCredentials: true,
          headers: { 'Content-Type': 'application/json' },
        }
      );

      if (response.status === 200) {
        toast.success('Password updated successfully');
        onClose();
        reset();
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update password. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={toggleDialog}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Update Password</DialogTitle>
          <DialogDescription>Change your account password.</DialogDescription>
        </DialogHeader>

        <form
          onSubmit={handleSubmit(onSubmit)}
          className='grid gap-6 py-4'
          aria-label='Update Password Form'
        >
          {[
            {
              label: 'Current Password',
              name: 'oldPassword',
              placeholder: 'Enter current password',
              type: 'password',
            },
            {
              label: 'New Password',
              name: 'newPassword',
              placeholder: 'Enter new password',
              type: 'password',
            },
            {
              label: 'Confirm Password',
              name: 'confirmNewPassword',
              placeholder: 'Confirm new password',
              type: 'password',
            },
          ].map((field) => (
            <div key={field.name} className='flex flex-col gap-2'>
              <Label htmlFor={field.name} className='text-sm font-medium text-primary'>
                {field.label}
              </Label>
              <div className='col-span-3'>
                <Controller
                  name={field.name}
                  control={control}
                  render={({ field: inputField }) => (
                    <Input
                      {...inputField}
                      id={field.name}
                      type={field.type}
                      placeholder={field.placeholder}
                      aria-invalid={!!errors[field.name]}
                    />
                  )}
                />
                {errors[field.name] && (
                  <p className='text-xs text-destructive mt-1'>{errors[field.name].message}</p>
                )}
              </div>
            </div>
          ))}

          <DialogFooter className='flex flex-col sm:flex-row gap-2 sm:gap-4'>
            <Button type='button' variant='secondary' onClick={toggleDialog}>
              Cancel
            </Button>
            <Button type='submit' disabled={isSubmitting} className='w-full sm:w-auto'>
              {isSubmitting && <Loader2 className='w-5 h-5 mr-2 animate-spin' />}
              {isSubmitting ? 'Updating...' : 'Update Password'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default UpdatePasswordDialog;
