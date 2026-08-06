module.exports = ({ config }) => {
  const variant = process.env.APP_VARIANT || 'development';
  const isDev = variant === 'development';
  const isPreview = variant === 'preview';

  const getAppName = () => {
    if (isDev) return 'SyncVibe (Dev)';
    if (isPreview) return 'SyncVibe (Preview)';
    return 'SyncVibe';
  };

  const getAppId = () => {
    if (isDev) return 'com.thakurdotdev.syncvibe.dev';
    if (isPreview) return 'com.thakurdotdev.syncvibe.preview';
    return 'com.thakurdotdev.syncvibe';
  };

  const getScheme = () => {
    if (isDev) return 'syncvibe-dev';
    if (isPreview) return 'syncvibe-preview';
    return 'syncvibe';
  };

  return {
    ...config,
    name: getAppName(),
    scheme: getScheme(),
    ios: {
      ...config.ios,
      bundleIdentifier: getAppId(),
    },
    android: {
      ...config.android,
      package: getAppId(),
      intentFilters: [
        {
          action: 'VIEW',
          autoVerify: true,
          data: [
            {
              scheme: getScheme(),
            },
          ],
          category: ['BROWSABLE', 'DEFAULT'],
        },
      ],
    },
  };
};
