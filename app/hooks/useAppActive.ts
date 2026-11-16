import { useSyncExternalStore } from 'react';
import { AppState } from 'react-native';

const subscribe = (onChange: () => void) => {
  const sub = AppState.addEventListener('change', onChange);
  return () => sub.remove();
};
const isActive = () => AppState.currentState === 'active';

/** True while the app is in the foreground. */
export function useAppActive() {
  return useSyncExternalStore(subscribe, isActive);
}
