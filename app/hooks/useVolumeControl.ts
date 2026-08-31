import { VolumeControl } from '@/modules/VolumeControl';
import { storageCache } from '@/utils/storageCache';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, PermissionsAndroid, Platform } from 'react-native';

const VOLUME_CONTROL_PREF_KEY = '@volume_control_enabled';

async function requestNotificationPermission(): Promise<boolean> {
  if (Platform.OS !== 'android' || Platform.Version < 33) return true;

  const status = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
  );
  return status === PermissionsAndroid.RESULTS.GRANTED;
}

export function useVolumeControl() {
  const [isEnabled, setIsEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const mountedRef = useRef(false);
  const operationInProgressRef = useRef(false);

  // Load persisted preference and sync with actual service state
  useEffect(() => {
    mountedRef.current = true;

    const init = async () => {
      try {
        if (!VolumeControl.isAvailable) return;

        const saved = await storageCache.getItem(VOLUME_CONTROL_PREF_KEY);
        const running = await VolumeControl.isRunning();

        if (!mountedRef.current) return;

        if (saved === 'true' && !running) {
          // Do not restart after the user explicitly stopped the service from
          // the notification. A service restart is still attempted when the
          // process/service died for another reason.
          const stoppedByUser = await VolumeControl.wasStoppedByUser();
          if (stoppedByUser) {
            await storageCache.setItem(VOLUME_CONTROL_PREF_KEY, 'false');
            setIsEnabled(false);
            return;
          }

          const granted = await requestNotificationPermission();
          if (!granted) {
            await storageCache.setItem(VOLUME_CONTROL_PREF_KEY, 'false');
            setIsEnabled(false);
            return;
          }

          const started = await VolumeControl.start();
          if (!started) throw new Error('Volume control service did not start');

          await storageCache.setItem(VOLUME_CONTROL_PREF_KEY, 'true');
          if (mountedRef.current) setIsEnabled(true);
        } else {
          setIsEnabled(running);
        }
      } catch (error) {
        console.warn('[VolumeControl] Failed to initialize', error);
        if (mountedRef.current) setIsEnabled(false);
      } finally {
        if (mountedRef.current) setIsLoading(false);
      }
    };

    init();

    const stateSubscription = VolumeControl.onStateChanged((running) => {
      if (!mountedRef.current) return;

      setIsEnabled(running);
      if (!running) {
        storageCache.setItem(VOLUME_CONTROL_PREF_KEY, 'false').catch((error) => {
          console.warn('[VolumeControl] Failed to persist stopped state', error);
        });
      }
    });

    // Re-sync when app comes back to foreground
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active' && mountedRef.current && VolumeControl.isAvailable) {
        VolumeControl.isRunning()
          .then(async (running) => {
            if (running) {
              if (mountedRef.current) setIsEnabled(true);
              return;
            }

            const saved = await storageCache.getItem(VOLUME_CONTROL_PREF_KEY);
            if (saved === 'true' && (await VolumeControl.wasStoppedByUser())) {
              await storageCache.setItem(VOLUME_CONTROL_PREF_KEY, 'false');
            }
            if (mountedRef.current) setIsEnabled(false);
          })
          .catch((error) => {
            console.warn('[VolumeControl] Failed to sync service state', error);
          });
      }
    });

    return () => {
      mountedRef.current = false;
      subscription.remove();
      stateSubscription.remove();
    };
  }, []);

  const toggle = useCallback(async () => {
    if (!VolumeControl.isAvailable || operationInProgressRef.current) return;

    operationInProgressRef.current = true;
    if (mountedRef.current) setIsLoading(true);

    try {
      const running = await VolumeControl.isRunning();

      if (running) {
        const stopped = await VolumeControl.stop();
        if (!stopped) throw new Error('Volume control service did not stop');

        await storageCache.setItem(VOLUME_CONTROL_PREF_KEY, 'false');
        if (mountedRef.current) setIsEnabled(false);
      } else {
        const granted = await requestNotificationPermission();
        if (!granted) return;

        const started = await VolumeControl.start();
        if (!started) throw new Error('Volume control service did not start');

        await storageCache.setItem(VOLUME_CONTROL_PREF_KEY, 'true');
        if (mountedRef.current) setIsEnabled(true);
      }
    } catch (error) {
      console.warn('[VolumeControl] Failed to toggle service', error);
      try {
        const running = await VolumeControl.isRunning();
        if (mountedRef.current) setIsEnabled(running);
      } catch {
        if (mountedRef.current) setIsEnabled(false);
      }
    } finally {
      operationInProgressRef.current = false;
      if (mountedRef.current) setIsLoading(false);
    }
  }, []);

  return {
    isEnabled,
    isLoading,
    toggle,
    isAvailable: VolumeControl.isAvailable,
  } as const;
}
