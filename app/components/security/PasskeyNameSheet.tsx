import SwipeableModal from '@/components/SwipeableModal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useTheme } from '@/context/ThemeContext';
import { Feather } from '@expo/vector-icons';
import { useState } from 'react';
import { SheetLayout } from './SheetLayout';

/** Names a new passkey before the system prompt, or renames an existing one. */
export default function PasskeyNameSheet({
  isVisible,
  mode,
  initialName,
  loading,
  onClose,
  onSubmit,
}: {
  isVisible: boolean;
  mode: 'add' | 'rename';
  initialName: string;
  loading: boolean;
  onClose: () => void;
  onSubmit: (name: string) => void;
}) {
  const { colors } = useTheme();
  const [name, setName] = useState(initialName);

  const trimmed = name.trim();
  const submit = () => trimmed && onSubmit(trimmed);

  return (
    <SwipeableModal isVisible={isVisible} onClose={onClose} maxHeight='80%'>
      <SheetLayout
        icon='key'
        title={mode === 'add' ? 'Add a passkey' : 'Rename passkey'}
        description={
          mode === 'add'
            ? 'Sign in with Face ID, Touch ID or your fingerprint instead of a password. Give it a name you’ll recognise.'
            : 'Pick a name that tells you which device or password manager holds it.'
        }
      >
        <Input
          variant='filled'
          placeholder='e.g. My iPhone'
          value={name}
          onChangeText={setName}
          maxLength={60}
          returnKeyType='done'
          onSubmitEditing={submit}
          leftIcon={<Feather name='tag' size={18} color={colors.mutedForeground} />}
        />
        <Button size='lg' isLoading={loading} disabled={!trimmed} onPress={submit}>
          {mode === 'add' ? 'Continue' : 'Save'}
        </Button>
      </SheetLayout>
    </SwipeableModal>
  );
}
