import DisableTwoFactorSheet from '@/components/security/DisableTwoFactorSheet';
import PasskeyActionsSheet from '@/components/security/PasskeyActionsSheet';
import PasskeyNameSheet from '@/components/security/PasskeyNameSheet';
import SessionSheet from '@/components/security/SessionSheet';
import TwoFactorSetupSheet from '@/components/security/TwoFactorSetupSheet';
import { DECK_CLEARANCE } from '@/components/music/UnifiedBottomDeck';
import { SettingsGroup, SettingsRow } from '@/components/profile/SettingsGroup';
import { StackHeader } from '@/components/ui/AppHeader';
import { useTheme } from '@/context/ThemeContext';
import { useToast } from '@/context/ToastContext';
import { useUser } from '@/context/UserContext';
import {
  addPasskey,
  deletePasskey,
  isPasskeySupported,
  listPasskeys,
  PasskeyCancelledError,
  renamePasskey,
  type Passkey,
} from '@/lib/passkey';
import {
  formatLastActive,
  listSessions,
  revokeOtherSessions,
  revokeSession,
  sessionIcon,
  type DeviceSession,
} from '@/lib/sessions';
import useApi from '@/utils/hooks/useApi';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Redirect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

// Lets the sheet finish closing before the system passkey prompt slides up over it.
const SHEET_CLOSE_DELAY_MS = 350;

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

const defaultPasskeyName = () => (Platform.OS === 'ios' ? 'iPhone' : 'Android phone');

const StatusPill = ({ on }: { on: boolean }) => {
  const { colors } = useTheme();
  return (
    <View style={[styles.pill, { backgroundColor: on ? `${colors.primary}1F` : colors.raised }]}>
      <View
        style={[styles.dot, { backgroundColor: on ? colors.primary : colors.mutedForeground }]}
      />
      <Text style={[styles.pillText, { color: on ? colors.primary : colors.mutedForeground }]}>
        {on ? 'On' : 'Off'}
      </Text>
    </View>
  );
};

const CurrentPill = () => {
  const { colors } = useTheme();
  return (
    <View style={[styles.pill, { backgroundColor: `${colors.primary}1F` }]}>
      <Text style={[styles.pillText, { color: colors.primary }]}>This device</Text>
    </View>
  );
};

