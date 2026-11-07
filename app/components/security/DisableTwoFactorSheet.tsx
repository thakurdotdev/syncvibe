import SwipeableModal from '@/components/SwipeableModal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useTheme } from '@/context/ThemeContext';
import { authClient, unwrap } from '@/lib/auth-client';
import { Feather } from '@expo/vector-icons';
import { useState } from 'react';
import { SheetLayout } from './SheetLayout';

export default function DisableTwoFactorSheet({
  isVisible,
  hasPassword,
  onClose,
  onDisabled,
}: {
  isVisible: boolean;
  hasPassword: boolean;
  onClose: () => void;
  onDisabled: () => void;
}) {
  const { colors } = useTheme();
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const disable = async () => {
    setLoading(true);
    setError('');
    try {
      await unwrap(authClient.twoFactor.disable(hasPassword ? { password } : {}));
      onDisabled();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Could not turn off two-factor. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SwipeableModal isVisible={isVisible} onClose={onClose} maxHeight='80%'>
      <SheetLayout
        icon='shield-off'
        tone='destructive'
        title='Turn off two-factor?'
        description={
          hasPassword
            ? 'Your account will only be protected by your password. Confirm it to continue.'
            : 'Signing in will no longer ask for a code from your authenticator app.'
        }
      >
        {hasPassword && (
          <Input
            variant='filled'
            placeholder='Password'
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize='none'
            autoComplete='current-password'
            textContentType='password'
            leftIcon={<Feather name='lock' size={18} color={colors.mutedForeground} />}
            error={!!error}
            errorText={error}
          />
        )}
        <Button
          size='lg'
          variant='destructive'
          isLoading={loading}
          disabled={hasPassword && !password}
          onPress={disable}
        >
          Turn off
        </Button>
        <Button size='lg' variant='ghost' disabled={loading} onPress={onClose}>
          Keep it on
        </Button>
      </SheetLayout>
    </SwipeableModal>
  );
}
