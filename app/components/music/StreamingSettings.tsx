import React, { useState } from 'react';
import { View, Text, Switch, Alert } from 'react-native';
import { Button } from '@/components/ui/button';
import streamingManager from '@/utils/streamingManager';

interface StreamingSettingsProps {
  className?: string;
}

export const StreamingSettings: React.FC<StreamingSettingsProps> = ({ className }) => {
  const [settings, setSettings] = useState({
    preferredQuality: '320kbps',
    enableCaching: true,
    preloadNextTrack: true,
    fallbackEnabled: true,
  });

  const handleQualityChange = (quality: '320kbps' | '128kbps' | '48kbps' | '12kbps') => {
    setSettings((prev) => ({ ...prev, preferredQuality: quality }));
    streamingManager.updateConfig({ preferredQuality: quality });
  };

  const handleCachingToggle = (enabled: boolean) => {
    setSettings((prev) => ({ ...prev, enableCaching: enabled }));
    streamingManager.updateConfig({ enableCaching: enabled });
  };

  const handlePreloadToggle = (enabled: boolean) => {
    setSettings((prev) => ({ ...prev, preloadNextTrack: enabled }));
    streamingManager.updateConfig({ preloadNextTrack: enabled });
  };

  const handleFallbackToggle = (enabled: boolean) => {
    setSettings((prev) => ({ ...prev, fallbackEnabled: enabled }));
    streamingManager.updateConfig({ fallbackEnabled: enabled });
  };

  const clearCache = () => {
    Alert.alert('Clear Cache', 'This will clear all cached music tracks. Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: () => {
          streamingManager.clearCache();
          Alert.alert('Success', 'Cache cleared successfully');
        },
      },
    ]);
  };

  const getCacheStats = () => {
    return streamingManager.getCacheStats();
  };

  const stats = getCacheStats();

  return (
    <View className={`p-4 space-y-4 ${className}`}>
      <Text className='text-lg font-bold text-gray-900 dark:text-white'>Streaming Settings</Text>

      {/* Quality Settings */}
      <View className='space-y-2'>
        <Text className='text-base font-semibold text-gray-800 dark:text-gray-200'>
          Audio Quality
        </Text>
        <Text className='text-sm text-gray-600 dark:text-gray-400'>
          Higher quality uses more data but sounds better
        </Text>
        <View className='flex-row flex-wrap gap-2'>
          {['320kbps', '128kbps', '48kbps', '12kbps'].map((quality) => (
            <Button
              key={quality}
              variant={settings.preferredQuality === quality ? 'default' : 'outline'}
              onPress={() => handleQualityChange(quality as any)}
              className='px-3 py-1'
            >
              <Text
                className={`text-sm ${
                  settings.preferredQuality === quality
                    ? 'text-white'
                    : 'text-gray-700 dark:text-gray-300'
                }`}
              >
                {quality}
              </Text>
            </Button>
          ))}
        </View>
      </View>

      {/* Caching Settings */}
      <View className='space-y-2'>
        <View className='flex-row justify-between items-center'>
          <View className='flex-1'>
            <Text className='text-base font-semibold text-gray-800 dark:text-gray-200'>
              Enable Caching
            </Text>
            <Text className='text-sm text-gray-600 dark:text-gray-400'>
              Cache tracks for offline playback
            </Text>
          </View>
          <Switch value={settings.enableCaching} onValueChange={handleCachingToggle} />
        </View>
      </View>

      {/* Preload Settings */}
      <View className='space-y-2'>
        <View className='flex-row justify-between items-center'>
          <View className='flex-1'>
            <Text className='text-base font-semibold text-gray-800 dark:text-gray-200'>
              Preload Next Track
            </Text>
            <Text className='text-sm text-gray-600 dark:text-gray-400'>
              Download next tracks for seamless playback
            </Text>
          </View>
          <Switch value={settings.preloadNextTrack} onValueChange={handlePreloadToggle} />
        </View>
      </View>

      {/* Fallback Settings */}
      <View className='space-y-2'>
        <View className='flex-row justify-between items-center'>
          <View className='flex-1'>
            <Text className='text-base font-semibold text-gray-800 dark:text-gray-200'>
              Quality Fallback
            </Text>
            <Text className='text-sm text-gray-600 dark:text-gray-400'>
              Use lower quality if preferred quality is unavailable
            </Text>
          </View>
          <Switch value={settings.fallbackEnabled} onValueChange={handleFallbackToggle} />
        </View>
      </View>

      {/* Cache Stats */}
      <View className='space-y-2 p-3 bg-gray-100 dark:bg-gray-800 rounded-lg'>
        <Text className='text-base font-semibold text-gray-800 dark:text-gray-200'>
          Cache Statistics
        </Text>
        <View className='space-y-1'>
          <Text className='text-sm text-gray-600 dark:text-gray-400'>
            Cached Tracks: {stats.totalCachedTracks}
          </Text>
          <Text className='text-sm text-gray-600 dark:text-gray-400'>
            Network: {stats.networkConnected ? 'Connected' : 'Offline'}
            {stats.networkType && ` (${stats.networkType})`}
          </Text>
        </View>
        <Button variant='outline' onPress={clearCache} className='mt-2'>
          <Text className='text-red-600 dark:text-red-400'>Clear Cache</Text>
        </Button>
      </View>
    </View>
  );
};

export default StreamingSettings;