export default function SecurityScreen() {
  const { colors } = useTheme();
  const { toast } = useToast();
  const { user, setUser } = useUser();
  const api = useApi();

  const [passkeys, setPasskeys] = useState<Passkey[]>([]);
  const [loadingPasskeys, setLoadingPasskeys] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [savingName, setSavingName] = useState(false);
  // Kept after closing so the sheet doesn't change its text while it slides away.
  const [nameTarget, setNameTarget] = useState<{ mode: 'add' | 'rename'; passkey?: Passkey }>({
    mode: 'add',
  });
  const [nameSheetOpen, setNameSheetOpen] = useState(false);
  const [twoFactorSheet, setTwoFactorSheet] = useState<'enable' | 'disable' | null>(null);
  // Bumped on every opening so each sheet mounts fresh, with no state left from last time.
  const [sheetKey, setSheetKey] = useState(0);
  const [actionsTarget, setActionsTarget] = useState<Passkey | null>(null);
  const [sessions, setSessions] = useState<DeviceSession[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [sessionTarget, setSessionTarget] = useState<
    { type: 'one'; session: DeviceSession } | { type: 'others'; count: number } | null
  >(null);

  const passkeysSupported = isPasskeySupported();
  const twoFactorEnabled = !!user?.twoFactorEnabled;
  const hasPassword = user?.hasPassword !== false;

  const loadPasskeys = useCallback(async () => {
    try {
      setPasskeys(await listPasskeys());
    } catch {
      toast('Couldn’t load your passkeys', { type: 'error' });
    } finally {
      setLoadingPasskeys(false);
      setRefreshing(false);
    }
  }, [toast]);

  const loadSessions = useCallback(async () => {
    try {
      setSessions(await listSessions(api));
    } catch (err: any) {
      toast(err.message, { type: 'error' });
    } finally {
      setLoadingSessions(false);
    }
  }, [api, toast]);

  useEffect(() => {
    if (!user) return;
    void loadPasskeys();
    void loadSessions();
  }, [user?.userid, loadPasskeys, loadSessions]); // eslint-disable-line react-hooks/exhaustive-deps

  const otherSessions = sessions.filter((session) => !session.isCurrent);

  const openSessionSheet = (target: NonNullable<typeof sessionTarget>) => {
    setSheetKey((key) => key + 1);
    setSessionTarget(target);
  };

  const confirmSessionSheet = async () => {
    if (!sessionTarget) return;
    try {
      if (sessionTarget.type === 'one') {
        await revokeSession(api, sessionTarget.session.id);
        setSessions((prev) => prev.filter((s) => s.id !== sessionTarget.session.id));
        toast('Device signed out', { type: 'success' });
      } else {
        await revokeOtherSessions(api);
        setSessions((prev) => prev.filter((s) => s.isCurrent));
        toast('Signed out of your other devices', { type: 'success' });
      }
    } catch (err: any) {
      toast(err.message, { type: 'error' });
      throw err;
    }
  };

  const setTwoFactor = useCallback(
    (enabled: boolean) => {
      setUser((prev) => {
        if (!prev) return prev;
        const next = { ...prev, twoFactorEnabled: enabled };
        void AsyncStorage.setItem('@user_profile', JSON.stringify(next));
        return next;
      });
    },
    [setUser]
  );

  const openNameSheet = (target: { mode: 'add' | 'rename'; passkey?: Passkey }) => {
    setNameTarget(target);
    setSheetKey((key) => key + 1);
    setNameSheetOpen(true);
  };

  const handleNameSubmit = async (name: string) => {
    const { mode, passkey } = nameTarget;

    if (mode === 'rename' && passkey) {
      setSavingName(true);
      try {
        await renamePasskey(passkey.id, name);
        setPasskeys((prev) => prev.map((p) => (p.id === passkey.id ? { ...p, name } : p)));
        setNameSheetOpen(false);
      } catch (err: any) {
        toast(err.message || 'Couldn’t rename this passkey', { type: 'error' });
      } finally {
        setSavingName(false);
      }
      return;
    }

    setNameSheetOpen(false);
    setRegistering(true);
    await new Promise((resolve) => setTimeout(resolve, SHEET_CLOSE_DELAY_MS));
    try {
      await addPasskey(name);
      toast('Passkey added', { type: 'success' });
      await loadPasskeys();
    } catch (err: any) {
      if (!(err instanceof PasskeyCancelledError)) {
        toast(err.message || 'Couldn’t add a passkey', { type: 'error' });
      }
    } finally {
      setRegistering(false);
    }
  };

  const removePasskey = async (passkey: Passkey) => {
    try {
      await deletePasskey(passkey.id);
      setPasskeys((prev) => prev.filter((p) => p.id !== passkey.id));
      toast('Passkey removed', { type: 'success' });
    } catch (err: any) {
      toast(err.message || 'Couldn’t remove this passkey', { type: 'error' });
      throw err;
    }
  };

  const openPasskeyActions = (passkey: Passkey) => {
    setActionsTarget(passkey);
    setSheetKey((key) => key + 1);
  };

  if (!user) return <Redirect href='/(tabs)/profile' />;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <StackHeader title='Security' />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: DECK_CLEARANCE }]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              void loadSessions();
              void loadPasskeys();
            }}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        <SettingsGroup title='Two-factor authentication'>
          <Text style={[styles.help, { color: colors.mutedForeground }]}>
            Ask for a code from your authenticator app whenever you sign in with your password.
          </Text>
          <SettingsRow
            icon='shield'
            label='Authenticator app'
            detail={twoFactorEnabled ? 'Codes are required to sign in' : 'Not set up'}
            trailing={<StatusPill on={twoFactorEnabled} />}
            onPress={() => {
              setSheetKey((key) => key + 1);
              setTwoFactorSheet(twoFactorEnabled ? 'disable' : 'enable');
            }}
          />
        </SettingsGroup>

        <SettingsGroup title='Passkeys'>
          <Text style={[styles.help, { color: colors.mutedForeground }]}>
            Sign in with Face ID, Touch ID or your fingerprint. Passkeys you add on the web work
            here too.
          </Text>

          {loadingPasskeys ? (
            <ActivityIndicator color={colors.primary} style={styles.loader} />
          ) : (
            passkeys.map((passkey) => (
              <SettingsRow
                key={passkey.id}
                icon={passkey.deviceType === 'singleDevice' ? 'smartphone' : 'key'}
                label={passkey.name || 'Passkey'}
                detail={`${passkey.backedUp ? 'Synced' : 'This device only'} · Added ${formatDate(passkey.createdAt)}`}
                onPress={() => openPasskeyActions(passkey)}
              />
            ))
          )}

          {!loadingPasskeys && passkeys.length === 0 && (
            <Text style={[styles.empty, { color: colors.mutedForeground }]}>No passkeys yet.</Text>
          )}

          <SettingsRow
            icon='plus'
            label={registering ? 'Waiting for your device…' : 'Add a passkey'}
            detail={passkeysSupported ? undefined : 'Not available on this device'}
            trailing={
              registering ? <ActivityIndicator size='small' color={colors.primary} /> : undefined
            }
            onPress={
              passkeysSupported && !registering ? () => openNameSheet({ mode: 'add' }) : undefined
            }
          />
        </SettingsGroup>

        <SettingsGroup title='Signed-in devices'>
          <Text style={[styles.help, { color: colors.mutedForeground }]}>
            Places where your account is signed in. Sign out any you don’t recognise.
          </Text>

          {loadingSessions ? (
            <ActivityIndicator color={colors.primary} style={styles.loader} />
          ) : (
            sessions.map((session) => (
              <SettingsRow
                key={session.id}
                icon={sessionIcon(session)}
                label={session.name}
                detail={
                  session.isCurrent
                    ? (session.detail ?? undefined)
                    : [session.location ?? session.detail, formatLastActive(session.lastActiveAt)]
                        .filter(Boolean)
                        .join(' · ')
                }
                trailing={session.isCurrent ? <CurrentPill /> : undefined}
                onPress={
                  session.isCurrent ? undefined : () => openSessionSheet({ type: 'one', session })
                }
              />
            ))
          )}

          {!loadingSessions && otherSessions.length > 0 && (
            <SettingsRow
              icon='log-out'
              label='Sign out of all other devices'
              destructive
              onPress={() => openSessionSheet({ type: 'others', count: otherSessions.length })}
            />
          )}
        </SettingsGroup>
      </ScrollView>

      <TwoFactorSetupSheet
        key={`enable-${sheetKey}`}
        isVisible={twoFactorSheet === 'enable'}
        hasPassword={hasPassword}
        onClose={() => setTwoFactorSheet(null)}
        onEnabled={() => {
          setTwoFactor(true);
          toast('Two-factor authentication is on', { type: 'success' });
        }}
      />
      <DisableTwoFactorSheet
        key={`disable-${sheetKey}`}
        isVisible={twoFactorSheet === 'disable'}
        hasPassword={hasPassword}
        onClose={() => setTwoFactorSheet(null)}
        onDisabled={() => {
          setTwoFactor(false);
          toast('Two-factor authentication is off', { type: 'success' });
        }}
      />
      <PasskeyActionsSheet
        key={`actions-${sheetKey}`}
        isVisible={!!actionsTarget}
        passkey={actionsTarget}
        isLastWayToSignIn={passkeys.length === 1 && !hasPassword}
        onClose={() => setActionsTarget(null)}
        onRename={() => {
          const passkey = actionsTarget;
          setActionsTarget(null);
          if (passkey) setTimeout(() => openNameSheet({ mode: 'rename', passkey }), 300);
        }}
        onRemove={() => (actionsTarget ? removePasskey(actionsTarget) : Promise.resolve())}
      />
      <SessionSheet
        key={`session-${sheetKey}`}
        isVisible={!!sessionTarget}
        target={sessionTarget}
        onClose={() => setSessionTarget(null)}
        onConfirm={confirmSessionSheet}
      />
      <PasskeyNameSheet
        key={`name-${sheetKey}`}
        isVisible={nameSheetOpen}
        mode={nameTarget.mode}
        initialName={nameTarget.passkey?.name || defaultPasskeyName()}
        loading={savingName}
        onClose={() => setNameSheetOpen(false)}
        onSubmit={handleNameSubmit}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingTop: 8, gap: 28 },
  help: { fontSize: 13.5, lineHeight: 19, paddingHorizontal: 20, marginBottom: 6 },
  empty: { fontSize: 14, paddingHorizontal: 20, paddingVertical: 10 },
  loader: { paddingVertical: 16 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    height: 26,
    borderRadius: 13,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  pillText: { fontSize: 12.5, fontWeight: '600' },
});
