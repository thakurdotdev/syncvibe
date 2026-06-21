import React, { createContext, useContext, useEffect, useState } from 'react';
import useApi from '@/utils/hooks/useApi';
import Constants from 'expo-constants';
import { toast } from '@/context/ToastContext';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface AppUpdate {
  id: number;
  version: string;
  releaseNotes: string | null;
  downloadUrl: string | null;
  critical: boolean;
  createdAt: string;
}

interface AppUpdateContextType {
  updateInfo: AppUpdate | null;
  isUpdateAvailable: boolean;
  currentVersion: string;
  checkUpdates: () => Promise<void>;
  loading: boolean;
}

const AppUpdateContext = createContext<AppUpdateContextType | null>(null);

export const useAppUpdate = () => {
  const context = useContext(AppUpdateContext);
  if (!context) {
    throw new Error('useAppUpdate must be used within an AppUpdateProvider');
  }
  return context;
};

const isNewerVersion = (current: string, latest: string): boolean => {
  const currentParts = current.split('.').map(Number);
  const latestParts = latest.split('.').map(Number);
  for (let i = 0; i < Math.max(currentParts.length, latestParts.length); i++) {
    const curr = currentParts[i] || 0;
    const lat = latestParts[i] || 0;
    if (lat > curr) return true;
    if (curr > lat) return false;
  }
  return false;
};

export const AppUpdateProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const api = useApi();
  const [updateInfo, setUpdateInfo] = useState<AppUpdate | null>(null);
  const [isUpdateAvailable, setIsUpdateAvailable] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);

  const currentVersion = Constants.expoConfig?.version || '1.0.0';

  const checkUpdates = async () => {
    setLoading(true);
    try {
      const response = await api.get('/api/app-update/latest');
      if (response.status === 200 && response.data.success && response.data.latest) {
        const latest = response.data.latest;
        setUpdateInfo(latest);
        const hasUpdate = isNewerVersion(currentVersion, latest.version);
        setIsUpdateAvailable(hasUpdate);

        if (hasUpdate) {
          const lastNotifiedVersion = await AsyncStorage.getItem('last-notified-update-version');
          if (lastNotifiedVersion !== latest.version) {
            await AsyncStorage.setItem('last-notified-update-version', latest.version);
            toast(`SyncVibe v${latest.version} is available! Check your profile to update.`, { type: 'info', duration: 6000 });
          }
        }
      }
    } catch (error) {
      console.error('Failed to check for updates:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkUpdates();
  }, []);

  return (
    <AppUpdateContext.Provider value={{ updateInfo, isUpdateAvailable, currentVersion, checkUpdates, loading }}>
      {children}
    </AppUpdateContext.Provider>
  );
};
