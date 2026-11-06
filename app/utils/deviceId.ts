import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'syncvibe_device_id';
let loading: Promise<string> | null = null;

/**
 * Identifies this install to the server, so it can tell this phone reconnecting from a different
 * device of yours joining the same room. Random, and used for nothing else.
 */
export const getDeviceId = (): Promise<string> => {
  loading ??= AsyncStorage.getItem(KEY)
    .then(async (stored) => {
      if (stored) return stored;
      const created = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
      await AsyncStorage.setItem(KEY, created);
      return created;
    })
    // Storage failing shouldn't keep anyone out of a room. This still holds until the app closes.
    .catch(() => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`);
  return loading;
};
