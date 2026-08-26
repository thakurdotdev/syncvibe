import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * A simple in-memory cache wrapper for AsyncStorage
 * to improve performance for frequently accessed values
 */
class StorageCache {
  private cache: Map<string, any> = new Map();

  async getItem(key: string): Promise<string | null> {
    // Check if we have a cached value first
    if (this.cache.has(key)) {
      return this.cache.get(key);
    }

    // Otherwise retrieve from AsyncStorage and cache it
    const value = await AsyncStorage.getItem(key);
    if (value !== null) {
      this.cache.set(key, value);
    }
    return value;
  }

  async setItem(key: string, value: string): Promise<void> {
    // Update cache first for immediate access
    this.cache.set(key, value);

    // Then persist to AsyncStorage
    return AsyncStorage.setItem(key, value);
  }

  async removeItem(key: string): Promise<void> {
    // Remove from cache
    this.cache.delete(key);

    // Then remove from AsyncStorage
    return AsyncStorage.removeItem(key);
  }

  async clear(): Promise<void> {
    this.cache.clear();
    return AsyncStorage.clear();
  }
}

export const storageCache = new StorageCache();
